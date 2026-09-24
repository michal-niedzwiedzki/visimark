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

describe("param domain clause", () => {
  test("integer preset intersected with a closed range", () => {
    const b = param("param extra_hours precision 0 integer in [0, 80] = default 0");
    expect(b.domain?.parts).toEqual([
      { kind: "preset", name: "integer", text: "integer" },
      {
        kind: "range",
        lo: "0",
        loLiteral: { text: "0", percent: false },
        loClosed: true,
        hi: "80",
        hiLiteral: { text: "80", percent: false },
        hiClosed: true,
        text: "[0, 80]",
      },
    ]);
  });

  test("a bare range with no preset", () => {
    const b = param("param volume_disc precision 3 in [0%, 15%] = default 0%");
    expect(b.domain?.parts).toEqual([
      {
        kind: "range",
        lo: "0",
        loLiteral: { text: "0%", percent: true },
        loClosed: true,
        hi: "0.15",
        hiLiteral: { text: "15%", percent: true },
        hiClosed: true,
        text: "[0%, 15%]",
      },
    ]);
  });

  test("a finite set", () => {
    const b = param("param prepay_share precision 2 in { 30%, 40%, 45%, 50% } = default 30%");
    expect(b.domain?.parts).toEqual([
      {
        kind: "set",
        members: ["0.3", "0.4", "0.45", "0.5"],
        memberLiterals: [
          { text: "30%", percent: true },
          { text: "40%", percent: true },
          { text: "45%", percent: true },
          { text: "50%", percent: true },
        ],
        text: "{ 30%, 40%, 45%, 50% }",
      },
    ]);
  });

  test("`natural`/`ℕ` are the same preset", () => {
    const a = param("param x precision 0 natural = default 0");
    const b = param("param x precision 0 ℕ = default 0");
    expect(a.domain).toEqual(b.domain);
    expect(a.domain?.parts).toEqual([{ kind: "preset", name: "natural", text: "natural" }]);
  });

  test("`positive integer`/`ℤ⁺` are the same preset", () => {
    const a = param("param x precision 0 positive integer = default 1");
    const b = param("param x precision 0 ℤ⁺ = default 1");
    expect(a.domain).toEqual(b.domain);
    expect(a.domain?.parts).toEqual([
      { kind: "preset", name: "positive integer", text: "positive integer" },
    ]);
  });

  test("`in`/`∈` are interchangeable", () => {
    const a = param("param x precision 0 integer in [0, 5] = default 0");
    const b = param("param x precision 0 integer ∈ [0, 5] = default 0");
    expect(a.domain).toEqual(b.domain);
  });

  test("half-open range", () => {
    const b = param("param x precision 0 integer in [0, 40) = default 0");
    expect(b.domain?.parts[1]).toMatchObject({ hiClosed: false, loClosed: true });
  });

  test("unbounded end must use an open bracket", () => {
    expect(fails("param x precision 0 in [0,] = default 0").message).toBe(
      "malformed param domain clause",
    );
    expect(fails("param x precision 0 in [0,)").message).not.toBe(undefined);
    const b = param("param x precision 0 in [0, ) = default 0");
    expect(b.domain?.parts[0]).toMatchObject({ lo: "0", loClosed: true, hiClosed: false });
    expect((b.domain?.parts[0] as { hi?: string }).hi).toBeUndefined();
  });

  test("an empty set literal parses (checked for emptiness later)", () => {
    const b = param("param x precision 0 in { } = default 0");
    expect(b.domain?.parts).toEqual([{ kind: "set", members: [], memberLiterals: [], text: "{ }" }]);
  });

  test("unrecognised preset word", () => {
    expect(fails("param x precision 0 nonsense = default 0").message).toBe(
      "unrecognised param domain preset `nonsense`",
    );
  });

  test("malformed clause: `in` with nothing after", () => {
    expect(fails("param x precision 0 in = default 0").message).toBe(
      "malformed param domain clause",
    );
  });

  test("no domain clause leaves `domain` undefined", () => {
    expect(param("param tax precision 3 = default 19%").domain).toBeUndefined();
  });
});
