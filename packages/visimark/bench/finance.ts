// IRR and NPV cost by series length. Not part of `bun test`; run it with
// `bun run bench:finance` from packages/visimark.
import { Decimal } from "decimal.js";
import type { Call, Expr } from "../src/lang/ast.js";
import { evalExpr, type EvalEnv } from "../src/eval/evaluate.js";
import { num, type Value } from "../src/eval/value.js";

const cash: Expr = { type: "ref", name: "Cash", start: 0, end: 0 };
const irr: Call = { type: "call", name: "IRR", args: [cash], start: 0, end: 0 };
const npv = (rate: string): Call => ({
  type: "call",
  name: "NPV",
  args: [{ type: "num", value: rate, start: 0, end: 0 }, cash],
  start: 0,
  end: 0,
});

function series(n: number, inflow: string, outlay: string): string[] {
  return [outlay, ...Array<string>(n).fill(inflow)];
}

const press = ["-48000", "20000", "20000", "20000"];
const cases: [string, Call, string[]][] = [
  ["IRR brake press (4 flows, 12%)", irr, press],
  ["IRR 10 flows", irr, series(10, "1500", "-10000")],
  ["IRR 36 monthly flows", irr, series(36, "300", "-10000")],
  ["IRR 120 flows", irr, series(120, "120", "-10000")],
  ["IRR 360 flows (30y monthly)", irr, series(360, "60", "-10000")],
  ["IRR high rate (4 flows, ~500%)", irr, ["-100", "500", "500", "500"]],
  ["IRR near -1 (4 flows, -90%)", irr, ["-1000", "1", "1", "1"]],
  ["IRR exact root (0.1)", irr, ["-100", "0", "121"]],
  ["NPV brake press at 8%", npv("0.08"), press],
  ["NPV 36 monthly flows at 0.5%", npv("0.005"), series(36, "300", "-10000")],
  ["NPV 120 flows at 0.6%", npv("0.006"), series(120, "120", "-10000")],
  ["NPV 360 flows at 0.4%", npv("0.004"), series(360, "60", "-10000")],
  ["NPV 360 flows at 0.41666...%", npv("0.004166666667"), series(360, "60", "-10000")],
];

const budgetMs = 500;

for (const [label, call, flows] of cases) {
  const vec: Value[] = flows.map((f) => num(new Decimal(f)));
  const env: EvalEnv = {
    vector: () => vec,
    scalar: () => {
      throw new Error("the benchmark binds no scalars");
    },
  };
  let result = evalExpr(call, env);
  let runs = 0;
  const start = performance.now();
  while (performance.now() - start < budgetMs || runs < 3) {
    result = evalExpr(call, env);
    runs++;
  }
  const ms = (performance.now() - start) / runs;
  const value = result.t === "num" ? result.d.toFixed(8) : "?";
  console.log(`${label.padEnd(34)} ${ms.toFixed(3).padStart(10)} ms/call  ${value}`);
}
