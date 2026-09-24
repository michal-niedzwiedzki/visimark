import { Decimal } from "decimal.js";

/**
 * A `param`'s declared domain — the set of scenario values it accepts. See
 * docs/design/a-param-declares-the-set-of-values-it-ac-spec.md §2-3.
 *
 * A domain is an `Intersection` of `Leaf` clauses, kept in source order:
 * `parts` is what a rejection message names one clause at a time. `effective`
 * is a leaf cached only when the whole intersection folds to exactly that
 * leaf (an explicit finite set, or a preset/range combination bounded to a
 * finite integer lattice) — used for listing, never for testing, since
 * testing a rejected value should still be able to name the clause that
 * failed even when a fold exists.
 */
export interface Domain {
  readonly parts: readonly Leaf[];
  readonly effective?: Leaf;
}

export type Leaf = RangeLeaf | SetLeaf | PresetLeaf;

/** a domain bound or set member, as written: the folded canonical value
 *  lives on the leaf itself; this is what `check` validates against the
 *  param's declared `precision` and percent-ness (spec §4.1). */
export interface DomainLiteral {
  readonly text: string;
  readonly percent: boolean;
}

/** every bound is a canonical decimal string; an absent bound is unbounded
 *  and always open — there is no closedness to declare for infinity */
export interface RangeLeaf {
  readonly kind: "range";
  readonly lo?: string;
  readonly loClosed: boolean;
  readonly loLiteral?: DomainLiteral;
  readonly hi?: string;
  readonly hiClosed: boolean;
  readonly hiLiteral?: DomainLiteral;
  /** the clause's own source text, for error messages */
  readonly text: string;
}

export interface SetLeaf {
  readonly kind: "set";
  readonly members: readonly string[];
  /** same length and order as `members` */
  readonly memberLiterals?: readonly DomainLiteral[];
  readonly text: string;
}

export type PresetName = "integer" | "positive" | "natural" | "positive integer";

export interface PresetLeaf {
  readonly kind: "preset";
  readonly name: PresetName;
  readonly text: string;
}

function testLeaf(leaf: Leaf, value: Decimal): boolean {
  switch (leaf.kind) {
    case "range": {
      if (leaf.lo !== undefined) {
        const cmp = value.cmp(leaf.lo);
        if (cmp < 0 || (cmp === 0 && !leaf.loClosed)) return false;
      }
      if (leaf.hi !== undefined) {
        const cmp = value.cmp(leaf.hi);
        if (cmp > 0 || (cmp === 0 && !leaf.hiClosed)) return false;
      }
      return true;
    }
    case "set":
      return leaf.members.some((m) => value.eq(m));
    case "preset":
      switch (leaf.name) {
        case "integer":
          return value.isInteger();
        case "positive":
          return value.gt(0);
        case "natural":
          return value.isInteger() && value.gte(0);
        case "positive integer":
          return value.isInteger() && value.gt(0);
      }
  }
}

/** every literal (range end or set member) written on a domain, paired with
 *  its folded canonical value, for the per-literal precision/percent checks
 *  in `eval/check.ts` §4.1 */
export function domainLiterals(domain: Domain): { value: string; literal: DomainLiteral }[] {
  const out: { value: string; literal: DomainLiteral }[] = [];
  for (const leaf of domain.parts) {
    if (leaf.kind === "range") {
      if (leaf.lo !== undefined && leaf.loLiteral)
        out.push({ value: leaf.lo, literal: leaf.loLiteral });
      if (leaf.hi !== undefined && leaf.hiLiteral)
        out.push({ value: leaf.hi, literal: leaf.hiLiteral });
    } else if (leaf.kind === "set" && leaf.memberLiterals) {
      leaf.members.forEach((value, idx) => {
        const literal = leaf.memberLiterals![idx];
        if (literal) out.push({ value, literal });
      });
    }
  }
  return out;
}

/**
 * The domain exactly as declared, in source order — `integer in [0, 80]`,
 * `{ 30%, 40% }`, `positive integer`. `in` joins a preset to the range/set
 * that follows it; a bare range or set (no preset) is printed without it,
 * matching spec §4.1's and §6's worked examples exactly (`[10, 0] has no
 * legal value`, not `in [10, 0] has no legal value`). Shared by the
 * `DOMAIN`/`SCENARIO` messages (`eval/check.ts`, `eval/scenario.ts`) and by
 * `eval`/`explain` reporting (spec §6).
 */
export function formatDomain(domain: Domain): string {
  return domain.parts
    .map((leaf, i) => (leaf.kind === "preset" || i === 0 ? leaf.text : `in ${leaf.text}`))
    .join(" ");
}

/** exact-decimal membership test, per spec §3 */
export function testDomain(domain: Domain, value: string): boolean {
  const d = new Decimal(value);
  return domain.parts.every((leaf) => testLeaf(leaf, d));
}

/**
 * The first clause (in source order) a value fails, or `undefined` when the
 * value is in the domain. A rejection message names this clause rather than
 * the whole intersection, per the maintainer's own shape note: "a rejection
 * still walks `parts` even when a fold is present."
 */
export function firstFailingLeaf(domain: Domain, value: string): Leaf | undefined {
  const d = new Decimal(value);
  return domain.parts.find((leaf) => !testLeaf(leaf, d));
}

