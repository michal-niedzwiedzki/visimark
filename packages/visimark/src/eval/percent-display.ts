import type { Value } from "./value.js";
import { roundToPlaces } from "./value.js";

/**
 * Print a stored ratio as a percent: × 100 at precision − 2, with a trailing
 * `%` and a leading minus when the stored value is negative.
 * `places` is the binding's write precision and must be ≥ 2.
 */
export function percentDisplay(v: Value, places: number): string {
  if (v.t !== "num") {
    throw new Error("percentDisplay expects a number");
  }
  const shown = roundToPlaces(v.d.abs().mul(100), places - 2).toFixed(places - 2);
  const sign = v.d.isNeg() && !v.d.isZero() ? "-" : "";
  return `${sign}${shown}%`;
}
