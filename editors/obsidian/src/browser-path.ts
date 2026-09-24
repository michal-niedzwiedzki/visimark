/**
 * The plugin's `node:path`, bundled in place of the builtin.
 *
 * **Why a shim rather than an allowlist entry.**
 * `packages/visimark/test/playground/browser-graph.test.ts` permits exactly one
 * `node:` builtin, `node:path`, because Bun's browser build of it works and it
 * touches no filesystem. That permission does not transfer here. Obsidian
 * desktop is Electron and has Node; Obsidian mobile is not and does not. A
 * `node:path` that resolves on the desktop and throws on a phone is a crash on
 * the one device fork B exists for, and it would be found by a user rather
 * than by CI. `esbuild.config.mjs` aliases `node:path` to this file, and
 * `test/bundle.test.ts` asserts no `node:` specifier survives into `main.js`.
 *
 * **What has to be here** is what the engine's browser graph imports, and only
 * that: `packages/visimark/src/fs/gate.ts` takes `dirname`, `isAbsolute`,
 * `resolve` and `sep`. Nothing else in that graph imports `node:path`. An
 * export added here without a caller is an export nothing tests.
 *
 * **POSIX, always.** A vault path is `/`-separated on every platform Obsidian
 * runs on — that is what `normalizePath()` guarantees — so this is
 * `path.posix`, not `path`. Shipping the platform-switching version would make
 * the plugin's containment check behave differently on Windows for paths that
 * Obsidian itself has already normalised.
 *
 * **One deliberate difference from `path.posix`, and it is load-bearing.**
 * `resolve()` given only relative segments has no `process.cwd()` to fall back
 * on, and a browser has no working directory to offer. This resolves against
 * `/` instead. That is not a degradation: the engine calls
 * `resolve(doc.path)` on the document's own path, and a vault path is
 * relative to the vault root, so rooting it at `/` makes the vault root the
 * containment boundary — which is exactly the gate the plugin is supposed to
 * have (`docs/design/obsidian-plugin-spec.md` §2.6: "The vault root is the
 * gate, and it is Obsidian's gate, not a second one written here"). The plugin
 * never hands the engine an absolute host path, so the branch where this would
 * differ from Node does not occur.
 *
 * `test/browser-path.test.ts` pins every function against `node:path.posix`
 * over a table of inputs, including the `/`-rooted cases above.
 */

export const sep = "/";

export function isAbsolute(p: string): boolean {
  return p.startsWith("/");
}

export function dirname(p: string): string {
  if (p.length === 0) return ".";
  const hadRoot = p.startsWith("/");
  // trailing slashes are not a directory boundary: posix dirname("/a/b/") is "/a"
  let end = p.length;
  while (end > 1 && p[end - 1] === "/") end--;
  const cut = p.lastIndexOf("/", end - 1);
  if (cut < 0) return hadRoot ? "/" : ".";
  if (cut === 0) return "/";
  return p.slice(0, cut);
}

export function resolve(...parts: string[]): string {
  let joined = "";
  let absolute = false;
  for (const part of parts) {
    if (part.length === 0) continue;
    if (part.startsWith("/")) {
      joined = part;
      absolute = true;
    } else {
      joined = joined.length === 0 ? part : joined + "/" + part;
    }
  }
  // the documented difference from path.posix: no cwd, so the vault root
  if (!absolute) joined = "/" + joined;

  const out: string[] = [];
  for (const segment of joined.split("/")) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return "/" + out.join("/");
}

export default { sep, isAbsolute, dirname, resolve };
