# PMT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `PMT(rate, nper, pv)` — the fourteenth builtin, a map of three numbers to the instalment that repays `pv` over `nper` periods at per-period rate `rate` — per `docs/vocab/pmt-spec.md`.

**Architecture:** `PMT` is one arm of the `evalCall` map switch in `eval/evaluate.ts`. `decimal.js` is already the numeric core; the zero-rate case is chosen before the general formula so a zero rate never divides by zero. The function is registered in `eval/functions.ts` as `{ kind: "map", arity: 3 }`, which the dependency walk, the static arity check and did-you-mean already read. `derivePrecision` needs no new arm: a call it does not recognise returns `null`, which is the declared-width rule `AVG` and `SQRT` already use. The reference entry is an `FnDoc` in `lang/reference.ts`. No parser, model, write, LSP or infer change.

**Tech Stack:** TypeScript; `decimal.js` (already the numeric core); Bun test runner; the engine package `packages/visimark`.

**Spec:** `docs/vocab/pmt-spec.md`

## Global Constraints

- No new npm dependencies. No new module.
- No change to `parse/`, `model/`, `write/`, `infer/`, or `packages/visimark-lsp`. The parser builds a call node for any name. `infer` never proposes `PMT`.
- No new [§10](../visimark-design.md#10-error-taxonomy) code. Domain failures are `TYPE`. A missing width and the working-precision ceiling stay `PRECISION`, with the wording those findings already use.
- `FnDoc.precision` is `{ from: "declared" }`. `FnDoc` has no `rounding` field. `PMT` has no prose spelling.
- Error messages, verbatim, checked in this order: a non-number argument → `PMT expects a number`; `nper` not a positive whole number (`Decimal.isInteger()` and `gt(0)`; `36.0` passes, `36.5` does not) → `PMT expects a positive whole number of periods`; `rate <= -1` → `PMT rate must be greater than -1`; a non-finite power or quotient → `result is not a finite decimal` from `num()`.
- Wrong arity is the existing static message `PMT() takes 3 arguments, got N`, once per binding.
- A row-varying bad argument is one `TYPE` on that row. A row-invariant bad argument over N rows emitting N findings is accepted. Do not add row-variance analysis.
- An unanchored scalar keeps full working precision and is not a `PRECISION` finding. An anchored scalar or a column rule whose formula is a bare `PMT` call must declare a width. `ROUND(PMT(...), 2)` derives its width from `ROUND`.
- A positive `pv` produces a positive instalment. Do not flip the sign. Do not divide an annual rate by 12 inside the function. No future-value argument and no payment-in-advance flag.
- Work on branch `vocab/issue-156-pmt-impl` (draft PR #161). Do not open a new PR.
- `docs/example-invoice.md` and `docs/example-invoice-drift.md` stay byte-identical.
- Every commit ends with the one `Co-Authored-By` trailer from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session doing the commit. Do not copy a trailer out of this plan, an older plan, or an older commit.

---

### Task 1: register `PMT` and evaluate it

**Files:**
- Edit: `packages/visimark/src/eval/functions.ts`
- Edit: `packages/visimark/src/eval/evaluate.ts`
- Edit: `packages/visimark/test/eval/precision.test.ts`
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Produces: `FUNCTIONS.get("PMT")` is `{ kind: "map", arity: 3 }`. `callProblem("PMT", args)` returns `{ kind: "arity", expected: 3, got: N }` for N other than 3, and `null` for 3. A `PMT` call evaluates to a `num` or throws `EvalError` with one of the four messages in Global Constraints.
- Consumes: `asNum`, `num`, and `EvalError` in `evaluate.ts`. `Decimal` from `decimal.js`, already imported there.

- [ ] **Step 1: Expect `PMT` in the builtin list (RED)**

In `test/eval/functions.test.ts`, the test `"every builtin declares a kind and an arity"` lists the sorted keys. Insert `"PMT"` between `"MOD"` and `"ROUND"`:

```ts
    "MOD",
    "PMT",
    "ROUND",
```

- [ ] **Step 2: Add the behaviour tests (RED)**

Append at the end of `test/eval/functions.test.ts`. This file reaches the engine only through `run(src)`.

```ts
// ---- PMT ------------------------------------------------------------

test("PMT is a map of arity 3", () => {
  expect(FUNCTIONS.get("PMT")).toEqual({ kind: "map", arity: 3 });
  expect(isReduce("PMT")).toBe(false);
  expect(callProblem("PMT", [{ type: "num" }, { type: "num" }, { type: "num" }])).toBeNull();
  expect(callProblem("PMT", [])).toEqual({ kind: "arity", expected: 3, got: 0 });
  expect(callProblem("PMT", [{ type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 3,
    got: 2,
  });
  expect(
    callProblem("PMT", [{ type: "num" }, { type: "num" }, { type: "num" }, { type: "num" }]),
  ).toEqual({ kind: "arity", expected: 3, got: 4 });
});

test("PMT exact cases and the two full working values", () => {
  const src = `
\`\`\`vmark #s
zero = PMT(0, 12, 1200)
one = PMT(0.10, 1, 1000)
none = PMT(0, 4, 0)
loan = PMT(0.01, 12, 10000)
press = PMT(0.005, 36, 48000)
neg = PMT(0.01, 12, -10000)
shown precision 2 = ROUND(loan, 2)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  const str = (name: string) => {
    const v = r.values.get(`s.${name}`);
    if (!v || v.t !== "num") throw new Error(name);
    return v.d.toString();
  };
  expect(str("zero")).toBe("100");
  expect(str("one")).toBe("1100");
  expect(str("none")).toBe("0");
  expect(str("loan")).toBe("888.4878867834170733998783122788652898045");
  expect(str("press")).toBe("1460.252997674645676629785549680054151698");
  expect(str("neg")).toBe("-888.4878867834170733998783122788652898045");
  expect(str("shown")).toBe("888.49");
});

test("PMT rejects a non-number, a bad term, then a bad rate, in that order", () => {
  const msg = (rule: string) => typeFindings(run(withScalar(rule)).findings)[0]?.message;
  expect(msg('PMT("x", 12, 1)')).toBe("PMT expects a number");
  expect(msg('PMT(0.01, "x", 1)')).toBe("PMT expects a number");
  expect(msg("PMT(0.01, 12, 2026-01-01)")).toBe("PMT expects a number");
  expect(msg("PMT(0.01, 0, 1)")).toBe("PMT expects a positive whole number of periods");
  expect(msg("PMT(0.01, -12, 1)")).toBe("PMT expects a positive whole number of periods");
  expect(msg("PMT(0.01, 12.5, 1)")).toBe("PMT expects a positive whole number of periods");
  expect(msg("PMT(-1, 12, 1)")).toBe("PMT rate must be greater than -1");
  expect(msg("PMT(-1.5, 12, 1)")).toBe("PMT rate must be greater than -1");
  expect(msg("PMT(-1, 1.5, 1)")).toBe("PMT expects a positive whole number of periods");
});
```

The `shown` binding is what keeps `loan` from being an unread scalar. `WARN` on any other name in that snippet is a bug in the snippet, not a `PMT` failure: the filter exists so an unrelated `WARN` cannot hide a `TYPE`.

- [ ] **Step 3: Run the tests and confirm they fail**

From the repo root:

```bash
bun test packages/visimark/test/eval/functions.test.ts
```

Expected: FAIL. `FUNCTIONS.get("PMT")` is `undefined`, and the sorted key list does not contain `"PMT"`.

- [ ] **Step 4: Register and implement**

In `FUNCTION_TABLE` in `packages/visimark/src/eval/functions.ts`, after the `EOMONTH` entry:

```ts
  PMT: { kind: "map", arity: 3 },
```

In the `evalCall` switch in `packages/visimark/src/eval/evaluate.ts`, before `default`:

```ts
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
```

`num()` already throws `result is not a finite decimal` for a non-finite result. The zero-rate arm runs before `.pow`, so a zero rate never reaches the denominator.

In `test/eval/precision.test.ts`, extend `"division, AVG and SQRT are not derivable"`:

```ts
test("division, AVG, SQRT and PMT are not derivable", () => {
  expect(P("four / two")).toBeNull();
  expect(P("AVG(two)")).toBeNull();
  expect(P("SQRT(four)")).toBeNull();
  expect(P("PMT(two, two, two)")).toBeNull();
  expect(P("ROUND(PMT(two, two, two), 2)")).toBe(2);
});
```

Do not add a `case "PMT"` in `eval/precision.ts`. The `default` arm returns `null`.

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
bun test packages/visimark/test/eval/functions.test.ts packages/visimark/test/eval/precision.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/visimark/src/eval/functions.ts packages/visimark/src/eval/evaluate.ts packages/visimark/test/eval/functions.test.ts packages/visimark/test/eval/precision.test.ts
git commit -m "$(printf 'feat: evaluate PMT\n\n%s' '<trailer>')"
```

`<trailer>` is the session line from `.agents/rules/ai-attribution.md`.

---

### Task 2: document `PMT` in the registry

**Files:**
- Edit: `packages/visimark/src/lang/reference.ts`
- Test: `packages/visimark/test/lang/reference-examples.test.ts` (already data-driven; do not edit it)
- Edit: `packages/visimark/test/lang/reference.test.ts` (the length assertion only)

**Interfaces:**
- Produces: `FUNCTION_DOCS.PMT` with `params.length === 3`, `precision: { from: "declared" }`, no `rounding`, no `prose`, and three examples whose `evaluate()` result equals `is`.
- Consumes: the evaluator from Task 1. `reference-examples.test.ts` builds `example = <expr>` with no anchor and compares `Decimal.toString()`, so `is` is the unrounded value. `100`, `1100` and `0` are the three exact cases. Do not put `888.49` in `is`.

- [ ] **Step 1: Add the `FnDoc` entry**

In `FUNCTION_DOCS`, after `EOMONTH`:

```ts
  PMT: {
    summary: "instalment that repays `pv` to zero over `nper` periods at per-period rate `rate`",
    params: [
      { name: "rate", type: "number", note: "the rate for one period; must be greater than -1" },
      { name: "nper", type: "number", note: "a positive whole number of periods" },
      { name: "pv", type: "number", note: "the present amount repaid down to zero" },
    ],
    returns: "number",
    precision: { from: "declared" },
    errors: [
      { when: "a non-numeric `rate`, `nper`, or `pv`", code: "TYPE" },
      { when: "a non-positive or non-whole `nper`", code: "TYPE" },
      { when: "a `rate` of -1 or below", code: "TYPE" },
    ],
    examples: [
      { expr: "PMT(0, 12, 1200)", is: "100" },
      { expr: "PMT(0.10, 1, 1000)", is: "1100" },
      { expr: "PMT(0, 4, 0)", is: "0" },
    ],
  },
```

`summary` does not repeat the error clauses. `scripts/gen-function-reference.ts` appends each `when` as `is a TYPE error`.

- [ ] **Step 2: Expect fourteen names**

In `packages/visimark/test/lang/reference.test.ts`, rename `functionNames lists all thirteen` to `functionNames lists all fourteen` and expect `14`. That assertion is the registry's own count. The prose that still says "thirteen" is Task 5.

- [ ] **Step 3: Run the registry tests**

```bash
bun test packages/visimark/test/lang/reference-examples.test.ts packages/visimark/test/lang/reference.test.ts
```

Expected: PASS, including the three `PMT:` example tests and `functionNames lists all fourteen`.

If `every documented precision rule is the rule the engine applies` fails for `PMT`, the `default` arm in `derivePrecision` is no longer returning `null` for an unknown call. Fix that arm so `PMT` stays `null`. Do not give `PMT` an operand-derived width.

- [ ] **Step 4: Commit**

```bash
git add packages/visimark/src/lang/reference.ts packages/visimark/test/lang/reference.test.ts
git commit -m "$(printf 'docs: registry entry for PMT\n\n%s' '<trailer>')"
```

---

### Task 3: written results, a bad row, and a missing width

**Files:**
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: `run` already defined in that file as `check(build(locate(src)))`. Findings carry `code`, `message`, `raw`, `rowLabel`, `name`.
- Produces: nothing later tasks import. The assertions are the spec's check-level acceptance.

- [ ] **Step 1: Add the tests (RED until Task 1 is present; on this branch they should already be green once written — still write them before treating the task as done)**

Append to `test/eval/check.test.ts`:

```ts
test("an anchored PMT at precision 2 matches 888.49", () => {
  const src = `Instalment **888.49**<!--vmark=s.instalment-->.

\`\`\`vmark #s
instalment precision 2 = PMT(0.01, 12, 10000)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("an anchored PMT with no declared width is PRECISION", () => {
  const src = `Instalment **888.49**<!--vmark=s.instalment-->.

\`\`\`vmark #s
instalment = PMT(0.01, 12, 10000)
\`\`\`
`;
  const p = run(src).findings.find((f) => f.code === "PRECISION");
  expect(p?.raw).toBe("PMT(0.01, 12, 10000)");
  expect(p?.message).toBeUndefined();
});

test("ROUND(PMT(...), 2) needs no precision clause", () => {
  const src = `Instalment **888.49**<!--vmark=s.shown-->.

\`\`\`vmark #s
shown = ROUND(PMT(0.01, 12, 10000), 2)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("one bad term is a TYPE on that row and the other row still verifies", () => {
  const src = `
| Loan | Rate | Term | Principal | Instalment |
|------|-----:|-----:|----------:|-----------:|
| ok   | 0.01 |   12 |  10000.00 |     888.49 |
| bad  | 0.01 |   -1 |  10000.00 |       0.00 |

\`\`\`vmark #loans
Instalment precision 2 = PMT(Rate, Term, Principal)
\`\`\`
`;
  const r = run(src);
  const types = r.findings.filter((f) => f.code === "TYPE");
  expect(types).toHaveLength(1);
  expect(types[0]!.rowLabel).toBe("bad");
  expect(types[0]!.message).toBe("PMT expects a positive whole number of periods");
  expect(r.findings.some((f) => f.code === "NOTE" || f.code === "STALE")).toBe(false);
});

test("PMT() with two arguments is one static TYPE", () => {
  const src = `
\`\`\`vmark #s
instalment precision 2 = PMT(0.01, 12)
\`\`\`
`;
  const t = run(src).findings.find((f) => f.code === "TYPE");
  expect(t?.message).toBe("PMT() takes 3 arguments, got 2");
});
```

- [ ] **Step 2: Run the tests**

```bash
bun test packages/visimark/test/eval/check.test.ts
```

Expected: the five new tests PASS. The clean invoice and drift tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/visimark/test/eval/check.test.ts
git commit -m "$(printf 'test: PMT write precision and a bad row\n\n%s' '<trailer>')"
```

---

### Task 4: the brake-press quote as a fixture

**Files:**
- Create: `packages/visimark/test/fixtures/pmt-press.md`
- Create: `packages/visimark/test/cli/pmt.test.ts`

**Interfaces:**
- Consumes: `runCli` and the `capture()` shape from `test/cli/cli.test.ts`. `eval --get` prints the rounded stored decimal, so `press.instalment` is `1460.25` and `press.monthly_rate` is `0.005`.
- Produces: a document `check` accepts with exit 0.

- [ ] **Step 1: Write the fixture, byte for byte the quote in spec §1**

`packages/visimark/test/fixtures/pmt-press.md`:

```markdown
# Brake press, financed

The quote is for one press at **48000.00**<!--vmark=press.price--> PLN.
The financing rate is **6%**<!--vmark=press.annual%--> a year, paid monthly
over **36**<!--vmark=press.term--> months. The instalment is
**1460.25**<!--vmark=press.instalment--> PLN.

| Item        | Amount   |
|-------------|---------:|
| Brake press | 48000.00 |

```vmark #press
param price  precision 2 = default 48000.00
param annual precision 2 = default 6%
param term   precision 0 = default 36

monthly_rate precision 3 = annual / 12
instalment   precision 2 = PMT(monthly_rate, term, price)
```
```

- [ ] **Step 2: Write the CLI test**

`packages/visimark/test/cli/pmt.test.ts`:

```ts
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const fixture = fileURLToPath(new URL("../fixtures/pmt-press.md", import.meta.url));

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the brake-press quote exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe(`${fixture}\n\n0 problems (0 stale, 0 errors)`);
});

test("eval --get prints the instalment and the monthly rate", async () => {
  const instalment = capture();
  expect(await runCli(["eval", fixture, "--get", "press.instalment"], instalment.io)).toBe(0);
  expect(instalment.out()).toBe("1460.25");

  const rate = capture();
  expect(await runCli(["eval", fixture, "--get", "press.monthly_rate"], rate.io)).toBe(0);
  expect(rate.out()).toBe("0.005");
});
```

- [ ] **Step 3: Run it**

```bash
bun test packages/visimark/test/cli/pmt.test.ts
```

Expected: PASS. If `check` exits 1, the report is the bug: a `STALE` anchor means a worked value in the fixture drifted from the spec table; a `PRECISION` means a declaration is missing; a `WARN` means a name in the block is unread.

- [ ] **Step 4: Commit**

```bash
git add packages/visimark/test/fixtures/pmt-press.md packages/visimark/test/cli/pmt.test.ts
git commit -m "$(printf 'test: brake-press quote checks clean\n\n%s' '<trailer>')"
```

---

### Task 5: documentation

**Files:**
- Edit: `packages/visimark/src/lang/reference.ts` is already done; this task regenerates from it
- Edit: `docs/function-reference.md` and the generated table in `docs/visimark-design.md` via `bun run gen:docs`
- Edit: `docs/visimark-design.md` (the hand-written count, not the generated table)
- Edit: `docs/vocabulary-catalogue.md`
- Edit: `CHANGELOG.md`
- Edit: `editors/vscode/CHANGELOG.md`
- Edit: `skills/visimark/SKILL.md`
- Edit: `docs/cli-reference.md`
- Edit: `README.md`
- Edit: `docs/tutorial.md`
- Edit: `CONTRIBUTING.md`
- Edit: `docs/issue-runbook.md` only if it still says the builtin count is thirteen

**Interfaces:**
- Consumes: the `FnDoc` from Task 2. `bun run gen:docs` rewrites `docs/function-reference.md` and the marked table in `docs/visimark-design.md`.
- Produces: the catalogue row leaves section A and sits in the Shipped register as `UNRELEASED`. Issue #156 stays open.

Do not edit historical text that records an older count: `CHANGELOG.md` entries under `## 0.1.x`, `docs/reviews/`, `docs/design/*-spec.md`, `docs/design/*-plan.md`, `docs/vocab/sqrt-plan.md`, `docs/vocab/ceiling-plan.md`. Those are the record of the release they describe.

- [ ] **Step 1: Regenerate the reference**

```bash
bun run gen:docs
```

Confirm the design-doc table gained a `PMT(rate, nper, pv)` row whose Precision cell is `**must be declared**`, and `docs/function-reference.md` has a `### PMT(rate, nper, pv)` section with the three examples.

- [ ] **Step 2: Hand-written count**

In `docs/visimark-design.md`, the sentence above the generated table: `Thirteen, chosen to cover…` becomes `Fourteen, chosen to cover…`, and the parenthetical gains `` `PMT`, issue #156 ``.

In the same file, [§14](../visimark-design.md#14-deferred): `A function library beyond the thirteen` becomes `beyond the fourteen`.

The same thirteen → fourteen replacement, and only where the sentence is "how many builtins exist today":

- `docs/vocabulary-catalogue.md` opening sentence (`**thirteen functions` → `**fourteen functions`)
- `docs/cli-reference.md` (`lists all thirteen`)
- `README.md` (`lists all thirteen`)
- `skills/visimark/SKILL.md` (`lists all thirteen`)
- `docs/tutorial.md` (the three live sentences: "thirteen functions", "lists all thirteen", "the thirteen builtins")
- `CONTRIBUTING.md` (`**thirteen functions`)
- `docs/issue-runbook.md`, if a search still finds the count

In `skills/visimark/SKILL.md`, add `PMT` beside division, `AVG` and `SQRT` in both places that name the operations whose width must be declared (the authoring bullet and the "Rules that bite" row). The red-flag line that says the same thing gets `PMT` too.

- [ ] **Step 3: Move the catalogue row**

Delete the section A row for `` `PMT(rate, nper, pv)` ``.

Insert this row at the top of the Shipped register body:

```markdown
| `PMT(rate, nper, pv)` | mapper | [#156](https://github.com/michal-niedzwiedzki/visimark/issues/156) | [#161](https://github.com/michal-niedzwiedzki/visimark/pull/161) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/156#issuecomment-5781382455) |
```

`Released` stays `—`. Do not mark it `SHIPPED` and do not close issue #156.

- [ ] **Step 4: Changelogs**

Under `CHANGELOG.md` `## Unreleased` → `### Added`, above the pre-commit bullet:

```markdown
- **`PMT(rate, nper, pv)`** — the fourteenth builtin (issue #156). The instalment
  that repays a present amount over a positive whole number of periods at a
  per-period rate, paid at the end of each period. A zero rate is `pv / nper`.
  A written result declares its width, as division does. A non-positive or
  non-whole term, or a rate of -1 or below, is `TYPE`.
  See [`pmt-spec.md`](docs/vocab/pmt-spec.md).
```

Under `editors/vscode/CHANGELOG.md` `## Unreleased`:

```markdown
- The engine now recognises `PMT(rate, nper, pv)`. A call that used to be
  reported as an unknown function is evaluated, and a missing width on a
  written result is the existing `PRECISION` diagnostic.
```

- [ ] **Step 5: Full local check**

From the repo root:

```bash
bun test
bun run typecheck
bun run build
bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md docs/example-invoice-drift.md
```

Expected: all green. `check` on the two invoices exits 0. Do not use `bunx visimark`.

- [ ] **Step 6: Commit**

```bash
git add docs/function-reference.md docs/visimark-design.md docs/vocabulary-catalogue.md CHANGELOG.md editors/vscode/CHANGELOG.md skills/visimark/SKILL.md docs/cli-reference.md README.md docs/tutorial.md CONTRIBUTING.md docs/issue-runbook.md
git commit -m "$(printf 'docs: PMT is the fourteenth builtin\n\n%s' '<trailer>')"
```

Omit `docs/issue-runbook.md` from `git add` if Step 2 did not change it.

---

## Self-review

Spec §3 worked values are either an exact `FnDoc` example (Task 2) or a `toString` / write-form assertion (Tasks 1, 3, 4). Spec §4 messages and the check order are the tests in Task 1. The unanchored-scalar rule and the `ROUND` wrapper are Task 3. The quote is Task 4. Non-goals (future value, type flag, sign flip, `NPV`, `IRR`, a new finding code) have no task. The generated table, the catalogue move, both changelogs and the live "thirteen" sentences are Task 5.
