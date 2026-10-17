/**
 * Naming a repository and pointing into it: the clone argument grammar shared
 * by `repo:investigate` and `repo:pr`, the Git host it names, the VisiMark
 * Action test, and permalinks at a scanned commit. Moved here from
 * `scripts/repo-scan-lib.ts` and `site/src/pages/repo-scan.ts`, which each
 * kept a copy.
 */

const SHORTHAND = /^[\w.-]+\/[\w.-]+$/;

export interface RepoRef {
  /** URL passed to `git clone`. */
  cloneUrl: string;
  /** `owner/repo`, for display and the report. */
  label: string;
}

/**
 * Accepts `owner/repo`, or an `https://`/`git@` URL (with or without a
 * `.git` suffix). Anything else is a usage error, not a network one — this
 * never touches the network.
 */
export function parseRepoArg(input: string): RepoRef | { error: string } {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { error: "repo argument is empty" };

  if (SHORTHAND.test(trimmed)) {
    return { cloneUrl: `https://github.com/${trimmed}.git`, label: trimmed };
  }

  const httpsMatch = trimmed.match(/^https:\/\/[^/]+\/([\w.-]+\/[\w.-]+?)(\.git)?\/?$/);
  if (httpsMatch) {
    return { cloneUrl: trimmed, label: httpsMatch[1]! };
  }

  const sshMatch = trimmed.match(/^git@[^:]+:([\w.-]+\/[\w.-]+?)(\.git)?\/?$/);
  if (sshMatch) {
    return { cloneUrl: trimmed, label: sshMatch[1]! };
  }

  return { error: `not a recognized repo (want \`owner/repo\` or a git URL): ${input}` };
}

/**
 * The Git host a `cloneUrl` points at — `github.com` for the `owner/repo`
 * shorthand, whatever host an explicit `https://`/`git@` URL named. Needed
 * because `RepoRef.label` alone ("owner/repo") collides across two different
 * hosts that happen to mirror the same path — without this, `repo:pr`'s
 * manifest/cache-directory identity (keyed by `label`) would let scanning a
 * second host's copy reuse, and later delete, the first host's retained
 * clone. `parseRepoArg`'s own regexes already validated the shape, so these
 * are the same patterns, just capturing the host instead of discarding it. */
export function hostOf(cloneUrl: string): string {
  const https = /^https:\/\/([^/]+)\//.exec(cloneUrl);
  if (https) return https[1]!;
  const ssh = /^git@([^:]+):/.exec(cloneUrl);
  if (ssh) return ssh[1]!;
  return cloneUrl;
}

/** True when any path segment starts with a dot — `.github/`, `.agents/`, a bare `.env.md`. */
export function isDotPath(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith("."));
}

/** Percent-encodes each path segment, keeping `/` as a separator, so `#`, `?`
 *  or `%` in a file name cannot truncate or misroute a URL. */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * A `uses:` line naming the visimark action, e.g. `owner/visimark@v1` or
 * `owner/visimark/action.yml@v1` — matches action.yml's own publish shape,
 * case-insensitively since Actions refs are matched case-insensitively too.
 * Horizontal whitespace only, and no two adjacent runs of it: workflow text
 * is untrusted input, and `\s*-?\s*` backtracked polynomially on it (CodeQL).
 */
export const VISIMARK_ACTION_USE = /^[ \t]*(?:-[ \t]*)?uses:[ \t]*[\w.-]+\/visimark(?:@|\/|\s|$)/im;

export function hasVisimarkAction(workflowTexts: string[]): boolean {
  return workflowTexts.some((text) => VISIMARK_ACTION_USE.test(text));
}

/**
 * A permalink to lines of a file at the scanned commit, so the link keeps
 * pointing at the table that was checked after the repo moves on. Null for a
 * host other than github.com, and for a local path, which has none.
 *
 * `?plain=1` makes GitHub show a Markdown file as source. Without it the
 * blob page renders the file and the `#L` anchor selects nothing, and every
 * file a scan reports is Markdown.
 */
export function blobUrl(
  host: string | null,
  label: string,
  commit: string,
  path: string,
  from: number,
  to?: number,
): string | null {
  if (host !== "github.com") return null;
  const range = to && to !== from ? `#L${from}-L${to}` : `#L${from}`;
  return `https://github.com/${label}/blob/${commit}/${encodePath(path)}?plain=1${range}`;
}
