import type { FindingCode } from "visimark";

/**
 * `markdownlint` prints `description` before a violation's `detail`, so this is
 * the fixed "what this rule is" half and `detail` carries the specifics.
 *
 * These are `docs/visimark-design.md` §10's Meaning column, sentence-cased and
 * with its cross-reference links stripped. The taxonomy is the documentation;
 * this is a transcription of it, not a second authoring of it that could drift.
 *
 * The `Record<FindingCode, …>` annotation is what keeps the seventeen rules in
 * step with the engine: a new `FindingCode` fails this file's typecheck rather
 * than quietly shipping a code with no rule.
 */
export const DESCRIPTIONS: Record<FindingCode, string> = {
  STALE: "Stored value or artifact disagrees with its formula",
  DATE: "Not an ISO 8601 calendar date",
  UNIT: "A column mixes unit decorations, a value is decorated on both sides, or a `%` display sigil shares a span with a unit",
  UNDEF: "Unresolvable name",
  DUP: "A name is bound twice in one scope, or two header cells sharing text",
  VECTOR: "Foreign column outside an aggregate",
  CYCLE: "Circular dependency",
  TYPE: "Illegal operand types, a malformed call, or a `%` display sigil on a non-numeric scalar or a chart/image",
  SHEET: "Column rules with no table, or an `assert` in a document-scope block",
  ANCHOR: "Anchor with no rewritable target",
  PRECISION:
    "A numeric binding with no declared width and none derivable, a value too large to carry the width it has, or a `%` display sigil on a binding whose width is below 2",
  DOMAIN: "A param's default is outside its declared domain, or the domain has no legal value",
  ASSERT: "An `assert` statement evaluated false",
  ARTIFACT: "A declared artifact cannot be built or written",
  IMPORT: "A declared local import cannot be resolved",
  WARN: "Scalar defined and never read, or an alias declared and never used",
  NOTE: "Finding suppressed by an upstream error",
  COVERAGE: "A table with no `vmark` rules, or a `no-formulas` marker on a document that has them",
};
