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

export interface FnDoc {
  /** one line; this becomes the `Meaning` column of the design-doc table */
  summary: string;
  /** exactly `arity` entries — asserted in `test/lang/reference.test.ts` */
  params: readonly FnParam[];
  returns: string;
  /** only where the function has rounding behaviour of its own */
  precision?: string;
  errors: readonly FnError[];
  examples: readonly FnExample[];
  see?: readonly FunctionName[];
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

export const FUNCTION_DOCS: Record<FunctionName, FnDoc> = {
  SUM: {
    summary: "total of a column; `0` over an empty column",
    params: [{ name: "col", type: "column", note: "the column to total" }],
    returns: "number",
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
    errors: [{ when: "a column mixing numbers and dates", code: "TYPE" }],
    examples: [{ expr: "MIN(t.Amount)", is: "10", given: AMOUNTS }],
    see: ["MAX"],
  },
  MAX: {
    summary: "greatest value",
    params: [{ name: "col", type: "column", note: "a column of numbers, or of dates" }],
    returns: "number or date, matching the column",
    errors: [{ when: "a column mixing numbers and dates", code: "TYPE" }],
    examples: [{ expr: "MAX(t.Amount)", is: "30", given: AMOUNTS }],
    see: ["MIN"],
  },
  AVG: {
    summary: "arithmetic mean",
    params: [{ name: "col", type: "column", note: "the column to average" }],
    returns: "number",
    errors: [{ when: "an empty column", code: "TYPE" }],
    examples: [{ expr: "AVG(t.Amount)", is: "20", given: AMOUNTS }],
    see: ["SUM", "COUNT"],
  },
  COUNT: {
    summary: "number of rows",
    params: [{ name: "col", type: "column", note: "the column whose rows are counted" }],
    returns: "number",
    errors: [],
    examples: [{ expr: "COUNT(t.Amount)", is: "3", given: AMOUNTS }],
    see: ["SUM"],
  },
  ROUND: {
    summary: "half-up to `places` decimals",
    params: [
      { name: "x", type: "number", note: "the value to round" },
      { name: "places", type: "number", note: "how many decimal places to keep" },
    ],
    returns: "number",
    precision: "Ties round away from zero (half-up), not to even.",
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
    errors: [],
    examples: [
      { expr: "ABS(-7)", is: "7" },
      { expr: "ABS(7)", is: "7" },
    ],
  },
  MOD: {
    summary: "remainder",
    params: [
      { name: "x", type: "number", note: "the dividend" },
      { name: "y", type: "number", note: "the divisor" },
    ],
    returns: "number",
    errors: [],
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
    errors: [{ when: "a negative operand", code: "TYPE" }],
    examples: [
      { expr: "SQRT(9)", is: "3" },
      { expr: "SQRT(0)", is: "0" },
    ],
  },
  FLOOR: {
    summary: "greatest multiple of `s` that does not exceed `x`, toward −∞",
    params: [
      { name: "x", type: "number", note: "the value to round down" },
      { name: "s", type: "number", note: "the positive step to round to" },
    ],
    returns: "number",
    errors: [{ when: "a non-positive `s`", code: "TYPE" }],
    examples: [
      { expr: "FLOOR(7, 3)", is: "6" },
      { expr: "FLOOR(-7, 3)", is: "-9" },
    ],
    see: ["CEILING", "ROUND"],
  },
  CEILING: {
    summary: "least multiple of `s` that is not less than `x`, toward +∞",
    params: [
      { name: "x", type: "number", note: "the value to round up" },
      { name: "s", type: "number", note: "the positive step to round to" },
    ],
    returns: "number",
    errors: [{ when: "a non-positive `s`", code: "TYPE" }],
    examples: [
      { expr: "CEILING(7, 3)", is: "9" },
      { expr: "CEILING(-7, 3)", is: "-6" },
    ],
    see: ["FLOOR", "ROUND"],
  },
  IF: {
    summary: "returns `a` or `b`",
    params: [
      { name: "cond", type: "bool", note: "the condition; must be a boolean" },
      { name: "a", type: "number", note: "the value when `cond` holds" },
      { name: "b", type: "number", note: "the value when it does not" },
    ],
    returns: "whichever of `a` or `b` was selected",
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
