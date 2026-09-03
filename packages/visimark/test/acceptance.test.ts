import { expect, test, describe } from "bun:test";
import { clean, drift } from "./examples.js";
import { locate } from "../src/parse/document.js";
import { build } from "../src/model/build.js";
import { check } from "../src/eval/check.js";
import { fmt } from "../src/write/fmt.js";
import { formatCheck } from "../src/report/format.js";

const run = (s: string) => check(build(locate(s)));

describe("the two worked examples are the acceptance suite", () => {
  test("example-invoice.md: zero findings", () => {
    const r = run(clean);
    expect(r.findings).toEqual([]);
    expect(r.exitCode).toBe(0);
  });

  test("example-invoice.md: fmt is byte-for-byte identical", () => {
    expect(fmt(clean, {}).output).toBe(clean);
  });

  test("example-invoice-drift.md: check output equals the doc's own transcript", () => {
    const all = drift.split("\n");
    const start = all.findIndex((l) => l.trim() === "```console");
    const end = all.findIndex((l, i) => i > start && l.trim() === "```");
    const expected = all.slice(start + 2, end).join("\n");
    expect(formatCheck("docs/example-invoice-drift.md", run(drift).findings)).toBe(
      expected,
    );
  });

  test("example-invoice-drift.md: 26 problems (21 stale, 5 errors) plus one NOTE", () => {
    const f = run(drift).findings;
    const stale = f
      .filter((x) => x.code === "STALE")
      .reduce((n, x) => n + (x.anchorGroup ? x.suppressedCount! : 1), 0);
    const errorCodes = new Set(["DATE", "UNDEF", "VECTOR", "CYCLE", "TYPE", "SHEET", "ANCHOR"]);
    expect(stale).toBe(21);
    expect(f.filter((x) => errorCodes.has(x.code)).length).toBe(5);
    expect(f.filter((x) => x.code === "NOTE").length).toBe(1);
  });

  test("fmt is idempotent on both examples", () => {
    for (const src of [clean, drift]) {
      const once = fmt(src, {}).output;
      expect(fmt(once, {}).output).toBe(once);
    }
  });

  test("fmt clears every STALE finding in the drift invoice", () => {
    const fixed = fmt(drift, {}).output;
    expect(run(fixed).findings.filter((x) => x.code === "STALE")).toEqual([]);
  });
});
