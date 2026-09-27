import { expect, test } from "bun:test";
import { build, locate } from "visimark";
import { importDependentNames } from "../src/import-deps.js";

/**
 * Review row 6's Live Preview half. `resolveImports` (the engine's own
 * `check` phase) is what populates a `from`-declared sheet's table and
 * columns from the CSV — a model from `build(locate(source))` alone, the
 * only kind Live Preview's reader-less `check` ever has, has never run that
 * phase. `sheet.imported !== null` survives regardless, because it comes
 * from parsing the fence's own `from` clause; that is the fact this module
 * has to work from, not `resolve()`'s ref-kind answer, which — pinned by the
 * first test below — is `"unknown"` for every one of an import's columns
 * before `check` has ever touched the model.
 */

const IMPORTED_SHEET =
  "```vmark #benchmark from benchmark.csv labelled Id, Time " +
  "at sha256:c4e418b2a0f4bdc584b99007dcfd39e200b51ff3555e66ae5d42694e0bbd19ee\n" +
  "Mean precision 2 = AVG(benchmark.Time)\n" +
  "```\n";

const DOC_SCALAR = "```vmark\nDoubleMean = benchmark.Mean * 2\n```\n";

const LOCAL_SHEET = "```vmark #local\n| x |\n|---|\n| 1 |\n| 2 |\ny = x * 2\n```\n";

test("a model built with no reader cannot resolve an import's own columns", () => {
  // this is exactly why `importDependentNames` can't be built on `resolve()`
  const model = build(locate(IMPORTED_SHEET));
  const mean = model.sheets.get("benchmark")?.scalars.get("Mean");
  expect(mean).toBeDefined();
  expect(model.sheets.get("benchmark")?.table).toBeNull();
  expect(model.sheets.get("benchmark")?.inputColumns.size).toBe(0);
});

test("a scalar declared inside an imported sheet's own block is import-dependent", () => {
  const model = build(locate(IMPORTED_SHEET));
  expect(importDependentNames(model)).toEqual(new Set(["benchmark.Mean"]));
});

test("a doc-scalar that reads an import-dependent scalar is import-dependent too", () => {
  const model = build(locate(`${IMPORTED_SHEET}\n${DOC_SCALAR}`));
  const dependent = importDependentNames(model);
  expect(dependent.has("benchmark.Mean")).toBe(true);
  expect(dependent.has("DoubleMean")).toBe(true);
});

test("a local sheet with no import in its dependency chain is not import-dependent", () => {
  const model = build(locate(`${IMPORTED_SHEET}\n${LOCAL_SHEET}`));
  const dependent = importDependentNames(model);
  expect(dependent.has("local.y")).toBe(false);
});

test("a document with no imported sheet returns an empty set", () => {
  const model = build(locate(LOCAL_SHEET));
  expect(importDependentNames(model)).toEqual(new Set());
});
