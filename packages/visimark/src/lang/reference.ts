/**
 * What each builtin function does, in a form a machine can serve.
 *
 * `eval/functions.ts` holds the shape table the evaluator turns on — `kind`
 * and `arity`, nothing else. This file holds the documentation, keyed by the
 * same names so that adding a function without documenting it fails
 * `typecheck`. Consumers read it through `describeFunction`: `visimark ref`,
 * the language server's hover, and the reference generator.
 *
 * There is deliberately no free-prose "caveats" field. A surprise is stated
 * either as a typed `FnError` or as an `FnExample` that CI executes; a
 * behaviour expressible as neither is a design bug, not a documentation entry.
 */
import { FUNCTION_TABLE, type FnSpec, type FunctionName } from "../eval/functions.js";
import type { FindingCode } from "../model/types.js";

export interface FnParam {
  name: string;
  type: "number" | "date" | "bool" | "string" | "column";
  note: string;
}

export interface FnError {
  /**
   * The offending thing, as a **noun phrase** — "a negative operand", "an
   * empty column", "a non-whole `months`". Never a sentence: this string is
   * rendered into `{when} is a {code} error` for the design-doc table and into
   * `{when} -> {code}` for `visimark ref`. A clause reads correctly in neither.
   */
  when: string;
  code: FindingCode;
}

export interface FnExample {
  /** an expression in the language */
  expr: string;
  /** what it evaluates to, rendered as the engine renders a value */
  is: string;
  /** Markdown establishing any sheet or column `expr` references */
  given?: string;
}

/**
 * Where a call's result gets its decimal width.
 *
 * The rule the engine actually applies is the switch in `eval/precision.ts`.
 * This is that rule as **data**, so the design-doc table, `visimark ref`,
 * `--json` and the editor hover all state it in the same words, and
 * `test/lang/reference.test.ts` can hold every variant against the engine
 * rather than trusting a sentence.
 *
 * Typed rather than prose for the same reason `FnError` is: the distinction
 * between `ROUND`, whose width is the *value* of `places`, and `FLOOR`, whose
 * width is the *scale* of `s`, is invisible in a cell reading `` `places` ``
 * against `` `s`'s `` — an apostrophe carrying the whole semantics.
 */
export type FnPrecision =
  /** the widest of the named operands — `SUM`, `MIN`, `MAX`, `ABS`, `MOD`, `IF` */
  | { from: "operands"; params: readonly string[] }
  /** the literal *value* of an argument — `ROUND`'s `places` */
  | { from: "argument-value"; param: string }
  /** the *width* of an argument — `FLOOR` and `CEILING`'s `s` */
  | { from: "argument-scale"; param: string }
  /** the same width whatever the operands — `COUNT` */
  | { from: "fixed"; width: number }
  /** nothing bounds the result's scale, so the binding must declare — `AVG`, `SQRT` */
  | { from: "declared" }
  /** not a number, so no width applies — `EOMONTH` */
  | { from: "date" };

/**
 * The width rule as one noun phrase, so no consumer words it differently.
 * Plain text with Markdown code spans: a renderer that wants emphasis on the
 * `declared` case adds its own, which is why none is baked in here.
 */
export function precisionPhrase(p: FnPrecision): string {
  const code = (n: string): string => `\`${n}\``;
  switch (p.from) {
    case "operands":
      return p.params.length === 1
        ? `the width of ${code(p.params[0]!)}`
        : `the wider of ${p.params.map(code).join(" and ")}`;
    case "argument-value":
      return `the value of ${code(p.param)}`;
    case "argument-scale":
      return `the width of ${code(p.param)}`;
    case "fixed":
      return `always ${p.width}`;
    case "declared":
      return "must be declared";
    case "date":
      return "not applicable — the result is a date";
  }
}

export interface FnDoc {
  /** one line; this becomes the `Meaning` column of the design-doc table */
  summary: string;
  /** exactly `arity` entries — asserted in `test/lang/reference.test.ts` */
  params: readonly FnParam[];
  returns: string;
  /**
   * Where the result's width comes from. Required, so a function cannot be
   * added without stating it — the same discipline `Precision behaviour` asks
   * of a vocabulary request.
   */
  precision: FnPrecision;
  /**
   * Rounding behaviour of the function's own, where it has any — how it breaks
   * a tie, not how wide its result is. Only `ROUND` has one.
   */
  rounding?: string;
  errors: readonly FnError[];
  examples: readonly FnExample[];
  see?: readonly FunctionName[];
  /**
   * The prose spelling, where the language has one — `|x|` for `ABS`. It is
   * documentation of the notation the parser accepts (`lang/notation.ts`), kept
   * here so every renderer shows it in the same words. Where a spelling omits a
   * parameter, it is a spelling of the call with that parameter's value: `⌊x⌋`
   * is `FLOOR(x, 1)`.
   */
  prose?: string;
}

/**
 * The smallest table a reduce example can be demonstrated over. The empty
 * `vmark #t` block is what gives the table its sheet id; without it `t.Amount`
 * does not resolve.
 */
