import { expect, test } from "bun:test";
import { parseBinding, parseExpr } from "../../src/lang/parser.js";
import { LangError } from "../../src/lang/token.js";
import type { Expr } from "../../src/lang/ast.js";

// deep-strip start/end for structural comparison
function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "start" || k === "end") continue;
      out[k] = strip(v);
    }
    return out;
  }
  return node;
}
const s = (src: string) => strip(parseExpr(src));

test("operator precedence: * before +", () => {
  expect(s("Price * Qty + 1")).toEqual({
    type: "binary",
    op: "+",
    left: {
      type: "binary",
      op: "*",
      left: { type: "ref", name: "Price" },
      right: { type: "ref", name: "Qty" },
    },
    right: { type: "num", value: "1" },
  });
});

test("^ is right associative", () => {
  expect(s("2 ^ 3 ^ 2")).toEqual({
    type: "binary",
    op: "^",
    left: { type: "num", value: "2" },
    right: {
      type: "binary",
      op: "^",
      left: { type: "num", value: "3" },
      right: { type: "num", value: "2" },
    },
  });
});

test("unary minus binds tighter than *", () => {
  expect(s("-Net * 2")).toEqual({
    type: "binary",
    op: "*",
    left: { type: "unary", op: "-", operand: { type: "ref", name: "Net" } },
    right: { type: "num", value: "2" },
  });
});

test("qualified reference inside an aggregate", () => {
  expect(s("SUM(schedule.Amount)")).toEqual({
    type: "call",
    name: "SUM",
    args: [{ type: "ref", name: "Amount", qualifier: "schedule" }],
  });
});

test("parenthesised subtraction", () => {
  expect(s("lines.gross_total * (1 - early_pay_disc)")).toEqual({
    type: "binary",
    op: "*",
    left: { type: "ref", name: "gross_total", qualifier: "lines" },
    right: {
      type: "binary",
      op: "-",
      left: { type: "num", value: "1" },
      right: { type: "ref", name: "early_pay_disc" },
    },
  });
});

test("percent folds to an exact decimal at parse time", () => {
  expect(s("23%")).toEqual({ type: "num", value: "0.23" });
  expect(s("2%")).toEqual({ type: "num", value: "0.02" });
});

test("== is comparison; bare = is not an expression operator", () => {
  expect(s("a == b")).toEqual({
    type: "binary",
    op: "==",
    left: { type: "ref", name: "a" },
    right: { type: "ref", name: "b" },
  });
  expect(() => parseExpr("a = b")).toThrow(LangError);
});

test("chained comparison is rejected", () => {
  expect(() => parseExpr("a < b < c")).toThrow(/chain/i);
});

test("not binds looser than comparison", () => {
  expect(s("not a == b")).toEqual({
    type: "unary",
    op: "not",
    operand: {
      type: "binary",
      op: "==",
      left: { type: "ref", name: "a" },
      right: { type: "ref", name: "b" },
    },
  });
});

test("parseBinding splits on the first top-level =", () => {
  const b = parseBinding("early_pay_total = lines.gross_total * (1 - early_pay_disc)");
  expect(b.name).toBe("early_pay_total");
  expect(b.nameStart).toBe(0);
  expect(b.nameEnd).toBe("early_pay_total".length);
  expect((strip(b.expr) as { type: string }).type).toBe("binary");
});

test("parseBinding on a date-arithmetic column rule", () => {
  const b = parseBinding("Days   = Due - issued");
  expect(b.name).toBe("Days");
  expect(strip(b.expr)).toEqual({
    type: "binary",
    op: "-",
    left: { type: "ref", name: "Due" },
    right: { type: "ref", name: "issued" },
  });
});

test("expr offsets are relative to the binding line", () => {
  const b = parseBinding("Days   = Due - issued");
  const e = b.expr as Expr;
  expect(e.start).toBe("Days   = ".length);
});

// ---- assert statements --------------------------------------------------

import { parseStatement } from "../../src/lang/parser.js";

test("parseStatement: an `assert` line yields an Assertion node", () => {
  const st = parseStatement("assert variance == 0");
  expect("type" in st && st.type).toBe("assert");
  expect(strip((st as { expr: Expr }).expr)).toEqual({
    type: "binary",
    op: "==",
    left: { type: "ref", name: "variance" },
    right: { type: "num", value: "0" },
  });
});

test("parseStatement: an ordinary binding is unchanged", () => {
  const st = parseStatement("Net = Qty * Rate");
  expect("type" in st).toBe(false);
  expect((st as { name: string }).name).toBe("Net");
});

test("parseStatement: `assert` cannot be a bound name", () => {
  expect(() => parseStatement("assert = 1")).toThrow("`assert` is a keyword");
});

test("parseStatement: `assert` with no expression is rejected", () => {
  expect(() => parseStatement("assert")).toThrow("assert needs an expression");
});

test("parseStatement: `assert` mid-binding is rejected", () => {
  expect(() => parseStatement("x = assert")).toThrow("`assert` is a keyword");
});

// --- charts (#36) -----------------------------------------------------------

import type { ChartDecl } from "../../src/lang/ast.js";

const chart = (line: string) => parseStatement(line) as ChartDecl;

test("chart statement: minimal form", () => {
  const c = chart("chart cost_component as pie of Net labelled Item");
  expect(c.type).toBe("chart");
  expect(c.name).toBe("cost_component");
  expect(c.engine).toBe("pie");
  expect(c.series).toEqual(["Net"]);
  expect(c.labels).toBe("Item");
  expect(c.aspect).toBeNull();
});

test("chart statement: multi-series and an explicit aspect", () => {
  const c = chart("chart perf as bar of Revenue, Cost, Profit labelled Month aspect 16:9");
  expect(c.series).toEqual(["Revenue", "Cost", "Profit"]);
  expect(c.engine).toBe("bar");
  expect(c.aspect).toEqual({ w: 16, h: 9 });
});

test("chart statement: `as` is mandatory", () => {
  expect(() => chart("chart cost pie of Net labelled Item")).toThrow(LangError);
});

test("chart statement: `of` and `labelled` are mandatory", () => {
  expect(() => chart("chart cost as pie Net labelled Item")).toThrow(LangError);
  expect(() => chart("chart cost as pie of Net Item")).toThrow(LangError);
});

test("chart statement: an expression operand is refused", () => {
  expect(() => chart("chart m as bar of Profit / Revenue labelled Item")).toThrow(
    "a chart takes a column, not an expression",
  );
});

test("chart statement: malformed aspect", () => {
  expect(() => chart("chart c as pie of Net labelled Item aspect 0:9")).toThrow(
    "aspect needs two positive integers, as `16:9`",
  );
  expect(() => chart("chart c as pie of Net labelled Item aspect 16:x")).toThrow(LangError);
});

test("`chart` may not be a bound name", () => {
  expect(() => parseStatement("chart = 1")).toThrow("`chart` is a keyword");
});

test("a chart needs a name", () => {
  expect(() => chart("chart as pie of Net labelled Item")).toThrow(LangError);
});
