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
  expect(kinds("2026-9-3")).toEqual(["number", "op", "number", "op", "number", "eof"]);
});

test("string literals", () => {
  expect(pairs('"net 30"')).toEqual([
    ["string", "net 30"],
    ["eof", ""],
  ]);
});

test("boolean literals are rejected", () => {
  // The type exists in the engine; the literals are not surface syntax.
  expect(() => lex("true")).toThrow(LangError);
  expect(() => lex("false")).toThrow(LangError);
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

test("`assert` lexes as its own keyword token", () => {
  expect(pairs("assert x == 1")).toEqual([
    ["assert", "assert"],
    ["ident", "x"],
    ["op", "=="],
    ["number", "1"],
    ["eof", ""],
  ]);
});

test("`assertion` is an ordinary identifier, not the keyword", () => {
  expect(kinds("assertion + 1")).toEqual(["ident", "op", "number", "eof"]);
});

// --- charts (#36) -----------------------------------------------------------

test("`chart` lexes as its own keyword kind", () => {
  const t = lex("chart cost as pie")[0]!;
  expect(t.kind).toBe("chart");
  expect(t.value).toBe("chart");
});

test("`chart` in a name position still lexes as the keyword", () => {
  // the parser, not the lexer, decides where a keyword may stand
  expect(kinds("chart = 1")).toEqual(["chart", "op", "number", "eof"]);
});

test("`:` lexes as a colon token for aspect ratios", () => {
  expect(kinds("16:9")).toEqual(["number", "colon", "number", "eof"]);
});

test("a word merely starting with `chart` is an ident", () => {
  expect(lex("charts")[0]!.kind).toBe("ident");
});

// --- Σ / ∑ alias for SUM (#43) ----------------------------------------------

test("Σ and ∑ lex as the identifier SUM", () => {
  expect(pairs("Σ(Net)")).toEqual(pairs("SUM(Net)"));
  expect(pairs("∑(Net)")).toEqual(pairs("SUM(Net)"));
});

test("Σ carries its own one-character source span", () => {
  const toks = lex("Σ(Net)");
  expect(toks.map((t) => [t.kind, t.value, t.start, t.end])).toEqual([
    ["ident", "SUM", 0, 1],
    ["lparen", "(", 1, 2],
    ["ident", "Net", 2, 5],
    ["rparen", ")", 5, 6],
    ["eof", "", 6, 6],
  ]);
});

test("a bare Σ (no call) lexes exactly like a bare SUM", () => {
  expect(pairs("Σ")).toEqual(pairs("SUM"));
});

test("lowercase sigma is not aliased", () => {
  expect(() => lex("σ(Net)")).toThrow('unexpected character "σ"');
  expect(() => lex("ς(Net)")).toThrow('unexpected character "ς"');
});
