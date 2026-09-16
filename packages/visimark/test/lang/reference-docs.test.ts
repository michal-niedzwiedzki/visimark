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
});
