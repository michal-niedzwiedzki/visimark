import { Decimal } from "decimal.js";

/** the engine's working precision, in **significant digits** — not decimals */
export const MAX_SIGNIFICANT_DIGITS = 40;

Decimal.set({ precision: MAX_SIGNIFICANT_DIGITS, rounding: Decimal.ROUND_HALF_UP });

export type Value =
  | { t: "num"; d: Decimal }
  | { t: "date"; iso: string }
  | { t: "str"; s: string }
  | { t: "bool"; b: boolean };

export const num = (d: Decimal | number | string): Value => ({
  t: "num",
  d: d instanceof Decimal ? d : new Decimal(d),
});
export const date = (iso: string): Value => ({ t: "date", iso });
export const str = (s: string): Value => ({ t: "str", s });
export const bool = (b: boolean): Value => ({ t: "bool", b });

export class EvalError extends Error {
  readonly code: "TYPE" | "DATE" = "TYPE";
  constructor(message: string) {
    super(message);
    this.name = "EvalError";
  }
}

/**
 * An `EvalError` whose root cause is that a computed value is not a
 * representable calendar date (e.g. an `EOMONTH` result outside years
 * 1–9999). `check` reports it as a `DATE` finding rather than `TYPE`.
 */
export class DateError extends EvalError {
  override readonly code = "DATE" as const;
  constructor(message: string) {
    super(message);
    this.name = "DateError";
  }
}

/**
 * True when rendering `d` at `places` decimals would print digits `decimal.js`
 * never computed.
 *
 * `Decimal.precision` is **significant digits**, not decimal places, so a
 * declared width is only real while a value's integer digits plus that width
 * stay inside it. Past the ceiling the tail is fabricated: at `precision: 40`,
 * a 30-digit integer part asked for 18 decimals comes back with eighteen zeros
 * that look perfectly orderly and are invented.
 *
 * This is not detectable by inspection — one digit over the ceiling often
 * agrees with the true value by luck — so it is decided by the inequality, not
 * by comparing renderings. See docs/design/declared-precision-spec.md
 * section 3.5.
 */
export function exceedsWorkingPrecision(d: Decimal, places: number): boolean {
  const intDigits = Math.max(1, d.abs().truncated().sd(true));
  return intDigits + places > Decimal.precision;
}

export function roundToPlaces(d: Decimal, places: number): Decimal {
  const r = d.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  // normalise -0 to 0
  return r.isZero() ? new Decimal(0) : r;
}

export function valueEquals(a: Value, b: Value): boolean {
  if (a.t !== b.t) return false;
  if (a.t === "num" && b.t === "num") return a.d.equals(b.d);
  if (a.t === "date" && b.t === "date") return a.iso === b.iso;
  if (a.t === "str" && b.t === "str") return a.s === b.s;
  if (a.t === "bool" && b.t === "bool") return a.b === b.b;
  return false;
}
