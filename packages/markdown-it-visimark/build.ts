import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * The published build (#373). One ESM file for any markdown-it host, the
 * engine bundled from its browser-safe source, `decorations.ts` and
 * `import-deps.ts` compiled from `codemirror-visimark`'s source, and
 * `node:path` replaced by `src/browser-path.ts` — so `dist/` has no `node:`
 * specifier and no runtime dependency.
 *
 * Declarations: `tsc -p tsconfig.build.json` (run first by the `build`
 * script) emits into .types/ with rootDir `..`. Only `index.d.ts` is public;
 * its re-exports from `./types.js` are inlined here so the shipped file
 * imports nothing.
 */

const here = import.meta.dir;
const dist = join(here, "dist");
const engineBrowser = resolve(here, "../visimark/src/browser.ts");
const pathShim = resolve(here, "src/browser-path.ts");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(here, "src", "index.ts")],
  outdir: dist,
  target: "browser",
  format: "esm",
  minify: true,
  naming: { entry: "[name].js" },
  plugins: [
    {
      name: "engine-from-source",
      setup(build) {
        build.onResolve({ filter: /^visimark$/ }, () => ({ path: engineBrowser }));
        build.onResolve({ filter: /^node:path$/ }, () => ({ path: pathShim }));
        // The engine's Markdown parser decodes character references through
        // `decode-named-character-reference`, whose `browser` export builds a
        // DOM element at import time. A markdown-it host is as often Node or
        // an Electron main process as a browser, so take its DOM-free entry —
        // the one the same import resolves to outside a browser build.
        build.onResolve({ filter: /^decode-named-character-reference$/ }, (args) => ({
          path: Bun.resolveSync(args.path, dirname(args.importer)),
        }));
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const types = join(here, ".types", "markdown-it-visimark", "src");
const publicTypes = readFileSync(join(types, "types.d.ts"), "utf8");
const option =
  /(?:\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?export type ReadImportSync[\s\S]*?export interface MarkdownItVisimarkOptions \{[\s\S]*?\n\}/.exec(
    publicTypes,
  );
if (option === null) {
  console.error("types.d.ts no longer starts with ReadImportSync and MarkdownItVisimarkOptions");
  process.exit(1);
}
writeFileSync(
  join(dist, "index.d.ts"),
  option[0] +
    "\n\n/** The markdown-it plugin: `md.use(markdownItVisimark, options?)`. */\n" +
    "declare function markdownItVisimark(md: unknown, options?: MarkdownItVisimarkOptions): void;\n" +
    "export default markdownItVisimark;\n",
);
console.log("markdown-it-visimark: built index");
