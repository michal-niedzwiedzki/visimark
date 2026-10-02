# `lattice` on `param`, and `report` statements — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** A `param` header may end its domain with `lattice STEP`, the spacing a sweep visits the declared interval at, validated at the declaration and reported by `eval` and `explain`. A sheet may carry `report NAME [OPTIONS]` statements from a closed list of five, whose options `check` parses, whose refs it resolves, and which it never runs. `fmt` writes neither. Per [`docs/design/lattice-on-param-and-report-statements-spec.md`](lattice-on-param-and-report-statements-spec.md).

**Architecture:** A new pure module, `packages/visimark/src/lang/lattice.ts`, holds the `Lattice` clause type, `isIntegral(domain)`, `effectiveInterval(domain)` and `analyzeLattice(...)`, which implements the spec §3.1 point-set rule and returns either `{ ok, first, last, count }` or a fault message. It never enumerates points, so a span of a billion costs nothing. The clause is parsed inside `parseParamInner` (`lang/parser.ts`), after the domain tokens and before `= default`, and rides on `Binding.lattice`, a sibling of `domain`, never inside `Domain`. `check` validates it in `paramWidthOk` (`eval/check.ts`) after the domain passes, as findings that do **not** mark the param unevaluable. `report` is a statement like `chart`: `lang/ast.ts` gains `ReportDecl`, `parseStatementInner` recognises it contextually (first token `report`, no `=` on the line), `model/build.ts` collects it into a new `Sheet.reports`, and a new `eval/check-reports.ts` pass resolves its refs. A report is not a graph node, so it adds no edge and cannot create a cycle; `collectReferenced` counts its refs as reads. `eval`/`explain` reporting grows a `lattice` text suffix and a `lattice: { step }` JSON sibling of `domain`.

**Tech Stack:** TypeScript; `decimal.js` (exact decimals); Bun test runner; engine package `packages/visimark`. No new dependency. No LSP or editor grammar code: diagnostics reach editors through `check`, and the repo has no editor keyword list naming `param` words (confirmed by grep in Task 8).

**Spec:** [`docs/design/lattice-on-param-and-report-statements-spec.md`](lattice-on-param-and-report-statements-spec.md)

## Global Constraints

