import { Decimal } from "decimal.js";
import type { Expr, Ref } from "../lang/ast.js";
import { addDays, daysBetween, eomonth } from "./dates.js";
import { FUNCTIONS, callProblem, describeCallProblem, isReduce } from "./functions.js";
import {
  bool,
  date,
  EvalError,
  MAX_SIGNIFICANT_DIGITS,
  num,
  roundToPlaces,
  str,
  Value,
  valueEquals,
} from "./value.js";

export interface EvalEnv {
  scalar(ref: Ref): Value;
  /** the column vector for an aggregate argument */
  vector(ref: Ref): Value[];
}

const irrBands = new WeakMap<Decimal, { lo: Decimal; hi: Decimal }>();

/** The bracket `IRR` isolated, when the returned decimal is not an exact root. */
export function irrBand(d: Decimal): { lo: Decimal; hi: Decimal } | undefined {
  return irrBands.get(d);
}

/** True when the two ends of a bracket do not share a half-up rounding at `places`. */
export function irrEndsDisagree(lo: Decimal, hi: Decimal, places: number): boolean {
  return !roundToPlaces(lo, places).eq(roundToPlaces(hi, places));
}

export function evalExpr(expr: Expr, env: EvalEnv): Value {
  switch (expr.type) {
    case "num":
      return num(new Decimal(expr.value));
    case "date":
      return date(expr.value);
    case "str":
      return str(expr.value);
    case "ref":
      return env.scalar(expr);
    case "unary":
      return evalUnary(expr.op, evalExpr(expr.operand, env));
    case "binary":
      return evalBinary(expr.op, evalExpr(expr.left, env), evalExpr(expr.right, env));
    case "call":
      return evalCall(expr, env);
  }
}

function asNum(v: Value, what: string): Decimal {
  if (v.t !== "num") throw new EvalError(`${what} expects a number`);
  return v.d;
}

function asDate(v: Value, what: string): string {
  if (v.t !== "date") throw new EvalError(`${what} expects a date`);
  return v.iso;
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
    case "/": {
      const left = asNum(l, "`/`");
      const right = asNum(r, "`/`");
      if (right.isZero()) throw new EvalError("division by zero");
      return num(left.div(right));
    }
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
  // `check` rejects these statically, so reaching one here means the evaluator
  // was called directly. Fail with the same message rather than reading past
  // the end of the argument list.
  const problem = callProblem(name, args);
  if (problem) throw new EvalError(describeCallProblem(name, problem));

  if (isReduce(name)) {
    const spec = FUNCTIONS.get(name);
    const col = spec?.kind === "reduce" ? spec.column : 0;
    const arg = args[col];
    // `callProblem` has already established this, but the narrowing is what
    // lets the vector lookup be typed rather than cast.
    if (!arg || arg.type !== "ref") {
      throw new EvalError(describeCallProblem(name, { kind: "shape" }));
    }
    if (name === "NPV") {
      const rate = evalExpr(args[0]!, env);
      return npv(rate, env.vector(arg));
    }
    if (name === "IRR") return irr(env.vector(arg));
    return aggregate(name, env.vector(arg));
  }

  const vals = args.map((a) => evalExpr(a, env));
  switch (name) {
    case "ROUND":
      return num(roundToPlaces(asNum(vals[0]!, "ROUND"), Number(asNum(vals[1]!, "ROUND"))));
    case "ABS":
      return num(asNum(vals[0]!, "ABS").abs());
    case "MOD": {
      const x = asNum(vals[0]!, "MOD");
      const y = asNum(vals[1]!, "MOD");
      if (y.isZero()) throw new EvalError("division by zero");
      return num(x.mod(y));
    }
    case "SQRT": {
      const x = asNum(vals[0]!, "SQRT");
      if (x.isNegative() && !x.isZero()) throw new EvalError("SQRT of a negative number");
      return num(x.sqrt());
    }
    case "FLOOR": {
      const x = asNum(vals[0]!, "FLOOR");
      const s = asNum(vals[1]!, "FLOOR");
      if (!s.gt(0)) {
        throw new EvalError("FLOOR significance must be a positive number");
      }
      const r = x.div(s).floor().times(s);
      return num(r.isZero() ? new Decimal(0) : r);
    }
    case "CEILING": {
      const x = asNum(vals[0]!, "CEILING");
      const s = asNum(vals[1]!, "CEILING");
      if (!s.gt(0)) {
        throw new EvalError("CEILING significance must be a positive number");
      }
      const r = x.div(s).ceil().times(s);
      return num(r.isZero() ? new Decimal(0) : r);
    }
    case "IF": {
      const c = vals[0]!;
      if (c.t !== "bool") throw new EvalError("IF() needs a boolean condition");
      return c.b ? vals[1]! : vals[2]!;
    }
    case "EOMONTH": {
      const d = asDate(vals[0]!, "EOMONTH");
      const months = asNum(vals[1]!, "EOMONTH");
      if (!months.isInteger()) {
        throw new EvalError("EOMONTH expects a whole number of months");
      }
      return date(eomonth(d, months.toNumber()));
    }
    case "PMT": {
      const rate = asNum(vals[0]!, "PMT");
      const nper = asNum(vals[1]!, "PMT");
      const pv = asNum(vals[2]!, "PMT");
      if (!nper.isInteger() || !nper.gt(0)) {
        throw new EvalError("PMT expects a positive whole number of periods");
      }
      if (!rate.gt(-1)) {
        throw new EvalError("PMT rate must be greater than -1");
      }
      if (rate.isZero()) return num(pv.div(nper));
      const growth = rate.plus(1).pow(nper);
      const instalment = pv.times(rate).times(growth).div(growth.minus(1));
      return num(instalment.isZero() ? new Decimal(0) : instalment);
    }
    default:
      throw new EvalError(`unknown function \`${name}\``);
  }
}

