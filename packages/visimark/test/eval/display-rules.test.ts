import { expect, test } from "bun:test";
import { Decimal } from "decimal.js";
import { matchesStored } from "../../src/eval/check.js";
import {
  DISPLAY_RULES,
  displayRuleTypeMessage,
  markdownSyntaxIn,
  nbspDisplay,
  percentDisplay,
} from "../../src/eval/display-rules.js";
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

test("the registry holds percent then nbsp", () => {
  expect(Object.keys(DISPLAY_RULES)).toEqual(["percent", "nbsp"]);
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
    "a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only)",
  );
});

test("markdownSyntaxIn lists distinct syntax characters in first-appearance order", () => {
  expect(markdownSyntaxIn("a *b* c")).toEqual(["*"]);
  expect(markdownSyntaxIn("run `ls` now")).toEqual(["`"]);
  expect(markdownSyntaxIn("already&nbsp;joined")).toEqual(["&"]);
  expect(markdownSyntaxIn("www.example.com")).toEqual([]);
  expect(markdownSyntaxIn("_a_ *b*")).toEqual(["_", "*"]);
});
