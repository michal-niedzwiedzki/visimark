import { expect, test, describe } from "bun:test";
import { columnCandidates } from "../../src/infer/candidates.js";
import { buildContext } from "../../src/infer/context.js";
import { select } from "../../src/infer/select.js";
import { strippedClean, strippedDrift } from "../examples.js";

const run = (src: string, i = 0) => {
  const ctx = buildContext(src);
  const sheet = ctx.sheets[i]!;
  return select(columnCandidates(ctx, sheet, []));
};

describe("selection produces an acyclic set", () => {
  const s = run(strippedClean);
  const rules = s.accepted.map((c) => c.rule);

  test("the inverse of an accepted rule is never also accepted", () => {
    expect(rules).toContain("Gross = Net + VAT");
    expect(rules).not.toContain("Net = Gross - VAT");
    expect(rules).not.toContain("VAT = Gross - Net");
  });

  test("an operand column keeps no rule of its own", () => {
    expect(rules).not.toContain("Qty = Net / Rate");
    expect(rules).not.toContain("Rate = Net / Qty");
  });

  test("the three rules of the services table, and only those", () => {
    expect(rules).toEqual(["Net = Qty * Rate", "Gross = Net + VAT", "VAT = Net * 0.23"]);
  });

  test("the constant form is reported as a rival, not proposed", () => {
    expect(s.alsoFits.map((a) => a.candidate.rule)).toEqual(["Gross = Net * 1.23"]);
    expect(s.alsoFits[0]!.reason).toBe("prefers a rule over materialised columns");
  });

  test("a rearrangement of an accepted rule is not offered as a rival", () => {
    expect(s.alsoFits.map((a) => a.candidate.rule)).not.toContain("Net = Gross - VAT");
  });
});

describe("evidence floors", () => {
  const body = (rows: string[]) =>
    ["| Item | A | B | C |", "|------|--:|--:|--:|", ...rows].join("\n");

  test("one row is never reported", () => {
    const s = run(body(["| a | 2 | 3 | 6 |"]));
    expect(s.accepted).toEqual([]);
    expect(s.weak).toEqual([]);
    expect(s.nearMisses).toEqual([]);
  });

  test("two rows are reported and marked weak", () => {
    const s = run(body(["| a | 2 | 3 | 6 |", "| b | 4 | 5 | 20 |"]));
    expect(s.accepted).toEqual([]);
    expect(s.weak.map((c) => c.rule)).toContain("C = A * B");
  });

  test("three rows are proposable", () => {
    const s = run(body(["| a | 2 | 3 | 6 |", "| b | 4 | 5 | 20 |", "| c | 6 | 7 | 42 |"]));
    expect(s.accepted.map((c) => c.rule)).toContain("C = A * B");
    expect(s.weak).toEqual([]);
  });
});

describe("near-misses", () => {
  const s = run(strippedDrift);

  test("the wrong row is named, with both values and the difference", () => {
    const nm = s.nearMisses.find((c) => c.target === "Net");
    expect(nm?.rule).toBe("Net = Qty * Rate");
    expect(nm?.verdict.misses[0]).toMatchObject({
      rowLabel: "On-call support",
      stored: "3120.00",
      computed: "5200.00",
    });
  });

  test("a near-miss is never accepted", () => {
    expect(s.accepted.map((c) => c.rule)).toEqual(["VAT = Net * 0.23"]);
  });

  test("the inverse view of the same defect is not reported twice", () => {
    expect(s.nearMisses.map((c) => c.target)).toEqual(["Net", "Gross"]);
  });
});
