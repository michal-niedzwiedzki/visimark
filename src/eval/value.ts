import { Decimal } from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

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
  readonly code = "TYPE" as const;
  constructor(message: string) {
    super(message);
    this.name = "EvalError";
  }
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
