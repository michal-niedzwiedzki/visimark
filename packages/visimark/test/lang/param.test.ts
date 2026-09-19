import { describe, expect, test } from "bun:test";
import { parseStatement, type Binding } from "../../src/lang/parser.js";
import { LangError } from "../../src/lang/token.js";

// docs/design/scenario-params-spec.md §2 and §4.1

function param(line: string): Binding {
  const s = parseStatement(line);
  if ("type" in s) throw new Error(`not a binding: ${line}`);
  return s;
}

function fails(line: string): LangError {
  try {
    parseStatement(line);
  } catch (e) {
    if (e instanceof LangError) return e;
    throw e;
  }
  throw new Error(`parsed: ${line}`);
}

describe("param statement", () => {
  test("a percent default folds and is remembered as a percent", () => {
    const b = param("param tax precision 3 = default 19%");
    expect(b.name).toBe("tax");
    expect(b.precision).toBe(3);
    expect(b.expr).toMatchObject({ type: "num", value: "0.19" });
    expect(b.param).toEqual({ text: "19%", percent: true });
  });

  test("a bare default keeps its written digits", () => {
    const b = param("param budget precision 2 = default 2.00");
    expect(b.expr).toMatchObject({ type: "num", value: "2.00" });
    expect(b.param).toEqual({ text: "2.00", percent: false });
  });

  test("a negative default", () => {
    const b = param("param delta precision 0 = default -3");
    expect(b.expr).toMatchObject({ type: "num", value: "-3" });
    expect(b.param?.text).toBe("-3");
  });

  test("a negative percent default", () => {
    expect(param("param d precision 3 = default -12.5%").expr).toMatchObject({
      value: "-0.125",
    });
  });

  test("a missing precision clause parses; check reports it", () => {
    const b = param("param tax = default 19%");
    expect(b.precision).toBeUndefined();
    expect(b.param?.percent).toBe(true);
  });

  test("no `default` after `=`", () => {
    const e = fails("param tax precision 3 = 19%");
    expect(e.message).toBe("expected `default` after `=` in a param");
    expect(e.bindingName).toBe("tax");
  });

  test("a quoted name is refused", () => {
    expect(fails('param "Growth" precision 2 = default 4.25').message).toBe(
      "a param name must be an identifier, not a quoted header",
    );
  });

  for (const dflt of ["12.5% * 2", "rate", '"abc"', "2026-01-01", "", "(3)"]) {
    test(`a non-literal default: ${JSON.stringify(dflt)}`, () => {
      expect(fails(`param x precision 2 = default ${dflt}`).message).toBe(
        "a param default must be a number literal",
      );
    });
  }
});

describe("param and default stay ordinary names elsewhere", () => {
  test("`param = 5` binds a scalar called param", () => {
    expect(param("param = 5").name).toBe("param");
    expect(param("param = 5").param).toBeUndefined();
  });

  test("`param precision 2 = x / y` binds a scalar called param", () => {
    const b = param("param precision 2 = x / y");
    expect(b.name).toBe("param");
    expect(b.precision).toBe(2);
    expect(b.param).toBeUndefined();
  });

  test("`default = 3` binds a scalar called default", () => {
    expect(param("default = 3").name).toBe("default");
  });

  test("both read as names inside an expression", () => {
    const b = param("x = param + default");
    expect(b.expr).toMatchObject({
      type: "binary",
      left: { type: "ref", name: "param" },
      right: { type: "ref", name: "default" },
    });
  });
});
