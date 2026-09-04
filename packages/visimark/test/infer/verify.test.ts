import { expect, test, describe } from "bun:test";
import { buildContext } from "../../src/infer/context.js";
import { verifyColumn, verifyScalar } from "../../src/infer/verify.js";
import { strippedClean, strippedDrift } from "../examples.js";

const services = (src: string) => {
  const ctx = buildContext(src);
  return { ctx, sheet: ctx.sheets[0]! };
};

describe("verify runs the real evaluator against the stored cells", () => {
  test("a rule that reproduces every cell fits", () => {
    const { ctx, sheet } = services(strippedClean);
    const r = verifyColumn(ctx, sheet, "Net = Qty * Rate", []);
    expect(r.usable).toBe(true);
    expect(r.rows).toBe(4);
    expect(r.fits).toBe(4);
    expect(r.misses).toEqual([]);
  });

  test("a constant multiplier is verified at the column's own precision", () => {
    const { ctx, sheet } = services(strippedClean);
    expect(verifyColumn(ctx, sheet, "VAT = Net * 0.23", []).fits).toBe(4);
  });

  test("a rule that fits one row and no other is not a finding", () => {
    const { ctx, sheet } = services(strippedClean);
    // 1800/3600 solves row 1 exactly and nothing else
    const r = verifyColumn(ctx, sheet, "Rate = Net * 0.5", []);
    expect(r.fits).toBe(1);
    expect(r.misses).toHaveLength(3);
  });

  test("a candidate may lean on an already-accepted rule", () => {
    const { ctx, sheet } = services(strippedClean);
    const accepted = [{ sheet, rule: "VAT = Net * 0.23" }];
    const r = verifyColumn(ctx, sheet, "Gross = Net + VAT", accepted);
    expect(r.fits).toBe(4);
  });

  test("the disagreeing row is named, with both values", () => {
    const { ctx, sheet } = services(strippedDrift);
    const r = verifyColumn(ctx, sheet, "Net = Qty * Rate", []);
    expect(r.fits).toBe(3);
    expect(r.misses).toHaveLength(1);
    expect(r.misses[0]).toMatchObject({
      rowLabel: "On-call support",
      stored: "3120.00",
      computed: "5200.00",
    });
  });

  test("a rule naming a column that does not exist is unusable", () => {
    const { ctx, sheet } = services(strippedClean);
    expect(verifyColumn(ctx, sheet, "Net = Qty * Nope", []).usable).toBe(false);
  });

  test("a reduce is evaluated to one value", () => {
    const { ctx, sheet } = services(strippedClean);
    const r = verifyScalar(ctx, sheet, "net_total = SUM(Net)", []);
    expect(r.usable).toBe(true);
    expect(r.text(2)).toBe("23300.00");
  });

  test("a reduce over a foreign column resolves by qualified name", () => {
    const ctx = buildContext(strippedClean);
    const r = verifyScalar(ctx, ctx.sheets[1]!, "scheduled = SUM(Amount)", []);
    expect(r.text(2)).toBe("28659.00");
  });
});
