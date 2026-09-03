import { expect, test } from "bun:test";
import { lex } from "../../src/lang/lexer.js";
import { LangError } from "../../src/lang/token.js";

const kinds = (src: string) => lex(src).map((t) => t.kind);
const pairs = (src: string) => lex(src).map((t) => [t.kind, t.value]);

test("identifiers and operators with offsets", () => {
  const toks = lex("Price * Qty");
  expect(toks.map((t) => [t.kind, t.value, t.start, t.end])).toEqual([
    ["ident", "Price", 0, 5],
    ["op", "*", 6, 7],
    ["ident", "Qty", 8, 11],
    ["eof", "", 11, 11],
  ]);
});

test("percent literal is one token carrying the numeric part", () => {
  expect(pairs("23%")).toEqual([
    ["percent", "23"],
    ["eof", ""],
  ]);
});

test("ISO date is one token; non-ISO date-ish text is not", () => {
  expect(pairs("2026-09-03")).toEqual([
    ["date", "2026-09-03"],
    ["eof", ""],
  ]);
  expect(kinds("2026-9-3")).toEqual([
    "number",
    "op",
    "number",
    "op",
    "number",
    "eof",
  ]);
});

test("string and boolean literals", () => {
  expect(pairs('"net 30"')).toEqual([
    ["string", "net 30"],
    ["eof", ""],
  ]);
  expect(pairs("true")).toEqual([
    ["bool", "true"],
    ["eof", ""],
  ]);
  expect(pairs("false")).toEqual([
    ["bool", "false"],
    ["eof", ""],
  ]);
});

test("thousands separators are rejected", () => {
  expect(() => lex("1,800")).toThrow(LangError);
  expect(() => lex("1,800")).toThrow(/thousands/i);
});

test("word operators lex from identifier position", () => {
  expect(pairs("a and not b")).toEqual([
    ["ident", "a"],
    ["op", "and"],
    ["op", "not"],
    ["ident", "b"],
    ["eof", ""],
  ]);
});

test("qualified reference produces a dot token", () => {
  expect(kinds("schedule.Amount")).toEqual(["ident", "dot", "ident", "eof"]);
});

test("comparison operators longest-match", () => {
  expect(pairs("a >= b != c")).toEqual([
    ["ident", "a"],
    ["op", ">="],
    ["ident", "b"],
    ["op", "!="],
    ["ident", "c"],
    ["eof", ""],
  ]);
});

test("parens, commas, decimals", () => {
  expect(pairs("SUM(Net, 5200.00)")).toEqual([
    ["ident", "SUM"],
    ["lparen", "("],
    ["ident", "Net"],
    ["comma", ","],
    ["number", "5200.00"],
    ["rparen", ")"],
    ["eof", ""],
  ]);
});

test("unrecognised character throws with offset", () => {
  try {
    lex("a $ b");
    throw new Error("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(LangError);
    expect((e as LangError).start).toBe(2);
  }
});
