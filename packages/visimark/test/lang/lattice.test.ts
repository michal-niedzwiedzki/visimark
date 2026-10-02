import { describe, expect, test } from "bun:test";
import type { Domain } from "../../src/lang/domain.js";
import { analyzeLattice, isIntegral, latticeJson } from "../../src/lang/lattice.js";
import { parseStatement } from "../../src/lang/parser.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §3.1

function domainOf(clause: string): Domain {
  const s = parseStatement(`param x precision 3 ${clause} = default 0`);
  if ("type" in s || s.domain === undefined) throw new Error(`no domain: ${clause}`);
  return s.domain;
}

function run(clause: string, step: string, opts: { text?: string; percent?: boolean } = {}) {
  return analyzeLattice({
    name: "x",
    domain: domainOf(clause),
    step,
    stepText: opts.text ?? step,
    percent: opts.percent ?? false,
  });
}

describe("the sweep points of a lattice (spec §3.1)", () => {
  test("closed ends are both visited", () => {
    expect(run("in [0%, 10%]", "0.01", { text: "1%", percent: true })).toEqual({
      ok: true,
      first: "0",
      last: "0.1",
      count: 11,
    });
  });
  test("an integral domain anchored at 0", () => {
    expect(run("integer in [0, 80]", "20")).toEqual({ ok: true, first: "0", last: "80", count: 5 });
  });
  test("anchored at the lower end, not at 0", () => {
    expect(run("integer in [3, 83]", "20")).toEqual({ ok: true, first: "3", last: "83", count: 5 });
  });
  test("a negative lower end anchors there", () => {
    expect(run("integer in [-10, 10]", "5")).toEqual({
      ok: true,
      first: "-10",
      last: "10",
      count: 5,
    });
  });
  test("integral rounding that misses the step is a fault", () => {
    const r = run("integer in [2.5, 22.5]", "5");
    expect(r).toEqual({
      ok: false,
      message:
        "lattice step 5 does not reach the end of [2.5, 22.5]: 22 is not a multiple of 5 above 3",
    });
  });
  test("open ends are dropped", () => {
    expect(run("in (0, 10)", "5")).toEqual({ ok: true, first: "5", last: "5", count: 1 });
    expect(run("integer in (0, 10)", "1")).toEqual({ ok: true, first: "1", last: "9", count: 9 });
  });
  test("positive makes the low end open at 0", () => {
    expect(run("positive in [0, 10]", "5")).toEqual({ ok: true, first: "5", last: "10", count: 2 });
  });
  test("the last point is never silently dropped", () => {
    expect(run("in [0, 10]", "3")).toEqual({
      ok: false,
      message:
        "lattice step 3 does not reach the end of [0, 10]: 10 is not a multiple of 3 above 0",
    });
  });
  test("a one-point interval is legal", () => {
    expect(run("in [3, 3]", "1")).toEqual({ ok: true, first: "3", last: "3", count: 1 });
  });
  test("a step equal to the span visits both ends", () => {
    expect(run("in [0, 5]", "5")).toEqual({ ok: true, first: "0", last: "5", count: 2 });
  });
  test("no point remains", () => {
    expect(run("in (0, 5)", "5")).toEqual({
      ok: false,
      message: "lattice step 5 leaves no point in (0, 5)",
    });
  });
  test("a wide span is counted, never enumerated", () => {
    expect(run("in [0, 1000000000]", "1")).toEqual({
      ok: true,
      first: "0",
      last: "1000000000",
      count: 1000000001,
    });
  });
  test("an intersection takes the tighter bound", () => {
    expect(run("natural in [0, 40)", "10")).toEqual({ ok: true, first: "0", last: "30", count: 4 });
  });
});

describe("the faults before the points (spec §4.1)", () => {
  test("no domain", () => {
    expect(analyzeLattice({ name: "x", step: "5", stepText: "5", percent: false })).toEqual({
      ok: false,
      message: "param x declares a lattice but no domain",
    });
  });
  test("a set", () => {
    expect(run("in { 1, 2 }", "1")).toEqual({
      ok: false,
      message: "param x declares a lattice, but a set already lists its points",
    });
  });
  test("no upper bound, no lower bound", () => {
    expect(run("natural", "5")).toEqual({
      ok: false,
      message: "param x declares a lattice, but its domain has no upper bound",
    });
    expect(run("in (, 10]", "5")).toEqual({
      ok: false,
      message: "param x declares a lattice, but its domain has no lower bound",
    });
  });
  test("a step that is not positive", () => {
    for (const s of ["0", "-5"]) {
      expect(run("in [0, 10]", s)).toEqual({ ok: false, message: "lattice step must be positive" });
    }
  });
  test("a fractional step on an integral domain", () => {
    expect(run("integer in [0, 80]", "2.5")).toEqual({
      ok: false,
      message: "lattice step 2.5 must be a whole number: param x is an integer domain",
    });
  });
  test("a percent param prints its numbers as percents", () => {
    expect(run("in [0%, 10%]", "0.03", { text: "3%", percent: true })).toEqual({
      ok: false,
      message:
        "lattice step 3% does not reach the end of [0%, 10%]: 10% is not a multiple of 3% above 0%",
    });
  });
});

describe("isIntegral and latticeJson", () => {
  test("integral exactly when an integer-valued preset is present", () => {
    expect(isIntegral(domainOf("integer"))).toBe(true);
    expect(isIntegral(domainOf("natural in [0, 8)"))).toBe(true);
    expect(isIntegral(domainOf("positive integer"))).toBe(true);
    expect(isIntegral(domainOf("positive"))).toBe(false);
    expect(isIntegral(domainOf("in [0, 80]"))).toBe(false);
    expect(isIntegral(domainOf("in { 1, 2 }"))).toBe(false);
  });
  test("latticeJson is the canonical decimal", () => {
    expect(latticeJson({ step: "0.010", literal: { text: "1%", percent: true } })).toEqual({
      step: "0.01",
    });
  });
});
