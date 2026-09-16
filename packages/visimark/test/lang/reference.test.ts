import { expect, test } from "bun:test";
import { FUNCTION_TABLE } from "../../src/eval/functions.js";
import { derivePrecision } from "../../src/eval/precision.js";
import type { Expr } from "../../src/lang/ast.js";
import { describeFunction, FUNCTION_DOCS, functionNames } from "../../src/lang/reference.js";
import { ERROR_CODES } from "../../src/model/types.js";

const names = Object.keys(FUNCTION_TABLE) as (keyof typeof FUNCTION_TABLE)[];

test("every builtin has a reference entry", () => {
  expect(Object.keys(FUNCTION_DOCS).sort()).toEqual([...names].sort());
});

test("each entry documents exactly as many parameters as its arity", () => {
  for (const n of names) {
    expect(FUNCTION_DOCS[n].params).toHaveLength(FUNCTION_TABLE[n].arity);
  }
});

test("every documented error code is a real error finding code", () => {
  for (const n of names) {
    for (const e of FUNCTION_DOCS[n].errors) expect(ERROR_CODES.has(e.code)).toBe(true);
  }
});

test("every entry carries at least one example", () => {
  for (const n of names) expect(FUNCTION_DOCS[n].examples.length).toBeGreaterThan(0);
});

test("`see also` never names an unknown function", () => {
  for (const n of names) {
    for (const s of FUNCTION_DOCS[n].see ?? []) expect(names).toContain(s);
  }
});

test("an error condition is a noun phrase, not a sentence", () => {
  for (const n of names) {
    for (const e of FUNCTION_DOCS[n].errors) {
      expect(`${e.when} is a ${e.code} error`).not.toMatch(/ is .* is a /);
      expect(e.when).not.toMatch(/\.$/);
    }
  }
});

test("describeFunction returns shape and documentation together", () => {
  const e = describeFunction("EOMONTH");
  expect(e).not.toBeNull();
  expect(e!.name).toBe("EOMONTH");
  expect(e!.kind).toBe("map");
  expect(e!.arity).toBe(2);
  expect(e!.returns).toBe("date");
});

test("describeFunction is case-sensitive and returns null for an unknown name", () => {
  expect(describeFunction("eomonth")).toBeNull();
  expect(describeFunction("NOPE")).toBeNull();
});

test("functionNames lists all thirteen", () => {
  expect(functionNames()).toHaveLength(13);
});

// The `Precision` column of the design-doc table is prose in `reference.ts`,
// while the rule the engine actually applies is the switch in
// `eval/precision.ts`. Nothing but this test stops the two drifting, and a
// table that misreports which functions bound their result's scale is the
// exact class of claim declared precision exists to remove.
test("`must be declared` names exactly the functions that derive no width", () => {
  const num = (v: string): Expr => ({ type: "num", value: v, start: 0, end: 0 });
  // Every argument is a literal of known width, so a `null` result is the
  // function's own rule rather than an operand the lookup could not resolve.
  // `1` rather than `1.0` because `ROUND` reads its width off the literal
  // itself and takes only a non-negative integer there.
  const call = (name: string, arity: number): Expr => ({
    type: "call",
    name,
    args: Array.from({ length: arity }, () => num("1")),
    start: 0,
    end: 0,
  });
  for (const n of names) {
    const derivesNothing = derivePrecision(call(n, FUNCTION_TABLE[n].arity), () => 2) === null;
    expect([n, FUNCTION_DOCS[n].precisionRule.includes("must be declared")]).toEqual([
      n,
      derivesNothing,
    ]);
  }
});
