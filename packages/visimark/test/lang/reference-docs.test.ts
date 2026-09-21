import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderReference, renderTable } from "../../../../scripts/gen-function-reference.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

test("docs/function-reference.md is current", () => {
  expect(readFileSync(join(root, "docs/function-reference.md"), "utf8")).toBe(renderReference());
});

test("the design doc's function table is current", () => {
  const design = readFileSync(join(root, "docs/visimark-design.md"), "utf8");
  expect(design).toContain(renderTable());
});

test("the generated Meaning column carries the error clauses", () => {
  const table = renderTable();
  expect(table).toContain("an empty column is a `TYPE` error");
  expect(table).toContain("a negative operand is a `TYPE` error");
  expect(table).toContain("a zero divisor is a `TYPE` error");
});

test("the generated table and reference show each prose spelling beside its call", () => {
  const table = renderTable();
  expect(table).toContain("| `ABS(x)` · `\\|x\\|` |");
  expect(table).toContain("| `SQRT(x)` · `√(x)` |");
  expect(table).toContain("| `FLOOR(x, s)` · `⌊x⌋` |");
  expect(table).toContain("| `CEILING(x, s)` · `⌈x⌉` |");
  const ref = renderReference();
  expect(ref).toContain("**Also written:** `|x|`");
  expect(ref).toContain("**Also written:** `⌊x⌋`");
  // a function with no prose spelling gets no such line
  expect(ref.match(/\*\*Also written:\*\*/g)).toHaveLength(4);
});
