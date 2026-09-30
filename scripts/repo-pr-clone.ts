/**
 * Clones a repo into a ref-named cache directory and runs the same
 * `infer`/`check` scan `repo-scan.ts` does, consulting and updating the
 * manifest (`repo-pr-manifest.ts`) along the way. Extracted so `repo-scan.ts`
 * (behind `--keep`) and `repo-pr.ts` share one implementation of "clone this
 * repo, but only once per commit, and only keep it when there's something to
 * act on" instead of drifting apart as two copies.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { cmdCheck, cmdInfer, type Writer } from "../packages/visimark/src/cli/commands.js";
import { listTrackedFiles, run } from "./proc-run.js";
import {
  cacheDirName,
  isAlreadyScanned,
  manifestKey,
  parseManifest,
  serializeManifest,
  upsertEntry,
  type Manifest,
  type ManifestEntry,
} from "./repo-pr-manifest.js";
import {
  excludeDotPaths,
  extractDisagreements,
  hasUsefulFindings,
  hasVisimarkAction,
  hostOf,
  parseRepoArg,
  relativizePaths,
  type ScanReport,
} from "./repo-scan-lib.js";

/** The local branch `repo-pr.ts` commits its generated changes to — shared
 * here (rather than each file defining its own copy) because `ensureClone`
 * needs to recognize it too, to avoid deleting one on a forced rescan. */
export const WORK_BRANCH = "visimark-check";

/** Whether `workdir` holds anything a forced rescan would destroy: a
 * `WORK_BRANCH` from a prior `repo:pr` run (with its commit), or uncommitted
 * changes. `--force` promises a rescan, not silent deletion of local work —
 * without this, `repo:pr` followed by `repo:scan --force`/`repo:pr --force`
 * at the same remote SHA would `rm -rf` the branch and commit the first run
 * just made. */
export function hasLocalWork(workdir: string): boolean {
  if (!existsSync(workdir)) return false; // nothing cloned here (yet) to preserve
  if (run(["git", "rev-parse", "--verify", "--quiet", `refs/heads/${WORK_BRANCH}`], workdir).ok) {
    return true;
  }
  const status = run(["git", "status", "--porcelain"], workdir);
  return status.ok && status.stdout.length > 0;
}

/** Overridable so tests and smoke runs don't touch the real user cache. */
export function defaultCacheRoot(): string {
  return process.env.VISIMARK_REPO_PR_HOME ?? join(homedir(), ".cache", "visimark", "repo-pr");
}

function manifestPath(cacheRoot: string): string {
  return join(cacheRoot, "manifest.json");
}

export function loadManifest(cacheRoot: string): Manifest {
  try {
    return parseManifest(readFileSync(manifestPath(cacheRoot), "utf8"));
  } catch {
    return parseManifest(undefined);
  }
}

function saveManifest(cacheRoot: string, manifest: Manifest): void {
  mkdirSync(cacheRoot, { recursive: true });
  writeFileSync(manifestPath(cacheRoot), serializeManifest(manifest));
}

export function collectJson(
  cmd: (args: string[], out: Writer, err: Writer) => number,
  files: string[],
): Record<string, unknown> {
  let captured = "";
  cmd(
    [...files, "--json"],
    (l) => (captured += l),
    () => {},
  );
  return JSON.parse(captured);
}

export interface EnsureCloneOptions {
  repoArg: string;
  branch?: string;
  /** Rescans even when the manifest already has this exact repo+ref, and
   * scans a repo the manifest would otherwise skip for already running the
   * VisiMark action. */
  force?: boolean;
  cacheRoot?: string;
}

export type EnsureCloneResult =
  | { status: "error"; message: string }
  | { status: "already-scanned"; repo: string; entry: ManifestEntry }
  | {
      status: "scanned";
      report: ScanReport;
      workdir: string;
      kept: boolean;
      defaultBranch: string;
    };

