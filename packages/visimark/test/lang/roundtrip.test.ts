import { expect, test } from "bun:test";
import type { Expr } from "../../src/lang/ast.js";
import { COMPARISON_OPS } from "../../src/lang/ast.js";
import { parseExpr } from "../../src/lang/parser.js";

/**
 * A property test for the language layer, in the shape the `fmt` idempotence
 * tests already use: generate, render, read back, assert nothing moved.
 *
 * Two things about this file are deliberate.
 *
 * **The printers live here, not in `src/lang/`.** VisiMark ships no `Expr`
 * printer — `fmt` rewrites tables and artifact anchors, never formula text —
 * and adding public surface nothing ships against, purely to enable a test, is
 * not a trade this repo makes. If a printer is ever actually needed, promote
 * these with their own tests; until then they are test fixtures.
 *
 * **There are two printers, and that is the point.** `printFull` parenthesises
 * every node, so it has no precedence logic and is correct by inspection; it is
 * the oracle. `printMin` emits the minimal parenthesisation from the real
 * `LEFT_BP` / `RIGHT_ASSOC` semantics, and is the thing under test alongside the
 * parser. Asserting only `parse(printMin(e)) === e` would rest on an untested
 * printer, and a printer bug that inverted a parser bug would pass silently.
 * Requiring both forms to agree closes that: they would have to be exactly
 * inverse to survive.
 *
 * No generator dependency — REVIEW §2.4 is explicit about that, and the repo's
 * four runtime deps are all load-bearing. The seed is fixed and printed on
 * failure, so a red run is reproducible from its own output.
 */

// ---- the generator ----

const SEED = 0x5eed_1234;

/** xorshift32 — reproducible, and small enough to read. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x1_0000_0000;
  };
}

const LEFT_BP: Record<string, number> = {
  or: 1,
  and: 2,
  "==": 3,
  "!=": 3,
  "<": 3,
  "<=": 3,
  ">": 3,
  ">=": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
  "^": 6,
};
const RIGHT_ASSOC = new Set(["^"]);
const UNARY_MINUS_BP = 5;
const UNARY_NOT_BP = 2;
const BIN_OPS = Object.keys(LEFT_BP);

/** Names chosen to collide with no keyword and no builtin. */
const NAMES = ["c0", "c1", "Net", "Qty", "rate_x"];
const QUALS = ["s1", "sheet_b"];
const STRINGS = ["", "a", "paid", "a b c"];
const DATES = ["2024-01-15", "1999-12-31", "2030-06-01"];
const NUMS = ["0", "1", "42", "3.5", "0.125", "1000000"];

interface Gen {
  next: () => number;
  pick: <T>(xs: readonly T[]) => T;
}

const pos = { start: 0, end: 0 };

function randomExpr(g: Gen, depth: number): Expr {
  // Atoms only at the leaves, and increasingly likely as depth runs out.
  if (depth <= 0 || g.next() < 0.3) {
    const k = g.next();
    if (k < 0.4) return { type: "num", value: g.pick(NUMS), ...pos };
    if (k < 0.55) return { type: "str", value: g.pick(STRINGS), ...pos };
    if (k < 0.7) return { type: "date", value: g.pick(DATES), ...pos };
    if (k < 0.85) return { type: "ref", name: g.pick(NAMES), ...pos };
    return { type: "ref", qualifier: g.pick(QUALS), name: g.pick(NAMES), ...pos };
  }

  const k = g.next();
  if (k < 0.2) {
    const op = g.next() < 0.7 ? "-" : "not";
    return { type: "unary", op, operand: randomExpr(g, depth - 1), ...pos };
  }
  if (k < 0.35) {
    // A call is generated with a real name and a real arity, but never a
    // reduce: `SUM` takes a bare column reference, and `SUM(1 + 2)` is a
    // `check`-time refusal that would make the corpus unrepresentative.
    const name = g.pick(["ROUND", "ABS", "MOD", "IF", "SQRT"]);
    const arity = name === "IF" ? 3 : name === "ABS" || name === "SQRT" ? 1 : 2;
    const args = Array.from({ length: arity }, () => randomExpr(g, depth - 1));
    return { type: "call", name, args, ...pos };
  }

  const op = g.pick(BIN_OPS);
  let left = randomExpr(g, depth - 1);
  // `1 < 2 < 3` is refused by design, and a parenthesised `(1 < 2) < 3` is
  // refused too, since parentheses are transparent in this AST. So the corpus
  // must not contain one; that rule has its own test in parser.test.ts.
  if (COMPARISON_OPS.has(op)) {
    while (left.type === "binary" && COMPARISON_OPS.has(left.op)) {
      left = randomExpr(g, depth - 1);
    }
  }
  return { type: "binary", op, left, right: randomExpr(g, depth - 1), ...pos };
}

// ---- the oracle: every node parenthesised, no precedence logic at all ----

