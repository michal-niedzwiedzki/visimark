// The quest engine's data contract: what docs/playground/scenarios.json is
// allowed to say, and what each check actually detects.
//
// This is the half of src/playground/app/ that needs no DOM — normalizeStep
// and the CHECKS predicates are pure functions over JSON — and it is the half
// worth pinning, because scenarios.json is data a future chapter will edit
// without touching any code. Before review §2.4 none of it could be tested at
// all: it lived inside playground.html's <script> tag.

import { describe, expect, test } from "bun:test";
import { CHECKS, PARAMETRIC_CHECKS } from "../../../src/playground/app/checks.js";
import { normalizeQuest, normalizeStep } from "../../../src/playground/app/quest.js";
import type { EvalContext, RawStep } from "../../../src/playground/app/types.js";

function ctx(over: Partial<EvalContext> = {}): EvalContext {
  return {
    evalResult: { assertions: [], charts: [] },
    baselineJson: JSON.stringify({ assertions: [], charts: [] }),
    hasStale: false,
    baselineHasStale: false,
    sourceChanged: false,
    ...over,
  };
}

describe("normalizeStep", () => {
  test("a tab step derives both its id and its action from group/tab", () => {
    const step = normalizeStep({ kind: "tab", text: "t", group: "diag", tab: "knowledge" }, 0);
    expect(step.id).toBe("tab:diag:knowledge");
    expect(step.action).toBe("tab:diag:knowledge");
  });

  test("an explicit id wins over the derived one", () => {
    const step = normalizeStep({ kind: "tab", id: "look", text: "t", group: "diag", tab: "x" }, 0);
    expect(step.id).toBe("look");
  });

  test("a text step carries its substring, not a predicate", () => {
    const step = normalizeStep({ kind: "text", text: "t", contains: "158.00" }, 3);
    expect(step.textContains).toBe("158.00");
    expect(step.id).toBe("text:3");
  });

  test("a manual step is the only kind that can be ticked by clicking", () => {
    expect(normalizeStep({ kind: "manual", text: "t" }, 1).manual).toBe(true);
    expect(normalizeStep({ kind: "text", text: "t", contains: "x" }, 1).manual).toBeUndefined();
  });

  test("an unknown check name is refused, naming it", () => {
    const raw = { kind: "eval", text: "t", check: "vibes" } as RawStep;
    expect(() => normalizeStep(raw, 0)).toThrow(/unknown check "vibes"/);
  });

  test("an unknown step kind is refused, naming it", () => {
    const raw = { kind: "teleport", text: "t" } as unknown as RawStep;
    expect(() => normalizeStep(raw, 0)).toThrow(/unknown step kind "teleport"/);
  });

  test("column-added without a column is refused rather than matching nothing", () => {
    const raw = { kind: "eval", text: "t", check: "column-added" } as RawStep;
    expect(() => normalizeStep(raw, 0)).toThrow(/needs a "column"/);
  });

  test("an absent quest normalizes to no steps", () => {
    expect(normalizeQuest(undefined)).toEqual([]);
  });
});

describe("CHECKS", () => {
  test("value-changed compares the whole eval result against the baseline", () => {
    expect(CHECKS["value-changed"]!(ctx())).toBe(false);
    expect(
      CHECKS["value-changed"]!(ctx({ evalResult: { assertions: [], charts: [], "s.Total": "9" } })),
    ).toBe(true);
  });

  test("source-changed is the only check a formula-free document can satisfy", () => {
    expect(CHECKS["source-changed"]!(ctx())).toBe(false);
    expect(CHECKS["source-changed"]!(ctx({ sourceChanged: true }))).toBe(true);
    // 01-tables.md has no vmark rules, so eval never moves however much you type
    expect(CHECKS["value-changed"]!(ctx({ sourceChanged: true }))).toBe(false);
  });

  test("stale-fixed needs the drift to have been there first", () => {
    expect(CHECKS["stale-fixed"]!(ctx({ baselineHasStale: true, hasStale: false }))).toBe(true);
    expect(CHECKS["stale-fixed"]!(ctx({ baselineHasStale: false, hasStale: false }))).toBe(false);
    expect(CHECKS["stale-fixed"]!(ctx({ baselineHasStale: true, hasStale: true }))).toBe(false);
  });

  test("assertion-passing is false for a document with no assertions at all", () => {
    expect(CHECKS["assertion-passing"]!(ctx())).toBe(false);
    expect(
      CHECKS["assertion-passing"]!(
        ctx({ evalResult: { assertions: [{ holds: true }], charts: [] } }),
      ),
    ).toBe(true);
    expect(
      CHECKS["assertion-passing"]!(
        ctx({ evalResult: { assertions: [{ holds: true }, { holds: null }], charts: [] } }),
      ),
    ).toBe(false);
  });

  test("assertion-failing ignores an assertion a failed dependency suppressed", () => {
    expect(
      CHECKS["assertion-failing"]!(
        ctx({ evalResult: { assertions: [{ holds: null }], charts: [] } }),
      ),
    ).toBe(false);
    expect(
      CHECKS["assertion-failing"]!(
        ctx({ evalResult: { assertions: [{ holds: false }], charts: [] } }),
      ),
    ).toBe(true);
  });

  test("charts-regenerated needs a rendered SVG and a changed result", () => {
    const withChart = { assertions: [], charts: [{ svg: "<svg/>" }] };
    expect(
      CHECKS["charts-regenerated"]!(
        ctx({ evalResult: withChart, baselineJson: JSON.stringify(withChart) }),
      ),
    ).toBe(false);
    expect(CHECKS["charts-regenerated"]!(ctx({ evalResult: withChart }))).toBe(true);
    // a chart the engine could not build carries no svg, so nothing regenerated
    expect(
      CHECKS["charts-regenerated"]!(ctx({ evalResult: { assertions: [], charts: [{}] } })),
    ).toBe(false);
  });

  test("column-added matches a bare name against the sheet-qualified key", () => {
    const columnAdded = PARAMETRIC_CHECKS["column-added"]!;
    const after = ctx({ evalResult: { assertions: [], charts: [], "order.Discount": "1, 2" } });
    expect(columnAdded(after, "Discount")).toBe(true);
    expect(columnAdded(after, "Total")).toBe(false);
    // already present at baseline — adding nothing does not complete the step
    const present = ctx({
      evalResult: { assertions: [], charts: [], "order.Discount": "1" },
      baselineJson: JSON.stringify({ assertions: [], charts: [], "order.Discount": "0" }),
    });
    expect(columnAdded(present, "Discount")).toBe(false);
  });
});