function irr(vec: Value[]): Value {
  if (vec.length === 0) throw new EvalError("IRR() of an empty column");
  const flows = vec.map((v) => asNum(v, "IRR"));
  if (flows.every((f) => f.isZero())) throw new EvalError("IRR() of an all-zero column");
  let changes = 0;
  let prev: Decimal | null = null;
  for (const f of flows) {
    if (f.isZero()) continue;
    if (prev !== null && prev.isNegative() !== f.isNegative()) changes++;
    prev = f;
  }
  if (changes === 0) throw new EvalError("IRR needs one sign change");
  if (changes > 1) throw new EvalError("IRR has more than one sign change");

  const sum = flows.reduce((acc, f) => acc.plus(f), new Decimal(0));
  if (sum.isZero()) return num(new Decimal(0));

  const npvAt = (rate: Decimal): Decimal => {
    let s = new Decimal(0);
    const base = rate.plus(1);
    for (let k = 0; k < flows.length; k++) s = s.plus(flows[k]!.div(base.pow(k)));
    return s;
  };
  const sign = (rate: Decimal): number => {
    const v = npvAt(rate);
    if (v.isZero()) return 0;
    return v.isNeg() ? -1 : 1;
  };
  // The last rate above -1 that 40-digit arithmetic can tell from -1.
  // A root closer than this rounds to -1 at every width the language can declare.
  let lo = new Decimal(-1).plus(new Decimal(10).pow(-MAX_SIGNIFICANT_DIGITS));
  if (!lo.gt(-1)) lo = new Decimal(-1).plus(new Decimal(10).pow(1 - MAX_SIGNIFICANT_DIGITS));
  let hi = new Decimal(1);
  const sLo = sign(lo);
  if (sLo === 0) return num(lo);
  let guard = 0;
  while (sign(hi) === sLo && guard < 200) {
    hi = hi.times(2).plus(1);
    guard++;
  }
  if (sign(hi) === 0) return num(hi);
  if (sign(hi) === sLo) return num(lo);
  for (let i = 0; i < 400; i++) {
    const mid = lo.plus(hi).div(2);
    const sm = sign(mid);
    if (sm === 0) return num(snap(mid));
    if (sm === sLo) lo = mid;
    else hi = mid;
    if (hi.minus(lo).lt(new Decimal(10).pow(-40))) break;
  }
  const mid = lo.plus(hi).div(2);
  const snapped = snap(mid);
  if (npvAt(snapped).isZero()) return num(snapped);
  irrBands.set(mid, { lo, hi });
  return num(mid);

  function snap(mid: Decimal): Decimal {
    for (let p = 0; p <= 20; p++) {
      const c = mid.toDecimalPlaces(p, Decimal.ROUND_HALF_UP);
      if (c.gt(-1) && npvAt(c).isZero()) return c.isZero() ? new Decimal(0) : c;
    }
    return mid;
  }
}

function npv(rate: Value, vec: Value[]): Value {
  const r = asNum(rate, "NPV");
  if (!r.gt(-1)) throw new EvalError("NPV rate must be greater than -1");
  if (vec.length === 0) throw new EvalError("NPV() of an empty column");
  let sum = new Decimal(0);
  for (let k = 0; k < vec.length; k++) {
    const flow = asNum(vec[k]!, "NPV");
    sum = sum.plus(flow.div(r.plus(1).pow(k)));
  }
  return num(sum.isZero() ? new Decimal(0) : sum);
}

function aggregate(name: string, vec: Value[]): Value {
  if (name === "COUNT") return num(vec.length);
  if (name === "SUM") {
    return num(vec.reduce((acc, v) => acc.plus(asNum(v, "SUM")), new Decimal(0)));
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
