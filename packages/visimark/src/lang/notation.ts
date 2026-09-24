/**
 * The prose spellings of shipped vocabulary. See
 * docs/design/prose-notation-for-existing-unary-spec.md and the `Σ` spec it
 * builds on, docs/design/as-an-alias-for-sum-spec.md.
 *
 * This is a **closed set**, not a general symbol-notation system: exactly these
 * codepoints, for exactly these functions. Another glyph is a new catalogue
 * issue. Everything downstream of the parser sees the plain function call and
 * has no awareness that a prose spelling exists.
 */

/** Single-codepoint identifier substitutions: the glyph lexes as this name. */
export const GLYPH_IDENTS: Readonly<Record<string, string>> = {
  Σ: "SUM",
  "∑": "SUM",
  "√": "SQRT",
  "∈": "in",
  ℤ: "integer",
  ℕ: "natural",
};

/**
 * `ℤ⁺` (U+2124 U+207A) is the one two-codepoint glyph in the closed set: it
 * lexes as the two identifier tokens `positive` then `integer`, in that
 * order, so the parser reads it exactly as it would read the two keywords —
 * no special case beyond recognising the pair. See
 * docs/design/a-param-declares-the-set-of-values-it-ac-spec.md §2.
 */
export const POSITIVE_INTEGER_GLYPH = "ℤ⁺";

export interface DelimPair {
  /** the glyph that closes the pair */
  close: string;
  /** the function the pair resolves to */
  fn: string;
  /** the literal second argument the notation itself supplies, if any */
  step?: string;
}

/** Paired delimiters, keyed by the glyph that opens them. */
export const DELIM_PAIRS: Readonly<Record<string, DelimPair>> = {
  "|": { close: "|", fn: "ABS" },
  "⌊": { close: "⌋", fn: "FLOOR", step: "1" },
  "⌈": { close: "⌉", fn: "CEILING", step: "1" },
};

/**
 * The opener of each closer that is not also an opener. `|` is absent: in
 * operand position it always opens, so it is never a stray closer.
 */
export const DELIM_OPENER_OF: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DELIM_PAIRS)
    .filter(([open, pair]) => pair.close !== open)
    .map(([open, pair]) => [pair.close, open]),
);

/** Every delimiter glyph, opening or closing. */
export const DELIMS: ReadonlySet<string> = new Set(
  Object.entries(DELIM_PAIRS).flatMap(([open, pair]) => [open, pair.close]),
);
