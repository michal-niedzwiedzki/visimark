import type { Value } from "./value.js";
import { roundToPlaces } from "./value.js";

export const PERCENT_TEXT_RE = /^(-?)(\d+(?:\.\d+)?)%$/;

export function isPercentText(text: string): boolean {
  return PERCENT_TEXT_RE.test(text.trim());
}

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

/** A named, chainless anchor-comment display transform — `<!--vmark=x.y|name-->`.
 *  Registered under a closed, catalogue-governed name; never user-defined
 *  (see docs/design/display-rules-replacing-percent-sigil-spec.md). */
export interface DisplayRule {
  /** true if this rule accepts a scalar of this value's type */
  accepts(v: Value): boolean;
  /** stored value, at the binding's write precision, to rendered text */
  render(v: Value, places: number): string;
}

/** The closed registry. Adding an entry means adding a key here, behind its
 *  own catalogue-approved issue — never a document-supplied name.
 *  Null-prototype: a document-supplied name such as `constructor` must miss
 *  the lookup, not resolve to an inherited `Object.prototype` member. */
export const DISPLAY_RULES: Readonly<Record<string, DisplayRule>> = Object.assign(
  Object.create(null) as Record<string, DisplayRule>,
  {
    percent: {
      accepts: (v: Value) => v.t === "num",
      render: percentDisplay,
    },
  },
);
