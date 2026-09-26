/**
 * Regenerates docs/tutorial.html, docs/ci.html, and docs/mcp-server.html
 * from their corresponding Markdown files at build time.
 *
 * Run with `bun run gen:docs`. CI re-runs it and fails on a diff.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTutorialPage, renderDocPage, type DocPageOptions } from "./gen-docs-lib.js";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const DOCS_DIR = join(ROOT, "docs");

interface DocConfig {
  name: string;
  options: DocPageOptions;
}

const docs: DocConfig[] = [
  {
    name: "tutorial",
    options: {
      title: "The VisiMark tutorial",
      description:
        "From a plain Markdown table to a checked document and back out to CI, one concept at a time — tables, inference, anchors, aggregates, assertions, charts and imports.",
      ogTitle: "The VisiMark tutorial",
      navLabel: "tutorial",
      scriptName: "tutorial",
    },
  },
  {
    name: "ci",
    options: {
      title: "Protect your Markdown numbers with CI",
      description:
        "Make a build read your Markdown documents on every commit, and stop a merge when the arithmetic in them stops adding up — the GitHub Action, globs, annotations, pinning and rollout.",
      ogTitle: "Protect your Markdown numbers with CI",
      navLabel: "CI",
      scriptName: "ci",
    },
  },
  {
    name: "mcp-server",
    options: {
      title: "Set up and run the VisiMark MCP server",
      description:
        "Set up visimark-mcp, add it to a host, and use its six read tools and two write tools from an agent — the write gate, the plan/apply split, resources and prompts.",
      ogTitle: "Set up and run the VisiMark MCP server",
      navLabel: "MCP server",
      scriptName: "mcp-server",
    },
  },
];

for (const doc of docs) {
  const mdPath = join(DOCS_DIR, `${doc.name}.md`);
  const htmlPath = join(DOCS_DIR, `${doc.name}.html`);

  const markdown = readFileSync(mdPath, "utf8");
  const html =
    doc.name === "tutorial" ? renderTutorialPage(markdown) : renderDocPage(markdown, doc.options);

  writeFileSync(htmlPath, html);
  console.log(`Generated ${doc.name}.html`);
}

console.log(`Generated ${docs.length} documentation page(s).`);
