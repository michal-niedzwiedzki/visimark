import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";

/**
 * The artifact path gate.
 *
 * The document states where its artifact lives, so the path is author-supplied
 * and must be bounded. Every rule here is a **refusal, never a transformation**
 * - nothing is normalised into legality, because a silently rewritten path is
 * exactly the kind of guess constraint 3 forbids.
 *
 * The gate stops a hostile or careless path. It is not the only safeguard: the
 * caller additionally refuses to overwrite any file that does not carry
 * VisiMark's own metadata marker, which is what protects a hand-drawn SVG.
 */

export type PathResult = { ok: string } | { err: string };

/** `CON`, `NUL`, `COM1`... are special on Windows whatever the extension. */
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
// matching control characters is the point: they must never reach a path
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function resolveArtifactPath(docPath: string, url: string): PathResult {
  if (url.length === 0) return { err: "artifact path is empty" };
  if (CONTROL_CHARS.test(url)) {
    return { err: "artifact path contains a control character" };
  }
  // a drive letter looks like a URL scheme, so it is judged first
  if (/^[A-Za-z]:/.test(url)) {
    return { err: "artifact path must be relative, not a drive letter" };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return { err: "artifact path must be a relative path, not a URL" };
  }
  if (isAbsolute(url) || url.startsWith("/") || url.startsWith("\\")) {
    return { err: "artifact path must be relative" };
  }
  if (!url.endsWith(".svg")) {
    return { err: "artifact path must end in `.svg`" };
  }

  for (const segment of url.split(/[\\/]/)) {
    if (WINDOWS_DEVICE.test(segment)) {
      return { err: "artifact path uses a reserved device name `" + segment + "`" };
    }
  }

  const base = realpathSyncSafe(dirname(resolve(docPath)));
  const target = resolve(base, url);

  if (!contains(base, target)) {
    return { err: "artifact path escapes the document's directory" };
  }

  // A symlink is resolved before the containment check, or the check is
  // trivially bypassed by pointing a link out of the tree.
  if (existsSync(target)) {
    const real = realpathSyncSafe(target);
    if (real !== target && !contains(base, real)) {
      return { err: "artifact path resolves through a symlink out of the document's directory" };
    }
  }
  const parent = dirname(target);
  if (existsSync(parent)) {
    const realParent = realpathSyncSafe(parent);
    if (realParent !== parent && !contains(base, realParent)) {
      return { err: "artifact path resolves through a symlink out of the document's directory" };
    }
  }

  return { ok: target };
}

function contains(base: string, target: string): boolean {
  return target === base || target.startsWith(base.endsWith(sep) ? base : base + sep);
}

/** `realpath` on a path that may not exist yet falls back to the input. */
function realpathSyncSafe(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** true when the path exists and is a symlink - callers refuse to write through one */
export function isSymlink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
