import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
