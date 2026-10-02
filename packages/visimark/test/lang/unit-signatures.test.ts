import { expect, test } from "bun:test";
import { runCli } from "../../src/cli/main.js";
import { describeFunction, functionNames, unitSigText } from "../../src/lang/reference.js";

const SPEC_SIGNATURES = [
  "SUM(col: U) → U",
  "MIN(col: U) → U",
  "MAX(col: U) → U",
  "AVG(col: U) → U",
  "COUNT(col: any) → 1",
  "NPV(rate: 1, flows: U) → U",
  "IRR(flows: U) → 1",
  "ROUND(x: U, places: 1) → U",
  "ABS(x: U) → U",
  "MOD(x: U, y: U) → U",
  "SQRT(x: U²) → U",
  "FLOOR(x: U, s: U) → U",
  "CEILING(x: U, s: U) → U",
  "IF(cond: bool, a: U, b: U) → U",
  "EOMONTH(d: date, months: any) → date",
  "PMT(rate: 1, nper: 1, pv: U) → U",
];

test("every builtin states the unit signature the spec gives it", () => {
  const got = functionNames().map((n) => unitSigText(n, describeFunction(n)!));
  expect(got.sort()).toEqual([...SPEC_SIGNATURES].sort());
});

test("unit signature parameters are exactly the function's parameters", () => {
  for (const n of functionNames()) {
    const e = describeFunction(n)!;
    expect(Object.keys(e.units.params).sort()).toEqual(e.params.map((p) => p.name).sort());
  }
});

async function run(args: string[]): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const code = await runCli(args, { out: (l) => lines.push(l), err: (l) => lines.push(l) });
  return { code, out: lines.join("\n") };
}

test("ref prints the unit signature", async () => {
  const { code, out } = await run(["ref", "SQRT"]);
  expect(code).toBe(0);
  expect(out).toContain("  units      SQRT(x: U²) → U");
});

test("ref --json carries the unit signature", async () => {
  const { code, out } = await run(["ref", "IF", "--json"]);
  expect(code).toBe(0);
  const body = JSON.parse(out) as { function: { units: unknown } };
  expect(body.function.units).toEqual({
    params: { cond: "bool", a: "U", b: "U" },
    returns: "U",
    text: "IF(cond: bool, a: U, b: U) → U",
  });
});
