import { expect, test } from "bun:test";
import { Decimal } from "decimal.js";
import { parseExpr } from "../../src/lang/parser.js";
import { derivePrecision } from "../../src/eval/precision.js";
import { exceedsWorkingPrecision } from "../../src/eval/value.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

/** stand-in for the column/scalar precision a real check would resolve */
const known: Record<string, number> = { zero: 0, one: 1, two: 2, four: 4 };
const lookup = (name: string): number | null => known[name] ?? null;
const P = (src: string) => derivePrecision(parseExpr(src), (r) => lookup(r.name));

test("literals: a folded percent carries the precision of its value", () => {
  expect(P("1600.00")).toBe(2);
  expect(P("7")).toBe(0);
  expect(P("4.2650")).toBe(4);
  // `23%` is folded to `0.23` by the parser, so `vat = 23%` derives 2, not 0.
  // Deriving 0 here would round every VAT figure in the invoice to a whole.
  expect(P("23%")).toBe(2);
  expect(P("0.5%")).toBe(3);
});

test("additive operators take the wider operand", () => {
  expect(P("two + four")).toBe(4);
  expect(P("four - zero")).toBe(4);
  expect(P("0 - two")).toBe(2);
});

test("multiplication sums the operands' scales", () => {
  expect(P("two * two")).toBe(4);
  expect(P("zero * two")).toBe(2);
});

test("powers multiply by a non-negative integer exponent, and nothing else", () => {
  expect(P("two ^ 2")).toBe(4);
  expect(P("two ^ 0")).toBe(0);
  expect(P("two ^ 2.5")).toBeNull();
  expect(P("two ^ zero")).toBeNull();
});

test("division, AVG, SQRT and PMT are not derivable", () => {
  expect(P("four / two")).toBeNull();
  expect(P("AVG(two)")).toBeNull();
  expect(P("SQRT(four)")).toBeNull();
  expect(P("PMT(two, two, two)")).toBeNull();
  expect(P("ROUND(PMT(two, two, two), 2)")).toBe(2);
});

test("reduces are closed over their column's scale", () => {
  expect(P("SUM(two)")).toBe(2);
  expect(P("MIN(four)")).toBe(4);
  expect(P("MAX(zero)")).toBe(0);
  expect(P("COUNT(four)")).toBe(0);
});

test("mappers whose width is fixed by an argument", () => {
  expect(P("ROUND(four / two, 2)")).toBe(2);
  expect(P("ROUND(four, 0)")).toBe(0);
  expect(P("FLOOR(four, 0.01)")).toBe(2);
  expect(P("CEILING(four, 0.001)")).toBe(3);
  // a non-literal width cannot be read off the call
  expect(P("ROUND(four, two)")).toBeNull();
});

test("mappers that pass their operands' width through", () => {
  expect(P("ABS(0 - two)")).toBe(2);
  expect(P("MOD(four, two)")).toBe(4);
  expect(P("IF(two > zero, two, four)")).toBe(4);
});

test("non-numeric constructs have no precision", () => {
  expect(P('"net 30"')).toBeNull();
  expect(P("two > four")).toBeNull();
});

test("date arithmetic is closed and typed", () => {
  // date - date is a whole number of days; date +/- n is another date, which has
  // no width at all. See the design doc, section 5.
  expect(P("2026-09-30 - 2026-09-03")).toBe(0);
  expect(P("2026-09-03 + 7")).toBe("date");
  expect(P("2026-09-03")).toBe("date");
  expect(P("EOMONTH(2026-01-15, 1)")).toBe("date");
});

test("an unresolvable operand makes the whole expression not derivable", () => {
  expect(P("unknown + two")).toBeNull();
  expect(P("SUM(unknown)")).toBeNull();
});

test("derivation never discards a digit", () => {
  // The invariant the whole table exists to satisfy: where a precision is
  // derived, rounding to it is a no-op. Only a declared precision may lose
  // digits, and only because the author asked.
  const cases: [string, Decimal][] = [
    ["1600.00 * 3", new Decimal("1600.00").times(3)],
    ["4.2650 * 1.05", new Decimal("4.2650").times("1.05")],
    ["1.05 ^ 3", new Decimal("1.05").pow(3)],
    ["0.1 + 0.02", new Decimal("0.1").plus("0.02")],
    ["MOD(7.5, 2)", new Decimal("7.5").mod(2)],
    ["ABS(0 - 12.345)", new Decimal("12.345")],
    ["23%", new Decimal("0.23")],
  ];
  for (const [src, exact] of cases) {
    const p = P(src);
    expect(p).not.toBeNull();
    expect(exact.toDecimalPlaces(p as number, Decimal.ROUND_HALF_UP).equals(exact)).toBe(true);
  }
});

// --- the working-precision ceiling (spec §3.5) ------------------------------

test("no digit is ever fabricated: the ceiling is reported, not padded", () => {
  // `Decimal.precision` is 40 *significant* digits, so a declared width is real
  // only while a value's integer digits plus that width stay inside it. The
  // oracle is a raised working precision, never inspection: one digit over the
  // ceiling often agrees with the true value by luck, while far over it the
  // fractional part is a run of zeros that looks orderly and is invented.
  // 28 ones over 7: the true tail is ...714285714286 and the engine returns
  // ...714285700000 — five real digits replaced by zeros. (30 ones would not
  // do: a repunit of length divisible by 6 divides exactly by 7, so its zeros
  // are genuine.)
  const big = "1".repeat(28);
  const src = [
    "| Item | V |",
    "|------|--:|",
    `| a    | ${big} |`,
    "",
    "```vmark #s",
    "wide precision 18 = SUM(V) / 7",
    "```",
    "",
    "Wide: **0.000000000000000000**<!--vmark=s.wide-->.",
  ].join("\n");

  const findings = check(build(locate(src))).findings;
  expect(findings.map((f) => f.code)).toEqual(["PRECISION"]);
  expect(findings[0]!.message).toContain("too large to carry 18 decimals");

  // and the reason it must be reported: at this magnitude the engine's own
  // answer disagrees with the answer a wider working precision gives
  const q = new Decimal(big).div(7);
  const at40 = q.toDecimalPlaces(18, Decimal.ROUND_HALF_UP).toFixed(18);
  const saved = Decimal.precision;
  Decimal.set({ precision: 120 });
  const at120 = new Decimal(big).div(7).toDecimalPlaces(18, Decimal.ROUND_HALF_UP).toFixed(18);
  Decimal.set({ precision: saved });
  expect(at40).not.toBe(at120);
});

test("an ordinary money value is nowhere near the ceiling", () => {
  expect(exceedsWorkingPrecision(new Decimal("28659.00"), 2)).toBe(false);
  expect(exceedsWorkingPrecision(new Decimal("4.2650"), 18)).toBe(false);
});
