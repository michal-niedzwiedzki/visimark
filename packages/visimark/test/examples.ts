import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { locate } from "../src/parse/document.js";
import { applyEdits } from "../src/write/splice.js";
const here = dirname(fileURLToPath(import.meta.url));

/** repo root — the worked examples live outside the package, in docs/ */
export const repoRoot = join(here, "..", "..", "..");
const docDir = join(repoRoot, "docs");

export const cleanPath = join(docDir, "example-invoice.md");
export const driftPath = join(docDir, "example-invoice-drift.md");
/** the third worked example: a plain document, with nothing wired up */
export const quotePath = join(docDir, "example-quote-plain.md");

export const clean = readFileSync(cleanPath, "utf8");
export const drift = readFileSync(driftPath, "utf8");
export const quote = readFileSync(quotePath, "utf8");

/** the body of the nth ```console block in a worked example, `$` lines dropped */
export function transcript(source: string, nth = 0): string {
  const lines = source.split("\n");
  let from = -1;
  for (let seen = 0; seen <= nth; seen++) {
    from = lines.findIndex((l, i) => i > from && l.trim() === "```console");
  }
  const to = lines.findIndex((l, i) => i > from && l.trim() === "```");
  return lines
    .slice(from + 1, to)
    .filter((l) => !l.startsWith("$ "))
    .join("\n");
}

/** the CLI entry, for tests that spawn it as a subprocess */
export const mainTs = join(here, "..", "src", "cli", "main.ts");

/**
 * The acceptance fixture for `infer`: a worked example with every `vmark`
 * block and every anchor removed. Generated here rather than committed, so it
 * cannot drift from the document it is derived from.
 */
export function stripVmark(source: string): string {
  const doc = locate(source);
  const out = applyEdits(source, [
    ...doc.blocks.map((b) => ({ ...b.span, text: "" })),
    ...doc.anchors.map((a) => ({ ...a.commentSpan, text: "" })),
  ]);
  return out.replace(/\n{3,}/g, "\n\n");
}

export const strippedClean = stripVmark(clean);
export const strippedDrift = stripVmark(drift);
