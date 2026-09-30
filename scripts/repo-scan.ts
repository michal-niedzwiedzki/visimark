/**
 * Clones a GitHub repo shallowly, finds its tracked Markdown files, and runs
 * `visimark infer` and `visimark check` over all of them — a mass scan to
 * find out, before touching anything, whether VisiMark would catch problems
 * in a repo that doesn't have it yet.
 *
 * Skips repos that already run the VisiMark action (nothing to demonstrate)
 * unless --force. By default this is scan-only: it reports what it found and
 * cleans up its clone. Turning the report into a PR (clone, add vmark rules,
 * open a pull request) is a separate, later step (`repo:pr`) — but that step
 * needs the clone to still exist, which is what --keep is for.
 *
 * --keep delegates to `repo-pr-clone.ts`'s `ensureClone`, which persists the
 * clone into a cache directory named after the repo and its commit instead
 * of a temp dir that gets deleted on exit — but only when the scan actually
 * found something (`hasUsefulFindings`); a clean repo has nothing for
 * `repo:pr` to act on, so its clone is deleted like an ordinary scan. A
 * manifest file alongside the cache records, per repo, the last ref scanned
 * — --keep skips re-cloning and re-scanning a repo already recorded at its
 * current HEAD (pass --force to redo it anyway), so re-running this over the
 * same repo list doesn't repeat work or re-contact repos whose content
 * hasn't moved.
 *
 * Text mode always lists the files with findings or proposals; --explain
 * expands each into every finding and proposal it has, not just the count.
 *
 * Usage: `bun run repo:scan <owner/repo|git-url> [--branch NAME] [--force] [--explain] [--json] [--keep]`
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdCheck, cmdInfer } from "../packages/visimark/src/cli/commands.js";
import { run } from "./proc-run.js";
import { collectJson, ensureClone } from "./repo-pr-clone.js";
import {
  excludeDotPaths,
  extractDisagreements,
  formatDisagreements,
  formatExplain,
  formatFiles,
  formatSummary,
  hasVisimarkAction,
  noColor,
  parseRepoArg,
  relativizePaths,
  type Palette,
  type ScanReport,
} from "./repo-scan-lib.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function usage(): never {
  console.error(
    "Usage: bun run repo:scan <owner/repo|git-url> [--branch NAME] [--force] [--explain] [--json] [--keep]",
  );
  process.exit(2);
}

function parseArgs(argv: string[]): {
  repo?: string;
  branch?: string;
  force: boolean;
  explain: boolean;
  json: boolean;
  keep: boolean;
} {
  let repo: string | undefined;
  let branch: string | undefined;
  let force = false;
  let explain = false;
  let json = false;
  let keep = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--branch") {
      branch = argv[++i];
    } else if (a === "--force") {
      force = true;
    } else if (a === "--explain") {
      explain = true;
    } else if (a === "--json") {
      json = true;
    } else if (a === "--keep") {
      keep = true;
    } else if (!a.startsWith("--") && repo === undefined) {
      repo = a;
    } else {
      usage();
    }
  }
  return { repo, branch, force, explain, json, keep };
}

const { repo: repoArg, branch, force, explain, json, keep } = parseArgs(process.argv.slice(2));
if (!repoArg) usage();

// Not under --json: that output is for machines, and ANSI codes in the
// middle of a JSON string would corrupt it. Otherwise gated on both an
// actual terminal and NO_COLOR, the two conventions a piped/redirected run
// (e.g. into a log file, or the next step's agent) relies on to get plain text.
const colorEnabled = !json && process.stdout.isTTY === true && !process.env.NO_COLOR;
const palette: Palette = colorEnabled
  ? {
      finding: (s) => `\x1b[34m${s}\x1b[0m`, // blue
      proposal: (s) => `\x1b[35m${s}\x1b[0m`, // purple
      disagreement: (s) => `\x1b[31m${s}\x1b[0m`, // red
    }
  : noColor;

function printReport(report: ScanReport): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const line of formatSummary(report)) console.log(line);
  const fileLines = explain ? formatExplain(report, palette) : formatFiles(report, palette);
  for (const line of fileLines) console.log(line);
  for (const line of formatDisagreements(report, palette)) console.log(line);
}

if (keep) {
  const result = ensureClone({ repoArg, branch, force });
  if (result.status === "error") {
    console.error(`repo-scan: ${result.message}`);
    process.exit(2);
  }
  if (result.status === "already-scanned") {
    const entry = result.entry;
    console.log(
      `repo-scan: ${result.repo} already scanned at ${entry.ref} on ${entry.scannedAt} ` +
        `(hasFindings: ${entry.hasFindings}${entry.workdir ? `, workdir: ${entry.workdir}` : ""}) ` +
        `— pass --force to rescan`,
    );
    process.exit(0);
  }
  printReport(result.report);
  const status = (result.report.check as { status?: string } | undefined)?.status;
  process.exit(status === "problems" ? 1 : 0);
}

const resolved = parseRepoArg(repoArg);
if ("error" in resolved) {
  console.error(`repo-scan: ${resolved.error}`);
  process.exit(2);
}
const { cloneUrl, label } = resolved;

const workdir = mkdtempSync(join(tmpdir(), "visimark-repo-scan-"));
let exitCode = 0;

try {
  const cloneArgs = ["git", "clone", "--depth", "1", "--quiet"];
  if (branch) cloneArgs.push("--branch", branch);
  cloneArgs.push(cloneUrl, workdir);
  const clone = run(cloneArgs, ROOT);
  if (!clone.ok) {
    console.error(`repo-scan: clone failed: ${clone.stderr || clone.stdout}`);
    process.exit(2);
  }

  const revParse = run(["git", "rev-parse", "HEAD"], workdir);
  const ref = revParse.ok ? revParse.stdout : null;

  const workflowsDir = join(workdir, ".github", "workflows");
  let workflows: string[] = [];
  try {
    workflows = readdirSync(workflowsDir, { withFileTypes: true })
      .filter((e) => e.isFile() && (e.name.endsWith(".yml") || e.name.endsWith(".yaml")))
      .map((e) => readFileSync(join(workflowsDir, e.name), "utf8"));
  } catch {
    workflows = [];
  }

  if (!force && hasVisimarkAction(workflows)) {
    const report: ScanReport = {
      command: "repo-scan",
      repo: label,
      cloneUrl,
      ref,
      skipped: true,
      skipReason: "repo already runs the visimark action (pass --force to scan anyway)",
      markdownFiles: 0,
    };
    printReport(report);
    process.exit(0);
  }

  const lsFiles = run(["git", "ls-files", "*.md", "*.markdown"], workdir);
  const relFiles = excludeDotPaths(lsFiles.stdout.length > 0 ? lsFiles.stdout.split("\n") : []);
  const absFiles = relFiles.map((f) => join(workdir, f));

  const report: ScanReport = {
    command: "repo-scan",
    repo: label,
    cloneUrl,
    ref,
    skipped: false,
    markdownFiles: absFiles.length,
  };

  if (absFiles.length > 0) {
    report.infer = collectJson(cmdInfer, absFiles) as ScanReport["infer"];
    report.check = collectJson(cmdCheck, absFiles) as ScanReport["check"];
    // paths are reported relative to the repo, not the temp clone that
    // disappears when this process exits.
    relativizePaths(report.infer, workdir);
    relativizePaths(report.check, workdir);
    report.disagreements = extractDisagreements(report.infer);
    if ((report.check as { status?: string } | undefined)?.status === "problems") exitCode = 1;
  }

  printReport(report);
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

process.exit(exitCode);
