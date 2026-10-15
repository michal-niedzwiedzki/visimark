import { resolve } from "node:path";

/**
 * The playground application bundle (docs/vendor/visimark-playground.js).
 * A script rather than a `bun build` command line since #360, because it
 * resolves two specifiers the command line cannot alias:
 *
 * - `codemirror-visimark` (and `/x.js` subpaths) to the package's source, as
 *   Obsidian does — never its dist;
 * - `visimark` to ./src/playground/engine-global.ts, which re-exports the
 *   engine the page already loaded as `window.VisiMark`, so the engine is not
 *   bundled a second time.
 *
 * And it refuses a bundle with two copies of @codemirror/state: an extension
 * built by one copy is not recognised by the other. Likewise @codemirror/language.
 */

const here = import.meta.dir;
const extensionSrc = resolve(here, "../packages/codemirror-visimark/src");
const engineGlobal = resolve(here, "src/playground/engine-global.ts");
const out = resolve(here, "../docs/vendor/visimark-playground.js");

const result = await Bun.build({
  entrypoints: [resolve(here, "src/playground/main.ts")],
  target: "browser",
  format: "iife",
  minify: true,
  plugins: [
    {
      name: "playground-aliases",
      setup(build) {
        build.onResolve({ filter: /^visimark$/ }, () => ({ path: engineGlobal }));
        build.onResolve({ filter: /^codemirror-visimark(\/.*)?$/ }, (args) => {
          const sub = args.path.slice("codemirror-visimark".length);
          return {
            path:
              sub === ""
                ? resolve(extensionSrc, "index.ts")
                : resolve(extensionSrc, sub.slice(1).replace(/\.js$/, ".ts")),
          };
        });
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const text = await result.outputs[0]!.text();
// one sentence @codemirror/state carries exactly once per copy
const copies = text.split("multiple instances of @codemirror/state are loaded").length - 1;
if (copies !== 1) {
  console.error(`visimark-playground.js holds ${copies} copies of @codemirror/state; expected 1`);
  process.exit(1);
}
// and @codemirror/language once (#367): a second copy brings its own tag
// objects, which the editor's HighlightStyle would never match
const languageCopies = text.split("Unknown highlighting tag").length - 1;
if (languageCopies !== 1) {
  console.error(
    `visimark-playground.js holds ${languageCopies} copies of @codemirror/language; expected 1`,
  );
  process.exit(1);
}
await Bun.write(out, text);
