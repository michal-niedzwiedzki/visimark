import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const engineSrc = join(here, "..", "..", "packages", "visimark", "src", "index.ts");

const common = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node18",
  minify: true,
  sourcemap: true,
  logLevel: "info",
  // Bundle the engine from source rather than through its package `exports`,
  // which would point at dist/ and make these bundles depend on the engine
  // having been rebuilt first — and silently ship stale code if it had not.
  alias: { visimark: engineSrc },
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
