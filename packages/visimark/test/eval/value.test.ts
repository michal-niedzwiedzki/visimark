import { expect, test } from "bun:test";
import { Decimal } from "decimal.js";
import type { Expr } from "../../src/lang/ast.js";
import { parseExpr } from "../../src/lang/parser.js";
import { evalExpr, type EvalEnv } from "../../src/eval/evaluate.js";
import { num, roundToPlaces, type Value } from "../../src/eval/value.js";

function envOf(scalars: Record<string, Value>, vectors: Record<string, Value[]> = {}): EvalEnv {
  return {
    scalar: (ref) => {
      const key = ref.qualifier ? `${ref.qualifier}.${ref.name}` : ref.name;
      const v = scalars[key];
      if (!v) throw new Error(`no scalar ${key}`);
      return v;
    },
    vector: (ref) => {
      const key = ref.qualifier ? `${ref.qualifier}.${ref.name}` : ref.name;
      return vectors[key] ?? [];
    },
  };
}

const evalStr = (src: string, env: EvalEnv) => evalExpr(parseExpr(src) as Expr, env);

test("multiplication is exact decimal", () => {
  const v = evalStr("Qty * Rate", envOf({ Qty: num(20), Rate: num(260) }));
  expect(v).toEqual(num(new Decimal(5200)));
});

test("decimal arithmetic, not binary float", () => {
  const v = evalStr("0.1 + 0.2", envOf({}));
  expect(v.t).toBe("num");
  if (v.t === "num") expect(v.d.toString()).toBe("0.3");
});

test("half-up rounding at the binding boundary", () => {
  expect(roundToPlaces(new Decimal("30593.052"), 2).toFixed(2)).toBe("30593.05");
  expect(roundToPlaces(new Decimal("2.5"), 0).toString()).toBe("3");
  expect(roundToPlaces(new Decimal("6719.57799"), 2).toFixed(2)).toBe("6719.58");
});

test("date arithmetic is closed and small", () => {
  const env = envOf({ due: { t: "date", iso: "2026-09-10" }, issued: { t: "date", iso: "2026-09-03" } });
  expect(evalStr("due - issued", env)).toEqual(num(7));
  expect(evalStr("issued + 7", env)).toEqual({ t: "date", iso: "2026-09-10" });
  expect(() => evalStr("issued * 2", env)).toThrow(/number/);
});

test("SUM over a column vector", () => {
  const env = envOf({}, { Net: [num(3600), num(14080), num(2500), num(5200)] });
  expect(evalStr("SUM(Net)", env)).toEqual(num(25380));
});

test("comparisons and booleans", () => {
  // Booleans have no literals, so a boolean can only come from a comparison.
  expect(evalStr("2 < 3 and not (4 < 3)", envOf({}))).toEqual({
    t: "bool",
    b: true,
  });
});
