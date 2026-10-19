import { expect, test } from "bun:test";
import { cellNumber, decimal, rewriteNumber, roundToPlaces, scaled } from "../src/decimal.js";

test("cellNumber reads decorated numbers and refuses units", () => {
  expect(cellNumber("**$1,234.50**")).toEqual({ value: 1234.5, decimals: 2 });
  expect(cellNumber("200+")).toBeNull();
  expect(cellNumber("1,5")).toBeNull();
});

test("scaled", () => {
  expect(scaled("1,234.50", 2)).toBe(123450n);
  expect(scaled("-0.5", 2)).toBe(-50n);
  expect(scaled("n/a", 2)).toBeNull();
});

test("decimal", () => {
  expect(decimal(-5n, 2)).toBe("-0.05");
  expect(decimal(34050n, 2)).toBe("340.50");
  expect(decimal(7n, 0)).toBe("7");
});

test("roundToPlaces rounds half away from zero", () => {
  expect(roundToPlaces(34055n, 2, 1)).toBe(3406n);
  expect(roundToPlaces(-34055n, 2, 1)).toBe(-3406n);
  expect(roundToPlaces(34054n, 2, 1)).toBe(3405n);
  expect(roundToPlaces(5n, 0, 2)).toBe(500n);
});

test("rewriteNumber keeps decoration and separators", () => {
  expect(rewriteNumber("**$1,234.50**", "1233.50")).toBe("**$1,233.50**");
  expect(rewriteNumber("12", "13.00")).toBe("13.00");
  expect(rewriteNumber("$999.00", "1000.00")).toBe("$1000.00");
  expect(rewriteNumber("-5", "-12")).toBe("-12");
});
