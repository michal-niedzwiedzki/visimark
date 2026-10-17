import { expect, test } from "bun:test";
import { cellKey } from "../src/ids.js";
import { runRule } from "./support.js";
import { totalRow } from "../src/rules/total-row.js";

test("the three id forms", () => {
  expect(cellKey("a.md", { kind: "table", table: 2, column: "Cost", row: "Total" })).toBe(
    "a.md#t2/Cost/Total",
  );
  expect(cellKey("a.md", { kind: "named", sheetId: "lunch", name: "Total" })).toBe(
    "a.md#lunch/Total",
  );
  expect(cellKey("a.md", { kind: "other", code: "CYCLE", name: null })).toBe("a.md#CYCLE/-");
});

test("a repeated label takes ~2, and emphasis leaves the header", () => {
  const text =
    "| Item | **Cost** |\n|---|---|\n| Total | 1 |\n| A | 1 |\n| B | 2 |\n| Total | 4 |\n";
  expect(runRule(totalRow, "a.md", text).shaped.map((f) => f.id)).toEqual(["a.md#t1/Cost/Total~2"]);
});
