import { expect, test } from "bun:test";
import { clean, drift } from "../examples.js";
import { fmt } from "../../src/write/fmt.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

test("fmt leaves the clean invoice byte-for-byte identical", () => {
  const r = fmt(clean, {});
  expect(r.changed).toBe(false);
  expect(r.output).toBe(clean);
});

test("fmt repairs every STALE finding in the drift invoice", () => {
  const r = fmt(drift, {});
  expect(r.changed).toBe(true);
  const after = check(build(locate(r.output)));
  expect(after.findings.filter((f) => f.code === "STALE")).toEqual([]);
  // the five errors survive
  const codes = after.findings.map((f) => String(f.code)).sort();
  expect(codes).toEqual(["CYCLE", "DATE", "DATE", "NOTE", "UNDEF", "VECTOR"].sort());
  expect(r.unfixable.map((f) => String(f.code)).sort()).toEqual(
    ["CYCLE", "DATE", "DATE", "NOTE", "UNDEF", "VECTOR"].sort(),
  );
});

test("fmt --fix-dates rewrites the decidable date only", () => {
  const r = fmt(drift, { fixDates: true });
  // the schedule table row is repaired
  expect(r.output).toContain("| 12486.96 | 2026-10-15 |");
  // the ambiguous date is untouched
  expect(r.output).toContain("| 11/12/2026 |");
  expect(r.datesFixed).toBe(1);
  // without the flag the decidable date stays put
  expect(fmt(drift, {}).output).toContain("| 15.10.2026 |");
});

test("fmt is idempotent", () => {
  for (const src of [clean, drift]) {
    const once = fmt(src, {}).output;
    const twice = fmt(once, {}).output;
    expect(twice).toBe(once);
  }
  const d1 = fmt(drift, { fixDates: true }).output;
  const d2 = fmt(d1, { fixDates: true }).output;
  expect(d2).toBe(d1);
});

test("a one-cell corruption produces a one-line diff", () => {
  const corrupted = clean.replace("| 50.00 |", "| 51.00 |");
  // fall back: the clean invoice has no `50.00`; corrupt the first Net cell
  const src = clean.includes("| 50.00 |") ? corrupted : clean.replace("3600.00", "3600.01");
  const out = fmt(src, {}).output;
  const changedLines = diffLines(src, out);
  expect(changedLines).toBe(1);
});

function diffLines(a: string, b: string): number {
  const la = a.split("\n");
  const lb = b.split("\n");
  let n = 0;
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) n++;
  }
  return n;
}
