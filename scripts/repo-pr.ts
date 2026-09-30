/**
 * Turns a `repo-scan --keep`-worthy repo into a reviewable local branch: it
 * reuses (or creates) the persisted clone from `repo-pr-clone.ts`'s
 * `ensureClone`, installs the VisiMark GitHub Action, runs `infer --write`
 * then `check` then `fmt` over the repo's tracked Markdown, commits the
 * result on a new local branch, and writes a PR description draft next to
 * the clone.
 *
 * It never pushes and never opens a PR — review, push, and opening the PR
 * are left to whoever runs this. The commit note says so explicitly.
 *
 * Usage: `bun run repo:pr <owner/repo|git-url> [--branch NAME] [--force]`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdCheck, cmdFmt, cmdInfer, type Writer } from "../packages/visimark/src/cli/commands.js";
import { run } from "./proc-run.js";
import { defaultCacheRoot, ensureClone } from "./repo-pr-clone.js";
import { excludeDotPaths, type JsonSummaryLike } from "./repo-scan-lib.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORK_BRANCH = "visimark-check";

function usage(): never {
  console.error("Usage: bun run repo:pr <owner/repo|git-url> [--branch NAME] [--force]");
  process.exit(2);
}

function parseArgs(argv: string[]): { repo?: string; branch?: string; force: boolean } {
  let repo: string | undefined;
  let branch: string | undefined;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--branch") branch = argv[++i];
    else if (a === "--force") force = true;
    else if (!a.startsWith("--") && repo === undefined) repo = a;
    else usage();
  }
  return { repo, branch, force };
}

const { repo: repoArg, branch, force } = parseArgs(process.argv.slice(2));
if (!repoArg) usage();

function runJson(
  cmd: (args: string[], out: Writer, err: Writer) => number,
  extraFlags: string[],
  files: string[],
): Record<string, unknown> {
  let captured = "";
  cmd(
    [...files, ...extraFlags, "--json"],
    (l) => (captured += l),
    () => {},
  );
  return JSON.parse(captured);
}

/** The tag the target repo's new workflow pins — the latest release this
 * repo has actually published, not `packages/visimark/package.json`'s
 * version, which can be ahead of the last tag during development. */
function latestVisimarkTag(): string {
  const tags = run(["git", "tag", "--list", "v*", "--sort=-v:refname"], ROOT);
  const [latest] = tags.stdout.split("\n");
  if (!tags.ok || !latest) {
    console.error("repo-pr: could not determine the latest visimark release tag");
    process.exit(2);
  }
  return latest;
}

function workflowYaml(defaultBranch: string, actionTag: string): string {
  return `name: visimark

on:
  push:
    branches: [${defaultBranch}]
  pull_request:

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: michal-niedzwiedzki/visimark@${actionTag}
`;
}

// --- 1. get a clone with something to act on ------------------------------

const clone = ensureClone({ repoArg, branch, force });
if (clone.status === "error") {
  console.error(`repo-pr: ${clone.message}`);
  process.exit(2);
}

let repoLabel: string;
let workdir: string;
if (clone.status === "already-scanned") {
  if (!clone.entry.hasFindings || !clone.entry.workdir) {
    console.log(
      `repo-pr: ${clone.repo} has nothing to act on (scanned, no findings) — nothing to do`,
    );
    process.exit(0);
  }
  repoLabel = clone.repo;
  workdir = clone.entry.workdir;
} else {
  if (!clone.kept) {
    console.log(
      `repo-pr: ${clone.report.repo} has nothing to act on (no findings) — nothing to do`,
    );
    process.exit(0);
  }
  repoLabel = clone.report.repo;
  workdir = clone.workdir;
}

console.log(`repo-pr: working in ${workdir}`);

// --- 2. install the workflow ------------------------------------------------

const defaultBranchResult = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], workdir);
const defaultBranch = defaultBranchResult.ok ? defaultBranchResult.stdout : "main";

const checkout = run(["git", "checkout", "-B", WORK_BRANCH], workdir);
if (!checkout.ok) {
  console.error(`repo-pr: could not create branch ${WORK_BRANCH}: ${checkout.stderr}`);
  process.exit(2);
}

const actionTag = latestVisimarkTag();
const workflowsDir = join(workdir, ".github", "workflows");
mkdirSync(workflowsDir, { recursive: true });
writeFileSync(join(workflowsDir, "visimark.yml"), workflowYaml(defaultBranch, actionTag));

// --- 3-5. infer --write, check, fmt ----------------------------------------

