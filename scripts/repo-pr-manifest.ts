/**
 * Tracks which repos `repo-scan --keep` has already persisted a clone for,
 * so a later `repo:pr` run (or a re-run of `repo-scan --keep` itself) can
 * tell "already handled this exact commit" from "repo moved since we last
 * looked" without re-cloning or re-scanning to find out.
 *
 * Keyed by ref, not by wall-clock time: two scans of the same repo at the
 * same HEAD are the same unit of work, however far apart in time they run.
 * A cache directory named from the ref (`cacheDirName`) gets this for free —
 * re-scanning an unchanged repo lands on the same path instead of growing a
 * new one — and the manifest entry lets a caller skip the clone entirely
 * once it already has an entry for that ref.
 *
 * Pure: no filesystem access here. `repo-scan.ts` owns reading/writing the
 * JSON file and the actual clone directory.
 */

export interface ManifestEntry {
  /** The Git host this entry's remote lives on (`hostOf`, repo-scan-lib.ts) —
   * part of the manifest key, not just metadata: `label` alone ("owner/repo")
   * collides across two different hosts mirroring the same path. */
  host: string;
  /** `owner/repo`, matching `RepoRef.label` from repo-scan-lib. */
  repo: string;
  cloneUrl: string;
  /** Commit SHA the repo was at when this entry was recorded. */
  ref: string;
  /** The repo's actual default branch at clone time — not the clone's
   * current checkout, which `repo:pr` moves to a work branch. Recovering it
   * from a re-derived `git rev-parse --abbrev-ref HEAD` on a reused clone
   * would read back that work branch instead, and write it into the
   * generated workflow's `branches:` list on a second run. */
  defaultBranch: string;
  /** ISO timestamp of the scan that produced this entry. */
  scannedAt: string;
  /** Whether the scan found anything worth acting on (findings or proposals). */
  hasFindings: boolean;
  /** Where the clone was kept, if `hasFindings` — absent otherwise, since a
   * clean scan has nothing worth keeping a clone around for. */
  workdir?: string;
}

export interface Manifest {
  /** One entry per repo, keyed by `manifestKey(host, repo)` — the latest scan
   * replaces any earlier one for that same host+repo. */
  repos: Record<string, ManifestEntry>;
}

/** The manifest's dictionary key for a given host+repo — `repo` alone
 * ("owner/repo") is ambiguous across hosts; see `ManifestEntry.host`. */
export function manifestKey(host: string, repo: string): string {
  return `${host}/${repo}`;
}

export function emptyManifest(): Manifest {
  return { repos: {} };
}

/** Tolerates a missing/empty file's caller passing `undefined`, and a
 * malformed one by falling back to empty rather than throwing — a corrupt
 * manifest should cost a re-scan, not block one. */
export function parseManifest(text: string | undefined): Manifest {
  if (!text || text.trim().length === 0) return emptyManifest();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && parsed.repos && typeof parsed.repos === "object") {
      return { repos: parsed.repos };
    }
  } catch {
    // fall through to empty
  }
  return emptyManifest();
}

export function serializeManifest(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function upsertEntry(manifest: Manifest, entry: ManifestEntry): Manifest {
  return { repos: { ...manifest.repos, [manifestKey(entry.host, entry.repo)]: entry } };
}

/** True when the manifest already has a record of this exact host+repo+ref —
 * the caller can skip cloning and scanning again. */
export function isAlreadyScanned(
  manifest: Manifest,
  host: string,
  repo: string,
  ref: string,
): boolean {
  return manifest.repos[manifestKey(host, repo)]?.ref === ref;
}

/**
 * `host` + `owner/repo` + a commit SHA -> a relative directory path, e.g.
 * `github.com/octocat/hello-world-a1b2c3d`. The short ref makes re-scans of
 * an unchanged repo land on the same directory instead of accumulating one
 * per run; a changed repo naturally gets a fresh directory alongside the
 * stale one, which the caller is responsible for eventually pruning.
 *
 * Kept as `host/owner/name-ref`, not a flattened `host-owner-name-ref` —
 * collapsing every `/` to `-` made `a-b/c` and `a/b-c` the same string (and,
 * before `host` was part of this at all, two different hosts mirroring the
 * same `owner/repo` the same string too), so scanning one repository could
 * silently reuse — and later delete, on a rescan — a different one's
 * retained clone. `repo` is always exactly one `/` (see
 * `RepoRef`/`parseRepoArg`), so splitting on the first one is unambiguous;
 * the result is a nested path, which `join()` (every caller) handles the
 * same as any other path segment. */
export function cacheDirName(host: string, repo: string, ref: string): string {
  const slash = repo.indexOf("/");
  const owner = slash === -1 ? repo : repo.slice(0, slash);
  const name = slash === -1 ? repo : repo.slice(slash + 1);
  const shortRef = ref.slice(0, 12);
  return `${host}/${owner}/${name}-${shortRef}`;
}
