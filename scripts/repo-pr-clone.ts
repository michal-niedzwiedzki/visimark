/**
 * Clones a repo into a ref-named cache directory and runs the same
 * `infer`/`check` scan `repo-scan.ts` does, consulting and updating the
 * manifest (`repo-pr-manifest.ts`) along the way. Extracted so `repo-scan.ts`
 * (behind `--keep`) and `repo-pr.ts` share one implementation of "clone this
 * repo, but only once per commit, and only keep it when there's something to
 * act on" instead of drifting apart as two copies.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { cmdCheck, cmdInfer, type Writer } from "../packages/visimark/src/cli/commands.js";
import { run } from "./proc-run.js";
import {
  cacheDirName,
  isAlreadyScanned,
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
  parseRepoArg,
  relativizePaths,
  type ScanReport,
} from "./repo-scan-lib.js";

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
  | { status: "scanned"; report: ScanReport; workdir: string; kept: boolean };

export function ensureClone(opts: EnsureCloneOptions): EnsureCloneResult {
  const cacheRoot = opts.cacheRoot ?? defaultCacheRoot();
  const force = opts.force ?? false;

  const resolved = parseRepoArg(opts.repoArg);
  if ("error" in resolved) return { status: "error", message: resolved.error };
  const { cloneUrl, label } = resolved;

  const lsRemote = run(["git", "ls-remote", cloneUrl, opts.branch ?? "HEAD"], process.cwd());
  const [sha] = lsRemote.stdout.split(/\s+/);
  if (!lsRemote.ok || !sha) {
    return {
      status: "error",
      message: `could not resolve remote ref: ${lsRemote.stderr || lsRemote.stdout}`,
    };
  }

  const manifest = loadManifest(cacheRoot);
  if (!force && isAlreadyScanned(manifest, label, sha)) {
    return { status: "already-scanned", repo: label, entry: manifest.repos[label]! };
  }
  // Narrowed once, here, since a nested function declared below (`finish`)
  // doesn't retain the `!sha` guard's narrowing across the closure boundary.
  const resolvedSha: string = sha;

  const workdir = join(cacheRoot, "clones", cacheDirName(label, resolvedSha));
  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(dirname(workdir), { recursive: true });

  function finish(report: ScanReport): EnsureCloneResult {
    const kept = hasUsefulFindings(report);
    if (!kept) rmSync(workdir, { recursive: true, force: true });
    saveManifest(
      cacheRoot,
      upsertEntry(manifest, {
        repo: label,
        cloneUrl,
        ref: report.ref ?? resolvedSha,
        scannedAt: new Date().toISOString(),
        hasFindings: kept,
        ...(kept ? { workdir } : {}),
      }),
    );
    return { status: "scanned", report, workdir, kept };
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
    return finish({
      command: "repo-scan",
      repo: label,
      cloneUrl,
      ref,
      skipped: true,
      skipReason: "repo already runs the visimark action (pass --force to scan anyway)",
      markdownFiles: 0,
    });
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
    // paths are reported relative to the repo, not the clone that may be
    // deleted (no findings) once this call returns.
    relativizePaths(report.infer, workdir);
    relativizePaths(report.check, workdir);
    report.disagreements = extractDisagreements(report.infer);
  }

  return finish(report);
}
