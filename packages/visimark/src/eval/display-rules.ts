import { formatUnit, isDimensionless, type UnitMap } from "../lang/unit-expr.js";
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

/**
 * Join a stored string's words with the `&nbsp;` entity. ECMAScript `\s`
 * includes U+00A0, so a stored no-break space is a word boundary too.
 * It takes no `places`: a string has no write precision.
 */
export function nbspDisplay(v: Value): string {
  if (v.t !== "str") {
    throw new Error("nbspDisplay expects a string");
  }
  return v.s.trim().split(/\s+/).join("&nbsp;");
}

/**
 * Print a stored number with its unit: the number at the binding's write
 * precision, one space, and the unit map in the normalised spelling
 * (`23300.00 PLN`, `5 m²`, `50 1/s`). A value that rounds to zero never
 * prints `-0`. The unit is the binding's own — declared or derived — and a
 * dimensionless value is refused before this is reached.
 */
export function unitDisplay(v: Value, places: number, unit?: UnitMap): string {
  if (v.t !== "num") {
    throw new Error("unitDisplay expects a number");
  }
  if (unit === undefined || isDimensionless(unit)) {
    throw new Error("unitDisplay expects a unit");
  }
  const rounded = roundToPlaces(v.d, places);
  const shown = rounded.abs().toFixed(places);
  const sign = rounded.isNeg() && !rounded.isZero() ? "-" : "";
  return `${sign}${shown} ${formatUnit(unit)}`;
}

/** A named, chainless anchor-comment display transform — `<!--vmark=x.y|name-->`.
 *  Registered under a closed, catalogue-governed name; never user-defined
 *  (see docs/design/display-rules-replacing-percent-sigil-spec.md). */
export interface DisplayRule {
  /** true if this rule accepts a scalar of this value's type */
  accepts(v: Value): boolean;
  /** stored value, at the binding's write precision, to rendered text;
   *  `unit` is the binding's unit map, which only a `needsUnit` rule reads */
  render(v: Value, places: number, unit?: UnitMap): string;
  /** the accepted-type phrase in the shared TYPE message, e.g. "numeric only" */
  accepted: string;
  /** false when the rendering is not legible inside a code span */
  inlineCode: boolean;
  /** true when the rule prints the value's unit: a dimensionless value is
   *  then a TYPE, and the rule is exempt from "cannot render a value with a
   *  unit", which every other rule is subject to */
  needsUnit: boolean;
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
      accepted: "numeric only",
      inlineCode: true,
      needsUnit: false,
    },
    nbsp: {
      accepts: (v: Value) => v.t === "str",
      render: nbspDisplay,
      accepted: "string only",
      inlineCode: false,
      needsUnit: false,
    },
    unit: {
      accepts: (v: Value) => v.t === "num",
      render: unitDisplay,
      accepted: "numeric with a unit",
      inlineCode: true,
      needsUnit: true,
    },
  },
);

/** The shared `TYPE` message, naming every rule's accepted type in registry
 *  order, so a new rule never needs the message extended by hand. */
export function displayRuleTypeMessage(): string {
  const accepted = Object.entries(DISPLAY_RULES)
    .map(([name, rule]) => `${name}: ${rule.accepted}`)
    .join("; ");
  return `a display rule is only legal on a value it accepts (${accepted})`;
}

/** The characters a round-trip refusal names as Markdown syntax. */
export const MARKDOWN_SYNTAX_CHARS: readonly string[] = [
  "\\",
  "`",
  "*",
  "_",
  "[",
  "]",
  "<",
  "&",
  "~",
];

/** Distinct Markdown syntax characters in `s`, in order of first appearance. */
export function markdownSyntaxIn(s: string): string[] {
  const found: string[] = [];
  for (const ch of s) {
    if (MARKDOWN_SYNTAX_CHARS.includes(ch) && !found.includes(ch)) found.push(ch);
  }
  return found;
}
