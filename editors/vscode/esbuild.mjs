import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const engineSrc = join(here, "..", "..", "packages", "visimark", "src", "index.ts");
const markdownItSrc = join(here, "..", "..", "packages", "markdown-it-visimark", "src", "index.ts");

const common = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  minify: true,
  sourcemap: true,
  logLevel: "info",
  // Bundle the engine from source rather than through its package `exports`,
  // which would point at dist/ and make these bundles depend on the engine
  // having been rebuilt first — and silently ship stale code if it had not.
  // The markdown-it plugin the preview uses (#373) is bundled from source for
  // the same reason.
  alias: { visimark: engineSrc, "markdown-it-visimark": markdownItSrc },
};

await build({
  ...common,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  external: ["vscode"],
});

await build({
  ...common,
  entryPoints: ["../../packages/visimark-lsp/src/server.ts"],
  outfile: "dist/server.js",
  external: ["vscode"],
});
