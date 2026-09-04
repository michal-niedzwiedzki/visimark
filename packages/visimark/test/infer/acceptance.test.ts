import { expect, test, describe } from "bun:test";
import { check } from "../../src/eval/check.js";
import { infer } from "../../src/infer/propose.js";
import { planInfer } from "../../src/infer/write.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";
import { formatCheck } from "../../src/report/format.js";
import { applyEdits } from "../../src/write/splice.js";
import { clean, strippedClean, strippedDrift } from "../examples.js";

const proposals = infer(strippedClean);
const rule = (name: string): string | undefined =>
  proposals.find((p) => p.kind === "column" && p.name === name)?.rule;
const scalar = (name: string) =>
  proposals.find((p) => p.kind === "scalar" && p.name === name);

const recovered = applyEdits(strippedClean, planInfer(strippedClean));

describe("what inference recovers from the stripped worked invoice", () => {
  test("the fixture really is the worked example with its mechanics removed", () => {
    expect(strippedClean).not.toBe(clean);
    expect(locate(strippedClean).blocks).toEqual([]);
    expect(locate(strippedClean).anchors).toEqual([]);
    expect(locate(strippedClean).tables).toHaveLength(2);
  });

  test("#unnamed1 — the services table", () => {
    expect(rule("Net")).toBe("Net = Qty * Rate");
    expect(rule("VAT")).toBe("VAT = Net * 0.23");
    expect(rule("Gross")).toBe("Gross = Net + VAT");
  });

  test("#unnamed1 — the three totals, anchored in the prose that states them", () => {
    for (const [name, value] of [
      ["net_total", "23300.00"],
      ["vat_total", "5359.00"],
      ["gross_total", "28659.00"],
    ]) {
      const s = scalar(name!)!;
      expect(s.sheetId).toBe("unnamed1");
      expect(s.anchorSite).toBeDefined();
      expect(
        strippedClean.slice(s.anchorSite!.start, s.anchorSite!.end),
      ).toBe(value!);
    }
  });

  test("#unnamed2 — the schedule table, through stage 4", () => {
    const amount = proposals.find((p) => p.kind === "column" && p.name === "Amount")!;
    expect(amount.rule).toBe("Amount = Share * unnamed1.gross_total");
    expect(amount.stage).toBe(4);
    expect(scalar("amount_total")?.rule).toBe("amount_total = SUM(Amount)");
  });

  test("both sheet ids were minted, in document order", () => {
    expect([...new Set(proposals.map((p) => p.sheetId))]).toEqual([
      "unnamed1",
      "unnamed2",
      "",
    ]);
    expect(proposals.every((p) => p.sheetId === "" || p.mintedSheetId)).toBe(true);
  });
});

describe("what inference must not recover — the more valuable half", () => {
  test("the constant is detected and never named", () => {
    expect(rule("VAT")).not.toContain("vat");
    const c = proposals.find((p) => p.kind === "constant")!;
    expect(c.name).toBe("0.23");
    expect(c.constantEcho?.text).toBe("23%");
  });

  test("#terms and #recon are outside every candidate space", () => {
    const names = proposals.map((p) => p.name);
    expect(names).not.toContain("early_pay_total");
    expect(names).not.toContain("early_pay_saved");
    expect(names).not.toContain("eur_total");
    expect(names).not.toContain("scheduled");
    expect(names).not.toContain("variance");
  });

  test("the reconciliation figures are ambiguous, so nothing is anchored", () => {
    const loose = proposals.filter((p) => p.kind === "ambiguous" && p.sheetId === "");
    expect(loose).toHaveLength(2);
    for (const p of loose) {
      expect(p.name).toBe("28659.00");
      expect(p.alternatives).toEqual([
        "unnamed1.gross_total = SUM(Gross)",
        "unnamed2.amount_total = SUM(Amount)",
      ]);
    }
    expect(recovered).toContain(
      "Scheduled instalments total **28659.00** PLN against a\n" +
        "gross invoice value of **28659.00** PLN, leaving a\n" +
        "variance of **0.00** PLN.",
    );
  });
});

describe("check on the written result", () => {
  const result = check(build(locate(recovered)));

  test("reports 0 problems", () => {
    expect(result.findings).toEqual([]);
    expect(formatCheck("recovered.md", result.findings)).toContain(
      "0 problems (0 stale, 0 errors)",
    );
  });

  test("and does so while six prose figures remain underived", () => {
    // Nothing in the document claims them: this is the green-check hole, not a
    // bug in inference, and widening the search is not the fix. See section 15.
    const underived = ["28085.82", "573.18", "6719.58", "28659.00", "0.00"];
    const doc = locate(recovered);
    const orphans = doc.figures.filter(
      (f) => !f.anchored && underived.includes(f.text) && f.value.kind === "strong",
    );
    expect(orphans).toHaveLength(6);
  });

  test("changing an input makes check complain", () => {
    const broken = recovered.replace("|   2 | 1800.00 |", "|   3 | 1800.00 |");
    expect(check(build(locate(broken))).findings.length).toBeGreaterThan(0);
  });

  test("fmt on the recovered document is a no-op", () => {
    expect(applyEdits(recovered, [])).toBe(recovered);
  });
});

describe("the drift invoice, stripped the same way", () => {
  const nm = infer(strippedDrift).find((p) => p.kind === "near-miss" && p.name === "Net")!;

  test("Net is a near-miss naming row 4", () => {
    expect(nm.rule).toBe("Net = Qty * Rate");
    expect(nm.fits).toBe(3);
    expect(nm.rows).toBe(4);
    expect(nm.disagreement).toMatchObject({
      rowIndex: 3,
      rowLabel: "On-call support",
      stored: "3120.00",
      computed: "5200.00",
    });
  });

  test("a near-miss is never written, even under --write", () => {
    const out = applyEdits(strippedDrift, planInfer(strippedDrift));
    expect(out).not.toContain("Net   = Qty * Rate");
    expect(out).not.toContain("Net = Qty * Rate\n");
  });
});
