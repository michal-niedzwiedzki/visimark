#!/usr/bin/env bun
// Local static server for docs/ — the same tree GitHub Pages deploys (see
// .github/workflows/pages.yml). `/` serves docs/index.html; every other path
// is resolved relative to docs/ (docs/playground.html, docs/example-*.md,
// docs/charts/*.svg, docs/vendor/*.js, …) exactly as Pages would serve them.
//
// Run: bun run serve   (or: bun scripts/serve.mjs [--port 8080])
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(dirname(fileURLToPath(import.meta.url))), "docs");

const portArg = process.argv.indexOf("--port");
const PORT = Number(portArg !== -1 ? process.argv[portArg + 1] : (process.env.PORT ?? 8080));

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    // Resolve within docs/ — reject any path that escapes it (e.g. "..").
    const path = normalize(join(ROOT, pathname));
    if (!path.startsWith(ROOT)) return new Response("Forbidden", { status: 403 });

    const file = Bun.file(path);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    return new Response(file);
  },
});

console.log(`Serving ${ROOT} at http://localhost:${server.port}/`);
