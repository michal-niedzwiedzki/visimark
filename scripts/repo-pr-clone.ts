/**
 * Clones a repo into a ref-named cache directory, runs the investigation core
 * (`packages/visimark-investigate`) over it, and records the result in the
 * manifest (`repo-pr-manifest.ts`). `repo:investigate` and `repo:pr` both
 * use it, so "clone this repo, but only once per commit, and only keep it
 * when there's something to act on" has one implementation, and the verdict
 * that decides "something to act on" is the same one the widget reaches.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import * as engine from "../packages/visimark/src/browser.js";
import { readVersion } from "../packages/visimark/src/cli/version.js";
import {
  hostOf,
  importTargets,
  investigate,
  looksGenerated,
  parseRepoArg,
  selectFiles,
  type Report,
  type Skipped,
} from "../packages/visimark-investigate/src/index.js";
import { isConfined } from "./fs-guard.js";
import { run } from "./proc-run.js";
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

/** The local branch `repo-pr.ts` commits its generated changes to — shared
 * here (rather than each file defining its own copy) because `ensureClone`
 * needs to recognize it too, to avoid deleting one on a forced rescan. */
export const WORK_BRANCH = "visimark-check";

/** Whether `workdir` holds anything a forced rescan would destroy: a
 * `WORK_BRANCH` from a prior `repo:pr` run (with its commit), or uncommitted
 * changes. `--force` promises a rescan, not silent deletion of local work —
 * without this, `repo:pr` followed by `repo:investigate --force`/`repo:pr --force`
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

export function saveManifest(cacheRoot: string, manifest: Manifest): void {
  mkdirSync(cacheRoot, { recursive: true });
  writeFileSync(manifestPath(cacheRoot), serializeManifest(manifest));
}

/** Worth keeping a clone for: anything confirmed, any lead, anything `infer` can write (spec §2.3). */
export function actionable(report: Report): boolean {
  return (
    report.accuracy.confirmed > 0 ||
    report.accuracy.leads > 0 ||
    report.adoption.inferable > 0 ||
    report.adoption.inferableAfterFix > 0
  );
}

export interface PreparedClone {
  status: "ready";
  host: string;
  label: string;
  cloneUrl: string;
  sha: string;
  workdir: string;
  defaultBranch: string;
  /** the clone holds a `repo:pr` branch or uncommitted edits and was reused as it is */
  reusedLocalWork: boolean;
}

/**
 * The repo cloned at its remote `HEAD` (or `branch`) into the cache, or an
 * existing clone of that same commit reused. `force` clones again — except
 * over local work, which `onLocalWork` either refuses or reuses.
 */
export function prepareClone(opts: {
  repoArg: string;
  branch?: string;
  force?: boolean;
  cacheRoot?: string;
  onLocalWork: "error" | "reuse";
}): { status: "error"; message: string } | PreparedClone {
  const cacheRoot = opts.cacheRoot ?? defaultCacheRoot();
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

  const workdir = join(cacheRoot, "clones", cacheDirName(host, label, sha));
  const ready = (defaultBranch: string, reusedLocalWork: boolean): PreparedClone => ({
    status: "ready",
    host,
    label,
    cloneUrl,
    sha,
    workdir,
    defaultBranch,
    reusedLocalWork,
  });
  // From the manifest when the clone is reused: a reused clone may have a
  // `repo:pr` work branch checked out, so `rev-parse --abbrev-ref HEAD` would
  // read that back instead of the repo's real default branch.
  const knownBranch = () =>
    loadManifest(cacheRoot).repos[manifestKey(host, label)]?.defaultBranch ??
    (run(["git", "rev-parse", "--abbrev-ref", "HEAD"], workdir).stdout || (opts.branch ?? "main"));

  if (hasLocalWork(workdir)) {
    if (opts.onLocalWork === "error") {
      return {
        status: "error",
        message: `${workdir} has local work (a ${WORK_BRANCH} branch or uncommitted changes) from a previous run — remove it manually if you want to redo this scan`,
      };
    }
    return ready(knownBranch(), true);
  }
  if (existsSync(workdir) && !opts.force) return ready(knownBranch(), false);

  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(dirname(workdir), { recursive: true });
  const cloneArgs = ["git", "clone", "--depth", "1", "--quiet"];
  if (opts.branch) cloneArgs.push("--branch", opts.branch);
  cloneArgs.push(cloneUrl, workdir);
  const clone = run(cloneArgs, process.cwd());
  if (!clone.ok) {
    rmSync(workdir, { recursive: true, force: true });
    return { status: "error", message: `clone failed: ${clone.stderr || clone.stdout}` };
  }
  // Captured right after cloning, before anything checks a work branch out.
  const branchResult = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], workdir);
  return ready(branchResult.ok ? branchResult.stdout : (opts.branch ?? "main"), false);
}