const AMOUNTS = `| Amount |
|-------:|
|  10.00 |
|  20.00 |
|  30.00 |

\`\`\`vmark #t
\`\`\`
`;

const CASH = `| Cash |
|-----:|
| -48000 |
|  20000 |
|  20000 |
|  20000 |

\`\`\`vmark #t
\`\`\`
`;

const ONE = `| Cash |
|-----:|
| -48000 |

\`\`\`vmark #t
\`\`\`
`;

const PAIR = `| Cash |
|-----:|
|  100 |
|  100 |

\`\`\`vmark #t
\`\`\`
`;

export const FUNCTION_DOCS: Record<FunctionName, FnDoc> = {
  SUM: {
    summary: "total of a column; `0` over an empty column",
    params: [{ name: "col", type: "column", note: "the column to total" }],
    returns: "number",
    precision: { from: "operands", params: ["col"] },
    errors: [],
    examples: [
      { expr: "SUM(t.Amount)", is: "60", given: AMOUNTS },
      { expr: "SUM(t.Amount) * 2", is: "120", given: AMOUNTS },
    ],
    see: ["AVG", "COUNT"],
  },
  MIN: {
    summary: "least value",
    params: [{ name: "col", type: "column", note: "a column of numbers, or of dates" }],
    returns: "number or date, matching the column",
    precision: { from: "operands", params: ["col"] },
    errors: [{ when: "a column mixing numbers and dates", code: "TYPE" }],
    examples: [{ expr: "MIN(t.Amount)", is: "10", given: AMOUNTS }],
    see: ["MAX"],
  },
  MAX: {
    summary: "greatest value",
    params: [{ name: "col", type: "column", note: "a column of numbers, or of dates" }],
    returns: "number or date, matching the column",
    precision: { from: "operands", params: ["col"] },
    errors: [{ when: "a column mixing numbers and dates", code: "TYPE" }],
    examples: [{ expr: "MAX(t.Amount)", is: "30", given: AMOUNTS }],
    see: ["MIN"],
  },
  AVG: {
    summary: "arithmetic mean",
    params: [{ name: "col", type: "column", note: "the column to average" }],
    returns: "number",
    precision: { from: "declared" },
    errors: [{ when: "an empty column", code: "TYPE" }],
    examples: [{ expr: "AVG(t.Amount)", is: "20", given: AMOUNTS }],
    see: ["SUM", "COUNT"],
  },
  COUNT: {
    summary: "number of rows",
    params: [{ name: "col", type: "column", note: "the column whose rows are counted" }],
    returns: "number",
    precision: { from: "fixed", width: 0 },
    errors: [],
    examples: [{ expr: "COUNT(t.Amount)", is: "3", given: AMOUNTS }],
    see: ["SUM"],
  },
  NPV: {
    summary:
      "present value of a cash-flow column; row 0 is undiscounted; an empty column is a TYPE error",
    params: [
      { name: "rate", type: "number", note: "the rate for one period; must be greater than -1" },
      { name: "flows", type: "column", note: "cash flows in time order; the first row is period 0" },
    ],
    returns: "number",
    precision: { from: "declared" },
    errors: [
      { when: "a non-numeric `rate`", code: "TYPE" },
      { when: "a `rate` of -1 or below", code: "TYPE" },
      { when: "an empty column", code: "TYPE" },
      { when: "a non-numeric cell", code: "TYPE" },
      { when: "a non-column `flows` argument", code: "TYPE" },
    ],
    examples: [
      { expr: "NPV(0, t.Cash)", is: "12000", given: CASH },
      { expr: "NPV(0.08, t.Cash)", is: "-48000", given: ONE },
      { expr: "NPV(-0.5, t.Cash)", is: "300", given: PAIR },
    ],
    see: ["SUM", "AVG"],
  },
  ROUND: {
    summary: "half-up to `places` decimals",
    params: [
      { name: "x", type: "number", note: "the value to round" },
      { name: "places", type: "number", note: "how many decimal places to keep" },
    ],
    returns: "number",
    precision: { from: "argument-value", param: "places" },
    rounding: "Ties round away from zero (half-up), not to even.",
    errors: [],
    examples: [
      { expr: "ROUND(2.345, 2)", is: "2.35" },
      { expr: "ROUND(2.5, 0)", is: "3" },
      { expr: "ROUND(-2.5, 0)", is: "-3" },
    ],
    see: ["FLOOR", "CEILING"],
  },
  ABS: {
    summary: "absolute value",
    params: [{ name: "x", type: "number", note: "the value whose sign is discarded" }],
    returns: "number",
    precision: { from: "operands", params: ["x"] },
    errors: [],
    examples: [
      { expr: "ABS(-7)", is: "7" },
      { expr: "ABS(7)", is: "7" },
    ],
    prose: "|x|",
  },
  MOD: {
    summary: "remainder",
    params: [
      { name: "x", type: "number", note: "the dividend" },
      { name: "y", type: "number", note: "the divisor" },
    ],
    returns: "number",
    precision: { from: "operands", params: ["x", "y"] },
    errors: [{ when: "a zero divisor", code: "TYPE" }],
    examples: [
      { expr: "MOD(7, 3)", is: "1" },
      { expr: "MOD(9, 3)", is: "0" },
    ],
    see: ["FLOOR"],
  },
  SQRT: {
    summary: "non-negative square root",
    params: [{ name: "x", type: "number", note: "a non-negative number" }],
    returns: "number",
    precision: { from: "declared" },
    errors: [{ when: "a negative operand", code: "TYPE" }],
    examples: [
      { expr: "SQRT(9)", is: "3" },
      { expr: "SQRT(0)", is: "0" },
    ],
    prose: "√(x)",
  },
  FLOOR: {
    summary: "greatest multiple of `s` that does not exceed `x`, toward −∞",
    params: [
      { name: "x", type: "number", note: "the value to round down" },
      { name: "s", type: "number", note: "the positive step to round to" },
    ],
    returns: "number",
    precision: { from: "argument-scale", param: "s" },
    errors: [{ when: "a non-positive `s`", code: "TYPE" }],
    examples: [
      { expr: "FLOOR(7, 3)", is: "6" },
      { expr: "FLOOR(-7, 3)", is: "-9" },
    ],
    see: ["CEILING", "ROUND"],
    prose: "⌊x⌋",
  },
  CEILING: {
    summary: "least multiple of `s` that is not less than `x`, toward +∞",
    params: [
      { name: "x", type: "number", note: "the value to round up" },
      { name: "s", type: "number", note: "the positive step to round to" },
    ],
    returns: "number",
    precision: { from: "argument-scale", param: "s" },
    errors: [{ when: "a non-positive `s`", code: "TYPE" }],
    examples: [
      { expr: "CEILING(7, 3)", is: "9" },
      { expr: "CEILING(-7, 3)", is: "-6" },
    ],
    see: ["FLOOR", "ROUND"],
    prose: "⌈x⌉",
  },
  IF: {
    summary: "returns `a` or `b`",
    params: [
      { name: "cond", type: "bool", note: "the condition; must be a boolean" },
      { name: "a", type: "number", note: "the value when `cond` holds" },
      { name: "b", type: "number", note: "the value when it does not" },
    ],
    returns: "whichever of `a` or `b` was selected",
    precision: { from: "operands", params: ["a", "b"] },
    errors: [{ when: "a non-boolean `cond`", code: "TYPE" }],
    examples: [
      { expr: "IF(1 < 2, 10, 20)", is: "10" },
      { expr: "IF(1 > 2, 10, 20)", is: "20" },
    ],
  },
  EOMONTH: {
    summary: "last day of the month `months` calendar months from `d`; `d`'s day is discarded",
    params: [
      { name: "d", type: "date", note: "the date whose month starts the count" },
      { name: "months", type: "number", note: "whole number of months to move; may be negative" },
    ],
    returns: "date",
    precision: { from: "date" },
    errors: [
      { when: "a non-whole `months`", code: "TYPE" },
      { when: "a result outside years 1–9999", code: "DATE" },
    ],
    examples: [
      { expr: "EOMONTH(2026-01-15, 0)", is: "2026-01-31" },
      { expr: "EOMONTH(2026-01-31, 1)", is: "2026-02-28" },
      { expr: "EOMONTH(2024-01-31, 1)", is: "2024-02-29" },
      { expr: "EOMONTH(2026-01-15, -1)", is: "2025-12-31" },
    ],
    see: ["MIN", "MAX"],
  },
  PMT: {
    summary: "instalment that repays `pv` to zero over `nper` periods at per-period rate `rate`",
    params: [
      { name: "rate", type: "number", note: "the rate for one period; must be greater than -1" },
      { name: "nper", type: "number", note: "a positive whole number of periods" },
      { name: "pv", type: "number", note: "the present amount repaid down to zero" },
    ],
    returns: "number",
    precision: { from: "declared" },
    errors: [
      { when: "a non-numeric `rate`, `nper`, or `pv`", code: "TYPE" },
      { when: "a non-positive or non-whole `nper`", code: "TYPE" },
      { when: "a `rate` of -1 or below", code: "TYPE" },
    ],
    examples: [
      { expr: "PMT(0, 12, 1200)", is: "100" },
      { expr: "PMT(0.10, 1, 1000)", is: "1100" },
      { expr: "PMT(0, 4, 0)", is: "0" },
    ],
  },
};

export type FnEntry = FnDoc & FnSpec & { name: FunctionName };

/**
 * Shape and documentation for one function, or `null` if the name is not a
 * builtin. Case-sensitive: the language's function names are upper-case, and a
 * lower-case spelling is a `TYPE` error at the call site, not a synonym here.
 */
export function describeFunction(name: string): FnEntry | null {
  if (!Object.hasOwn(FUNCTION_TABLE, name)) return null;
  const n = name as FunctionName;
  return { name: n, ...FUNCTION_TABLE[n], ...FUNCTION_DOCS[n] };
}

export function functionNames(): readonly FunctionName[] {
  return Object.keys(FUNCTION_TABLE) as FunctionName[];
}
