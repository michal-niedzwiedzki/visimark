import { Decimal } from "decimal.js";
import type { Domain, DomainLiteral } from "./domain.js";

/**
 * A `param`'s `lattice STEP` clause: the spacing a sweep visits its declared
 * interval at. It is **not** part of the domain: it narrows no membership, and
 * a default or scenario value off the lattice is legal. See
 * docs/design/lattice-on-param-and-report-statements-spec.md §2.1 and §3.
 */
export interface Lattice {
  /** canonical decimal; a percent step is folded (`1%` is `"0.01"`) */
  readonly step: string;
  /** the step as written, for messages and `eval`/`explain` text */
  readonly literal: DomainLiteral;
}

export interface Bound {
  readonly value: Decimal;
  readonly closed: boolean;
}

export interface Interval {
  readonly lo?: Bound;
  readonly hi?: Bound;
}

/** a domain is integral exactly when it holds an integer-valued preset */
export function isIntegral(domain: Domain): boolean {
  return domain.parts.some((leaf) => leaf.kind === "preset" && leaf.name !== "positive");
}

function tighterLow(a: Bound | undefined, b: Bound): Bound {
  if (a === undefined) return b;
  if (a.value.gt(b.value)) return a;
  if (b.value.gt(a.value)) return b;
  return { value: a.value, closed: a.closed && b.closed };
}

function tighterHigh(a: Bound | undefined, b: Bound): Bound {
  if (a === undefined) return b;
  if (a.value.lt(b.value)) return a;
  if (b.value.lt(a.value)) return b;
  return { value: a.value, closed: a.closed && b.closed };
}

/**
 * The intersection of every bound the domain's clauses state: the greatest
 * low bound and the least high bound, an open bound winning a tie. `positive`
 * and `positive integer` contribute an open low bound at 0, `natural` a closed
 * one. A set contributes nothing here; callers refuse a set first.
 */
export function effectiveInterval(domain: Domain): Interval {
  let lo: Bound | undefined;
  let hi: Bound | undefined;
  for (const leaf of domain.parts) {
    if (leaf.kind === "preset") {
      if (leaf.name === "natural") lo = tighterLow(lo, { value: new Decimal(0), closed: true });
      else if (leaf.name !== "integer")
        lo = tighterLow(lo, { value: new Decimal(0), closed: false });
    } else if (leaf.kind === "range") {
      if (leaf.lo !== undefined)
        lo = tighterLow(lo, { value: new Decimal(leaf.lo), closed: leaf.loClosed });
      if (leaf.hi !== undefined)
        hi = tighterHigh(hi, { value: new Decimal(leaf.hi), closed: leaf.hiClosed });
    }
  }
  return { ...(lo === undefined ? {} : { lo }), ...(hi === undefined ? {} : { hi }) };
}

export interface LatticeInput {
  readonly name: string;
  readonly domain?: Domain;
  /** canonical decimal step */
  readonly step: string;
  /** the step as written */
  readonly stepText: string;
  /** whether the param is a percent, so numbers in a message print as percents */
  readonly percent: boolean;
}

export type LatticeAnalysis =
  | { readonly ok: true; readonly first: string; readonly last: string; readonly count: number }
  | { readonly ok: false; readonly message: string };

/**
 * Spec §3.1: the points a lattice declares, as first, last and count, or the
 * reason it cannot be swept. Never enumerates, so a span of a billion is as
 * cheap as a span of ten. The checks run in the order of spec §4.1's table
 * from "positive" down; the literal, percent-ness and width checks belong to
 * the caller, which has the param's `precision`.
 */
export function analyzeLattice(input: LatticeInput): LatticeAnalysis {
  const { name, domain, stepText, percent } = input;
  const fault = (message: string): LatticeAnalysis => ({ ok: false, message });
  const show = (v: Decimal): string => (percent ? `${v.times(100).toString()}%` : v.toString());
  const step = new Decimal(input.step);

  if (step.lte(0)) return fault("lattice step must be positive");
  if (domain === undefined) return fault(`param ${name} declares a lattice but no domain`);
  if (domain.parts.some((leaf) => leaf.kind === "set")) {
    return fault(`param ${name} declares a lattice, but a set already lists its points`);
  }
  const { lo, hi } = effectiveInterval(domain);
  if (lo === undefined) {
    return fault(`param ${name} declares a lattice, but its domain has no lower bound`);
  }
  if (hi === undefined) {
    return fault(`param ${name} declares a lattice, but its domain has no upper bound`);
  }
  const integral = isIntegral(domain);
  if (integral && !step.isInteger()) {
    return fault(
      `lattice step ${stepText} must be a whole number: param ${name} is an integer domain`,
    );
  }

  const interval = `${lo.closed ? "[" : "("}${show(lo.value)}, ${show(hi.value)}${hi.closed ? "]" : ")"}`;
  const a = integral ? lo.value.ceil() : lo.value;
  const b = integral ? hi.value.floor() : hi.value;
  const n = b.minus(a).div(step);
  if (n.isNegative() || !n.isInteger()) {
    return fault(
      `lattice step ${stepText} does not reach the end of ${interval}: ${show(b)} is not a multiple of ${stepText} above ${show(a)}`,
    );
  }
  const dropFirst = !lo.closed && a.eq(lo.value);
  const dropLast = !hi.closed && b.eq(hi.value);
  const count = n.toNumber() + 1 - (dropFirst ? 1 : 0) - (dropLast ? 1 : 0);
  if (count < 1) return fault(`lattice step ${stepText} leaves no point in ${interval}`);
  return {
    ok: true,
    first: (dropFirst ? a.plus(step) : a).toString(),
    last: (dropLast ? b.minus(step) : b).toString(),
    count,
  };
}

/**
 * Every point a lattice declares, ascending, as canonical decimals. Only for a
 * lattice `check` accepted: a fault throws. Built by exact decimal steps from
 * the first point, so `1%` steps never drift. See
 * docs/design/add-a-simulate-command-spec.md §3.1.
 */
export function latticePoints(input: LatticeInput): string[] {
  const a = analyzeLattice(input);
  if (!a.ok) throw new Error(a.message);
  const step = new Decimal(input.step);
  const out: string[] = [];
  let v = new Decimal(a.first);
  for (let i = 0; i < a.count; i++) {
    out.push(v.toString());
    v = v.plus(step);
  }
  return out;
}

/** the JSON form of a lattice: a sibling of `domain`, the canonical decimal */
export function latticeJson(l: Lattice): { step: string } {
  return { step: new Decimal(l.step).toString() };
}
