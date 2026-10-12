import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyse } from "../src/analysis.js";

/**
 * Review row 5: reading mode ran `locate` + `build` + `check` +
 * `decorationsFor` once per rendered section, even though every section of
 * one render passes the same source text. This is the memo that makes it
 * once per render instead — proven here by identity, not by timing, so it
 * cannot flake on a slow runner.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");

test("the same source string returns the identical analysis object", () => {
  const source = read("example-invoice.md");
  const first = analyse(source);
  const second = analyse(source);
  expect(second).toBe(first);
});

test("a freshly reconstructed but equal source string still hits the memo", () => {
  // `analyse` is keyed on the string's value: two sections of one render each
  // hand it their own slice of `info.text`, and this proves a value built by
  // concatenation, not the original literal, still matches the cached entry
  const a = read("example-invoice.md");
  const b = `${a.slice(0, 10)}${a.slice(10)}`;
  expect(analyse(b)).toBe(analyse(a));
});

test("a different source string is a different analysis", () => {
  const first = analyse(read("example-invoice.md"));
  const second = analyse(read("example-invoice-drift.md"));
  expect(second).not.toBe(first);
  expect(second.source).not.toBe(first.source);
});

test("the analysis carries a model, a check result and decorations for the source", () => {
  const { model, result, decorations, located } = analyse(read("example-invoice.md"));
  expect(located.blocks.length).toBeGreaterThan(0);
  expect(model.sheets.size).toBeGreaterThan(0);
  expect(result.findings).toBeDefined();
  expect(decorations.length).toBeGreaterThan(0);
});
