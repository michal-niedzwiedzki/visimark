import { expect, test } from "bun:test";
import { foldDomain, isEmptyDomain, testDomain, type Domain } from "../../src/lang/domain.js";

const range = (
  lo: string | undefined,
  loClosed: boolean,
  hi: string | undefined,
  hiClosed: boolean,
): Domain => ({
  parts: [{ kind: "range", lo, loClosed, hi, hiClosed, text: `[${lo ?? ""}, ${hi ?? ""}]` }],
});
const set = (members: string[]): Domain => ({
  parts: [{ kind: "set", members, text: `{ ${members.join(", ")} }` }],
});
const preset = (name: "integer" | "positive" | "natural" | "positive integer"): Domain => ({
  parts: [{ kind: "preset", name, text: name }],
});
const withPreset = (
  name: "integer" | "positive" | "natural" | "positive integer",
  d: Domain,
): Domain => ({ parts: [{ kind: "preset", name, text: name }, ...d.parts] });

test("closed range: interior, bounds, outside", () => {
  const d = range("0", true, "80", true);
  expect(testDomain(d, "40")).toBe(true);
  expect(testDomain(d, "0")).toBe(true);
  expect(testDomain(d, "80")).toBe(true);
  expect(testDomain(d, "-1")).toBe(false);
  expect(testDomain(d, "81")).toBe(false);
});

test("half-open range excludes the open end", () => {
  const d = range("0", true, "40", false);
  expect(testDomain(d, "40")).toBe(false);
  expect(testDomain(d, "39")).toBe(true);
});

test("unbounded lower end", () => {
  const d = range(undefined, false, "40", true);
  expect(testDomain(d, "-1000000")).toBe(true);
  expect(testDomain(d, "41")).toBe(false);
});

test("finite set membership and percent normalization", () => {
  const d = set(["0.30", "0.40", "0.45", "0.50"]);
  expect(testDomain(d, "0.40")).toBe(true);
  expect(testDomain(d, "0.35")).toBe(false);
});

test("integer preset alone", () => {
  const d = preset("integer");
  expect(testDomain(d, "-3")).toBe(true);
  expect(testDomain(d, "2.5")).toBe(false);
});

test("integer intersected with a range", () => {
  const d = withPreset("integer", range("0", true, "80", true));
  expect(testDomain(d, "40.5")).toBe(false);
  expect(testDomain(d, "81")).toBe(false);
  expect(testDomain(d, "40")).toBe(true);
});

test("natural includes zero, excludes negatives", () => {
  const d = preset("natural");
  expect(testDomain(d, "0")).toBe(true);
  expect(testDomain(d, "-1")).toBe(false);
});

test("positive integer excludes zero, includes one", () => {
  const d = preset("positive integer");
  expect(testDomain(d, "0")).toBe(false);
  expect(testDomain(d, "1")).toBe(true);
});

test("positive alone: fraction yes, zero no", () => {
  const d = preset("positive");
  expect(testDomain(d, "0.001")).toBe(true);
  expect(testDomain(d, "0")).toBe(false);
});

test("empty domain: reversed range", () => {
  expect(isEmptyDomain(range("10", true, "0", true))).toBe(true);
});

test("empty domain: empty set literal", () => {
  expect(isEmptyDomain(set([]))).toBe(true);
});

test("empty domain: integer preset intersected with a fractional range", () => {
  expect(isEmptyDomain(withPreset("integer", range("0.2", true, "0.8", true)))).toBe(true);
});

test("non-empty: narrow positive range at fine precision is not flagged empty", () => {
  // A stated non-goal: general precision-grid emptiness is not detected.
  expect(isEmptyDomain(withPreset("positive", range("0.001", true, "0.002", true)))).toBe(false);
});

test("non-empty: ordinary range", () => {
  expect(isEmptyDomain(range("0", true, "80", true))).toBe(false);
});

test("fold: explicit set", () => {
  expect(foldDomain(set(["0.3", "0.4"]))).toEqual(["0.3", "0.4"]);
});

test("fold: integer range", () => {
  expect(foldDomain(withPreset("integer", range("0", true, "3", true)))).toEqual([
    "0",
    "1",
    "2",
    "3",
  ]);
});

test("fold: unbounded or non-integer range is undefined", () => {
  expect(foldDomain(range("0", true, "80", true))).toBeUndefined();
  expect(foldDomain(preset("positive"))).toBeUndefined();
});

test("fold: an integer range past the fold-size cap is undefined, not enumerated", () => {
  // A hang/OOM regression guard: `eval --json`/`explain --json` must not
  // block walking a billion-point range. 10,000 is the documented cap
  // (spec §6); this exercises just past it without actually iterating 1e9
  // times if the cap were broken (a wall-clock bound keeps it honest).
  const huge = withPreset("integer", range("0", true, "1000000000", true));
  const start = Date.now();
  expect(foldDomain(huge)).toBeUndefined();
  expect(Date.now() - start).toBeLessThan(1000);
});

test("fold: an integer range exactly at the cap still enumerates", () => {
  const atCap = withPreset("integer", range("1", true, "10000", true));
  expect(foldDomain(atCap)?.length).toBe(10000);
});
