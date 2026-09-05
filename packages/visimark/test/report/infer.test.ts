import { expect, test, describe } from "bun:test";
import { infer } from "../../src/infer/propose.js";
import { formatInfer } from "../../src/report/infer.js";
import { lineOf } from "../../src/report/lines.js";
import { strippedClean, strippedDrift } from "../examples.js";

const firstTable = (src: string): string =>
  formatInfer("invoice.md", src, infer(src)).split("\n\ninvoice.md")[0]!;

describe("the report keeps check's visual idiom with its own field layout", () => {
  test("the services table renders exactly as the design specifies", () => {
    expect(firstTable(strippedClean)).toBe(
      [
        "invoice.md  table at line 10 — 4 rows, 7 columns",
        "",
        "  column rules",
        "    Net    = Qty * Rate                       4/4 rows",
        "    VAT    = Net * 0.23                       4/4 rows",
        "    Gross  = Net + VAT                        4/4 rows",
        "",
        "  constants worth naming",
        '    0.23   also appears as "23%" in prose, line 18',
        "",
        "  scalars matching figures in prose",
        "    23300.00  line 17  = SUM(Net)                  net_total",
        "    5359.00   line 18  = SUM(VAT)                  vat_total",
        "    28659.00  line 19  = SUM(Gross)                gross_total",
        "",
        "  no rule found — treating as inputs",
        "    Item, Unit, Qty, Rate",
        "",
        "  also fits, not proposed",
        "    Gross = Net * 1.23        prefers a rule over materialised columns",
      ].join("\n"),
    );
  });

  test("a near-miss prints the disagreeing row and the difference", () => {
    expect(firstTable(strippedDrift)).toContain(
      [
        "  near-miss — not proposed",
        "    Net = Qty * Rate                          3/4 rows",
        "      row 4  On-call support",
        "      cell 3120.00, rule gives 5200.00        differs by 2080.00",
      ].join("\n"),
    );
  });

  test("the footer counts what was proposed across the file", () => {
    expect(formatInfer("i.md", strippedClean, infer(strippedClean))).toEndWith(
      "\n4 rules, 4 scalars, 4 anchors.",
    );
  });

  test("a document with nothing to say still says so", () => {
    expect(formatInfer("i.md", "# nothing\n", [])).toBe("0 rules, 0 scalars, 0 anchors.");
  });
});

describe("line numbers", () => {
  test("are 1-based and count newlines before the offset", () => {
    const s = "a\nbb\nccc";
    expect(lineOf(s, 0)).toBe(1);
    expect(lineOf(s, 2)).toBe(2);
    expect(lineOf(s, 5)).toBe(3);
    expect(lineOf(s, 999)).toBe(3);
  });
});
