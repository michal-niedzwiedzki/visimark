/**
 * The builtin function table — the single home for the map/reduce
 * classification the rest of the engine turns on.
 *
 * Every expression in VisiMark has one of two shapes. A **scalar** is a single
 * value. A **vector** is a column, and it is produced by exactly one thing: a
 * reference to a column. A **map** function is scalar -> scalar and runs once
 * per row inside a column rule; a **reduce** function is vector -> scalar and
 * collapses a column to a single value. There is no vector -> vector, which is
 * why a bare foreign column outside a reduce is a `VECTOR` error and why a
 * reduce's result composes freely back into a map (`Share = Net / SUM(Net)`).
 *
 * A reduce takes a *column reference*, never an expression: `SUM(Price * Qty)`
 * is refused so that every intermediate is materialised as a column a reader
 * can see in the diff. That refusal is the audit trail, not a limitation of
 * the parser.
 */

export type FnKind = "map" | "reduce";

export interface FnSpec {
  /** `map` is scalar -> scalar; `reduce` is column -> scalar. */
  kind: FnKind;
  /** exact argument count; every reduce takes exactly one */
  arity: number;
}

export const FUNCTIONS: ReadonlyMap<string, FnSpec> = new Map<string, FnSpec>([
  // reduces: one column reference in, one scalar out
  ["SUM", { kind: "reduce", arity: 1 }],
  ["MIN", { kind: "reduce", arity: 1 }],
  ["MAX", { kind: "reduce", arity: 1 }],
  ["COUNT", { kind: "reduce", arity: 1 }],
  ["AVG", { kind: "reduce", arity: 1 }],
  // maps: scalars in, one scalar out
  ["ROUND", { kind: "map", arity: 2 }],
  ["ABS", { kind: "map", arity: 1 }],
  ["MOD", { kind: "map", arity: 2 }],
  ["SQRT", { kind: "map", arity: 1 }],
  ["IF", { kind: "map", arity: 3 }],
  ["EOMONTH", { kind: "map", arity: 2 }],
]);

export const isReduce = (name: string): boolean => FUNCTIONS.get(name)?.kind === "reduce";

export type CallProblem =
  | { kind: "unknown" }
  | { kind: "arity"; expected: number; got: number }
  | { kind: "shape" };

/** Static problems with a call, decidable without evaluating anything. */
export function callProblem(name: string, args: { type: string }[]): CallProblem | null {
  const spec = FUNCTIONS.get(name);
  if (!spec) return { kind: "unknown" };
  if (args.length !== spec.arity) {
    return { kind: "arity", expected: spec.arity, got: args.length };
  }
  if (spec.kind === "reduce" && args[0]!.type !== "ref") return { kind: "shape" };
  return null;
}

export function describeCallProblem(name: string, p: CallProblem): string {
  switch (p.kind) {
    case "unknown":
      return `unknown function \`${name}\``;
    case "arity":
      return `${name}() takes ${p.expected} argument${p.expected === 1 ? "" : "s"}, got ${p.got}`;
    case "shape":
      return `${name}() takes a column reference, not an expression`;
  }
}
