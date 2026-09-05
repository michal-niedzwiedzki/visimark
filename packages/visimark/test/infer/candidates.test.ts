import { expect, test, describe } from "bun:test";
import { buildContext } from "../../src/infer/context.js";
import { columnCandidates } from "../../src/infer/candidates.js";
import { strippedClean } from "../examples.js";

const exact = (src: string, sheetIndex = 0) => {
  const ctx = buildContext(src);
  const sheet = ctx.sheets[sheetIndex]!;
  return columnCandidates(ctx, sheet, []).filter((c) => c.verdict.misses.length === 0);
};

describe("stages 1 and 2 find the rules the services table was built from", () => {
  const rules = exact(strippedClean).map((c) => c.rule);

  test("the product falls out of stage 1", () => {
    expect(rules).toContain("Net = Qty * Rate");
  });

  test("the sum falls out of stage 1", () => {
    expect(rules).toContain("Gross = Net + VAT");
  });

  test("the tax fraction falls out of stage 2", () => {
    expect(rules).toContain("VAT = Net * 0.23");
  });

  test("the algebraic inverses fit too — selection is what rejects them", () => {
    expect(rules).toContain("Net = Gross - VAT");
    expect(rules).toContain("Qty = Net / Rate");
  });

  test("a multiplier that only satisfies its own row is never generated", () => {
    // Rate = Net * 0.5 solves row 1 alone; it must not appear as exact
    expect(rules).not.toContain("Rate = Net * 0.5");
  });

  test("a constant with a long tail is not a constant anybody wrote", () => {
    for (const r of rules) {
      const m = /\* (\d+\.\d+)$/.exec(r);
      if (m) expect(m[1]!.split(".")[1]!.length).toBeLessThanOrEqual(6);
    }
  });
});

describe("degenerate operands", () => {
  const doc = `
| Item | Qty | Rate | Net  |
|------|----:|-----:|-----:|
| a    |   1 |  100 |  100 |
| b    |   1 |  200 |  200 |
| c    |   1 |  300 |  300 |
`;
  test("a constant operand that can be dropped makes the rule ambiguous", () => {
    const c = exact(doc).find((x) => x.rule === "Net = Qty * Rate");
    expect(c?.degenerateWith).toBe("Net = Rate");
  });

  test("a genuine product with varying operands is not degenerate", () => {
    const c = exact(strippedClean).find((x) => x.rule === "Net = Qty * Rate");
    expect(c?.degenerateWith).toBeUndefined();
  });
});
