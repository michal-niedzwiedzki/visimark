# CEILING Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `CEILING(number, significance)` — the thirteenth builtin, map-shaped, `number → number` — rounding `number` up to the nearest multiple of a positive `significance` toward +∞, per `docs/vocab/ceiling-spec.md`.

**Architecture:** `CEILING` is a three-call numeric map on the existing decimal core: `x.div(s).ceil().times(s)` (`Decimal.prototype.ceil` is `ROUND_CEIL`, toward +∞), guarded by the same `!s.gt(0)` check `FLOOR` uses, added directly to the `evalCall` map `switch` in `eval/evaluate.ts` — no new module. It is registered in the single builtin table (`eval/functions.ts`) as `{ kind: "map", arity: 2 }`, which the dependency walk, the static arity check and the did-you-mean suggestion all read from automatically. No parser, model, write, LSP, infer, or trailing-NOTE change. Do **not** implement it as `-FLOOR(-x, s)`.

**Tech Stack:** TypeScript; `decimal.js` (already the numeric core); Bun test runner; the engine package `packages/visimark`.

**Spec:** `docs/vocab/ceiling-spec.md`

## Global Constraints

- No new npm dependencies.
- No change to `lang/`, `parse/`, `model/`, `write/`, `infer/`, or `packages/visimark-lsp` — the parser is function-agnostic (builds a call node for any name), completion/hover carry no builtin list, and `infer` never proposes named functions.
- No new [§10](../visimark-design.md#10-error-taxonomy) error code — every `CEILING` failure is `TYPE`. Do not invent `DIV0`. Do not follow `/ 0` leaking `Infinity`.
- No 1-argument `CEILING(x)` and no function overloading. Arity is exactly 2. Integer ceiling is spelled `CEILING(x, 1)`.
- Do **not** edit `docs/example-executable-documentation.md`. It does not call `CEILING`; this issue does not recruit it.
- Error message strings, verbatim: non-number operand → `CEILING expects a number`; non-positive `significance` → `CEILING significance must be a positive number`.
- Reporting granularity: a row-varying bad `significance` is one `TYPE` finding **on that row**; a scalar binding is one finding on the binding; a static arity error is one finding on the call, not one per row. A row-invariant bad operand in a column rule emitting N identical findings is an accepted, pre-existing property shared with `SQRT(-1)` over N rows — do **not** add row-variance analysis here.
- Work on branch `vocab/issue-54-ceiling-impl` (the spec PR #59); do not open a new PR.
- Acceptance additions are unit tests + one test-only fixture (`packages/visimark/test/fixtures/ceiling-nodes.md`). `docs/example-invoice.md`, `docs/example-invoice-drift.md` and `docs/example-charts.md` stay byte-for-byte identical and the [§13](../visimark-design.md#13-testing) transcript does not move.
- Match shipped `FLOOR` (`eval/evaluate.ts`): guard with `!s.gt(0)`, not `!s.isPositive()`. Do not take `|s|`.
- Every commit ends with the `Co-Authored-By` trailer from `.claude/rules/ai-attribution.md` for this session: `Co-Authored-By: Grok 4.6 <noreply@x.ai>`.

---

### Task 1: register `CEILING` and evaluate it

**Files:**
- Edit: `packages/visimark/src/eval/functions.ts`
- Edit: `packages/visimark/src/eval/evaluate.ts`
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Produces: `CEILING` resolvable from `FUNCTIONS` as `{ kind: "map", arity: 2 }`; `callProblem("CEILING", args)` returns `{ kind: "arity" }` for 0, 1 or 3 args and `null` for 2; `evalExpr` of a `CEILING(x, s)` call node returns a `num` `Value` or throws `EvalError`.
- Consumes: existing `asNum` helper and `num` constructor in `evaluate.ts`; `Decimal` already imported there from `decimal.js`; shipped `FLOOR` for the complementarity anchors.

- [ ] **Step 1: Update the builtin-list test to expect `CEILING` (RED)**

In `test/eval/functions.test.ts`, the test `"every builtin declares a kind and an arity"` asserts the full sorted key list. Add `"CEILING"` in sorted position (between `AVG` and `COUNT`):
```ts
  expect([...FUNCTIONS.keys()].sort()).toEqual([
    "ABS",
    "AVG",
    "CEILING",
    "COUNT",
    "EOMONTH",
    "FLOOR",
    "IF",
    "MAX",
    "MIN",
    "MOD",
    "ROUND",
    "SQRT",
    "SUM",
  ]);
```

- [ ] **Step 2: Add the `CEILING` behaviour tests (RED)**

Append to `test/eval/functions.test.ts`, after the `FLOOR` block (after the `"FLOOR misspelled gets a did-you-mean"` test). This file tests **only through snippets** (`run(src)` then inspect findings) — it never calls `evalExpr` directly. Exact values are asserted the way the `FLOOR` tests do it: an anchor holding the expected literal plus zero findings means the computed value matched. Use the existing `run` / `withColumnRule` / `withScalar` / `typeFindings` helpers.
```ts
// ---- CEILING --------------------------------------------------------

test("CEILING is a map of arity 2", () => {
  expect(FUNCTIONS.get("CEILING")).toEqual({ kind: "map", arity: 2 });
  expect(isReduce("CEILING")).toBe(false);
  expect(callProblem("CEILING", [{ type: "num" }, { type: "num" }])).toBeNull();
  expect(callProblem("CEILING", [])).toEqual({ kind: "arity", expected: 2, got: 0 });
  expect(callProblem("CEILING", [{ type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 1,
  });
  expect(callProblem("CEILING", [{ type: "num" }, { type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 3,
  });
});

test("CEILING computes toward positive infinity (anchor-verified)", () => {
  const src = `
Ceilings: **20**<!--vmark=r.a-->, **-10**<!--vmark=r.b-->, **15**<!--vmark=r.c-->,
**0**<!--vmark=r.d-->, **3**<!--vmark=r.e-->, **-2**<!--vmark=r.f-->,
**1.3**<!--vmark=r.g-->, **0.3**<!--vmark=r.h-->, **48**<!--vmark=r.i-->,
**39**<!--vmark=r.j-->, **10**<!--vmark=r.k-->, **0**<!--vmark=r.l-->,
**20**<!--vmark=r.m-->, **-10**<!--vmark=r.n-->.

\`\`\`vmark #r
a = CEILING(17, 5)
b = CEILING(-12, 5)
c = CEILING(15, 5)
d = CEILING(0, 5)
e = CEILING(2.5, 1)
f = CEILING(-2.5, 1)
g = CEILING(1.23, 0.1)
h = CEILING(0.3, 0.1)
i = CEILING(12000 / 250, 1)
j = CEILING(307 / 8, 1)
k = CEILING(5.0001, 5)
l = CEILING(-0.0001, 1)
m = -FLOOR(-17, 5)
n = -FLOOR(12, 5)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("CEILING of a non-number is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('CEILING("x", 1)')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING expects a number");
});

test("CEILING of a date is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("CEILING(2026-01-01, 1)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING expects a number");
});

test("CEILING with a non-number significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('CEILING(17, "x")')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING expects a number");
});

test("CEILING with zero significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("CEILING(17, 0)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING significance must be a positive number");
});

test("CEILING with negative significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("CEILING(17, -5)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING significance must be a positive number");
});

test("CEILING with one argument is a TYPE arity error", () => {
  const r = run(withColumnRule("CEILING(Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("CEILING() takes 2 arguments, got 1");
  expect(ts[0]!.rowLabel).toBeUndefined();
});

test("CEILING misspelled gets a did-you-mean", () => {
  const r = run(withScalar("CELING(Price, 1)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("unknown function `CELING`");
  expect(ts[0]!.suggestion).toBe("CEILING");
});
```
`CELING` → `CEILING` is edit distance 1, inside `MAX_FN_SUGGESTION_DISTANCE` (2). `withColumnRule` is a two-row table, so the arity test also proves the static finding is once, not once per row. Anchors `a`–`l` cover every worked value in spec §3 except the two `TYPE` rows; `m` and `n` are the complementarity corollary (`CEILING(x, s) == -FLOOR(-x, s)`).

- [ ] **Step 3: Run the tests, verify they fail**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: FAIL — `FUNCTIONS.get("CEILING")` is `undefined`; the key-list assertion fails; `CEILING(...)` snippets report `unknown function \`CEILING\`` (and the misspelled-`CELING` test gets no suggestion, since `CEILING` is not yet a known name).

- [ ] **Step 4: Register `CEILING` (GREEN, part 1)**

In `src/eval/functions.ts`, in the `FUNCTIONS` map, in the `// maps` group after `["FLOOR", { kind: "map", arity: 2 }]`:
```ts
  ["CEILING", { kind: "map", arity: 2 }],
```
Nothing else in that file changes — `closest(call.name, FUNCTIONS.keys(), MAX_FN_SUGGESTION_DISTANCE)` in `check.ts` picks `CEILING` up for did-you-mean automatically.

- [ ] **Step 5: Evaluate `CEILING` (GREEN, part 2)**

In `src/eval/evaluate.ts`, in `evalCall`'s map `switch`, after the `case "FLOOR":` block and before `case "IF":`:
```ts
    case "CEILING": {
      const x = asNum(vals[0]!, "CEILING");
      const s = asNum(vals[1]!, "CEILING");
      if (!s.gt(0)) {
        throw new EvalError("CEILING significance must be a positive number");
      }
      const r = x.div(s).ceil().times(s);
      return num(r.isZero() ? new Decimal(0) : r);
    }
```
`asNum` already throws `EvalError("CEILING expects a number")` for a non-number operand — that gives both non-number messages for free (`FLOOR` / `ROUND` do not distinguish their two operands either). `!s.gt(0)` rejects zero, negative, and signed zero in one test; do **not** take `|s|`. `.ceil()` is `ROUND_CEIL` (toward +∞). Normalise a signed-zero result to `0`, matching `FLOOR` and `roundToPlaces`. `Decimal` is already imported at the top of this file. The guard must run **before** `.div(s)` so `significance = 0` is a `TYPE` error rather than `Infinity`. Do **not** implement this as `-FLOOR(-x, s)`.

- [ ] **Step 6: Run the tests, verify they pass**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/visimark/src/eval/functions.ts packages/visimark/src/eval/evaluate.ts packages/visimark/test/eval/functions.test.ts
git commit -m "$(printf 'feat: CEILING(number, significance) builtin — map arity 2, toward +inf\n\nCo-Authored-By: Grok 4.6 <noreply@x.ai>')"
```

---

### Task 2: check-level reporting

**Files:**
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: Task 1's `CEILING`.
- Produces: proof that a row-varying zero `significance` is one `TYPE` on that row and no `NOTE`; a 1-arg call in a column rule is one static `TYPE`; a clean scalar `CEILING(17, 5)` verifies.

- [ ] **Step 1: Add the check-level tests (RED, then GREEN — behaviour already implemented)**

In `test/eval/check.test.ts`, after the FLOOR block (after `"FLOOR: a 1-arg call in a column rule is one static TYPE, not one per row"`), add:
```ts
test("CEILING: a clean scalar verifies", () => {
  const src = `
n is **20**<!--vmark=s.n-->.

\`\`\`vmark #s
n = CEILING(17, 5)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("CEILING: one zero-significance row is a single TYPE finding, no NOTE", () => {
  const src = `
| Item | Amount | Step | Bucket |
|------|-------:|-----:|-------:|
| a    |     17 |    5 |     20 |
| b    |     17 |    0 |      0 |
| c    |     12 |    5 |     15 |

\`\`\`vmark #t
Bucket = CEILING(Amount, Step)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code).sort()).toEqual(["TYPE"]);
  expect(r.findings.find((f) => f.code === "TYPE")).toMatchObject({
    name: "Bucket",
    rowLabel: "b",
    message: "CEILING significance must be a positive number",
  });
});

test("CEILING: a 1-arg call in a column rule is one static TYPE, not one per row", () => {
  const src = `
| Leg | Qty |   Km |
|-----|----:|-----:|
| a   |  10 | 0.00 |
| b   |   4 | 0.00 |

\`\`\`vmark #legs
Km = CEILING(Qty)
\`\`\`
`;
  const r = run(src);
  const ts = r.findings.filter((f) => f.code === "TYPE");
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("CEILING() takes 2 arguments, got 1");
  expect(ts[0]!.rowLabel).toBeUndefined();
});
```
These should pass on Task 1's implementation: the trailing NOTE already counts only upstream suppression (SQRT's fix), and arity is checked statically once per binding. If the zero-significance row test sees `["NOTE", "TYPE"]`, stop — that is a regression of the SQRT NOTE fix, not something to paper over here.

- [ ] **Step 2: Run the tests**

Run: `bun test packages/visimark/test/eval/check.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/visimark/test/eval/check.test.ts
git commit -m "$(printf 'test: CEILING check-level reporting — per-row TYPE, static arity once\n\nCo-Authored-By: Grok 4.6 <noreply@x.ai>')"
```

---

### Task 3: end-to-end fixture and CLI check

**Files:**
- Create: `packages/visimark/test/fixtures/ceiling-nodes.md`
- Create: `packages/visimark/test/cli/ceiling.test.ts`

**Interfaces:**
- Consumes: the whole pipeline from Tasks 1–2.
- Produces: proof that `visimark check` is clean and `visimark eval --get kubernetes.MinNodes` prints `39` for the inverse kubernetes arithmetic.

- [ ] **Step 1: Create the fixture**

`packages/visimark/test/fixtures/ceiling-nodes.md` — given a CPU demand, how many whole workers are needed. Integer write precision (anchors have no decimal point). Cross-sheet refs are qualified. Both sheets are scalar-only (no table), which is legal.
````markdown
# Kubernetes workers needed

Required CPU **307**<!--vmark=demand.RequiredCPU--> vCPU.
Each worker provides **8**<!--vmark=demand.CPUPerWorker--> vCPU.

```vmark #demand
RequiredCPU = 307
CPUPerWorker = 8
```

```vmark #kubernetes
MinNodes = CEILING(demand.RequiredCPU / demand.CPUPerWorker, 1)
```

Minimum worker nodes: **39**<!--vmark=kubernetes.MinNodes-->
````
Worked value: `CEILING(307 / 8, 1) = CEILING(38.375, 1) = 39`. `FLOOR` of the same quotient is `38`. If `check` is not clean, fix the literals, never the formulas.

- [ ] **Step 2: Create the CLI test**

`packages/visimark/test/cli/ceiling.test.ts` — mirror `test/cli/floor.test.ts` exactly (same `capture()` helper, same imports):
```ts
import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "fixtures", "ceiling-nodes.md");

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the CEILING kubernetes-workers fixture exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("eval --get resolves MinNodes", async () => {
  const c = capture();
  const code = await runCli(["eval", fixture, "--get", "kubernetes.MinNodes"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe("39");
});
```
`eval` prints the raw decimal for scripts (`39`, not `39.00`); the integer write form is exercised by the clean `check` above (the anchors are non-stale).

- [ ] **Step 3: Run the test**

Run: `bun test packages/visimark/test/cli/ceiling.test.ts`
Expected: PASS. If `check` reports `STALE` on an anchor, correct that literal in the fixture and re-run. If it reports `WARN` on an unread scalar, that scalar is unused — either anchor it or delete it; do not leave a WARN in a fixture the spec requires to be `0 problems`.

- [ ] **Step 4: Commit**

```bash
git add packages/visimark/test/fixtures/ceiling-nodes.md packages/visimark/test/cli/ceiling.test.ts
git commit -m "$(printf 'test: end-to-end CEILING fixture — kubernetes workers needed\n\nCo-Authored-By: Grok 4.6 <noreply@x.ai>')"
```

---

### Task 4: documentation

**Files:**
- Edit: `docs/visimark-design.md` ([§4](../visimark-design.md#4-syntax) builtin table + the "Twelve, chosen…" sentence; [§14](../visimark-design.md#14-deferred) "beyond the twelve")
- Edit: `docs/vocabulary-catalogue.md` (line 3 count; both `CEILING` rows in section A **moved/deleted** — the #54 row into the Shipped register as `UNRELEASED`, the seed `CEILING(x, mult)` row deleted)
- Edit: `docs/issue-review.md` (the "twelve builtins" phrase)
- Edit: `docs/cli-reference.md` (only if it enumerates builtins — it does not today; grep to confirm)
- Edit: `CHANGELOG.md` (`## Unreleased` → `### Added`)
- Edit: `editors/vscode/CHANGELOG.md` (`## Unreleased`)
- Do **not** edit `docs/example-executable-documentation.md`

**Interfaces:**
- Consumes: shipped behaviour from Tasks 1–3.
- Produces: the design doc describes thirteen builtins; the catalogue #54 row is `UNRELEASED` in the Shipped register linking this PR; the seed `CEILING(x, mult)` row is gone; a `## Unreleased` changelog line so a release cut from `master` ships an accurate note. Issue #54 stays open — `releasing.md` / `release.yml` close it and promote the row to `SHIPPED` on the next tag.

- [ ] **Step 1: [§4](../visimark-design.md#4-syntax) builtin table** — in `docs/visimark-design.md`, add a row after the `FLOOR` row:
```
| `CEILING(x, s)` | map | 2 | least multiple of positive `s` that is not less than `x`, toward +∞; a non-positive `s` is a `TYPE` error |
```
and change the section's opening `Twelve, chosen to cover the examples and the catalogued additions a real document needed (`EOMONTH`, issue #6; `SQRT`, issue #18; `FLOOR`, issue #53).` → `Thirteen, chosen to cover the examples and the catalogued additions a real document needed (`EOMONTH`, issue #6; `SQRT`, issue #18; `FLOOR`, issue #53; `CEILING`, issue #54).` Re-read the sentence so it still parses.

- [ ] **Step 2: [§14](../visimark-design.md#14-deferred)** — `docs/visimark-design.md` currently reads `A function library beyond the twelve —`. Change `twelve` → `thirteen`.

- [ ] **Step 3: catalogue count** — `docs/vocabulary-catalogue.md` line 3: `The language ships **twelve functions and a fixed operator set**` → `**thirteen functions and a fixed operator set**`.

- [ ] **Step 4: catalogue rows → Shipped register as `UNRELEASED`** — in `docs/vocabulary-catalogue.md` [§A](../vocabulary-catalogue.md#a-mappers-scalar--scalar):
  1. **Delete** the seed `CEILING(x, mult)` row (still `DEFERRED`, Request `—`). It is this primitive.
  2. **Delete** the `CEILING(number, significance)` row (Request `#54`, Status `APPROVED`).
  3. Add a condensed row to the [Shipped](../vocabulary-catalogue.md#shipped) table, after the `FLOOR` row:
```
| `CEILING(number, significance)` | mapper | [#54](https://github.com/michal-niedzwiedzki/visimark/issues/54) | [#59](https://github.com/michal-niedzwiedzki/visimark/pull/59) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/54#issuecomment-5600795875) |
```
Do **not** set Status to `SHIPPED`. Do **not** close issue #54.

- [ ] **Step 5: runbook phrasing** — `docs/issue-review.md` currently: `overlap with the twelve builtins` → `overlap with the thirteen builtins`.

- [ ] **Step 6: `cli-reference.md`** — `grep -n "ABS\\|SUM\\|builtin\\|EOMONTH\\|SQRT\\|FLOOR\\|CEILING" docs/cli-reference.md`. Today it names no builtin list, only a `TYPE` example ("calling a function wrongly"). If that is still all, make no change; if a list has appeared, add `CEILING`.

- [ ] **Step 7: `CHANGELOG.md`** — under `## Unreleased` → `### Added`, a new bullet at the top of the list (keep `### Added` grouped). Also edit the existing `FLOOR` bullet: drop the sentence `CEILING` is a separate request (#54). — that is no longer true once this ships in the same Unreleased section.
```markdown
- **`CEILING(number, significance)`** — the thirteenth builtin (issue #54). A map,
  `number → number`, rounding `number` up to the nearest multiple of a
  positive `significance` toward positive infinity: `CEILING(17, 5) → 20`,
  `CEILING(-12, 5) → -10`. `significance` is mandatory — `CEILING(x)` is a `TYPE`
  arity error, the same as `ROUND(x)` and `FLOOR(x)` — so integer ceiling is
  spelled `CEILING(x, 1)`. Zero and negative `significance` are `TYPE`. Function
  overloading is not decided. Complement of `FLOOR`: `CEILING(x, s) == -FLOOR(-x, s)`.
```

- [ ] **Step 8: `editors/vscode/CHANGELOG.md`** — under the existing `## Unreleased`, add a bullet beside the `FLOOR` one:
```markdown
- The engine now recognises `CEILING(number, significance)` (round up to a
  multiple), so a formula that uses it no longer shows an "unknown function"
  diagnostic.
```

- [ ] **Step 9: Confirm the published example is untouched**

`git diff --exit-code docs/example-executable-documentation.md` must succeed. Do not rewrite `MaxNodes = FLOOR(...)`.

- [ ] **Step 10: Commit**

```bash
git add docs/visimark-design.md docs/vocabulary-catalogue.md docs/issue-review.md docs/cli-reference.md CHANGELOG.md editors/vscode/CHANGELOG.md
git commit -m "$(printf 'docs: CEILING is the thirteenth builtin — design §4, catalogue UNRELEASED, changelog\n\nCo-Authored-By: Grok 4.6 <noreply@x.ai>')"
```
If `cli-reference.md` was unchanged, drop it from `git add`.

**Verify (whole task):** `bun test` (whole suite), `bun run typecheck`, `bun run build`; then the branch's own CLI against the protected example docs —
`bun packages/visimark/src/cli/main.ts check docs/example-invoice.md` (clean),
`bun packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md` (reproduces its transcript),
`bun packages/visimark/src/cli/main.ts check docs/example-charts.md` (clean),
and `bun packages/visimark/src/cli/main.ts fmt docs/example-invoice.md` a no-op (`git diff --exit-code docs/example-invoice.md`).
Do **not** use `bunx visimark` — it runs the published build, not this branch.

---

## Done when

- `bun test`, `bun run typecheck`, `bun run build` all green, including the new functions / check / cli cases.
- `CEILING(17, 5)` evaluates to `20`, `CEILING(-12, 5)` to `-10`, `CEILING(17, 0)` and `CEILING(17, -5)` are `TYPE` "CEILING significance must be a positive number", and `CEILING(Qty)` is `TYPE` "CEILING() takes 2 arguments, got 1".
- `eval --get kubernetes.MinNodes` on the fixture prints `39`; `check` on the fixture exits 0.
- `docs/example-invoice.md`, `-drift.md`, `example-charts.md`, and `docs/example-executable-documentation.md` are untouched; the [§13](../visimark-design.md#13-testing) acceptance transcript is byte-identical.
- `docs/visimark-design.md` [§4](../visimark-design.md#4-syntax) lists thirteen builtins; `docs/vocabulary-catalogue.md` shows `CEILING` as `UNRELEASED` in the Shipped register and no longer has a section-A `CEILING` row; `CHANGELOG.md` `## Unreleased` carries the `CEILING` line.
- PR #59 carries spec + plan + implementation, CI is green, and the PR is promoted out of draft. Issue #54 stays open until the next release tag.
