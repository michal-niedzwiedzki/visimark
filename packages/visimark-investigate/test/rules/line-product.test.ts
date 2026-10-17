import { describe, expect, test } from "bun:test";
import { lineProduct } from "../../src/rules/line-product.js";
import { runRule } from "../support.js";

const table = (...rows: string[]) =>
  ["| Item | Qty | Price | Cost |", "|---|---:|---:|---:|", ...rows].join("\n") + "\n";

describe("line-product", () => {
  test("needs two agreeing rows", () => {
    const three = table(
      "| A | 2 | 5.00 | 10.00 |",
      "| B | 3 | 4.00 | 13.00 |",
      "| C | 1 | 7.00 | 7.00 |",
    );
    expect(runRule(lineProduct, "a.md", three).shaped.map((f) => f.id)).toEqual(["a.md#t1/Cost/B"]);
    const two = table("| A | 2 | 5.00 | 10.00 |", "| B | 3 | 4.00 | 13.00 |");
    expect(runRule(lineProduct, "a.md", two).findings).toEqual([]);
  });

  test("two wrong rows: no finding", () => {
    const text = table(
      "| A | 2 | 5.00 | 10.00 |",
      "| B | 3 | 4.00 | 13.00 |",
      "| C | 1 | 7.00 | 8.00 |",
      "| D | 4 | 2.00 | 8.00 |",
    );
    expect(runRule(lineProduct, "a.md", text).findings).toEqual([]);
  });

  test("factor columns must be left of the product", () => {
    const text = [
      "| Item | Cost | Qty | Price |",
      "|---|---:|---:|---:|",
      "| A | 10.00 | 2 | 5.00 |",
      "| B | 13.00 | 3 | 4.00 |",
      "| C | 7.00 | 1 | 7.00 |",
      "| D | 8.00 | 4 | 2.00 |",
    ].join("\n");
    expect(runRule(lineProduct, "a.md", text).findings).toEqual([]);
  });

  test("exact: 0.1 × 3 = 0.30 holds", () => {
    const text = table(
      "| A | 3 | 0.1 | 0.30 |",
      "| B | 3 | 0.7 | 2.10 |",
      "| C | 3 | 0.3 | 0.90 |",
      "| D | 3 | 0.2 | 0.60 |",
    );
    const r = runRule(lineProduct, "a.md", text);
    expect(r.findings).toEqual([]);
    expect(r.checked).toEqual(["a.md#t1"]);
  });

  test("total rows are not line items", () => {
    const text = table(
      "| A | 2 | 5.00 | 10.00 |",
      "| B | 3 | 4.00 | 12.00 |",
      "| C | 1 | 7.00 | 7.00 |",
      "| Total | | | 29.00 |",
    );
    expect(runRule(lineProduct, "a.md", text).findings).toEqual([]);
  });
});
