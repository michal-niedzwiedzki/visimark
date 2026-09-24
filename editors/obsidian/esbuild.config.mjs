import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

/**
 * The plugin build. One `main.js`, no `node:` specifier in it, and the engine
 * bundled from source.
 *
 * **Why `visimark` resolves to the engine's source and not its `exports`.**
 * The same reason `editors/vscode/esbuild.mjs` gives: going through the
 * package's `exports` would make this bundle depend on `dist/` having been
 * rebuilt first, and would silently ship stale code if it had not. The
 * specifier is `visimark/browser` in spirit — the engine's browser-safe entry
 * point (`packages/visimark/src/browser.ts`, issue #201) — and it is resolved
 * here rather than published, because no published subpath exists yet and the
 * plugin does not need one to be built in this repository.
 *
 * **Why `node:path` is aliased rather than allowed.** The engine's browser
 * graph reaches `node:path` through `fs/gate.ts`, which uses it for string
 * work only. The playground lets that one builtin through because Bun's
 * browser build of it works. Obsidian mobile is not Electron and has no Node
 * to fall back on, so this build substitutes `src/browser-path.ts` and
 * `test/bundle.test.ts` asserts that **no** `node:` specifier survives into
 * the output. There is no allowlist here; zero is the number.
 *
 * **Externals** are what Obsidian itself provides at run time. They must not
 * be bundled: a second copy of CodeMirror in a plugin is a second editor
 * state, and `obsidian` has no implementation to bundle at all.
 */

const here = dirname(fileURLToPath(import.meta.url));
const engineBrowserSrc = join(here, "..", "..", "packages", "visimark", "src", "browser.ts");

/** What Obsidian provides to a plugin at run time, and therefore never bundles. */
export const EXTERNALS = [
  "obsidian",
  "electron",
  "@codemirror/autocomplete",
  "@codemirror/collab",
  "@codemirror/commands",
  "@codemirror/language",
  "@codemirror/lint",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/view",
  "@lezer/common",
  "@lezer/highlight",
  "@lezer/lr",
];

/**
 * The one build, exported so `test/bundle.test.ts` builds exactly what ships.
 *
 * @type {import("esbuild").BuildOptions & { alias: Record<string, string> }}
 */
export const options = {
  entryPoints: [join(here, "src", "main.ts")],
  outfile: join(here, "main.js"),
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2018",
  minify: true,
  sourcemap: false,
  treeShaking: true,
  logLevel: "info",
  alias: {
    visimark: engineBrowserSrc,
    "node:path": join(here, "src", "browser-path.ts"),
  },
  external: EXTERNALS,
};

if (import.meta.main) {
  await build(options);
}
