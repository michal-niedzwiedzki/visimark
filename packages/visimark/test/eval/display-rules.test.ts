import { expect, test } from "bun:test";
import { Decimal } from "decimal.js";
import { matchesStored } from "../../src/eval/check.js";
import { percentDisplay } from "../../src/eval/percent-display.js";
import { num } from "../../src/eval/value.js";

test("percentDisplay writes stored × 100 at N − 2", () => {
  expect(percentDisplay(num(new Decimal("0.4026")), 4)).toBe("40.26%");
  expect(percentDisplay(num(new Decimal("0.40")), 2)).toBe("40%");
  expect(percentDisplay(num(new Decimal("0.20")), 2)).toBe("20%");
  expect(percentDisplay(num(new Decimal("0")), 2)).toBe("0%");
  expect(percentDisplay(num(new Decimal("-0.05")), 2)).toBe("-5%");
  expect(percentDisplay(num(new Decimal("1.50")), 2)).toBe("150%");
  expect(percentDisplay(num(new Decimal("0.125")), 3)).toBe("12.5%");
  expect(percentDisplay(num(new Decimal("-0")), 2)).toBe("0%");
});

test("matchesStored accepts a signed percent as the stored ratio", () => {
  expect(matchesStored(num(new Decimal("-0.05")), "-5%", 2)).toBe(true);
  expect(matchesStored(num(new Decimal("0.4026")), "40.26%", 4)).toBe(true);
  expect(matchesStored(num(new Decimal("0.4026")), "0.4026", 4)).toBe(true);
  expect(matchesStored(num(new Decimal("0.4026")), "41.55%", 4)).toBe(false);
});
