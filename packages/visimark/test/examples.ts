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

export const clean = readFileSync(cleanPath, "utf8");
export const drift = readFileSync(driftPath, "utf8");

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
