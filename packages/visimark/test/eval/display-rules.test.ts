import { expect, test } from "bun:test";
import { Decimal } from "decimal.js";
import { matchesStored } from "../../src/eval/check.js";
import {
  DISPLAY_RULES,
  displayRuleTypeMessage,
  markdownSyntaxIn,
  nbspDisplay,
  percentDisplay,
  unitDisplay,
} from "../../src/eval/display-rules.js";
import { parseUnit, type UnitMap } from "../../src/lang/unit-expr.js";
import { date, num, str } from "../../src/eval/value.js";

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

test("the registry holds percent, nbsp, then unit", () => {
  expect(Object.keys(DISPLAY_RULES)).toEqual(["percent", "nbsp", "unit"]);
});

const u = (text: string): UnitMap => {
  const p = parseUnit(text);
  if (!p.ok) throw new Error(`${text} did not parse`);
  return p.map;
};
const d = (s: string) => num(new Decimal(s));

test("unitDisplay writes the number at write precision, a space and the normalised unit", () => {
  expect(unitDisplay(d("23300"), 2, u("PLN"))).toBe("23300.00 PLN");
  expect(unitDisplay(d("-3.5"), 2, u("kg"))).toBe("-3.50 kg");
  expect(unitDisplay(d("5"), 0, u("m^2"))).toBe("5 m²");
  expect(unitDisplay(d("50"), 0, u("1/s"))).toBe("50 1/s");
  expect(unitDisplay(d("6"), 1, u("N*m/s/s"))).toBe("6.0 N⋅m/s²");
  expect(unitDisplay(d("6"), 1, u("J"))).toBe("6.0 J");
});

test("unitDisplay never prints a negative zero", () => {
  expect(unitDisplay(d("-0.001"), 2, u("PLN"))).toBe("0.00 PLN");
  expect(unitDisplay(d("-0"), 0, u("PLN"))).toBe("0 PLN");
});

test("unitDisplay refuses a non-number and a missing or empty unit", () => {
  expect(() => unitDisplay(str("x"), 2, u("PLN"))).toThrow();
  expect(() => unitDisplay(d("1"), 2)).toThrow();
  expect(() => unitDisplay(d("1"), 2, new Map())).toThrow();
});

test("unit accepts a number only, and only unit needs a unit", () => {
  const unit = DISPLAY_RULES.unit!;
  expect(unit.accepts(d("1"))).toBe(true);
  expect(unit.accepts(date("2026-01-01"))).toBe(false);
  expect(unit.accepts(str("hello"))).toBe(false);
  expect(unit.inlineCode).toBe(true);
  expect(DISPLAY_RULES.unit!.needsUnit).toBe(true);
  expect(DISPLAY_RULES.percent!.needsUnit).toBe(false);
  expect(DISPLAY_RULES.nbsp!.needsUnit).toBe(false);
});

test("percent's accepts is true only for a numeric value", () => {
  const percent = DISPLAY_RULES.percent!;
  expect(percent.accepts(num(new Decimal("0.5")))).toBe(true);
  expect(percent.accepts(date("2026-01-01"))).toBe(false);
  expect(percent.accepts(str("hello"))).toBe(false);
});

test("percent's render is percentDisplay", () => {
  expect(DISPLAY_RULES.percent!.render).toBe(percentDisplay);
});

test("an inherited Object.prototype name is not a registered rule", () => {
  expect(DISPLAY_RULES.constructor).toBeUndefined();
  expect(DISPLAY_RULES.toString).toBeUndefined();
  expect(DISPLAY_RULES.__proto__).toBeUndefined();
});

test("nbspDisplay joins the stored words with &nbsp;", () => {
  expect(nbspDisplay(str("past due"))).toBe("past&nbsp;due");
  expect(nbspDisplay(str("paid in full"))).toBe("paid&nbsp;in&nbsp;full");
  expect(nbspDisplay(str("  past   due "))).toBe("past&nbsp;due");
  expect(nbspDisplay(str("past\u00a0due"))).toBe("past&nbsp;due");
  expect(nbspDisplay(str("settled"))).toBe("settled");
  expect(nbspDisplay(str("user_id"))).toBe("user_id");
  expect(nbspDisplay(str(""))).toBe("");
  expect(nbspDisplay(str("   "))).toBe("");
  expect(nbspDisplay(str("past\tdue"))).toBe("past&nbsp;due");
  expect(nbspDisplay(str("past\n due"))).toBe("past&nbsp;due");
});

test("nbspDisplay throws on a non-string", () => {
  expect(() => nbspDisplay(num(new Decimal("1")))).toThrow("nbspDisplay expects a string");
});

test("nbsp's accepts is true only for a string value", () => {
  const nbsp = DISPLAY_RULES.nbsp!;
  expect(nbsp.accepts(str("past due"))).toBe(true);
  expect(nbsp.accepts(num(new Decimal("0.5")))).toBe(false);
  expect(nbsp.accepts(date("2026-01-01"))).toBe(false);
  expect(nbsp.render).toBe(nbspDisplay);
  expect(nbsp.inlineCode).toBe(false);
  expect(DISPLAY_RULES.percent!.inlineCode).toBe(true);
});

test("displayRuleTypeMessage names every rule in registry order", () => {
  expect(displayRuleTypeMessage()).toBe(
    "a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only; unit: numeric with a unit)",
  );
});

test("markdownSyntaxIn lists distinct syntax characters in first-appearance order", () => {
  expect(markdownSyntaxIn("a *b* c")).toEqual(["*"]);
  expect(markdownSyntaxIn("run `ls` now")).toEqual(["`"]);
  expect(markdownSyntaxIn("already&nbsp;joined")).toEqual(["&"]);
  expect(markdownSyntaxIn("www.example.com")).toEqual([]);
  expect(markdownSyntaxIn("_a_ *b*")).toEqual(["_", "*"]);
});
