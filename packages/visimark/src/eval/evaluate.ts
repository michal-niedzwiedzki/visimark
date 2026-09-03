import { Decimal } from "decimal.js";
import type { Expr, Ref } from "../lang/ast.js";
import { addDays, daysBetween } from "./dates.js";
import {
  bool,
  date,
  EvalError,
  num,
  roundToPlaces,
  str,
  Value,
  valueEquals,
} from "./value.js";

export const AGGREGATE_FNS = new Set(["SUM", "MIN", "MAX", "COUNT", "AVG"]);
const KNOWN_FNS = new Set([
  "SUM",
  "MIN",
  "MAX",
  "COUNT",
  "AVG",
  "ROUND",
  "ABS",
  "IF",
  "MOD",
]);

export interface EvalEnv {
  scalar(ref: Ref): Value;
  /** the column vector for an aggregate argument */
  vector(ref: Ref): Value[];
}

export function evalExpr(expr: Expr, env: EvalEnv): Value {
  switch (expr.type) {
    case "num":
      return num(new Decimal(expr.value));
    case "date":
      return date(expr.value);
    case "str":
      return str(expr.value);
    case "bool":
      return bool(expr.value);
    case "ref":
      return env.scalar(expr);
    case "unary":
      return evalUnary(expr.op, evalExpr(expr.operand, env));
    case "binary":
      return evalBinary(
        expr.op,
        evalExpr(expr.left, env),
        evalExpr(expr.right, env),
      );
    case "call":
      return evalCall(expr, env);
  }
}

function asNum(v: Value, what: string): Decimal {
  if (v.t !== "num") throw new EvalError(`${what} expects a number`);
  return v.d;
}

function evalUnary(op: "-" | "not", v: Value): Value {
  if (op === "-") return num(asNum(v, "unary minus").negated());
  if (v.t !== "bool") throw new EvalError("`not` expects a boolean");
  return bool(!v.b);
}

function evalBinary(op: string, l: Value, r: Value): Value {
  switch (op) {
    case "+":
      if (l.t === "num" && r.t === "num") return num(l.d.plus(r.d));
      if (l.t === "date" && r.t === "num") return date(addDays(l.iso, intDays(r.d)));
      if (l.t === "num" && r.t === "date") return date(addDays(r.iso, intDays(l.d)));
      throw new EvalError("`+` needs two numbers or a date and a number");
    case "-":
      if (l.t === "num" && r.t === "num") return num(l.d.minus(r.d));
      if (l.t === "date" && r.t === "date") return num(daysBetween(l.iso, r.iso));
      if (l.t === "date" && r.t === "num") return date(addDays(l.iso, -intDays(r.d)));
      throw new EvalError("`-` needs two numbers, two dates, or a date and a number");
    case "*":
      return num(asNum(l, "`*`").times(asNum(r, "`*`")));
    case "/":
      return num(asNum(l, "`/`").div(asNum(r, "`/`")));
    case "^":
      return num(asNum(l, "`^`").pow(asNum(r, "`^`")));
    case "and":
    case "or": {
      if (l.t !== "bool" || r.t !== "bool") {
        throw new EvalError(`\`${op}\` expects booleans`);
      }
      return bool(op === "and" ? l.b && r.b : l.b || r.b);
    }
    case "==":
      return bool(valueEquals(l, r));
    case "!=":
      return bool(!valueEquals(l, r));
    case "<":
    case "<=":
    case ">":
    case ">=":
      return bool(compare(op, l, r));
    default:
      throw new EvalError(`unknown operator \`${op}\``);
  }
}

function intDays(d: Decimal): number {
  if (!d.isInteger()) throw new EvalError("date arithmetic needs a whole number of days");
  return d.toNumber();
}

function compare(op: string, l: Value, r: Value): boolean {
  let c: number;
  if (l.t === "num" && r.t === "num") c = l.d.comparedTo(r.d);
  else if (l.t === "date" && r.t === "date") c = l.iso < r.iso ? -1 : l.iso > r.iso ? 1 : 0;
  else if (l.t === "str" && r.t === "str") c = l.s < r.s ? -1 : l.s > r.s ? 1 : 0;
  else throw new EvalError(`\`${op}\` cannot compare those operands`);
  if (op === "<") return c < 0;
  if (op === "<=") return c <= 0;
  if (op === ">") return c > 0;
  return c >= 0;
}

function evalCall(expr: Extract<Expr, { type: "call" }>, env: EvalEnv): Value {
  const { name, args } = expr;
  if (!KNOWN_FNS.has(name)) {
    throw new EvalError(`unknown function \`${name}\``);
  }

  if (AGGREGATE_FNS.has(name)) {
    const arg = args[0];
    if (!arg || arg.type !== "ref" || args.length !== 1) {
      throw new EvalError(`${name}() takes one column reference`);
    }
    const vec = env.vector(arg);
    return aggregate(name, vec);
  }

  const vals = args.map((a) => evalExpr(a, env));
  switch (name) {
    case "ROUND":
      return num(
        roundToPlaces(asNum(vals[0]!, "ROUND"), Number(asNum(vals[1]!, "ROUND"))),
      );
    case "ABS":
      return num(asNum(vals[0]!, "ABS").abs());
    case "MOD":
      return num(asNum(vals[0]!, "MOD").mod(asNum(vals[1]!, "MOD")));
    case "IF": {
      const c = vals[0]!;
      if (c.t !== "bool") throw new EvalError("IF() needs a boolean condition");
      return c.b ? vals[1]! : vals[2]!;
    }
    default:
      throw new EvalError(`unknown function \`${name}\``);
  }
}

function aggregate(name: string, vec: Value[]): Value {
  if (name === "COUNT") return num(vec.length);
  if (name === "SUM") {
    return num(
      vec.reduce((acc, v) => acc.plus(asNum(v, "SUM")), new Decimal(0)),
    );
  }
  if (vec.length === 0) throw new EvalError(`${name}() of an empty column`);
  if (name === "AVG") {
    const total = vec.reduce((acc, v) => acc.plus(asNum(v, "AVG")), new Decimal(0));
    return num(total.div(vec.length));
  }
  // MIN / MAX over numbers or dates
  const first = vec[0]!;
  if (first.t === "num") {
    let best = asNum(first, name);
    for (const v of vec.slice(1)) {
      const d = asNum(v, name);
      if ((name === "MIN" && d.lt(best)) || (name === "MAX" && d.gt(best))) best = d;
    }
    return num(best);
  }
  if (first.t === "date") {
    let best = first.iso;
    for (const v of vec.slice(1)) {
      if (v.t !== "date") throw new EvalError(`${name}() over mixed types`);
      if ((name === "MIN" && v.iso < best) || (name === "MAX" && v.iso > best)) {
        best = v.iso;
      }
    }
    return date(best);
  }
  throw new EvalError(`${name}() needs numbers or dates`);
}
