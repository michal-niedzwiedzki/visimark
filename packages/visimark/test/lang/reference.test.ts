import { expect, test } from "bun:test";
import { FUNCTION_TABLE } from "../../src/eval/functions.js";
import { derivePrecision, type Width } from "../../src/eval/precision.js";
import type { Expr } from "../../src/lang/ast.js";
import {
  describeFunction,
  FUNCTION_DOCS,
  functionNames,
  precisionPhrase,
} from "../../src/lang/reference.js";
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

// The `Precision` column of the design-doc table, the `precision` line in
// `visimark ref` and the editor hover all render `FnDoc.precision`, while the
// rule the engine applies is the switch in `eval/precision.ts`. Nothing but
// this test stops the two drifting, and a reference that misreports which
// functions bound their result's scale is the exact class of claim declared
// precision exists to remove.
test("every documented precision rule is the rule the engine applies", () => {
  const num = (v: string): Expr => ({ type: "num", value: v, start: 0, end: 0 });
  // Every argument is the literal `2`: a width of 0 and a value of 2, which
  // tells the three numeric variants apart. Literals rather than refs so a
  // `null` is the function's own rule, never an operand the lookup missed.
  const call = (name: string, arity: number): Expr => ({
    type: "call",
    name,
    args: Array.from({ length: arity }, () => num("2")),
    start: 0,
    end: 0,
  });
  for (const n of names) {
    const p = FUNCTION_DOCS[n].precision;
    const expected: Width =
      p.from === "declared"
        ? null
        : p.from === "date"
          ? "date"
          : p.from === "fixed"
            ? p.width
            : p.from === "argument-value"
              ? 2 // the literal's value
              : 0; // the literal's width, for `operands` and `argument-scale`
    const actual = derivePrecision(call(n, FUNCTION_TABLE[n].arity), () => 2);
    expect([n, actual]).toEqual([n, expected]);
  }
});

test("a precision rule never names a parameter the function does not have", () => {
  for (const n of names) {
    const p = FUNCTION_DOCS[n].precision;
    const named = p.from === "operands" ? p.params : "param" in p ? [p.param] : [];
    const real = FUNCTION_DOCS[n].params.map((x) => x.name);
    for (const name of named) expect([n, real]).toEqual([n, expect.arrayContaining([name])]);
  }
});

test("every function states a precision rule in one phrase, with no stray markup", () => {
  for (const n of names) {
    const phrase = precisionPhrase(FUNCTION_DOCS[n].precision);
    expect(phrase.length).toBeGreaterThan(0);
    // emphasis is the renderer's choice, so the shared phrase carries none
    expect(phrase).not.toContain("**");
  }
});

test("`rounding` is about breaking a tie, not about width", () => {
  // The two were one field once, and `ref ROUND` printed both meanings under
  // the word `precision`. Only `ROUND` breaks a tie of its own.
  const withRounding = names.filter((n) => FUNCTION_DOCS[n].rounding !== undefined);
  expect(withRounding).toEqual(["ROUND"]);
});
