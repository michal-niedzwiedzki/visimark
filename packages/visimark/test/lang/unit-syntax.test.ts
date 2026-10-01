import { describe, expect, test } from "bun:test";
import type { Binary, NumberLit, UnitDef } from "../../src/lang/ast.js";
import { lex } from "../../src/lang/lexer.js";
import { type Binding, parseExpr, parseStatement } from "../../src/lang/parser.js";
import { LangError } from "../../src/lang/token.js";

function failure(line: string): LangError {
  try {
    parseStatement(line);
  } catch (e) {
    if (e instanceof LangError) return e;
    throw e;
  }
  throw new Error(`expected \`${line}\` to fail`);
}

describe("lexing", () => {
  test("a bracket is one raw unit token, its grammar untouched", () => {
    const t = lex("[kg⋅m²/s²]");
    expect(t[0]).toMatchObject({ kind: "unit", value: "kg⋅m²/s²", start: 0, end: 10 });
  });

  test("a bracket after `in` stays domain punctuation", () => {
    expect(lex("in [0, 80]").map((t) => t.kind)).toEqual([
      "ident",
      "lbracket",
      "number",
      "comma",
      "number",
      "rbracket",
      "eof",
    ]);
  });

  test("an unterminated bracket is a parse error", () => {
    expect(() => lex("x [kg = 1")).toThrow("unterminated unit bracket");
  });

  test("⋅ outside a bracket is the * operator", () => {
    const e = parseExpr("width ⋅ height") as Binary;
    expect(e).toMatchObject({ type: "binary", op: "*" });
  });
});

describe("binding heads", () => {
  test("the unit comes right after the name, before precision", () => {
    const b = parseStatement("x [m/s] precision 2 = a / b") as Binding;
    expect(b.name).toBe("x");
    expect(b.precision).toBe(2);
    expect(b.unit).toMatchObject({ text: "m/s", start: 2, end: 7 });
  });

  test("whitespace before the bracket is optional", () => {
    expect((parseStatement("x[kg] = 1") as Binding).unit?.text).toBe("kg");
  });

  test("a unit after precision is a TYPE parse error", () => {
    const e = failure("x precision 2 [m] = 1");
    expect(e.message).toBe("the unit comes before precision: name [unit] precision N");
    expect(e.code).toBeUndefined();
  });

  test("a quoted head takes no unit", () => {
    const e = failure('"Worker cost" [USD] = 1');
    expect(e.message).toBe("Worker cost's unit is declared on its header, not on its rule");
    expect(e.code).toBe("UNIT");
  });
});

describe("param heads", () => {
  test("a unit and a domain on one head", () => {
    const b = parseStatement(
      "param rate [PLN/EUR] precision 4 in [4.0, 4.5] = default 4.2650",
    ) as Binding;
    expect(b.unit?.text).toBe("PLN/EUR");
    expect(b.precision).toBe(4);
    expect(b.domain?.parts[0]).toMatchObject({ kind: "range" });
  });

  test("a unit on the default literal is refused", () => {
    const e = failure("param rate [PLN] precision 2 = default 4.20 [PLN]");
    expect(e.message).toBe("a param's unit is declared on its head");
    expect(e.code).toBe("UNIT");
  });

  test("a unit on a domain bound is refused", () => {
    const e = failure("param rate [PLN] precision 2 in [4.0 [PLN], 4.5] = default 4.20");
    expect(e.message).toBe("a param's unit is declared on its head");
    expect(e.code).toBe("UNIT");
  });

  test("a unit after precision on a param is a parse error", () => {
    expect(failure("param rate precision 2 [PLN] = default 1").message).toBe(
      "the unit comes before precision: name [unit] precision N",
    );
  });
});

describe("number literals", () => {
  test("10 [PLN] carries its unit", () => {
    const n = parseExpr("10 [PLN]") as NumberLit;
    expect(n).toMatchObject({ type: "num", value: "10", unit: { text: "PLN" } });
  });

  test("whitespace before the bracket is optional", () => {
    expect((parseExpr("10[PLN]") as NumberLit).unit?.text).toBe("PLN");
  });

  test("the bracket binds tighter than any operator", () => {
    expect(parseExpr("-10 [PLN]")).toMatchObject({
      type: "unary",
      operand: { type: "num", unit: { text: "PLN" } },
    });
    expect(parseExpr("2 * 10 [PLN]")).toMatchObject({
      type: "binary",
      op: "*",
      right: { type: "num", unit: { text: "PLN" } },
    });
  });

  test("a percent literal is marked and refuses a unit", () => {
    expect(parseExpr("23%")).toMatchObject({ value: "0.23", percent: true });
    const e = failure("x = 23% [PLN]");
    expect(e.message).toBe("23% is a ratio and cannot carry a unit");
    expect(e.code).toBe("UNIT");
  });

  test.each([
    "x = a [PLN]",
    "x = SUM(Net) [PLN]",
    'x = "abc" [PLN]',
    "x = 2026-01-01 [d]",
    "x = (a + b) [m]",
  ])("%s is refused: a unit goes only on a number literal", (line) => {
    const e = failure(line);
    expect(e.message).toBe("a unit can be written only on a number literal");
    expect(e.code).toBe("UNIT");
  });
});

describe("unit definitions", () => {
  test("[J] = [N⋅m]", () => {
    const d = parseStatement("[J] = [N⋅m]") as UnitDef;
    expect(d).toMatchObject({ type: "unitdef", atom: { text: "J" }, unit: { text: "N⋅m" } });
  });

  test("the left side is one atom", () => {
    const e = failure("[N⋅m] = [J]");
    expect(e.message).toBe("a definition defines one atom");
    expect(e.code).toBe("UNIT");
  });

  test("anything but `[atom] = [unit]` is a parse error", () => {
    expect(failure("[J] = 3").message).toBe("a unit definition is written `[atom] = [unit]`");
    expect(failure("[J] = [N] [m]").message).toBe("a unit definition is written `[atom] = [unit]`");
  });
});
