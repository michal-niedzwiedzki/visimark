import { expect, test } from "bun:test";
import { drift } from "../examples.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

const run = (s: string) => check(build(locate(s)));

test("every finding except NOTE and the anchor group carries a span", () => {
  const findings = run(drift).findings;
  const missing = findings.filter(
    (f) => f.code !== "NOTE" && !f.anchorGroup && f.span === undefined,
  );
  expect(missing.map((f) => `${f.code} ${f.sheetId}.${f.name}`)).toEqual([]);
});

test("spans are well formed and inside the source", () => {
  const findings = run(drift).findings;
  for (const f of findings) {
    if (!f.span) continue;
    expect(f.span.start).toBeGreaterThanOrEqual(0);
    expect(f.span.end).toBeGreaterThanOrEqual(f.span.start);
    expect(f.span.end).toBeLessThanOrEqual(drift.length);
  }
});

test("a STALE cell span selects exactly the stored text", () => {
  const f = run(drift).findings.find(
    (x) => x.code === "STALE" && x.rowLabel && x.stored,
  )!;
  expect(drift.slice(f.span!.start, f.span!.end)).toBe(f.stored!);
});

test("a DATE span selects exactly the offending literal", () => {
  const f = run(drift).findings.find((x) => x.code === "DATE")!;
  expect(drift.slice(f.span!.start, f.span!.end)).toBe(f.raw!);
});

test("an UNDEF span selects exactly the unknown reference", () => {
  const f = run(drift).findings.find((x) => x.code === "UNDEF")!;
  expect(drift.slice(f.span!.start, f.span!.end)).toBe(f.raw!);
});