export function ensureClone(opts: EnsureCloneOptions): EnsureCloneResult {
  const cacheRoot = opts.cacheRoot ?? defaultCacheRoot();
  const force = opts.force ?? false;

  const resolved = parseRepoArg(opts.repoArg);
  if ("error" in resolved) return { status: "error", message: resolved.error };
  const { cloneUrl, label } = resolved;
  const host = hostOf(cloneUrl);

  const lsRemote = run(["git", "ls-remote", cloneUrl, opts.branch ?? "HEAD"], process.cwd());
  const [sha] = lsRemote.stdout.split(/\s+/);
  if (!lsRemote.ok || !sha) {
    return {
      status: "error",
      message: `could not resolve remote ref: ${lsRemote.stderr || lsRemote.stdout}`,
    };
  }

  const manifest = loadManifest(cacheRoot);
  if (!force && isAlreadyScanned(manifest, host, label, sha)) {
    return {
      status: "already-scanned",
      repo: label,
      entry: manifest.repos[manifestKey(host, label)]!,
    };
  }
  // Narrowed once, here, since a nested function declared below (`finish`)
  // doesn't retain the `!sha` guard's narrowing across the closure boundary.
  const resolvedSha: string = sha;

  const workdir = join(cacheRoot, "clones", cacheDirName(host, label, resolvedSha));
  // `--force` promises a rescan, not deletion of a prior `repo:pr` run's
  // unpushed branch or uncommitted edits — see `hasLocalWork`.
  if (hasLocalWork(workdir)) {
    return {
      status: "error",
      message: `${workdir} has local work (a ${WORK_BRANCH} branch or uncommitted changes) from a previous run — remove it manually if you want to redo this scan`,
    };
  }
  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(dirname(workdir), { recursive: true });

  function finish(report: ScanReport, defaultBranch: string): EnsureCloneResult {
    const kept = hasUsefulFindings(report);
    if (!kept) rmSync(workdir, { recursive: true, force: true });
    saveManifest(
      cacheRoot,
      upsertEntry(manifest, {
        host,
        repo: label,
        cloneUrl,
        ref: report.ref ?? resolvedSha,
        defaultBranch,
        scannedAt: new Date().toISOString(),
        hasFindings: kept,
        ...(kept ? { workdir } : {}),
      }),
    );
    return { status: "scanned", report, workdir, kept, defaultBranch };
  }

  const cloneArgs = ["git", "clone", "--depth", "1", "--quiet"];
  if (opts.branch) cloneArgs.push("--branch", opts.branch);
  cloneArgs.push(cloneUrl, workdir);
  const clone = run(cloneArgs, process.cwd());
  if (!clone.ok) {
    rmSync(workdir, { recursive: true, force: true });
    return { status: "error", message: `clone failed: ${clone.stderr || clone.stdout}` };
  }

  const revParse = run(["git", "rev-parse", "HEAD"], workdir);
  const ref = revParse.ok ? revParse.stdout : resolvedSha;
  // Captured right here, right after cloning and before anything (this
  // function or `repo-pr.ts`) checks the work branch out — the only moment
  // this checkout can be trusted to reflect the repo's real default branch,
  // not whatever `repo:pr` later switches it to. Re-deriving it later, from
  // a clone reused across runs, would read back `WORK_BRANCH` instead.
  const branchResult = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], workdir);
  const defaultBranch = branchResult.ok ? branchResult.stdout : (opts.branch ?? "main");

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
    return finish(
      {
        command: "repo-scan",
        repo: label,
        cloneUrl,
        ref,
        skipped: true,
        skipReason: "repo already runs the visimark action (pass --force to scan anyway)",
        markdownFiles: 0,
      },
      defaultBranch,
    );
  }

  const relFiles = excludeDotPaths(listTrackedFiles(workdir, ["*.md", "*.markdown"]));
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
    // paths are reported relative to the repo, not the clone that may be
    // deleted (no findings) once this call returns.
    relativizePaths(report.infer, workdir);
    relativizePaths(report.check, workdir);
    report.disagreements = extractDisagreements(report.infer);
  }

  return finish(report, defaultBranch);
}
