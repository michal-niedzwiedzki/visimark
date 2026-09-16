import { expect, test } from "bun:test";
import { FUNCTION_TABLE } from "../../src/eval/functions.js";
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
