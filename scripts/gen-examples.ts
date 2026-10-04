/**
 * Regenerates docs/examples.html and one docs/examples/<slug>/index.html per
 * entry in docs/examples/examples.json, from that catalogue and each
 * example's own Markdown file.
 *
 * Run with `bun run gen:examples`. CI re-runs it and fails on a diff (see
 * .github/workflows/ci.yml, job examples-pages).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  relativeToDocs,
  renderExamplePage,
  renderExamplesListPage,
  type Example,
} from "./gen-examples-lib.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES_DIR = join(ROOT, "docs/examples");

const { examples } = JSON.parse(readFileSync(join(EXAMPLES_DIR, "examples.json"), "utf8")) as {
  examples: Example[];
};

writeFileSync(join(ROOT, "docs/examples.html"), renderExamplesListPage(examples));

for (const example of examples) {
  const mdPath = join(EXAMPLES_DIR, example.path);
  const markdown = relativeToDocs(
    readFileSync(mdPath, "utf8"),
    relative(join(ROOT, "docs"), dirname(mdPath)),
  );
  const outDir = join(EXAMPLES_DIR, example.slug);
  mkdirSync(outDir, { recursive: true });
  const attachments = (example.attachments ?? []).map((path) => ({
    name: basename(path),
    content: readFileSync(join(EXAMPLES_DIR, path), "utf8"),
  }));
  writeFileSync(join(outDir, "index.html"), renderExamplePage(example, markdown, attachments));
}

const currentSlugs = new Set(examples.map((example) => example.slug));
const staleSlugs = readdirSync(EXAMPLES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !currentSlugs.has(entry.name))
  .map((entry) => entry.name);
for (const slug of staleSlugs) {
  const indexPath = join(EXAMPLES_DIR, slug, "index.html");
  if (existsSync(indexPath)) rmSync(indexPath);
}

console.log(
  `Generated docs/examples.html and ${examples.length} example page(s)` +
    (staleSlugs.length > 0 ? `, removed ${staleSlugs.length} stale page(s).` : "."),
);
