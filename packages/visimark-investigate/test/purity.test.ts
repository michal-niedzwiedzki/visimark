import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The core runs in the browser bundle and in the CLI; it may not reach a Node
// builtin, and it takes the engine as an argument rather than importing it.
const SRC = join(import.meta.dir, "../src");

test("the core imports no node: builtin and visimark only as types", () => {
  const offenders: string[] = [];
  for (const f of readdirSync(SRC, { recursive: true }) as string[]) {
    if (!f.endsWith(".ts")) continue;
    const text = readFileSync(join(SRC, f), "utf8");
    if (/from\s+["']node:/.test(text)) offenders.push(`${f}: node: import`);
    if (/import\s+(?!type\b)[^;]*from\s+["']visimark["']/.test(text)) {
      offenders.push(`${f}: value import of visimark`);
    }
  }
  expect(offenders).toEqual([]);
});