const lsFiles = run(["git", "ls-files", "*.md", "*.markdown"], workdir);
const relFiles = excludeDotPaths(lsFiles.stdout.length > 0 ? lsFiles.stdout.split("\n") : []);
const absFiles = relFiles.map((f) => join(workdir, f));

// The repo's own state, before any of this tool's changes — the baseline
// the commit note and PR draft compare against. `ensureClone`'s report
// isn't reused here: the "already-scanned" reuse path doesn't carry one.
const checkBefore = absFiles.length
  ? (runJson(cmdCheck, [], absFiles) as { summary: JsonSummaryLike })
  : { summary: { files: 0, problems: 0, stale: 0, errors: 0 } };

const inferResult = absFiles.length
  ? (runJson(cmdInfer, ["--write"], absFiles) as { summary: JsonSummaryLike })
  : { summary: { files: 0, rules: 0, scalars: 0, anchors: 0 } };

const fmtResult = absFiles.length
  ? (runJson(cmdFmt, [], absFiles) as {
      summary: {
        filesChanged: number;
        cellsUpdated: number;
        anchorsUpdated: number;
        datesFixed: number;
      };
    })
  : { summary: { filesChanged: 0, cellsUpdated: 0, anchorsUpdated: 0, datesFixed: 0 } };

const checkFinal = absFiles.length
  ? (runJson(cmdCheck, [], absFiles) as { summary: JsonSummaryLike })
  : { summary: { files: 0, problems: 0, stale: 0, errors: 0 } };

// --- 6. commit --------------------------------------------------------------

run(["git", "add", "-A"], workdir);
const status = run(["git", "status", "--porcelain"], workdir);

const summaryLines = [
  "Add VisiMark check and annotate arithmetic with vmark rules",
  "",
  `- Installed .github/workflows/visimark.yml (visimark@${actionTag} on push/PR)`,
  `- infer --write: ${inferResult.summary.rules} rule(s), ${inferResult.summary.scalars} scalar(s), ${inferResult.summary.anchors} anchor(s) across ${inferResult.summary.files} file(s)`,
  `- fmt: ${fmtResult.summary.filesChanged} file(s) changed, ${fmtResult.summary.cellsUpdated} cell(s), ${fmtResult.summary.anchorsUpdated} anchor(s), ${fmtResult.summary.datesFixed} date(s) corrected`,
  `- check: ${checkBefore.summary.problems} problem(s)/${checkBefore.summary.errors} error(s) before, ${checkFinal.summary.problems} problem(s)/${checkFinal.summary.errors} error(s) after`,
  "",
  "Generated by `bun run repo:pr` (VisiMark) — not reviewed by a human yet.",
];
const commitMessage = summaryLines.join("\n");

if (status.stdout.trim().length === 0) {
  console.log("repo-pr: nothing changed after infer/check/fmt — no commit made");
} else {
  const commit = run(["git", "commit", "-m", commitMessage], workdir);
  if (!commit.ok) {
    console.error(`repo-pr: commit failed: ${commit.stderr || commit.stdout}`);
    process.exit(2);
  }
  console.log(`repo-pr: committed on branch ${WORK_BRANCH}`);
}

// --- 7. PR draft --------------------------------------------------------------

const draftDir = join(defaultCacheRoot(), "pr-drafts");
mkdirSync(draftDir, { recursive: true });
const draftPath = join(draftDir, `${repoLabel.replace(/\//g, "-")}.md`);

const prBody = [
  "## Summary",
  "",
  `- Add \`.github/workflows/visimark.yml\` so future pull requests verify arithmetic in Markdown automatically.`,
  `- Run \`visimark infer --write\` to annotate existing tables/scalars with the vmark rules they already imply.`,
  `- Run \`visimark fmt\` to correct anything that had drifted.`,
  "",
  "## Before/after `visimark check`",
  "",
  `Before: ${checkBefore.summary.problems} problem(s), ${checkBefore.summary.errors} error(s)`,
  `After: ${checkFinal.summary.problems} problem(s), ${checkFinal.summary.errors} error(s)`,
  "",
  "---",
  "",
  `_Draft generated by \`bun run repo:pr\` — not opened as a PR. Review the diff in \`${workdir}\` (branch \`${WORK_BRANCH}\`) before pushing._`,
].join("\n");

writeFileSync(draftPath, `# Add VisiMark check\n\n${prBody}\n`);

console.log(`repo-pr: PR draft written to ${draftPath}`);
console.log(`repo-pr: review with: git -C ${workdir} log -p -1`);
