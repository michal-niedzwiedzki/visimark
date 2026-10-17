import { describe, expect, test } from "bun:test";
import { totalRow } from "../../src/rules/total-row.js";
import { runRule } from "../support.js";

const table = (...rows: string[]) => ["| Item | Cost |", "|---|---:|", ...rows].join("\n") + "\n";

describe("total-row", () => {
  test("unreadable cell skips the column and counts 1", () => {
    const r = runRule(
      totalRow,
      "a.md",
      table("| A | 200+ |", "| B | 5 |", "| C | 5 |", "| Total | 99 |"),
    );
    expect(r.findings).toEqual([]);
    expect(r.unreadable).toBe(1);
  });

  test("one term is not enough", () => {
    const r = runRule(totalRow, "a.md", table("| A | 5 |", "| Total | 9 |"));
    expect(r.findings).toEqual([]);
    expect(r.checked).toEqual([]);
  });

  test("a price column totalled as qty*price is not a finding", () => {
    const text = [
      "| Item | Qty | Price |",
      "|---|---:|---:|",
      "| A | 2 | 5.00 |",
      "| B | 3 | 4.00 |",
      "| Total | | 22.00 |",
    ].join("\n");
    expect(runRule(totalRow, "a.md", text).findings).toEqual([]);
  });

  test("total rounded coarser than its rows agrees", () => {
    const r = runRule(
      totalRow,
      "a.md",
      table("| A | 0.333 |", "| B | 0.333 |", "| C | 0.333 |", "| Total | 1.00 |"),
    );
    expect(r.findings).toEqual([]);
    expect(r.checked).toEqual(["a.md#t1"]);
  });

  test("checked includes the table on an equal total", () => {
    expect(
      runRule(totalRow, "a.md", table("| A | 1 |", "| B | 2 |", "| Total | 3 |")).checked,
    ).toEqual(["a.md#t1"]);
  });

  test("subtotals restart the sum", () => {
    const r = runRule(
      totalRow,
      "a.md",
      table(
        "| A | 1 |",
        "| B | 2 |",
        "| Subtotal | 3 |",
        "| C | 4 |",
        "| D | 5 |",
        "| Subtotal | 9 |",
      ),
    );
    expect(r.findings).toEqual([]);
  });

  test("decorated total is fixed in place", () => {
    const text = table("| A | $1,000.00 |", "| B | $233.50 |", "| **Total** | **$1,234.50** |");
    const [f] = runRule(totalRow, "a.md", text).shaped;
    expect(f!.id).toBe("a.md#t1/Cost/Total");
    expect(f!.computed).toBe("1233.50");
    expect(f!.fix).toEqual([
      {
        from: text.indexOf("**$1,234.50**"),
        to: text.indexOf("**$1,234.50**") + "**$1,234.50**".length,
        old: "**$1,234.50**",
        new: "**$1,233.50**",
      },
    ]);
  });
});