function printFull(e: Expr): string {
  switch (e.type) {
    case "num":
      return `(${e.value})`;
    case "str":
      return `("${e.value}")`;
    case "date":
      return `(${e.value})`;
    case "ref":
      return `(${e.qualifier === undefined ? e.name : `${e.qualifier}.${e.name}`})`;
    case "unary":
      return `(${e.op} ${printFull(e.operand)})`;
    case "binary":
      return `(${printFull(e.left)} ${e.op} ${printFull(e.right)})`;
    case "call":
      return `(${e.name}(${e.args.map(printFull).join(", ")}))`;
  }
}

// ---- the thing under test alongside the parser ----

/** Binding power a node behaves as when it is someone else's operand. */
function prec(e: Expr): number {
  switch (e.type) {
    case "unary":
      return e.op === "-" ? UNARY_MINUS_BP : UNARY_NOT_BP;
    case "binary":
      return LEFT_BP[e.op]!;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function printMin(e: Expr): string {
  switch (e.type) {
    case "num":
      return e.value;
    case "str":
      return `"${e.value}"`;
    case "date":
      return e.value;
    case "ref":
      return e.qualifier === undefined ? e.name : `${e.qualifier}.${e.name}`;
    case "call":
      return `${e.name}(${e.args.map(printMin).join(", ")})`;
    case "unary": {
      const bp = prec(e);
      // `<=`, not `<`: a unary parses its operand with parseBp(bp), which stops
      // at an operator of *equal* binding power. `-a * b` is `(-a) * b`, so an
      // operand that is itself a `*` has to be wrapped.
      const inner = printMin(e.operand);
      return `${e.op} ${prec(e.operand) <= bp ? `(${inner})` : inner}`;
    }
    case "binary": {
      const bp = prec(e);
      const right = RIGHT_ASSOC.has(e.op);
      const wrap = (child: Expr, isLeft: boolean): string => {
        const p = prec(child);
        const needs = p < bp || (p === bp && (isLeft ? right : !right));
        const s = printMin(child);
        return needs ? `(${s})` : s;
      };
      return `${wrap(e.left, true)} ${e.op} ${wrap(e.right, false)}`;
    }
  }
}

// ---- the property ----

/** Structural equality ignoring spans, which printing cannot preserve. */
function same(a: Expr, b: Expr): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "num":
    case "str":
    case "date":
      return a.value === (b as typeof a).value;
    case "ref":
      return a.name === (b as typeof a).name && a.qualifier === (b as typeof a).qualifier;
    case "unary":
      return a.op === (b as typeof a).op && same(a.operand, (b as typeof a).operand);
    case "binary":
      return (
        a.op === (b as typeof a).op &&
        same(a.left, (b as typeof a).left) &&
        same(a.right, (b as typeof a).right)
      );
    case "call":
      return (
        a.name === (b as typeof a).name &&
        a.args.length === (b as typeof a).args.length &&
        a.args.every((x, i) => same(x, (b as typeof a).args[i]!))
      );
  }
}

test("generated expressions round-trip through both printers", () => {
  const next = rng(SEED);
  const g: Gen = { next, pick: (xs) => xs[Math.floor(next() * xs.length)]! };

  for (let i = 0; i < 2000; i++) {
    const e = randomExpr(g, 6);
    const full = printFull(e);
    const min = printMin(e);
    // The seed plus the case index is the whole reproduction: the generator is
    // deterministic, so a failure here is replayable from this message alone.
    const where = `seed=0x${SEED.toString(16)} case=${i}\n  full: ${full}\n  min:  ${min}`;

    let a: Expr;
    let b: Expr;
    try {
      a = parseExpr(full);
      b = parseExpr(min);
    } catch (err) {
      throw new Error(`parse threw\n${where}\n  ${String(err)}`);
    }
    if (!same(a, e)) throw new Error(`fully-parenthesised form did not round-trip\n${where}`);
    if (!same(b, e)) throw new Error(`minimal form did not round-trip\n${where}`);
  }
  expect(true).toBe(true);
});

test("the corpus actually exercises the operators it claims to", () => {
  // A generator that quietly stopped producing anything but atoms would make
  // the test above pass and mean nothing.
  const next = rng(SEED);
  const g: Gen = { next, pick: (xs) => xs[Math.floor(next() * xs.length)]! };
  const seen = new Set<string>();
  const walk = (e: Expr): void => {
    if (e.type === "binary") {
      seen.add(e.op);
      walk(e.left);
      walk(e.right);
    } else if (e.type === "unary") {
      seen.add(`u${e.op}`);
      walk(e.operand);
    } else if (e.type === "call") {
      seen.add("call");
      e.args.forEach(walk);
    }
  };
  for (let i = 0; i < 2000; i++) walk(randomExpr(g, 6));
  for (const op of [...BIN_OPS, "u-", "unot", "call"]) expect([...seen]).toContain(op);
});
