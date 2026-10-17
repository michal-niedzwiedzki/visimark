/**
 * Investigates a repository's Markdown for wrong numbers: a Total row that
 * does not add up, a line total that is not quantity × price, a value its
 * `vmark` rule no longer computes. The judging is the investigation core
 * (`packages/visimark-investigate`), the same code the homepage's "Scan your
 * repo" widget runs; this file only clones, reads and prints. Spec:
 * docs/design/one-investigation-core-behind-repo-spec.md.
 *
 * A remote repo is cloned into the cache `repo:pr` uses and kept there only
 * when the report is actionable. A local path (`/`, `./`, `../`) is read in
 * place. Exit 0 when nothing is confirmed, 1 when something is, 2 on a usage
 * error or a failure.
 *
 * Usage: `bun run repo:investigate <owner/repo|git-url|./path> [--branch NAME] [--force] [--json]`
 */
import { existsSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  findingLines,
  parseRepoArg,
  summaryLines,
  type Report,
} from "../packages/visimark-investigate/src/index.js";
import { run } from "./proc-run.js";
import {
  defaultCacheRoot,
  investigateWorkdir,
  prepareClone,
  recordClone,
} from "./repo-pr-clone.js";

const USAGE =
  "Usage: bun run repo:investigate <owner/repo|git-url|./path> [--branch NAME] [--force] [--json]";
const LOCAL = /^(\/|\.\/|\.\.\/)/;

function fail(message: string | null, withUsage: boolean): never {
  if (message) console.error(`repo-investigate: ${message}`);
  if (withUsage) console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv: string[]): {
  target: string;
  branch?: string;
  force: boolean;
  json: boolean;
} {
  let target: string | undefined;
  let branch: string | undefined;
  let force = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--branch") {
      branch = argv[++i];
      if (branch === undefined || branch.startsWith("--")) fail("--branch needs a value", true);
    } else if (a === "--force") force = true;
    else if (a === "--json") json = true;
    else if (a.startsWith("--")) fail(`unknown option ${a}`, true);
    else if (target === undefined) target = a;
    else fail(`unexpected argument ${a}`, true);
  }
  if (target === undefined) fail(null, true);
  return { target, branch, force, json };
}

function print(report: Report, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const out = [
    `repo-investigate: ${report.repo.label} at ${report.repo.commit.slice(0, 12)}, ${report.files.read} Markdown files`,
    ...summaryLines(report),
    ...report.files.skipped.map((s) => `skipped: ${s.path} (${s.reason})`),
  ];
  for (const f of report.findings) out.push("", ...findingLines(f, "cli"));
  console.log(out.join("\n"));
}

const { target, branch, force, json } = parseArgs(process.argv.slice(2));

let report: Report;
if (LOCAL.test(target)) {
  if (branch !== undefined || force)
    fail("--branch and --force do not apply to a local path", true);
  const dir = resolve(target);
  const top =
    existsSync(dir) && statSync(dir).isDirectory()
      ? run(["git", "rev-parse", "--show-toplevel"], dir)
      : null;
  if (!top?.ok || !top.stdout) fail(`not a git work tree: ${target}`, false);
  const head = run(["git", "rev-parse", "HEAD"], top.stdout);
  if (!head.ok) fail(`could not read HEAD: ${head.stderr}`, false);
  report = investigateWorkdir(top.stdout, {
    label: basename(top.stdout),
    host: null,
    commit: head.stdout,
    clonePath: top.stdout,
  });
} else {
  if ("error" in parseRepoArg(target)) {
    fail(
      `not a recognized repo (want \`owner/repo\`, a git URL, or a path starting with / ./ ../): ${target}`,
      false,
    );
  }
  const cacheRoot = defaultCacheRoot();
  const clone = prepareClone({ repoArg: target, branch, force, cacheRoot, onLocalWork: "reuse" });
  if (clone.status === "error") fail(clone.message, false);
  if (clone.reusedLocalWork) {
    console.error(
      `note: ${clone.workdir} has local work from repo:pr; reusing it, manifest left alone`,
    );
  }
  report = investigateWorkdir(clone.workdir, {
    label: clone.label,
    host: clone.host,
    commit: clone.sha,
    clonePath: clone.workdir,
  });
  const kept = clone.reusedLocalWork || recordClone(cacheRoot, clone, report);
  if (!kept) report.clonePath = null;
  console.error(
    kept ? `note: clone kept at ${clone.workdir}` : "note: nothing actionable; clone removed",
  );
}

print(report, json);
process.exit(report.accuracy.confirmed > 0 ? 1 : 0);