/**
 * Emptiness, checked only where decidable (spec §3): a degenerate or
 * reversed range; an empty set literal; a preset intersected with a range
 * that contains no lattice point. A `positive`-only range narrower than a
 * param's declared precision is not detected here — a stated non-goal.
 */
export function isEmptyDomain(domain: Domain): boolean {
  const ranges = domain.parts.filter((l): l is RangeLeaf => l.kind === "range");
  const sets = domain.parts.filter((l): l is SetLeaf => l.kind === "set");
  const presets = domain.parts.filter((l): l is PresetLeaf => l.kind === "preset");

  for (const set of sets) {
    if (set.members.length === 0) return true;
  }

  // Combine every range clause into one effective bound; several ranges on
  // one param are not proposed in v1, but this stays correct if that changes.
  let lo: Decimal | undefined;
  let loClosed = true;
  let hi: Decimal | undefined;
  let hiClosed = true;
  for (const r of ranges) {
    if (r.lo !== undefined) {
      const v = new Decimal(r.lo);
      if (lo === undefined || v.gt(lo) || (v.eq(lo) && !r.loClosed)) {
        lo = v;
        loClosed = r.loClosed;
      }
    }
    if (r.hi !== undefined) {
      const v = new Decimal(r.hi);
      if (hi === undefined || v.lt(hi) || (v.eq(hi) && !r.hiClosed)) {
        hi = v;
        hiClosed = r.hiClosed;
      }
    }
  }
  if (lo !== undefined && hi !== undefined) {
    const cmp = lo.cmp(hi);
    if (cmp > 0) return true;
    if (cmp === 0 && !(loClosed && hiClosed)) return true;
  }

  const needsInteger = presets.some((p) => p.name !== "positive");
  const needsPositive = presets.some((p) => p.name === "positive" || p.name === "positive integer");
  const needsNonNegative = presets.some((p) => p.name === "natural");

  if (needsInteger && lo !== undefined && hi !== undefined) {
    // is there an integer in [lo, hi] (respecting openness)?
    let candidate = lo.isInteger() ? lo : lo.floor().plus(1);
    if (candidate.eq(lo) && !loClosed) candidate = candidate.plus(1);
    if (candidate.gt(hi) || (candidate.eq(hi) && !hiClosed)) return true;
  }
  if (needsPositive && hi !== undefined) {
    if (hi.lt(0) || (hi.eq(0) && true)) {
      // hi <= 0 leaves nothing > 0, whatever hi's own openness
      if (hi.lte(0)) return true;
    }
  }
  if (needsNonNegative && hi !== undefined && hi.lt(0)) return true;

  return false;
}

/** each clause's own source text, in source order — the `domain.clauses`
 *  JSON field (spec §6), e.g. `["integer", "[0, 80]"]`. */
export function domainClauses(domain: Domain): string[] {
  return domain.parts.map((leaf) => leaf.text);
}

/**
 * The exact enumerated set, when the intersection folds to a finite,
 * exactly-known list: an explicit set, or a preset/range combination bounded
 * to a finite integer lattice. Undefined when no exact fold exists (an
 * unbounded or non-integer range).
 */
export function foldDomain(domain: Domain): string[] | undefined {
  const sets = domain.parts.filter((l): l is SetLeaf => l.kind === "set");
  if (sets.length > 0) {
    // A set intersected with anything else: the members that also pass every
    // other clause.
    const base = sets[0]!.members;
    const rest: Domain = { parts: domain.parts.filter((l) => l.kind !== "set") };
    return base.filter((m) => testDomain(rest, m)).sort((a, b) => new Decimal(a).cmp(b));
  }

  const ranges = domain.parts.filter((l): l is RangeLeaf => l.kind === "range");
  const presets = domain.parts.filter((l): l is PresetLeaf => l.kind === "preset");
  const isIntegerLattice = presets.some((p) => p.name !== "positive");
  if (!isIntegerLattice) return undefined;

  let lo: Decimal | undefined;
  let hi: Decimal | undefined;
  for (const r of ranges) {
    if (r.lo !== undefined) lo = lo === undefined ? new Decimal(r.lo) : Decimal.max(lo, r.lo);
    if (r.hi !== undefined) hi = hi === undefined ? new Decimal(r.hi) : Decimal.min(hi, r.hi);
  }
  if (lo === undefined || hi === undefined) return undefined;

  const first = lo.isInteger() ? lo : lo.floor().plus(1);
  // A fold this wide is not useful to list and would block `eval --json`/
  // `explain --json` for tens of seconds while it walks every integer; the
  // spec allows an absent fold (spec §6), so an oversized range is treated
  // the same as an unbounded one rather than enumerated.
  if (hi.floor().minus(first).plus(1).gt(MAX_FOLD_SIZE)) return undefined;

  const out: string[] = [];
  let v = first;
  while (v.lte(hi)) {
    if (testDomain(domain, v.toString())) out.push(v.toString());
    v = v.plus(1);
  }
  return out;
}

/** the widest integer-lattice fold `foldDomain` will enumerate; see spec §6 */
const MAX_FOLD_SIZE = 10_000;

/** `{ clauses, fold? }` — the JSON shape shared by `eval --json` and
 *  `explain --json` (spec §6). `fold` is absent, not `null`, when no exact
 *  fold exists. */
export function domainJson(domain: Domain): { clauses: string[]; fold?: string[] } {
  const fold = foldDomain(domain);
  return { clauses: domainClauses(domain), ...(fold === undefined ? {} : { fold }) };
}
