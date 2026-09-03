import { expect, test } from "bun:test";
import { drift } from "../examples.js";
import { applyEdits } from "../../src/write/splice.js";
import { inferColumnPrecision } from "../../src/eval/check.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";

test("applyEdits splices by offset, right-to-left, without shifting", () => {
  expect(applyEdits("abcdef", [{ start: 2, end: 4, text: "XY" }])).toBe("abXYef");
  expect(
    applyEdits("0123456789", [
      { start: 1, end: 3, text: "A" },
      { start: 6, end: 8, text: "BBBB" },
    ]),
  ).toBe("0A345BBBB89");
});

test("overlapping edits throw", () => {
  expect(() =>
    applyEdits("abcdef", [
      { start: 1, end: 4, text: "x" },
      { start: 3, end: 5, text: "y" },
    ]),
  ).toThrow(/overlap/);
});

test("inferColumnPrecision reads the existing cells", () => {
  const m = build(locate(drift));
  const sch = m.sheets.get("schedule")!;
  const daysIdx = sch.columnIndex.get("Days")!;
  const amtIdx = sch.columnIndex.get("Amount")!;
  expect(inferColumnPrecision(sch.table!, daysIdx, 2)).toBe(0);
  expect(inferColumnPrecision(sch.table!, amtIdx, 2)).toBe(2);
});
