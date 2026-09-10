import { dirname, isAbsolute, resolve, sep } from "node:path";
import { existsSync, realpathSync } from "node:fs";

/**
 * The declared-input path gate — the read-side counterpart of
 * `artifact/path.ts`'s chart-output gate. Same shape: relative only,
 * contained against its resolved real path, no traversal, no symlink escape,
 * no control characters, no Windows device names. Unlike the artifact gate
 * there is no "refuse to overwrite an unmarked file" rule, because nothing is
 * ever written here — and the extension check looks for `.csv`, the only
 * format v1 recognises. See
 * `docs/design/declared-local-data-imports-spec.md` §2.
 */

export type PathResult = { ok: string } | { err: string };

const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
// matching control characters is the point: they must never reach a path
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function resolveImportPath(docPath: string, url: string): PathResult {
  if (url.length === 0) return { err: "imported file path is empty" };
  if (CONTROL_CHARS.test(url)) {
    return { err: "imported file path contains a control character" };
  }
  if (/^[A-Za-z]:/.test(url)) {
    return { err: "imported file path must be relative, not a drive letter" };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return { err: "imported file path must be a relative path, not a URL" };
  }
  if (isAbsolute(url) || url.startsWith("/") || url.startsWith("\\")) {
    return { err: "imported file path must be relative" };
  }
  if (!url.endsWith(".csv")) {
    return { err: "imported file path must end in `.csv`" };
  }

  for (const segment of url.split(/[\\/]/)) {
    if (WINDOWS_DEVICE.test(segment)) {
      return { err: "imported file path uses a reserved device name `" + segment + "`" };
    }
  }

  const base = realpathSyncSafe(dirname(resolve(docPath)));
  const target = resolve(base, url);

  if (!contains(base, target)) {
    return { err: "imported file path escapes the document's directory" };
  }

  if (existsSync(target)) {
    const real = realpathSyncSafe(target);
    if (real !== target && !contains(base, real)) {
      return { err: "imported file path resolves through a symlink out of the document's directory" };
    }
  }
  const parent = dirname(target);
  if (existsSync(parent)) {
    const realParent = realpathSyncSafe(parent);
    if (realParent !== parent && !contains(base, realParent)) {
      return { err: "imported file path resolves through a symlink out of the document's directory" };
    }
  }

  return { ok: target };
}

function contains(base: string, target: string): boolean {
  return target === base || target.startsWith(base.endsWith(sep) ? base : base + sep);
}

function realpathSyncSafe(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