/** A regular file inside `workdir` — never a symlink, which could point anywhere on this machine. */
function readInside(workdir: string, rel: string): string | null {
  const abs = join(workdir, rel);
  try {
    if (!isConfined(workdir, abs) || !lstatSync(abs).isFile()) return null;
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * The CLI shell's half of an investigation: everything the core needs, read
 * from a work tree (spec §3.2) — the tracked paths with sizes, the Markdown
 * the policy keeps, its import targets, the workflows and the commit date.
 */
export function investigateWorkdir(
  workdir: string,
  meta: { label: string; host: string | null; commit: string; clonePath: string | null },
): Report {
  const listed = run(["git", "ls-files", "-z"], workdir);
  const paths: { path: string; size: number }[] = [];
  for (const path of listed.stdout.split("\0").filter(Boolean)) {
    try {
      const st = lstatSync(join(workdir, path));
      if (st.isFile()) paths.push({ path, size: st.size });
    } catch {
      // listed but missing from the work tree: nothing to read
    }
  }
  const { markdown, skipped } = selectFiles(paths);
  const texts = new Map<string, string>();
  const allSkipped: Skipped[] = [...skipped];
  for (const path of markdown) {
    const text = readInside(workdir, path);
    if (text === null) continue;
    if (looksGenerated(text)) allSkipped.push({ path, reason: "generated" });
    else texts.set(path, text);
  }
  for (const target of importTargets(texts, engine)) {
    const text = readInside(workdir, target);
    if (text !== null && !texts.has(target)) texts.set(target, text);
  }
  const workflowTexts = paths
    .filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p.path))
    .flatMap((p) => readInside(workdir, p.path) ?? []);
  const lastCommit = run(["git", "log", "-1", "--format=%cs"], workdir);
  return investigate(
    {
      repo: {
        label: meta.label,
        host: meta.host,
        commit: meta.commit,
        lastCommit: lastCommit.ok && lastCommit.stdout ? lastCommit.stdout : null,
      },
      engineVersion: readVersion(),
      paths,
      texts,
      skipped: allSkipped,
      workflowTexts,
      clonePath: meta.clonePath,
    },
    engine,
  );
}

/** Writes the manifest entry and deletes the clone unless the report is actionable. Returns whether it was kept. */
export function recordClone(cacheRoot: string, clone: PreparedClone, report: Report): boolean {
  const kept = actionable(report);
  if (!kept) rmSync(clone.workdir, { recursive: true, force: true });
  saveManifest(
    cacheRoot,
    upsertEntry(loadManifest(cacheRoot), {
      host: clone.host,
      repo: clone.label,
      cloneUrl: clone.cloneUrl,
      ref: clone.sha,
      defaultBranch: clone.defaultBranch,
      scannedAt: new Date().toISOString(),
      hasFindings: kept,
      ...(kept ? { workdir: clone.workdir } : {}),
    }),
  );
  return kept;
}

export interface EnsureCloneOptions {
  repoArg: string;
  branch?: string;
  /** Re-investigates even when the manifest already has this exact repo+ref. */
  force?: boolean;
  cacheRoot?: string;
}

export type EnsureCloneResult =
  | { status: "error"; message: string }
  | { status: "already-scanned"; repo: string; entry: ManifestEntry }
  | {
      status: "scanned";
      report: Report;
      workdir: string;
      kept: boolean;
      defaultBranch: string;
    };

/** `repo:pr`'s entry point: skip a repo+ref the manifest already has, else prepare, investigate and record. */
export function ensureClone(opts: EnsureCloneOptions): EnsureCloneResult {
  const cacheRoot = opts.cacheRoot ?? defaultCacheRoot();
  const resolved = parseRepoArg(opts.repoArg);
  if ("error" in resolved) return { status: "error", message: resolved.error };
  const host = hostOf(resolved.cloneUrl);
  const lsRemote = run(
    ["git", "ls-remote", resolved.cloneUrl, opts.branch ?? "HEAD"],
    process.cwd(),
  );
  const [sha] = lsRemote.stdout.split(/\s+/);
  const manifest = loadManifest(cacheRoot);
  if (lsRemote.ok && sha && !opts.force && isAlreadyScanned(manifest, host, resolved.label, sha)) {
    return {
      status: "already-scanned",
      repo: resolved.label,
      entry: manifest.repos[manifestKey(host, resolved.label)]!,
    };
  }
  const clone = prepareClone({ ...opts, cacheRoot, onLocalWork: "error" });
  if (clone.status === "error") return clone;
  const report = investigateWorkdir(clone.workdir, {
    label: clone.label,
    host: clone.host,
    commit: clone.sha,
    clonePath: clone.workdir,
  });
  const kept = recordClone(cacheRoot, clone, report);
  if (!kept) report.clonePath = null;
  return {
    status: "scanned",
    report,
    workdir: clone.workdir,
    kept,
    defaultBranch: clone.defaultBranch,
  };
}
