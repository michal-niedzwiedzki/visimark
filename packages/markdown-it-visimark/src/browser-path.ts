import {
  dirname as posixDirname,
  resolve as posixResolve,
} from "../../codemirror-visimark/src/browser-path.js";

/**
 * The published bundle's `node:path` (spec §2.6), bundled in place of the
 * builtin so `dist/` carries no `node:` specifier.
 *
 * `codemirror-visimark`'s shim is POSIX-only because Obsidian hands it vault
 * paths. A markdown-it host hands this one real host paths, which on Windows
 * carry a drive letter, so a drive-letter path is handled here and everything
 * else is that shim's, unchanged — one POSIX implementation, not two.
 *
 * `sep` is a single constant `fs/gate.ts`'s `contains()` reads, so it cannot
 * follow the path. It is `/`, and a drive-letter path is normalised to `/`
 * instead: `C:\notes\note.md` resolves as `C:/notes/note.md`, and that is the
 * form `readImport` receives. Every Windows file API accepts it.
 *
 * `test/browser-path.test.ts` pins this against `node:path.win32` and
 * `node:path.posix` over the calls the gate makes.
 */

const DRIVE = /^[A-Za-z]:[\\/]/;

export const sep = "/";

export function isAbsolute(p: string): boolean {
  return p.startsWith("/") || DRIVE.test(p);
}

export function resolve(...parts: string[]): string {
  const last = parts.findLastIndex((p) => DRIVE.test(p));
  if (last < 0) return posixResolve(...parts);
  let drive = "";
  let segments: string[] = [];
  for (const part of parts.slice(last)) {
    if (part.length === 0) continue;
    if (DRIVE.test(part)) {
      drive = part.slice(0, 2);
      segments = part.slice(3).split(/[\\/]/);
    } else if (part.startsWith("/") || part.startsWith("\\")) {
      segments = part.slice(1).split(/[\\/]/);
    } else {
      segments.push(...part.split(/[\\/]/));
    }
  }
  const out: string[] = [];
  for (const segment of segments) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") out.pop();
    else out.push(segment);
  }
  return drive + "/" + out.join("/");
}

export function dirname(p: string): string {
  if (!DRIVE.test(p)) return posixDirname(p);
  const norm = p.replace(/\\/g, "/");
  let end = norm.length;
  while (end > 3 && norm[end - 1] === "/") end--;
  const cut = norm.lastIndexOf("/", end - 1);
  return cut <= 2 ? norm.slice(0, 3) : norm.slice(0, cut);
}

export default { sep, isAbsolute, dirname, resolve };
