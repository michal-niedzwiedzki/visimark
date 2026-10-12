import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The published build (#360). ESM for browsers, CodeMirror external, the
 * engine bundled from its browser-safe source with `node:path` replaced by the
 * string shim — the same two substitutions editors/obsidian/esbuild.config.mjs
 * makes. `splitting` puts the findings field in one shared chunk, so `index.js`
 * and `lint.js` share it; two copies would be two StateFields. `highlight.js`
 * (#367) shares nothing: it imports `@codemirror/language`, kept external so
 * its tags are the host's own — a bundled copy would match no `HighlightStyle`.
 *
 * Declarations: `tsc -p tsconfig.build.json` (run first, by the `build`
 * script) emits into .types/ with rootDir `..`; only the three public files are
 * copied, and each must import nothing but @codemirror/*.
 */

const here = import.meta.dir;
const dist = join(here, "dist");
const engineBrowser = resolve(here, "../visimark/src/browser.ts");
const pathShim = resolve(here, "src/browser-path.ts");
const entries = ["index", "lint", "highlight"].filter((e) =>
  existsSync(join(here, "src", `${e}.ts`)),
);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const result = await Bun.build({
  entrypoints: entries.map((e) => join(here, "src", `${e}.ts`)),
  outdir: dist,
  target: "browser",
  format: "esm",
  splitting: true,
  minify: true,
  external: ["@codemirror/state", "@codemirror/view", "@codemirror/lint", "@codemirror/language"],
  naming: { entry: "[name].js", chunk: "chunk-[hash].js" },
  plugins: [
    {
      name: "engine-from-source",
      setup(build) {
        build.onResolve({ filter: /^visimark$/ }, () => ({ path: engineBrowser }));
        build.onResolve({ filter: /^node:path$/ }, () => ({ path: pathShim }));
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

for (const e of entries) {
  const from = join(here, ".types", "codemirror-visimark", "src", `${e}.d.ts`);
  const text = readFileSync(from, "utf8");
  const foreign = [...text.matchAll(/from\s+"([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((s) => !s.startsWith("@codemirror/"));
  if (foreign.length > 0) {
    console.error(
      `${e}.d.ts imports ${foreign.join(", ")}; the public declarations must be self-contained`,
    );
    process.exit(1);
  }
  copyFileSync(from, join(dist, `${e}.d.ts`));
}
console.log(`codemirror-visimark: built ${entries.join(", ")}`);