- Work on branch `issue/258-lattice-on-param-and-report-statements-impl`. One PR (#327, already open as a draft); do not open a second.
- Every commit ends with the `Co-Authored-By` trailer resolved from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session doing the work. Do not hardcode a vendor name into this plan or copy a trailer from another plan.
- **No new `FindingCode`.** `TYPE` covers a malformed or impossible `lattice` and a malformed or unknown `report`; `PRECISION` a step wider than the param; `UNDEF`, `SHEET` and `DUP` the `report` cases. `DOMAIN` is not used.
- Grammar: `param NAME precision N [PRESET] [in DOMAIN-EXPR] [lattice STEP] = default LITERAL`; `report NAME [OPTIONS]` with exactly these option grammars and no others: `ledger [assertions broken]`, `deltas [on REF {, REF}]`, `gates`, `best scalar REF direction max|min [among feasible]`, `forbidden`. `lattice`, `report` and the option words are contextual: `lattice = 5` and `report = 5` still bind scalars.
- A lattice is **not** part of the domain: no field of `Domain`, no effect on `testDomain`, `foldDomain`, `domainJson` or scenario membership. A default or a scenario value off the lattice is legal.
- `fmt` neither adds, removes nor normalises a `lattice` clause or a `report` line. Prove it with a byte-identical round trip on the new fixture (Task 7).
- Exact messages are the spec's §4.1 and §4.2 strings. Where a message prints interval ends or multiples, a percent param prints them as percents (`[0%, 10%]`) and every other param as decimals; the step always prints as written. A bare step on a percent param is `<name> is a percent; lattice step 5 must be too`; the reverse is `<name> is not a percent; lattice step 5% must not be one`.
- A document with no `lattice` and no `report` must print byte-for-byte what it printed before: verify by capturing `eval` and `explain` output for `packages/visimark/test/fixtures/domain/levers.md` and every `docs/example-*.md` before Task 4 and diffing after each later task.
- `visimark ref`, `infer` and `fmt` are not touched.
- After each task: `bun test`, `bun run typecheck`, `bun run build` from the repo root, plus `bun run packages/visimark/src/cli/main.ts check` on every `docs/example-*.md` and on the new fixture once it exists. Loop check → fix → check until green. Never `bunx visimark` (that runs the published build, not this branch).

## Review Focus

Inputs the spec implies and the tasks' own tests do not obviously reach. Each has a test in the task named after it.

1. **A faulty domain plus a lattice** (`integer in [0.2, 0.8] lattice 1`) reports only the `DOMAIN` finding, never a lattice finding on top. Task 3.
2. **A very wide span** (`in [0, 1000000000] lattice 1`) validates instantly and reports `count: 1000000001`; the validator never enumerates. Task 1.
3. **A negative lower end** (`integer in [-10, 10] lattice 5`) anchors at `-10`, not at `0`. Task 1.
4. **A `report` ref to a document-scope scalar** from a sheet resolves with no `UNDEF`, as an expression's bare name does. Task 6.
5. **A step with a unit bracket** (`lattice 5 [PLN]`) is refused by the existing literal-with-unit rule, not parsed as a clean lattice. Task 2.

---

### Task 1: the lattice module

**Files:**
- Create: `packages/visimark/src/lang/lattice.ts`
- Test: `packages/visimark/test/lang/lattice.test.ts`

**Interfaces:**
- Consumes: `Domain`, `DomainLiteral` from `packages/visimark/src/lang/domain.ts` (a domain is `{ parts: Leaf[] }`; a leaf is `{kind:"preset", name}`, `{kind:"range", lo?, loClosed, hi?, hiClosed, ...}` or `{kind:"set", members, ...}`).
- Produces:
  - `interface Lattice { readonly step: string; readonly literal: DomainLiteral }` — `step` is the canonical decimal (`1%` is `"0.01"`), `literal` is the text as written.
  - `isIntegral(domain: Domain): boolean`.
  - `effectiveInterval(domain: Domain): { lo?: Bound; hi?: Bound }` with `Bound = { value: Decimal; closed: boolean }`.
  - `analyzeLattice(input: { name: string; domain?: Domain; step: string; stepText: string; percent: boolean }): { ok: true; first: string; last: string; count: number } | { ok: false; message: string }`.
  - `latticeJson(l: Lattice): { step: string }`.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/lang/lattice.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { Domain } from "../../src/lang/domain.js";
import { analyzeLattice, isIntegral, latticeJson } from "../../src/lang/lattice.js";
import { parseStatement } from "../../src/lang/parser.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §3.1

function domainOf(clause: string): Domain {
  const s = parseStatement(`param x precision 3 ${clause} = default 0`);
  if ("type" in s || s.domain === undefined) throw new Error(`no domain: ${clause}`);
  return s.domain;
}

function run(clause: string, step: string, opts: { text?: string; percent?: boolean } = {}) {
  return analyzeLattice({
    name: "x",
    domain: domainOf(clause),
    step,
    stepText: opts.text ?? step,
    percent: opts.percent ?? false,
  });
}

describe("the sweep points of a lattice (spec §3.1)", () => {
  test("closed ends are both visited", () => {
    expect(run("in [0%, 10%]", "0.01", { text: "1%", percent: true })).toEqual({
      ok: true,
      first: "0",
      last: "0.1",
      count: 11,
    });
  });
  test("an integral domain anchored at 0", () => {
    expect(run("integer in [0, 80]", "20")).toEqual({ ok: true, first: "0", last: "80", count: 5 });
  });
  test("anchored at the lower end, not at 0", () => {
    expect(run("integer in [3, 83]", "20")).toEqual({ ok: true, first: "3", last: "83", count: 5 });
  });
  test("a negative lower end anchors there", () => {
    expect(run("integer in [-10, 10]", "5")).toEqual({
      ok: true,
      first: "-10",
      last: "10",
      count: 5,
    });
  });
  test("integral rounding that misses the step is a fault", () => {
    const r = run("integer in [2.5, 22.5]", "5");
    expect(r).toEqual({
      ok: false,
      message:
        "lattice step 5 does not reach the end of [2.5, 22.5]: 22 is not a multiple of 5 above 3",
    });
  });
  test("open ends are dropped", () => {
    expect(run("in (0, 10)", "5")).toEqual({ ok: true, first: "5", last: "5", count: 1 });
    expect(run("integer in (0, 10)", "1")).toEqual({ ok: true, first: "1", last: "9", count: 9 });
  });
  test("positive makes the low end open at 0", () => {
    expect(run("positive in [0, 10]", "5")).toEqual({ ok: true, first: "5", last: "10", count: 2 });
  });
  test("the last point is never silently dropped", () => {
    expect(run("in [0, 10]", "3")).toEqual({
      ok: false,
      message: "lattice step 3 does not reach the end of [0, 10]: 10 is not a multiple of 3 above 0",
    });
  });
  test("a one-point interval is legal", () => {
    expect(run("in [3, 3]", "1")).toEqual({ ok: true, first: "3", last: "3", count: 1 });
  });
  test("a step equal to the span visits both ends", () => {
    expect(run("in [0, 5]", "5")).toEqual({ ok: true, first: "0", last: "5", count: 2 });
  });
  test("no point remains", () => {
    expect(run("in (0, 5)", "5")).toEqual({
      ok: false,
      message: "lattice step 5 leaves no point in (0, 5)",
    });
  });
  test("a wide span is counted, never enumerated", () => {
    expect(run("in [0, 1000000000]", "1")).toEqual({
      ok: true,
      first: "0",
      last: "1000000000",
      count: 1000000001,
    });
  });
  test("an intersection takes the tighter bound", () => {
    expect(run("natural in [0, 40)", "10")).toEqual({ ok: true, first: "0", last: "30", count: 4 });
  });
});

describe("the faults before the points (spec §4.1)", () => {
  test("no domain", () => {
    expect(
      analyzeLattice({ name: "x", step: "5", stepText: "5", percent: false }),
    ).toEqual({ ok: false, message: "param x declares a lattice but no domain" });
  });
  test("a set", () => {
    expect(run("in { 1, 2 }", "1")).toEqual({
      ok: false,
      message: "param x declares a lattice, but a set already lists its points",
    });
  });
  test("no upper bound, no lower bound", () => {
    expect(run("natural", "5")).toEqual({
      ok: false,
      message: "param x declares a lattice, but its domain has no upper bound",
    });
    expect(run("in (, 10]", "5")).toEqual({
      ok: false,
      message: "param x declares a lattice, but its domain has no lower bound",
    });
  });
  test("a step that is not positive", () => {
    for (const s of ["0", "-5"]) {
      expect(run("in [0, 10]", s)).toEqual({ ok: false, message: "lattice step must be positive" });
    }
  });
  test("a fractional step on an integral domain", () => {
    expect(run("integer in [0, 80]", "2.5")).toEqual({
      ok: false,
      message: "lattice step 2.5 must be a whole number: param x is an integer domain",
    });
  });
  test("a percent param prints its numbers as percents", () => {
    expect(run("in [0%, 10%]", "0.03", { text: "3%", percent: true })).toEqual({
      ok: false,
      message:
        "lattice step 3% does not reach the end of [0%, 10%]: 10% is not a multiple of 3% above 0%",
    });
  });
});

describe("isIntegral and latticeJson", () => {
  test("integral exactly when an integer-valued preset is present", () => {
    expect(isIntegral(domainOf("integer"))).toBe(true);
    expect(isIntegral(domainOf("natural in [0, 8)"))).toBe(true);
    expect(isIntegral(domainOf("positive integer"))).toBe(true);
    expect(isIntegral(domainOf("positive"))).toBe(false);
    expect(isIntegral(domainOf("in [0, 80]"))).toBe(false);
    expect(isIntegral(domainOf("in { 1, 2 }"))).toBe(false);
  });
  test("latticeJson is the canonical decimal", () => {
    expect(latticeJson({ step: "0.010", literal: { text: "1%", percent: true } })).toEqual({
      step: "0.01",
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test packages/visimark/test/lang/lattice.test.ts`
Expected: FAIL, `Cannot find module '../../src/lang/lattice.js'`.

- [ ] **Step 3: Implement**

Create `packages/visimark/src/lang/lattice.ts`:

```ts
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
      else if (leaf.name !== "integer") lo = tighterLow(lo, { value: new Decimal(0), closed: false });
    } else if (leaf.kind === "range") {
      if (leaf.lo !== undefined) lo = tighterLow(lo, { value: new Decimal(leaf.lo), closed: leaf.loClosed });
      if (leaf.hi !== undefined) hi = tighterHigh(hi, { value: new Decimal(leaf.hi), closed: leaf.hiClosed });
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
    return fault(`lattice step ${stepText} must be a whole number: param ${name} is an integer domain`);
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

/** the JSON form of a lattice: a sibling of `domain`, the canonical decimal */
export function latticeJson(l: Lattice): { step: string } {
  return { step: new Decimal(l.step).toString() };
}
```

Note: the percent message test expects `[0%, 10%]` from a `Decimal(0.1).times(100)` → `"10"`; `Decimal(0).times(100).toString()` is `"0"`.

- [ ] **Step 4: Run to verify it passes**

Run: `bun test packages/visimark/test/lang/lattice.test.ts`
Expected: PASS. If `"lattice step 5 does not reach the end of [2.5, 22.5]: 22 is not a multiple of 5 above 3"` differs in wording from the actual output, the test is the spec's contract; fix the implementation, not the test.

- [ ] **Step 5: Verification loop and commit**

Run the Global Constraints loop (`bun test`, `bun run typecheck`, `bun run build`).

```bash
git add packages/visimark/src/lang/lattice.ts packages/visimark/test/lang/lattice.test.ts
git commit -m "feat: lattice module — sweep points of a declared lattice (#258)" -m "<trailer from .agents/rules/ai-attribution.md>"
```

---

### Task 2: parsing the `lattice` clause

**Files:**
- Modify: `packages/visimark/src/lang/parser.ts` — `Binding` interface (about line 360), `parseParamInner` (about line 569), a new `parseLatticeClause`, one new exported message constant.
- Modify: `packages/visimark/src/model/types.ts` — `Binding` gains `lattice?: Lattice` beside `domain?: Domain`.
- Modify: `packages/visimark/src/model/build.ts` — `parseOne` (about line 585) copies `s.lattice` onto the binding.
- Modify: `packages/visimark/src/eval/scenario.ts` — `ParamInfo` gains `lattice?: Lattice`; `listParams` copies it.
- Test: `packages/visimark/test/lang/param.test.ts` (append a `describe`).

**Interfaces:**
- Consumes: `Lattice` from Task 1; `parseDomainLiteral(line, tokens, i)` already in `parser.ts`, returning `{ value, literal, next }`.
- Produces: `parseStatement("param x precision 0 in [0, 10] lattice 5 = default 0")` returns a `Binding` whose `lattice` is `{ step: "5", literal: { text: "5", percent: false } }`; `export const PARAM_LATTICE_LITERAL_MESSAGE = "a lattice step must be a number literal"`.

- [ ] **Step 1: Write the failing test**

Append to `packages/visimark/test/lang/param.test.ts` (the file already defines `param(line)` and `fails(line)`):

```ts
describe("param lattice clause (lattice spec §2.1)", () => {
  test("a lattice follows the domain", () => {
    const b = param("param extra_hours precision 0 integer in [0, 80] lattice 20 = default 40");
    expect(b.lattice).toEqual({ step: "20", literal: { text: "20", percent: false } });
    expect(b.domain).toBeDefined();
  });

  test("a percent step folds and is remembered as a percent", () => {
    const b = param("param volume_disc precision 3 in [0%, 10%] lattice 1% = default 0%");
    expect(b.lattice).toEqual({ step: "0.01", literal: { text: "1%", percent: true } });
  });

  test("a lattice with no domain still parses; check refuses it", () => {
    const b = param("param x precision 0 lattice 5 = default 0");
    expect(b.domain).toBeUndefined();
    expect(b.lattice?.step).toBe("5");
  });

  test("a negative step parses; check refuses it", () => {
    expect(param("param x precision 0 in [0, 10] lattice -5 = default 0").lattice?.step).toBe("-5");
  });

  test("no clause, no field", () => {
    expect(param("param x precision 0 in [0, 10] = default 0").lattice).toBeUndefined();
  });

  test("lattice is contextual: a scalar called lattice still binds", () => {
    const s = parseStatement("lattice = 5");
    if ("type" in s) throw new Error("not a binding");
    expect(s.name).toBe("lattice");
    expect(s.lattice).toBeUndefined();
  });

  test("a missing or non-literal step", () => {
    expect(fails("param x precision 0 in [0, 10] lattice = default 0").message).toBe(
      "a lattice step must be a number literal",
    );
    expect(fails("param x precision 0 in [0, 10] lattice y = default 0").message).toBe(
      "a lattice step must be a number literal",
    );
  });

  test("a second lattice, or a lattice before the domain, is malformed", () => {
    expect(fails("param x precision 0 in [0, 10] lattice 5 lattice 5 = default 0").message).toBe(
      "malformed param domain clause",
    );
    expect(fails("param x precision 0 lattice 5 in [0, 10] = default 0").message).toBe(
      "malformed param domain clause",
    );
  });

  test("a unit on the step is refused by the existing literal rule", () => {
    const e = fails("param x precision 0 in [0, 10] lattice 5 [PLN] = default 0");
    expect(e.code).toBe("UNIT");
  });

  test("the failure names the param", () => {
    expect(fails("param x precision 0 in [0, 10] lattice = default 0").bindingName).toBe("x");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/visimark/test/lang/param.test.ts`
Expected: FAIL (`lattice` is parsed today as an unrecognised preset or left over tokens).

- [ ] **Step 3: Implement**

In `packages/visimark/src/lang/parser.ts`:

Add the import beside the domain import: `import type { Lattice } from "./lattice.js";`.

Add the field to the exported `Binding` interface, right after `domain?: Domain;`:

```ts
  /** a `param`'s optional `lattice STEP` clause, a sibling of `domain` and not
   *  part of it. See docs/design/lattice-on-param-and-report-statements-spec.md §2.1. */
  lattice?: Lattice;
```

In `parseParamInner`, replace

```ts
  const domain = rest.length === 0 ? undefined : parseParamDomainClause(line, rest);
```

with

```ts
  // `lattice STEP` is last in the header, so everything from the keyword on is
  // the clause and everything before it is the domain
  let lattice: Lattice | undefined;
  const latticeAt = rest.findIndex((t) => t.kind === "ident" && t.value === "lattice");
  if (latticeAt !== -1) {
    lattice = parseLatticeClause(line, rest.slice(latticeAt));
    rest = rest.slice(0, latticeAt);
  }
  const domain = rest.length === 0 ? undefined : parseParamDomainClause(line, rest);
```

and in the returned object, after `...(domain === undefined ? {} : { domain }),` add:

```ts
    ...(lattice === undefined ? {} : { lattice }),
```

Add after `parseParamDomainClause`:

```ts
export const PARAM_LATTICE_LITERAL_MESSAGE = "a lattice step must be a number literal";

/**
 * `lattice STEP`, the optional last clause of a `param` header. `tokens[0]` is
 * the keyword. The step is a number literal as a domain bound is; anything
 * after it (a second clause, a domain written after the lattice) is malformed.
 * See docs/design/lattice-on-param-and-report-statements-spec.md §2.1 and §4.1.
 */
function parseLatticeClause(line: string, tokens: Token[]): Lattice {
  const kw = tokens[0]!;
  const first = tokens[1];
  const literal = first?.kind === "op" && first.value === "-" ? tokens[2] : first;
  if (!literal || (literal.kind !== "number" && literal.kind !== "percent")) {
    throw new LangError(PARAM_LATTICE_LITERAL_MESSAGE, kw.start, (first ?? kw).end);
  }
  const parsed = parseDomainLiteral(line, tokens, 1);
  if (parsed.next !== tokens.length) {
    throw new LangError(
      PARAM_DOMAIN_MALFORMED_MESSAGE,
      tokens[parsed.next]!.start,
      tokens[tokens.length - 1]!.end,
    );
  }
  return { step: parsed.value, literal: parsed.literal };
}
```

In `packages/visimark/src/model/types.ts` add `import type { Lattice } from "../lang/lattice.js";` beside the `Domain` import and, in `Binding`, right after `domain?: Domain;`:

```ts
  /** a `param`'s optional `lattice STEP` clause. See
   *  docs/design/lattice-on-param-and-report-statements-spec.md §2.1. */
  lattice?: Lattice;
```

In `packages/visimark/src/model/build.ts` `parseOne`, after the line `...(s.domain === undefined ? {} : { domain: s.domain }),` add:

```ts
        ...(s.lattice === undefined ? {} : { lattice: s.lattice }),
```

In `packages/visimark/src/eval/scenario.ts` add `import type { Lattice } from "../lang/lattice.js";`, add to `ParamInfo` after `domain?: Domain;`:

```ts
  /** a `param`'s optional lattice, reported beside its domain */
  lattice?: Lattice;
```

and in `listParams`, after `...(b.domain === undefined ? {} : { domain: b.domain }),` add:

```ts
      ...(b.lattice === undefined ? {} : { lattice: b.lattice }),
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test packages/visimark/test/lang/param.test.ts`
Expected: PASS. The `UNIT` test relies on `parseDomainLiteral` already throwing `UNIT_ON_PARAM_LITERAL_MESSAGE` with code `"UNIT"` for a unit after a literal; if the unit bracket lexes as a `unit` token after the literal, that path is taken.

- [ ] **Step 5: Verification loop and commit**

```bash
git add packages/visimark/src packages/visimark/test/lang/param.test.ts
git commit -m "feat: parse a lattice clause on a param header (#258)" -m "<trailer>"
```

---

### Task 3: lattice findings in `check`

**Files:**
- Modify: `packages/visimark/src/eval/check.ts` — `paramWidthOk` (about line 385), a new `paramLatticeOk` beside `paramDomainOk`, an import.
- Test: `packages/visimark/test/eval/lattice.test.ts` (create).

**Interfaces:**
- Consumes: `analyzeLattice` from Task 1; `Binding.lattice` from Task 2; the existing `emit(finding, { sheetId })` in `check.ts`.
- Produces: findings `TYPE`/`PRECISION` on the param, named, with the spec §4.1 messages; **no** `unevaluable` marking.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/eval/lattice.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { check } from "../../src/eval/check.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §4.1

const fence = (body: string): string => "```vmark #s\n" + body + "\n```\n";

function findings(body: string) {
  return check(build(locate(fence(body)))).findings.filter((f) => f.code !== "WARN");
}

const msg = (body: string) => {
  const fs = findings(body);
  return fs.map((f) => `${f.code} ${f.name ?? ""} ${f.message ?? ""}`.trim());
};

describe("a lattice on a param header", () => {
  const rows: [string, string, string][] = [
    ["no domain", "param x precision 0 lattice 5 = default 0", "TYPE x param x declares a lattice but no domain"],
    [
      "a set",
      "param x precision 0 in { 1, 2 } lattice 1 = default 1",
      "TYPE x param x declares a lattice, but a set already lists its points",
    ],
    [
      "no upper bound",
      "param x precision 0 natural lattice 5 = default 0",
      "TYPE x param x declares a lattice, but its domain has no upper bound",
    ],
    [
      "no lower bound",
      "param x precision 0 in (, 10] lattice 5 = default 0",
      "TYPE x param x declares a lattice, but its domain has no lower bound",
    ],
    ["zero step", "param x precision 0 in [0, 10] lattice 0 = default 0", "TYPE x lattice step must be positive"],
    ["negative step", "param x precision 0 in [0, 10] lattice -5 = default 0", "TYPE x lattice step must be positive"],
    [
      "bare step on a percent param",
      "param x precision 3 in [0%, 10%] lattice 5 = default 0%",
      "TYPE x x is a percent; lattice step 5 must be too",
    ],
    [
      "percent step on a bare param",
      "param x precision 0 in [0, 10] lattice 5% = default 0",
      "TYPE x x is not a percent; lattice step 5% must not be one",
    ],
    [
      "a step wider than the precision",
      "param x precision 1 in [0, 1] lattice 0.25 = default 0",
      "PRECISION x lattice step 0.25 has 2 decimals; param x declares 1",
    ],
    [
      "a fractional step on an integer domain",
      "param x precision 1 integer in [0, 80] lattice 2.5 = default 0",
      "TYPE x lattice step 2.5 must be a whole number: param x is an integer domain",
    ],
    [
      "a step that does not reach the end",
      "param x precision 0 in [0, 10] lattice 3 = default 0",
      "TYPE x lattice step 3 does not reach the end of [0, 10]: 10 is not a multiple of 3 above 0",
    ],
    [
      "no point remains",
      "param x precision 0 in (0, 5) lattice 5 = default 1",
      "TYPE x lattice step 5 leaves no point in (0, 5)",
    ],
  ];
  for (const [label, line, expected] of rows) {
    test(label, () => {
      expect(msg(line)).toEqual([expected]);
    });
  }

  test("a lattice parse failure is the existing TYPE, named for the param", () => {
    expect(msg("param x precision 0 in [0, 10] lattice = default 0")).toEqual([
      "TYPE x a lattice step must be a number literal",
    ]);
  });

  test("a default off its lattice is legal", () => {
    expect(msg("param x precision 0 in [0, 80] lattice 20 = default 7")).toEqual([]);
  });

  test("a valid lattice raises nothing", () => {
    expect(
      msg(
        "param extra_hours precision 0 integer in [0, 80] lattice 20 = default 40\n" +
          "param volume_disc precision 3 in [0%, 10%] lattice 1% = default 0%\n" +
          "param bump precision 1 in (0, 10) lattice 5 = default 5",
      ),
    ).toEqual([]);
  });

  test("the first fault wins: percent-ness before width before the domain", () => {
    // bare step on a percent param AND wider than precision AND unbounded
    expect(msg("param x precision 3 in [0%, ) lattice 0.5 = default 0%")).toEqual([
      "TYPE x x is a percent; lattice step 0.5 must be too",
    ]);
  });

  test("a faulty domain reports only the domain finding", () => {
    expect(msg("param x precision 1 integer in [0.2, 0.8] lattice 1 = default 0")).toEqual([
      "DOMAIN x param x declares an empty domain: integer in [0.2, 0.8] has no legal value",
    ]);
  });

  test("an impossible lattice does not suppress the param's readers", () => {
    const body =
      "param x precision 0 in [0, 10] lattice 3 = default 4\ny precision 0 = x + 1\n";
    const result = check(build(locate(fence(body))));
    expect(result.findings.filter((f) => f.code === "NOTE")).toEqual([]);
    expect(String((result.values.get("s.y") as { d: unknown }).d)).toBe("5");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/visimark/test/eval/lattice.test.ts`
Expected: FAIL (no lattice findings are raised).

- [ ] **Step 3: Implement**

In `packages/visimark/src/eval/check.ts` add `import { analyzeLattice } from "../lang/lattice.js";` beside the domain import.

In `paramWidthOk`, replace the last two lines

```ts
    if (binding.domain !== undefined && !paramDomainOk(binding)) return false;
    return true;
  }
```

with

```ts
    if (binding.domain !== undefined && !paramDomainOk(binding)) return false;
    // a lattice finding is about the declaration only: the default and the
    // domain are fine, so the param stays evaluable and its readers are not
    // suppressed (spec §4.1)
    if (binding.lattice !== undefined) paramLatticeOk(binding);
    return true;
  }

  /**
   * A `param`'s lattice: percent-ness and width of the step, then the facts
   * `analyzeLattice` decides. Emits at most one finding, the first that fires,
   * and never marks the binding unevaluable. See
   * docs/design/lattice-on-param-and-report-statements-spec.md §4.1.
   */
  function paramLatticeOk(binding: Binding): void {
    const lattice = binding.lattice!;
    const param = binding.param!;
    const finding = (code: "TYPE" | "PRECISION", message: string): void =>
      emit(
        { code, sheetId: binding.sheetId, name: binding.name, message, span: binding.span },
        { sheetId: binding.sheetId },
      );
    const text = lattice.literal.text;
    if (param.percent && !lattice.literal.percent) {
      return finding("TYPE", `${binding.name} is a percent; lattice step ${text} must be too`);
    }
    if (!param.percent && lattice.literal.percent) {
      return finding(
        "TYPE",
        `${binding.name} is not a percent; lattice step ${text} must not be one`,
      );
    }
    const places = new Decimal(lattice.step).decimalPlaces();
    if (places > binding.precision!) {
      return finding(
        "PRECISION",
        `lattice step ${text} has ${places} decimal${places === 1 ? "" : "s"}; param ${binding.name} declares ${binding.precision}`,
      );
    }
    const analysis = analyzeLattice({
      name: binding.name,
      ...(binding.domain === undefined ? {} : { domain: binding.domain }),
      step: lattice.step,
      stepText: text,
      percent: param.percent,
    });
    if (!analysis.ok) finding("TYPE", analysis.message);
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test packages/visimark/test/eval/lattice.test.ts`
Expected: PASS. The percent-first test relies on `paramLatticeOk` checking percent-ness before width and before the unbounded-domain fact.

- [ ] **Step 5: Verification loop and commit**

```bash
git add packages/visimark/src/eval/check.ts packages/visimark/test/eval/lattice.test.ts
git commit -m "feat: check validates a param's lattice at the declaration (#258)" -m "<trailer>"
```

---

### Task 4: reporting a lattice in `eval` and `explain`

**Files:**
- Modify: `packages/visimark/src/report/params.ts` — `paramLines`.
- Modify: `packages/visimark/src/report/explain.ts` — `paramJson`.
- Modify: `packages/visimark/src/cli/commands.ts` — `domainParamsJson`, `domainParamsText` (about lines 464–483), imports.
- Test: `packages/visimark/test/report/lattice-report.test.ts` (create).

**Interfaces:**
- Consumes: `Binding.lattice`, `ParamInfo.lattice` (Task 2); `latticeJson` (Task 1).
- Produces: `eval` text `levers.extra_hours   integer in [0, 80] lattice 20`; `explain` row `... domain integer in [0, 80]   lattice 20`; JSON `"lattice": { "step": "0.01" }` as a sibling of `domain`, absent when none.

- [ ] **Step 0: Capture the byte-for-byte baseline** (before any edit in this task)

```bash
mkdir -p /tmp/lattice-baseline
for f in packages/visimark/test/fixtures/domain/levers.md docs/example-*.md; do
  n=$(echo "$f" | tr '/' '_')
  bun run packages/visimark/src/cli/main.ts eval "$f" > "/tmp/lattice-baseline/$n.eval" 2>&1
  bun run packages/visimark/src/cli/main.ts explain "$f" > "/tmp/lattice-baseline/$n.explain" 2>&1
  bun run packages/visimark/src/cli/main.ts eval --json "$f" > "/tmp/lattice-baseline/$n.evaljson" 2>&1
  bun run packages/visimark/src/cli/main.ts explain --json "$f" > "/tmp/lattice-baseline/$n.explainjson" 2>&1
done
ls /tmp/lattice-baseline | wc -l
```

Expected: a non-zero count. These files are the "before" for every later diff.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/report/lattice-report.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §5

const DOC = [
  "```vmark #levers",
  "param extra_hours  precision 0 integer in [0, 80] lattice 20 = default 40",
  "param volume_disc  precision 3 in [0%, 10%] lattice 1% = default 0%",
  "param prepay_share precision 2 in { 30%, 40% } = default 30%",
  "```",
  "",
].join("\n");

async function run(args: string[], md: string) {
  const dir = mkdtempSync(join(tmpdir(), "vm-lattice-"));
  const file = join(dir, "d.md");
  writeFileSync(file, md);
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli([...args, file], {
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  });
  rmSync(dir, { recursive: true });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

test("eval prints the lattice after the domain", async () => {
  const r = await run(["eval"], DOC);
  expect(r.out).toMatch(/levers\.extra_hours\s+integer in \[0, 80\] lattice 20\n/);
  expect(r.out).toMatch(/levers\.volume_disc\s+\[0%, 10%\] lattice 1%\n/);
  expect(r.out).toMatch(/levers\.prepay_share\s+\{ 30%, 40% \}(?:\n|$)/);
});

test("eval --json carries a lattice sibling of domain, absent when none", async () => {
  const j = JSON.parse((await run(["eval", "--json"], DOC)).out);
  expect(j.params["levers.extra_hours"].lattice).toEqual({ step: "20" });
  expect(j.params["levers.volume_disc"].lattice).toEqual({ step: "0.01" });
  expect("lattice" in j.params["levers.prepay_share"]).toBe(false);
  expect(j.params["levers.extra_hours"].domain.clauses).toEqual(["integer", "[0, 80]"]);
});

test("explain prints the lattice after the domain on the param's row", async () => {
  const r = await run(["explain"], DOC);
  expect(r.out).toMatch(/extra_hours\s+precision 0\s+default 40\s+domain integer in \[0, 80\]   lattice 20/);
  expect(r.out).not.toMatch(/prepay_share.*lattice/);
});

test("explain --json carries the lattice on the param entry", async () => {
  const j = JSON.parse((await run(["explain", "--json"], DOC)).out);
  const sheet = j.sheets.find((s: { id: string }) => s.id === "levers");
  const byName = Object.fromEntries(sheet.params.map((p: { name: string }) => [p.name, p]));
  expect(byName.volume_disc.lattice).toEqual({ step: "0.01" });
  expect("lattice" in byName.prepay_share).toBe(false);
});

test("a document with no lattice prints no lattice anywhere", async () => {
  const plain = DOC.replace(/ lattice [0-9.]+%?/g, "");
  for (const args of [["eval"], ["eval", "--json"], ["explain"], ["explain", "--json"]]) {
    expect((await run(args, plain)).out).not.toContain("lattice");
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/visimark/test/report/lattice-report.test.ts`
Expected: FAIL (no `lattice` in any output).

- [ ] **Step 3: Implement**

`packages/visimark/src/report/params.ts` — in `paramLines`, change the `domain` field so the lattice rides on it:

```ts
    domain:
      b.domain === undefined
        ? undefined
        : `domain ${formatDomain(b.domain)}` +
          (b.lattice === undefined ? "" : `   lattice ${b.lattice.literal.text}`),
```

`packages/visimark/src/report/explain.ts` — add `import { latticeJson } from "../lang/lattice.js";`, widen `paramJson`'s return type with `lattice?: { step: string };` and add after the `domain` spread:

```ts
    ...(b.lattice === undefined ? {} : { lattice: latticeJson(b.lattice) }),
```

`packages/visimark/src/cli/commands.ts` — add `import { latticeJson } from "../lang/lattice.js";`, in `domainParamsJson` after `domain: domainJson(p.domain!),` add

```ts
        ...(p.lattice === undefined ? {} : { lattice: latticeJson(p.lattice) }),
```

and in `domainParamsText` replace the row template with:

```ts
      ...domainParams.map(
        (p) =>
          `  ${p.id.padEnd(w)}   ${formatDomain(p.domain!)}` +
          (p.lattice === undefined ? "" : ` lattice ${p.lattice.literal.text}`),
      ),
```

- [ ] **Step 4: Run to verify it passes, then diff against the baseline**

Run: `bun test packages/visimark/test/report/lattice-report.test.ts` — Expected: PASS.

Then:

```bash
for f in packages/visimark/test/fixtures/domain/levers.md docs/example-*.md; do
  n=$(echo "$f" | tr '/' '_')
  bun run packages/visimark/src/cli/main.ts eval "$f" 2>&1 | diff - "/tmp/lattice-baseline/$n.eval"
  bun run packages/visimark/src/cli/main.ts explain "$f" 2>&1 | diff - "/tmp/lattice-baseline/$n.explain"
  bun run packages/visimark/src/cli/main.ts eval --json "$f" 2>&1 | diff - "/tmp/lattice-baseline/$n.evaljson"
  bun run packages/visimark/src/cli/main.ts explain --json "$f" 2>&1 | diff - "/tmp/lattice-baseline/$n.explainjson"
done
```

Expected: no diff output at all.

- [ ] **Step 5: Verification loop and commit**

```bash
git add packages/visimark/src packages/visimark/test/report/lattice-report.test.ts
git commit -m "feat: eval and explain report a param's lattice beside its domain (#258)" -m "<trailer>"
```

---

### Task 5: the `report` statement — syntax and model

**Files:**
- Modify: `packages/visimark/src/lang/ast.ts` — `REPORT_NAMES`, `ReportName`, `ReportDecl`.
- Modify: `packages/visimark/src/lang/parser.ts` — the `parseStatement` return types, `parseStatementInner` recognition, a new `parseReport`.
- Modify: `packages/visimark/src/model/types.ts` — `Report` interface, `Sheet.reports`.
- Modify: `packages/visimark/src/model/build.ts` — `Stmt`, `parseOne`, the document-scope loop (about line 72), the sheet pass (about line 312), `ensureSheet`.
- Modify: `packages/visimark/src/infer/context.ts` (about line 127) — the object literal that builds a `Sheet` gains `reports: []`.
- Test: `packages/visimark/test/lang/report.test.ts` (create), `packages/visimark/test/model/report-build.test.ts` (create).

**Interfaces:**
- Consumes: `Ref` from `lang/ast.ts`; `rebase(expr, delta)` in `build.ts`.
- Produces:
  - `REPORT_NAMES = ["ledger", "deltas", "gates", "best", "forbidden"] as const`; `type ReportName`.
  - `interface ReportDecl extends Pos { type: "report"; name: ReportName; refs: Ref[]; text: string }` — `text` is the whitespace-normalised statement (`report deltas on lines.signature, lines.margin`), the `DUP` key; `refs` are the `REF`s in source order.
  - `interface Report { id: string; sheetId: string; name: ReportName; refs: Ref[]; text: string; span: Span; source: string }` and `Sheet.reports: Report[]`. `id` is `<sheetId>::report@<offset>`; ref spans are absolute.

- [ ] **Step 1: Write the failing tests**

Create `packages/visimark/test/lang/report.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { parseStatement } from "../../src/lang/parser.js";
import { LangError } from "../../src/lang/token.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §2.2 and §4.2

function report(line: string) {
  const s = parseStatement(line);
  if (!("type" in s) || s.type !== "report") throw new Error(`not a report: ${line}`);
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

describe("report statement", () => {
  test("the five shipped forms", () => {
    expect(report("report ledger assertions broken").text).toBe("report ledger assertions broken");
    expect(report("report ledger").text).toBe("report ledger");
    expect(report("report gates").refs).toEqual([]);
    expect(report("report forbidden").text).toBe("report forbidden");
    const d = report("report deltas on lines.signature,   lines.margin");
    expect(d.text).toBe("report deltas on lines.signature, lines.margin");
    expect(d.refs.map((r) => [r.qualifier, r.name])).toEqual([
      ["lines", "signature"],
      ["lines", "margin"],
    ]);
    expect(report("report deltas").refs).toEqual([]);
    const b = report("report best scalar lines.margin direction max among feasible");
    expect(b.text).toBe("report best scalar lines.margin direction max among feasible");
    expect(b.refs).toHaveLength(1);
    expect(report("report best scalar margin direction min").text).toBe(
      "report best scalar margin direction min",
    );
  });

  test("a ref carries its span within the line", () => {
    const d = report("report deltas on lines.signature");
    expect(d.refs[0]).toMatchObject({ start: 17, end: 32 });
  });

  test("report is contextual: a scalar called report still binds", () => {
    for (const line of ["report = 5", "report precision 2 = 5"]) {
      const s = parseStatement(line);
      expect("type" in s).toBe(false);
      expect((s as { name: string }).name).toBe("report");
    }
  });

  test("no name", () => {
    expect(fails("report").message).toBe("a report needs a name");
  });

  test("an unknown name lists the shipped ones", () => {
    expect(fails("report foo").message).toBe(
      "unknown report `foo`; the reports are ledger, deltas, gates, best, forbidden",
    );
  });

  test("options that do not match the grammar", () => {
    expect(fails("report ledger assertions").message).toBe(
      "`report ledger` takes: [assertions broken]",
    );
    expect(fails("report ledger extra").message).toBe("`report ledger` takes: [assertions broken]");
    expect(fails("report deltas lines.margin").message).toBe(
      "`report deltas` takes: [on REF {, REF}]",
    );
    expect(fails("report deltas on").message).toBe("`report deltas` takes: [on REF {, REF}]");
    expect(fails("report gates extra").message).toBe("`report gates` takes no options");
    expect(fails("report forbidden x").message).toBe("`report forbidden` takes no options");
    for (const bad of [
      "report best",
      "report best scalar",
      "report best scalar m",
      "report best scalar m direction up",
      "report best scalar m direction max among",
      "report best scalar m direction max among feasible extra",
    ]) {
      expect(fails(bad).message).toBe(
        "`report best` takes: scalar REF direction max|min [among feasible]",
      );
    }
  });

  test("a report failure names no binding", () => {
    expect(fails("report foo").bindingName).toBeUndefined();
  });
});
```

Create `packages/visimark/test/model/report-build.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §4.2

const fence = (id: string | null, body: string): string =>
  "```vmark" + (id ? ` #${id}` : "") + "\n" + body + "\n```\n";

describe("reports in the model", () => {
  test("a report is collected into its sheet, in order, with absolute spans", () => {
    const md = fence("runs", "x = 1\nreport gates\nreport deltas on runs.x");
    const model = build(locate(md));
    const reports = model.sheets.get("runs")!.reports;
    expect(reports.map((r) => r.text)).toEqual(["report gates", "report deltas on runs.x"]);
    expect(md.slice(reports[1]!.span.start, reports[1]!.span.end)).toBe("report deltas on runs.x");
    const ref = reports[1]!.refs[0]!;
    expect(md.slice(ref.start, ref.end)).toBe("runs.x");
    expect(reports[0]!.id).toMatch(/^runs::report@\d+$/);
  });

  test("a report needs no table", () => {
    const model = build(locate(fence("s", "report gates")));
    expect(model.findings).toEqual([]);
    expect(model.sheets.get("s")!.reports).toHaveLength(1);
  });

  test("a report in a document-scope block is SHEET", () => {
    const model = build(locate(fence(null, "report gates")));
    expect(model.findings.map((f) => [f.code, f.message])).toEqual([
      ["SHEET", "`report` must be in a `#id` sheet block"],
    ]);
  });

  test("an identical statement twice is DUP, naming the sheet", () => {
    const model = build(locate(fence("s", "report gates\nreport   gates")));
    expect(model.findings.map((f) => [f.code, f.sheetId, f.name, f.message])).toEqual([
      ["DUP", "s", undefined, "report gates is declared twice in sheet s"],
    ]);
    expect(model.sheets.get("s")!.reports).toHaveLength(1);
  });

  test("the same report with different options is not a duplicate", () => {
    const model = build(locate(fence("s", "a = 1\nb = 2\nreport deltas on s.a\nreport deltas on s.b")));
    expect(model.findings).toEqual([]);
    expect(model.sheets.get("s")!.reports).toHaveLength(2);
  });

  test("a malformed report is a TYPE finding with no name", () => {
    const model = build(locate(fence("s", "report foo")));
    expect(model.findings.map((f) => [f.code, f.sheetId, f.name])).toEqual([["TYPE", "s", undefined]]);
  });

  test("a binding called report still builds", () => {
    const model = build(locate(fence("s", "report = 5")));
    expect(model.sheets.get("s")!.scalars.has("report")).toBe(true);
    expect(model.sheets.get("s")!.reports).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun test packages/visimark/test/lang/report.test.ts packages/visimark/test/model/report-build.test.ts`
Expected: FAIL (`report` is not recognised; `Sheet.reports` does not exist).

- [ ] **Step 3: Implement**

`packages/visimark/src/lang/ast.ts` — append:

```ts
/** the closed list of reports the tool ships; the list grows only through its
 *  own catalogue row. See docs/design/lattice-on-param-and-report-statements-spec.md §2.2. */
export const REPORT_NAMES = ["ledger", "deltas", "gates", "best", "forbidden"] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

/** A `report <name> [options]` statement. Binds nothing and stores nothing; it
 *  asks that a named, shipped reading of a simulation be printed. `check`
 *  parses and resolves it and never runs it. `refs` are the `REF`s in the
 *  options, in source order; `text` is the whitespace-normalised statement, the
 *  key a duplicate is judged by. */
export interface ReportDecl extends Pos {
  type: "report";
  name: ReportName;
  refs: Ref[];
  text: string;
}
```

`packages/visimark/src/lang/parser.ts`:

1. Add `type ReportDecl, REPORT_NAMES, type ReportName` to the existing `./ast.js` import list (the import already brings `ChartDecl`).
2. Widen both `parseStatement` and `parseStatementInner` return types to `Binding | Assertion | ChartDecl | AliasDecl | UnitDef | ReportDecl`.
3. In `parseStatementInner`, right after the `if (first?.kind === "unit") {...}` block and before the `chart` branch, add:

```ts
  // `report` is contextual, like `param`: a statement only as the first token
  // of a line with no `=`. A binding always has an `=`, so `report = 5` and
  // `report precision 2 = 5` stay ordinary bindings.
  if (
    first?.kind === "ident" &&
    first.value === "report" &&
    !toks.some((t) => t.kind === "op" && t.value === "=")
  ) {
    return parseReport(toks, first);
  }
```

4. Add after `parseChart`:

```ts
const REPORT_SYNOPSIS: Record<ReportName, string | null> = {
  ledger: "[assertions broken]",
  deltas: "[on REF {, REF}]",
  gates: null,
  best: "scalar REF direction max|min [among feasible]",
  forbidden: null,
};

/**
 * `report NAME [OPTIONS]` — see docs/design/lattice-on-param-and-report-statements-spec.md
 * §2.2. Each shipped name has a closed option grammar; anything else is a
 * `TYPE` finding naming the synopsis. `REF`s are parsed, not resolved: `check`
 * resolves them (eval/check-reports.ts).
 */
function parseReport(toks: Token[], kw: Token): ReportDecl {
  let i = toks.indexOf(kw) + 1;
  const last = toks[toks.length - 1]!;
  const at = (): Token => toks[i] ?? last;

  const nameTok = at();
  if (nameTok.kind === "eof") throw new LangError("a report needs a name", kw.start, kw.end);
  if (nameTok.kind !== "ident" || !(REPORT_NAMES as readonly string[]).includes(nameTok.value)) {
    throw new LangError(
      `unknown report \`${nameTok.value}\`; the reports are ${REPORT_NAMES.join(", ")}`,
      nameTok.start,
      nameTok.end,
    );
  }
  const name = nameTok.value as ReportName;
  i++;

  const bad = (): never => {
    const synopsis = REPORT_SYNOPSIS[name];
    throw new LangError(
      synopsis === null ? `\`report ${name}\` takes no options` : `\`report ${name}\` takes: ${synopsis}`,
      at().start,
      last.end,
    );
  };
  const isWord = (w: string): boolean => at().kind === "ident" && at().value === w;
  const word = (w: string): void => {
    if (!isWord(w)) bad();
    i++;
  };
  const ref = (): Ref => {
    const head = at();
    if (head.kind !== "ident") return bad();
    i++;
    if (at().kind === "dot") {
      i++;
      const tail = at();
      if (tail.kind !== "ident") return bad();
      i++;
      return { type: "ref", name: tail.value, qualifier: head.value, start: head.start, end: tail.end };
    }
    return { type: "ref", name: head.value, start: head.start, end: head.end };
  };
  const refText = (r: Ref): string => (r.qualifier ? `${r.qualifier}.${r.name}` : r.name);

  const refs: Ref[] = [];
  const pieces: string[] = [];
  if (name === "ledger" && isWord("assertions")) {
    i++;
    word("broken");
    pieces.push("assertions broken");
  } else if (name === "deltas" && isWord("on")) {
    i++;
    for (;;) {
      refs.push(ref());
      if (at().kind === "comma") {
        i++;
        continue;
      }
      break;
    }
    pieces.push(`on ${refs.map(refText).join(", ")}`);
  } else if (name === "best") {
    word("scalar");
    refs.push(ref());
    word("direction");
    const dir = at();
    if (dir.kind !== "ident" || (dir.value !== "max" && dir.value !== "min")) bad();
    i++;
    pieces.push(`scalar ${refText(refs[0]!)} direction ${dir.value}`);
    if (isWord("among")) {
      i++;
      word("feasible");
      pieces.push("among feasible");
    }
  }
  if (at().kind !== "eof") bad();
  return {
    type: "report",
    name,
    refs,
    text: ["report", name, ...pieces].join(" "),
    start: kw.start,
    end: at().start,
  };
}
```

`packages/visimark/src/model/types.ts` — add `import type { Ref } from "../lang/ast.js"` and `ReportName` to the existing `../lang/ast.js` import if one exists (otherwise add the import), then add beside `Chart`:

```ts
/**
 * A `report` statement: a request that a named, shipped reading of a simulation
 * be printed under the sheet's heading. Not a graph node and never evaluated by
 * `check`; its refs are resolved and counted as reads. See
 * docs/design/lattice-on-param-and-report-statements-spec.md.
 */
export interface Report {
  /** `<sheetId>::report@<offset>` */
  id: string;
  sheetId: string;
  name: ReportName;
  /** the `REF`s in the options, source order, absolute spans */
  refs: Ref[];
  /** whitespace-normalised statement; the duplicate key */
  text: string;
  span: Span;
  source: string;
}
```

and in `Sheet`, after `charts: Chart[];`:

```ts
  /** `report` statements, in block-declaration order */
  reports: Report[];
```

`packages/visimark/src/model/build.ts`:

- Import `type Report` from `./types.js` alongside the others.
- `Stmt` union gains `| { kind: "report"; report: Report }`.
- In `parseOne`, immediately after the `if ("type" in s && s.type === "chart") {...}` block, add:

```ts
    if ("type" in s && s.type === "report") {
      for (const r of s.refs) rebase(r, rb.start);
      return {
        kind: "report",
        report: {
          id: `${sheetId}::report@${rb.start}`,
          sheetId,
          name: s.name,
          refs: s.refs,
          text: s.text,
          span: { start: rb.start, end: rb.end },
          source: rb.raw,
        },
      };
    }
```

- In the document-scope loop, right after the `if (stmt.kind === "chart") {...}` block, add:

```ts
    if (stmt.kind === "report") {
      findings.push({
        code: "SHEET",
        message: "`report` must be in a `#id` sheet block",
        sourceOffset: stmt.report.span.start,
        span: stmt.report.span,
      });
      continue;
    }
```

- In the sheet pass, right after the `if (stmt.kind === "chart") {...}` block (before the `const parsed = stmt.binding;` line), add:

```ts
      if (stmt.kind === "report") {
        const first = sheet.reports.find((r) => r.text === stmt.report.text);
        if (first) {
          findings.push({
            code: "DUP",
            sheetId,
            message: `${stmt.report.text} is declared twice in sheet ${sheetId}`,
            sourceOffset: stmt.report.span.start,
            span: stmt.report.span,
            relatedSpan: first.span,
          });
          continue;
        }
        sheet.reports.push(stmt.report);
        continue;
      }
```

- In `ensureSheet`, after `charts: [],` add `reports: [],`.

`packages/visimark/src/infer/context.ts` — in the object literal that carries `charts: [],` (about line 127) add `reports: [],` on the next line.

- [ ] **Step 4: Run to verify they pass**

Run: `bun test packages/visimark/test/lang/report.test.ts packages/visimark/test/model/report-build.test.ts` — Expected: PASS. Then `bun run typecheck`; any other `Sheet` constructor reported by the compiler gets `reports: []`.

- [ ] **Step 5: Verification loop and commit**

```bash
git add packages/visimark/src packages/visimark/test/lang/report.test.ts packages/visimark/test/model/report-build.test.ts
git commit -m "feat: parse and collect report statements (#258)" -m "<trailer>"
```

---

### Task 6: `check` resolves a report's refs

**Files:**
- Create: `packages/visimark/src/eval/check-reports.ts`
- Modify: `packages/visimark/src/eval/check.ts` — call `checkReports(st)` after `checkCharts(st)` (about line 276).
- Modify: `packages/visimark/src/eval/check-report.ts` — `collectReferenced` counts a report's refs as reads (about line 180).
- Test: `packages/visimark/test/eval/report.test.ts` (create).

**Interfaces:**
- Consumes: `Sheet.reports` (Task 5); `resolve`, `refText` from `eval/graph.ts`; `CheckState["emit"]`.
- Produces: `checkReports(st: Pick<CheckState, "model" | "emit">): void`, emitting `UNDEF` (a ref that resolves to nothing, with the existing `suggestion`) and `TYPE` (`a report reads a scalar; <ref> is a column`), each carrying the sheet and no `name`.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/eval/report.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { check } from "../../src/eval/check.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §3.3 and §4.2

const fence = (id: string | null, body: string): string =>
  "```vmark" + (id ? ` #${id}` : "") + "\n" + body + "\n```\n";

function run(md: string) {
  return check(build(locate(md)));
}

const brief = (md: string) =>
  run(md)
    .findings.filter((f) => f.code !== "WARN" && f.code !== "COVERAGE")
    .map((f) => ({ code: f.code, sheetId: f.sheetId, name: f.name, raw: f.raw, message: f.message }));

describe("report refs", () => {
  test("a ref that resolves to nothing is UNDEF, with no name", () => {
    expect(brief(fence("s", "x = 1\nreport deltas on s.nope"))).toEqual([
      { code: "UNDEF", sheetId: "s", name: undefined, raw: "s.nope", message: undefined },
    ]);
  });

  test("a bare ref resolves in the sheet", () => {
    expect(brief(fence("s", "x = 1\nreport deltas on x"))).toEqual([]);
  });

  test("a bare ref resolves to a document-scope scalar", () => {
    const md = fence(null, "rate = 5") + fence("s", "x = 1\nreport best scalar rate direction max");
    expect(brief(md)).toEqual([]);
  });

  test("a ref to a column is TYPE", () => {
    const md =
      "| a |\n|---|\n| 1 |\n\n" + fence("s", "report deltas on s.a") + "\n";
    expect(brief(md)).toEqual([
      {
        code: "TYPE",
        sheetId: "s",
        name: undefined,
        raw: undefined,
        message: "a report reads a scalar; s.a is a column",
      },
    ]);
  });

  test("a ref to a param resolves", () => {
    expect(
      brief(fence("s", "param x precision 0 integer in [0, 10] lattice 5 = default 5\nreport deltas on s.x")),
    ).toEqual([]);
  });

  test("a scalar that only a report reads is not WARN", () => {
    const fs = run(fence("s", "x = 1\nreport deltas on s.x")).findings;
    expect(fs.filter((f) => f.code === "WARN")).toEqual([]);
  });

  test("a scalar nothing reads still is", () => {
    const fs = run(fence("s", "x = 1\ny = 2\nreport deltas on s.x")).findings;
    expect(fs.filter((f) => f.code === "WARN").map((f) => f.name)).toEqual(["y"]);
  });

  test("a report changes no evaluation and no exit code on its own", () => {
    const withReport = run(fence("s", "x precision 0 = 2 * 3\nreport gates"));
    expect(String((withReport.values.get("s.x") as { d: unknown }).d)).toBe("6");
    expect(withReport.exitCode).toBe(0);
  });

  test("a report adds no dependency edge: no CYCLE from naming a binding", () => {
    const fs = run(fence("s", "x = 1\nreport deltas on s.x\nreport best scalar s.x direction max")).findings;
    expect(fs.filter((f) => f.code === "CYCLE")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/visimark/test/eval/report.test.ts`
Expected: FAIL (the UNDEF and TYPE cases are not raised; the WARN cases fail).

- [ ] **Step 3: Implement**

Create `packages/visimark/src/eval/check-reports.ts`:

```ts
import type { CheckState } from "./check-state.js";
import { refText, resolve } from "./graph.js";

/**
 * Resolves every `REF` a `report` statement names. A report reads a scalar: a
 * ref that resolves to nothing is `UNDEF` (with the same did-you-mean an
 * expression's unknown name gets), and a ref that resolves to a column is
 * `TYPE`. Findings carry the sheet and no `name`, as `chart` findings do. A
 * report is not a graph node, so this pass adds no dependency edge and cannot
 * introduce a cycle. See
 * docs/design/lattice-on-param-and-report-statements-spec.md §3.3 and §4.2.
 *
 * It emits findings, so it keeps its position in the phase sequence —
 * `orderFindings` sorts on emit order.
 */
export function checkReports(st: Pick<CheckState, "model" | "emit">): void {
  for (const sheet of st.model.sheets.values()) {
    for (const report of sheet.reports) {
      for (const ref of report.refs) {
        const res = resolve(st.model, report.sheetId, ref);
        if (res.kind === "unknown") {
          st.emit(
            {
              code: "UNDEF",
              sheetId: report.sheetId,
              raw: refText(ref),
              suggestion: res.suggestion ?? undefined,
              sourceOffset: ref.start,
              span: { start: ref.start, end: ref.end },
            },
            { sheetId: report.sheetId },
          );
        } else if (res.kind === "column" || res.kind === "input-column") {
          st.emit(
            {
              code: "TYPE",
              sheetId: report.sheetId,
              message: `a report reads a scalar; ${refText(ref)} is a column`,
              sourceOffset: ref.start,
              span: { start: ref.start, end: ref.end },
            },
            { sheetId: report.sheetId },
          );
        }
      }
    }
  }
}
```

In `packages/visimark/src/eval/check.ts` add `import { checkReports } from "./check-reports.js";` beside `checkCharts`, and change

```ts
  const charts = checkCharts(st);
```

to

```ts
  const charts = checkCharts(st);
  checkReports(st);
```

In `packages/visimark/src/eval/check-report.ts`, in `collectReferenced`, after the closing brace of the `for (const c of sheet.charts) {...}` loop (still inside `for (const sheet ...)`), add:

```ts
    // a report's refs are reads: a scalar only a report names is not "never read"
    for (const r of sheet.reports) for (const ref of r.refs) visit(ref, r.sheetId);
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test packages/visimark/test/eval/report.test.ts`
Expected: PASS. If the `emit` signature rejects a finding without `name`, mirror how the chart pass emits (`check-charts.ts`, `artifactFinding`), which also omits `name` where it has none.

- [ ] **Step 5: Verification loop and commit**

Re-run the Task 4 baseline diff loop; expected: no diff.

```bash
git add packages/visimark/src packages/visimark/test/eval/report.test.ts
git commit -m "feat: check resolves a report's refs and counts them as reads (#258)" -m "<trailer>"
```

---

### Task 7: acceptance fixture and transcript test

**Files:**
- Create: `packages/visimark/test/fixtures/simulation/levers.md`
- Test: `packages/visimark/test/simulation-acceptance.test.ts` (create)

**Interfaces:**
- Consumes: everything above, through `runCli`, `check`, `build`, `locate`, and `resolveScenario`/`parseScenarioJson` for membership.
- Produces: the spec §6 acceptance transcript.

- [ ] **Step 1: Create the fixture**

````markdown
# Levers, with lattices and reports

A non-normative fixture for
[`lattice-on-param-and-report-statements-spec.md`](../../../../../docs/design/lattice-on-param-and-report-statements-spec.md).
Every lever below is askable within its declared domain; a `lattice` says at
which spacing a sweep visits it, and the `report` lines say which readings of
a sweep are wanted. `check` runs neither.

```vmark #levers
param extra_hours  precision 0 integer in [0, 80] lattice 20 = default 40
param volume_disc  precision 3 in [0%, 10%] lattice 1% = default 0%
param prepay_share precision 2 in { 30%, 40%, 45%, 50% } = default 30%
param bump         precision 1 in (0, 10) lattice 5 = default 5
param staff        precision 0 positive integer in [1, 13] lattice 3 = default 1

max_prepay = 40%
cost precision 0 = extra_hours * 100
assert levers.prepay_share <= max_prepay

report ledger assertions broken
report deltas on levers.extra_hours, levers.volume_disc
report gates
report best scalar levers.cost direction min among feasible
report forbidden
```
````

Save the content between the outer fences to `packages/visimark/test/fixtures/simulation/levers.md` (the file itself is plain Markdown with the single `vmark` fence shown; the four-backtick outer fence above exists only so this plan can show it).

- [ ] **Step 2: Write the failing test**

Create `packages/visimark/test/simulation-acceptance.test.ts`:

```ts
/**
 * The acceptance transcript for `lattice` and `report`
 * (docs/design/lattice-on-param-and-report-statements-spec.md §6).
 *
 * Only the clean fixture (`fixtures/simulation/levers.md`) is committed; every
 * broken variant below is generated in memory, the pattern
 * `domain-acceptance.test.ts` uses.
 */
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";
import { check } from "../src/eval/check.js";
import { build } from "../src/model/build.js";
import { locate } from "../src/parse/document.js";

const MD_PATH = join(import.meta.dir, "fixtures", "simulation", "levers.md");
const DOMAIN_PATH = join(import.meta.dir, "fixtures", "domain", "levers.md");
const CLEAN = readFileSync(MD_PATH, "utf8");

async function run(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(args, {
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

const fence = (id: string | null, body: string): string =>
  "```vmark" + (id ? ` #${id}` : "") + "\n" + body + "\n```\n";

function problems(md: string) {
  return check(build(locate(md))).findings.filter((f) => f.code !== "WARN" && f.code !== "COVERAGE");
}
const shape = (md: string) =>
  problems(md).map((f) => `${f.code}|${f.sheetId ?? ""}|${f.name ?? ""}|${f.message ?? f.raw ?? ""}`);

test("1. clean: check exits 0 with no error findings", async () => {
  const r = await run(["check", MD_PATH]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("0 problems");
  expect(r.out).not.toMatch(/\b(TYPE|DOMAIN|PRECISION|SHEET|UNDEF|DUP)\b/);
  // bump and staff are read by nothing; volume_disc only by a report
  expect(r.out).toMatch(/WARN\s+levers\.bump/);
  expect(r.out).toMatch(/WARN\s+levers\.staff/);
  expect(r.out).not.toMatch(/WARN\s+levers\.volume_disc/);
});

test("2. eval reports every lattice", async () => {
  const j = JSON.parse((await run(["eval", "--json", MD_PATH])).out);
  expect(j.params["levers.extra_hours"].lattice).toEqual({ step: "20" });
  expect(j.params["levers.volume_disc"].lattice).toEqual({ step: "0.01" });
  expect(j.params["levers.bump"].lattice).toEqual({ step: "5" });
  expect(j.params["levers.staff"].lattice).toEqual({ step: "3" });
  expect("lattice" in j.params["levers.prepay_share"]).toBe(false);
  expect(j.params["levers.extra_hours"].domain.clauses).toEqual(["integer", "[0, 80]"]);
  const text = (await run(["eval", MD_PATH])).out;
  expect(text).toMatch(/levers\.extra_hours\s+integer in \[0, 80\] lattice 20\n/);
  expect(text).toMatch(/levers\.volume_disc\s+\[0%, 10%\] lattice 1%\n/);
});

test("3. the #241 fixture prints no lattice anywhere", async () => {
  for (const args of [["eval"], ["eval", "--json"], ["explain"], ["explain", "--json"]]) {
    expect((await run([...args, DOMAIN_PATH])).out).not.toContain("lattice");
  }
});

test("4a. every lattice finding in spec 4.1", () => {
  const rows: [string, string][] = [
    ["param x precision 0 in [0, 10] lattice = default 0", "TYPE|s|x|a lattice step must be a number literal"],
    ["param x precision 0 in [0, 10] lattice 5 lattice 5 = default 0", "TYPE|s|x|malformed param domain clause"],
    ["param x precision 0 lattice 5 in [0, 10] = default 0", "TYPE|s|x|malformed param domain clause"],
    ["param x precision 0 lattice 5 = default 0", "TYPE|s|x|param x declares a lattice but no domain"],
    ["param x precision 0 in { 1, 2 } lattice 1 = default 1", "TYPE|s|x|param x declares a lattice, but a set already lists its points"],
    ["param x precision 0 natural lattice 5 = default 0", "TYPE|s|x|param x declares a lattice, but its domain has no upper bound"],
    ["param x precision 0 in (, 10] lattice 5 = default 0", "TYPE|s|x|param x declares a lattice, but its domain has no lower bound"],
    ["param x precision 0 in [0, 10] lattice 0 = default 0", "TYPE|s|x|lattice step must be positive"],
    ["param x precision 3 in [0%, 10%] lattice 5 = default 0%", "TYPE|s|x|x is a percent; lattice step 5 must be too"],
    ["param x precision 0 in [0, 10] lattice 5% = default 0", "TYPE|s|x|x is not a percent; lattice step 5% must not be one"],
    ["param x precision 1 in [0, 1] lattice 0.25 = default 0", "PRECISION|s|x|lattice step 0.25 has 2 decimals; param x declares 1"],
    ["param x precision 1 integer in [0, 80] lattice 2.5 = default 0", "TYPE|s|x|lattice step 2.5 must be a whole number: param x is an integer domain"],
    ["param x precision 0 in [0, 10] lattice 3 = default 0", "TYPE|s|x|lattice step 3 does not reach the end of [0, 10]: 10 is not a multiple of 3 above 0"],
    ["param x precision 0 in (0, 5) lattice 5 = default 1", "TYPE|s|x|lattice step 5 leaves no point in (0, 5)"],
  ];
  for (const [line, expected] of rows) {
    expect(shape(fence("s", line))).toEqual([expected]);
  }
});

test("4b. every report finding in spec 4.2, and the silent cases", () => {
  const withScalars = (stmts: string) => fence("s", `a = 1\nb = 2\n${stmts}`);
  expect(shape(withScalars("report"))).toEqual(["TYPE|s||a report needs a name"]);
  expect(shape(withScalars("report foo"))).toEqual([
    "TYPE|s||unknown report `foo`; the reports are ledger, deltas, gates, best, forbidden",
  ]);
  expect(shape(withScalars("report ledger assertions"))).toEqual([
    "TYPE|s||`report ledger` takes: [assertions broken]",
  ]);
  expect(shape(withScalars("report gates extra"))).toEqual([
    "TYPE|s||`report gates` takes no options",
  ]);
  expect(shape(withScalars("report best scalar s.a direction up"))).toEqual([
    "TYPE|s||`report best` takes: scalar REF direction max|min [among feasible]",
  ]);
  expect(shape(withScalars("report deltas on s.nope"))).toEqual(["UNDEF|s||s.nope"]);
  expect(shape("| c |\n|---|\n| 1 |\n\n" + fence("s", "report deltas on s.c"))).toEqual([
    "TYPE|s||a report reads a scalar; s.c is a column",
  ]);
  expect(shape(fence(null, "report gates"))).toEqual([
    "SHEET|||`report` must be in a `#id` sheet block",
  ]);
  expect(shape(withScalars("report gates\nreport  gates"))).toEqual([
    "DUP|s||report gates is declared twice in sheet s",
  ]);
  // silent: same report, different options; a default off its lattice; no table
  expect(shape(withScalars("report deltas on s.a\nreport deltas on s.b"))).toEqual([]);
  expect(shape(fence("s", "param x precision 0 in [0, 80] lattice 20 = default 7"))).toEqual([]);
  expect(shape(fence("s", "report gates"))).toEqual([]);
});

test("4c. each variant exits per check: findings 1, silent 0", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-sim-"));
  try {
    const bad = join(dir, "bad.md");
    writeFileSync(bad, fence("s", "param x precision 0 in [0, 10] lattice 3 = default 0"));
    expect((await run(["check", bad])).code).toBe(1);
    const ok = join(dir, "ok.md");
    writeFileSync(ok, fence("s", "param x precision 0 in [0, 80] lattice 20 = default 7\ny = x"));
    expect((await run(["check", ok])).code).toBe(0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("5. membership is untouched by a lattice", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-sim-"));
  try {
    const off = join(dir, "off.json");
    writeFileSync(off, JSON.stringify({ extra_hours: "7" }));
    const r = await run(["eval", "--scenario", off, MD_PATH]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/levers\.extra_hours\s+7\b/);
    const outside = join(dir, "outside.json");
    writeFileSync(outside, JSON.stringify({ extra_hours: "81" }));
    const bad = await run(["eval", "--scenario", outside, MD_PATH]);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain("scenario value for extra_hours");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("6. fmt writes nothing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-sim-"));
  try {
    const copy = join(dir, "levers.md");
    writeFileSync(copy, CLEAN);
    await run(["fmt", copy]);
    expect(readFileSync(copy, "utf8")).toBe(CLEAN);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("7. a scalar named report still binds", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-sim-"));
  try {
    const f = join(dir, "r.md");
    writeFileSync(f, fence("s", "report = 5\nlattice = 7"));
    const r = await run(["eval", f]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/s\.report\s+5\b/);
    expect(r.out).toMatch(/s\.lattice\s+7\b/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 3: Run to verify it fails, then passes**

Run: `bun test packages/visimark/test/simulation-acceptance.test.ts`
Expected before the fixture exists: FAIL (missing file). With the fixture and Tasks 1–6: PASS. Items whose precise text the test cannot know in advance (alignment of `eval` columns) are asserted by regex; fix any other mismatch in the implementation, not by loosening an assertion.

- [ ] **Step 4: Prove `fmt`, `infer` and the LSP need nothing**

Run `bun packages/visimark/src/cli/main.ts fmt --check packages/visimark/test/fixtures/simulation/levers.md` (expected exit `0`) and `bun packages/visimark/src/cli/main.ts infer packages/visimark/test/fixtures/simulation/levers.md` (expected: no proposal for `lattice` or `report`). Run `grep -rn "positive integer\|\"chart\"" editors packages/visimark-lsp --include=*.json --include=*.ts -l | grep -v node_modules | grep -v "/out/\|/dist/"` and record in the PR description that it names no editor keyword list.

- [ ] **Step 5: Verification loop and commit**

Run the Task 4 baseline diff loop (expected: no diff), then:

```bash
git add packages/visimark/test/fixtures/simulation packages/visimark/test/simulation-acceptance.test.ts
git commit -m "test: acceptance transcript for lattice and report (#258)" -m "<trailer>"
```

---

### Task 8: documentation (final task — every merged PR needs this)

**Files:**
- Modify: `docs/visimark-design.md` — §4 syntax (the `param` paragraph near line 258 gains a `lattice` and a `report` paragraph), §10 (rows for `TYPE`, `PRECISION`, `SHEET`, `UNDEF` and `DUP`, near lines 672–700), §20 (the "A declared domain" bullet, near line 1298, gains a lattice bullet).
- Modify: `docs/cli-reference.md` — the `eval` and `explain` rows (lines 23–24) and the findings table rows (near line 110).
- Modify: `docs/tutorial.md` — wherever the declared-domain material is, add one short paragraph and example for `lattice`.
- Modify: `CHANGELOG.md` — `## Unreleased` → `### Added`.
- Modify: `editors/vscode/CHANGELOG.md` — `## Unreleased`.
- Modify: `docs/vocabulary-catalogue.md` — move the `lattice` row out of section E into the Shipped register as `UNRELEASED`.
- Regenerate: `docs/vendor/visimark-browser.js` (committed playground bundle).
- Check: `skills/visimark/SKILL.md` and `packages/visimark-mcp/skill.md`.

**Interfaces:** none.

- [ ] **Step 1: The design doc**

In `docs/visimark-design.md` §4, after the `param` paragraph, add:

```markdown
**`lattice` — sweep spacing.** A `param` header may end its domain with
`lattice STEP`: `param volume_disc precision 3 in [0%, 10%] lattice 1% = default 0%`.
It declares the spacing a sweep visits the interval at, anchored at the lower
end, both ends visited and an open end dropped. It is not part of the domain:
`in [0, 80] lattice 20` still accepts `7`, and a default or scenario value off
the lattice is legal. A lattice needs a finite interval, so a set, an unbounded
domain, an inexact step or a step that leaves no point is a `TYPE` finding at the
declaration. `lattice` is contextual: `lattice = 5` still binds a scalar.

**`report` — a named reading.** A sheet block may carry `report NAME [OPTIONS]`,
a statement beside `chart`. `NAME` is one of `ledger`, `deltas`, `gates`, `best`
and `forbidden`, each with a closed option grammar. `check` parses the line,
resolves its refs and counts them as reads, and never runs a question; `fmt`
leaves it alone. What each report computes belongs to the `simulate` command.
```

In §10 widen the table cells: `TYPE` gains "a malformed or impossible `lattice` clause, or a malformed or unknown `report`"; `PRECISION` gains "a lattice step wider than its param"; `SHEET` gains "a `report` in a document-scope block"; `UNDEF` gains "a `report` ref that resolves to nothing"; `DUP` gains "two identical `report` statements in one sheet". In §20 add a bullet: "**A lattice** declares the spacing a sweep visits a param's interval at; it narrows nothing. `eval` and `explain` print it beside the domain, and `--json` adds a `lattice` object next to `domain`."

- [ ] **Step 2: The CLI reference, the tutorial, the changelogs**

`docs/cli-reference.md`: in the `eval` row, change "naming each param's declared domain" to "naming each param's declared domain and lattice"; in the `explain` row, change "shows its declared domain, when it has one" to "shows its declared domain and lattice, when it has them"; widen the same five finding rows as in the design doc.

`docs/tutorial.md`: find the declared-domain section with `grep -n "domain" docs/tutorial.md` and add, after its last example, a paragraph and a `vmark` example using `integer in [0, 80] lattice 20` explaining that a lattice names the spacing a later sweep uses and does not narrow what a value may be.

`CHANGELOG.md`, under `## Unreleased` → `### Added`:

```markdown
- **`lattice` on a `param`, and `report` statements.** A `param` header may end
  its domain with `lattice STEP` (`param volume_disc precision 3 in [0%, 10%]
  lattice 1% = default 0%`): the spacing a sweep visits the interval at. It
  narrows nothing and `fmt` writes nothing; a set, an unbounded domain, an inexact
  step or a step with no point is a `TYPE` finding at the declaration. `eval` and
  `explain` print it beside the domain, and `--json` adds a `lattice` object. A
  sheet may carry `report ledger|deltas|gates|best|forbidden [options]`, which
  `check` parses and resolves and never runs. See
  [#258](https://github.com/michal-niedzwiedzki/visimark/issues/258) and
  [`docs/design/lattice-on-param-and-report-statements-spec.md`](docs/design/lattice-on-param-and-report-statements-spec.md).
```

`editors/vscode/CHANGELOG.md`, under `## Unreleased`, one line: "A `lattice` clause on a `param` and a `report` statement are now understood: an impossible lattice, an unknown report name or a report option that does not match its grammar gets a diagnostic."

- [ ] **Step 3: The catalogue**

In `docs/vocabulary-catalogue.md`, delete the `` `lattice` on `param`, and `report` statements `` row from the section-E table and add to the Shipped table a row in that table's columns (copy the column order from the `Declared domain on param` row, which sits there already):

```markdown
| `lattice` on `param`, and `report` statements | language feature | [#258](https://github.com/michal-niedzwiedzki/visimark/issues/258) | [#327](https://github.com/michal-niedzwiedzki/visimark/pull/327) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/258#issuecomment-5956116308) |
```

Add "`lattice` on `param` and `report` statements" to the sentence that lists what section E has shipped (`assert` statements, generated artifacts, …).

- [ ] **Step 4: Generated docs, bundle, skills, format and lint**

```bash
bun run gen:docs && git status --short docs | head
grep -n "param\b.*domain\|in \[" skills/visimark/SKILL.md packages/visimark-mcp/skill.md | head
```

If the skill files describe `param` domains, add one line naming `lattice STEP` and `report`, then run `bun run gen:mcp`. Rebuild the committed playground bundle:

```bash
bun run --filter visimark build:playground
bun run format && bun run lint
```

Expected: `format:check` and `lint` clean; a changed `docs/vendor/visimark-browser.js`; `gen:docs` produces no unexpected diff.

- [ ] **Step 5: Final checks and commit**

Run the Global Constraints loop one last time, plus the Task 4 baseline diff loop (expected: no diff), plus `bun run packages/visimark/src/cli/main.ts check docs/*.md` for every doc that carries a `vmark` fence.

```bash
git add -A docs CHANGELOG.md editors/vscode/CHANGELOG.md skills packages/visimark-mcp
git commit -m "docs: lattice and report statements — design doc, CLI reference, tutorial, changelogs, catalogue (#258)" -m "<trailer>"
git push
```

Then wait for CI (`gh pr checks 327 --watch`) and promote the PR with `gh pr ready 327` only when every check passes.
