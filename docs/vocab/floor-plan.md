# FLOOR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `FLOOR(number, significance)` — the twelfth builtin, map-shaped, `number → number` — rounding `number` down to the nearest multiple of a positive `significance` toward −∞, per `docs/vocab/floor-spec.md`.

**Architecture:** `FLOOR` is a three-call numeric map on the existing decimal core: `x.div(s).floor().times(s)` (`Decimal.prototype.floor` is `ROUND_FLOOR`, toward −∞), guarded by an explicit `!s.isPositive()` check, added directly to the `evalCall` map `switch` in `eval/evaluate.ts` — no new module. It is registered in the single builtin table (`eval/functions.ts`) as `{ kind: "map", arity: 2 }`, which the dependency walk, the static arity check and the did-you-mean suggestion all read from automatically. No parser, model, write, LSP, infer, or trailing-NOTE change.

**Tech Stack:** TypeScript; `decimal.js` (already the numeric core); Bun test runner; the engine package `packages/visimark`.

**Spec:** `docs/vocab/floor-spec.md`

## Global Constraints

- No new npm dependencies.
- No change to `lang/`, `parse/`, `model/`, `write/`, `infer/`, or `packages/visimark-lsp` — the parser is function-agnostic (builds a call node for any name), completion/hover carry no builtin list, and `infer` never proposes named functions.
- No new [§10](../visimark-design.md#10-error-taxonomy) error code — every `FLOOR` failure is `TYPE`. Do not invent `DIV0`. Do not follow `/ 0` leaking `Infinity`.
- No 1-argument `FLOOR(x)` and no function overloading. Arity is exactly 2. Integer floor is spelled `FLOOR(x, 1)`.
- `CEILING` is #54 — do not add it.
- Error message strings, verbatim: non-number operand → `FLOOR expects a number`; non-positive `significance` → `FLOOR significance must be a positive number`.
- Reporting granularity: a row-varying bad `significance` is one `TYPE` finding **on that row**; a scalar binding is one finding on the binding; a static arity error is one finding on the call, not one per row. A row-invariant bad operand in a column rule emitting N identical findings is an accepted, pre-existing property shared with `SQRT(-1)` over N rows — do **not** add row-variance analysis here.
- Work on branch `vocab/issue-53-floor-impl` (the spec PR #56); do not open a new PR.
- Acceptance additions are unit tests + one test-only fixture (`packages/visimark/test/fixtures/`). `docs/example-invoice.md`, `docs/example-invoice-drift.md` and `docs/example-charts.md` stay byte-for-byte identical and the [§13](../visimark-design.md#13-testing) transcript does not move.
- `docs/example-executable-documentation.md` is rewritten only at the four `FLOOR` call sites (`FLOOR(…, 1)`); it is **not** made check-clean.
- Every commit ends with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: register `FLOOR` and evaluate it

**Files:**
- Edit: `packages/visimark/src/eval/functions.ts`
- Edit: `packages/visimark/src/eval/evaluate.ts`
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Produces: `FLOOR` resolvable from `FUNCTIONS` as `{ kind: "map", arity: 2 }`; `callProblem("FLOOR", args)` returns `{ kind: "arity" }` for 0, 1 or 3 args and `null` for 2; `evalExpr` of a `FLOOR(x, s)` call node returns a `num` `Value` or throws `EvalError`.
- Consumes: existing `asNum` helper and `num` constructor in `evaluate.ts`; `Decimal` already imported there from `decimal.js`.

- [ ] **Step 1: Update the builtin-list test to expect `FLOOR` (RED)**

In `test/eval/functions.test.ts`, the test `"every builtin declares a kind and an arity"` asserts the full sorted key list. Add `"FLOOR"` in sorted position (between `EOMONTH` and `IF`):
```ts
  expect([...FUNCTIONS.keys()].sort()).toEqual([
    "ABS",
    "AVG",
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

- [ ] **Step 2: Add the `FLOOR` behaviour tests (RED)**

Append to `test/eval/functions.test.ts`, after the `SQRT` block (after the `"SQRT misspelled gets a did-you-mean"` test). This file tests **only through snippets** (`run(src)` then inspect findings) — it never calls `evalExpr` directly. Exact values are asserted the way the `SQRT` tests do it: an anchor holding the expected literal plus zero findings means the computed value matched. Use the existing `run` / `withColumnRule` / `withScalar` / `typeFindings` helpers.
```ts
// ---- FLOOR ----------------------------------------------------------

test("FLOOR is a map of arity 2", () => {
  expect(FUNCTIONS.get("FLOOR")).toEqual({ kind: "map", arity: 2 });
  expect(isReduce("FLOOR")).toBe(false);
  expect(callProblem("FLOOR", [{ type: "num" }, { type: "num" }])).toBeNull();
  expect(callProblem("FLOOR", [])).toEqual({ kind: "arity", expected: 2, got: 0 });
  expect(callProblem("FLOOR", [{ type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 1,
  });
  expect(callProblem("FLOOR", [{ type: "num" }, { type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 3,
  });
});

test("FLOOR computes toward negative infinity (anchor-verified)", () => {
  const src = `
Floors: **15**<!--vmark=r.a-->, **-15**<!--vmark=r.b-->, **15**<!--vmark=r.c-->,
**0**<!--vmark=r.d-->, **2**<!--vmark=r.e-->, **-3**<!--vmark=r.f-->,
**1.2**<!--vmark=r.g-->, **0.3**<!--vmark=r.h-->, **48**<!--vmark=r.i-->,
**5**<!--vmark=r.j-->, **-1**<!--vmark=r.k-->.

\`\`\`vmark #r
a = FLOOR(17, 5)
b = FLOOR(-12, 5)
c = FLOOR(15, 5)
d = FLOOR(0, 5)
e = FLOOR(2.5, 1)
f = FLOOR(-2.5, 1)
g = FLOOR(1.23, 0.1)
h = FLOOR(0.3, 0.1)
i = FLOOR(12000 / 250, 1)
j = FLOOR(5.0001, 5)
k = FLOOR(-0.0001, 1)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("FLOOR of a non-number is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('FLOOR("x", 1)')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR expects a number");
});

test("FLOOR of a date is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("FLOOR(2026-01-01, 1)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR expects a number");
});

test("FLOOR with a non-number significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('FLOOR(17, "x")')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR expects a number");
});

test("FLOOR with zero significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("FLOOR(17, 0)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR significance must be a positive number");
});

test("FLOOR with negative significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("FLOOR(17, -5)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR significance must be a positive number");
});

test("FLOOR with one argument is a TYPE arity error", () => {
  const r = run(withColumnRule("FLOOR(Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("FLOOR() takes 2 arguments, got 1");
  expect(ts[0]!.rowLabel).toBeUndefined();
});

test("FLOOR misspelled gets a did-you-mean", () => {
  const r = run(withScalar("FLOR(Price, 1)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("unknown function `FLOR`");
  expect(ts[0]!.suggestion).toBe("FLOOR");
});
```
`FLOR` → `FLOOR` is edit distance 1, inside `MAX_FN_SUGGESTION_DISTANCE` (2). `withColumnRule` is a two-row table, so the arity test also proves the static finding is once, not once per row. The 11-anchor snippet covers every worked value in spec §3 except the two `TYPE` rows, which the tests below it cover.

- [ ] **Step 3: Run the tests, verify they fail**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: FAIL — `FUNCTIONS.get("FLOOR")` is `undefined`; the key-list assertion fails; `FLOOR(...)` snippets report `unknown function \`FLOOR\`` (and the misspelled-`FLOR` test gets no suggestion, since `FLOOR` is not yet a known name).

- [ ] **Step 4: Register `FLOOR` (GREEN, part 1)**

In `src/eval/functions.ts`, in the `FUNCTIONS` map, in the `// maps` group after `["SQRT", { kind: "map", arity: 1 }]`:
```ts
  ["FLOOR", { kind: "map", arity: 2 }],
```
Nothing else in that file changes — `closest(call.name, FUNCTIONS.keys(), MAX_FN_SUGGESTION_DISTANCE)` in `check.ts` picks `FLOOR` up for did-you-mean automatically.

- [ ] **Step 5: Evaluate `FLOOR` (GREEN, part 2)**

In `src/eval/evaluate.ts`, in `evalCall`'s map `switch`, after the `case "SQRT":` block and before `case "IF":`:
```ts
    case "FLOOR": {
      const x = asNum(vals[0]!, "FLOOR");
      const s = asNum(vals[1]!, "FLOOR");
      if (!s.isPositive()) {
        throw new EvalError("FLOOR significance must be a positive number");
      }
      const r = x.div(s).floor().times(s);
      return num(r.isZero() ? new Decimal(0) : r);
    }
```
`asNum` already throws `EvalError("FLOOR expects a number")` for a non-number operand — that gives both non-number messages for free (`ROUND` does not distinguish its two operands either). `!s.isPositive()` rejects zero, negative, and signed zero in one test; do **not** take `|s|`. `.floor()` is `ROUND_FLOOR` (toward −∞). Normalise a signed-zero result to `0`, matching `roundToPlaces`. `Decimal` is already imported at the top of this file. The guard must run **before** `.div(s)` so `significance = 0` is a `TYPE` error rather than `Infinity`.

- [ ] **Step 6: Run the tests, verify they pass**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/visimark/src/eval/functions.ts packages/visimark/src/eval/evaluate.ts packages/visimark/test/eval/functions.test.ts
git commit -m "$(printf 'feat: FLOOR(number, significance) builtin — map arity 2, toward -inf\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 2: check-level reporting

**Files:**
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: Task 1's `FLOOR`.
- Produces: proof that a row-varying zero `significance` is one `TYPE` on that row and no `NOTE`; a 1-arg call in a column rule is one static `TYPE`; a clean scalar `FLOOR(17, 5)` verifies.

- [ ] **Step 1: Add the check-level tests (RED, then GREEN — behaviour already implemented)**

In `test/eval/check.test.ts`, after the SQRT block (after `"SQRT: a negative scalar operand is one TYPE finding on the binding"`), add:
```ts
test("FLOOR: a clean scalar verifies", () => {
  const src = `
n is **15**<!--vmark=s.n-->.

\`\`\`vmark #s
n = FLOOR(17, 5)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("FLOOR: one zero-significance row is a single TYPE finding, no NOTE", () => {
  const src = `
| Item | Amount | Step | Bucket |
|------|-------:|-----:|-------:|
| a    |     17 |    5 |     15 |
| b    |     17 |    0 |      0 |
| c    |     12 |    5 |     10 |

\`\`\`vmark #t
Bucket = FLOOR(Amount, Step)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code).sort()).toEqual(["TYPE"]);
  expect(r.findings.find((f) => f.code === "TYPE")).toMatchObject({
    name: "Bucket",
    rowLabel: "b",
    message: "FLOOR significance must be a positive number",
  });
});

test("FLOOR: a 1-arg call in a column rule is one static TYPE, not one per row", () => {
  const src = `
| Leg | Qty |   Km |
|-----|----:|-----:|
| a   |  10 | 0.00 |
| b   |   4 | 0.00 |

\`\`\`vmark #legs
Km = FLOOR(Qty)
\`\`\`
`;
  const r = run(src);
  const ts = r.findings.filter((f) => f.code === "TYPE");
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("FLOOR() takes 2 arguments, got 1");
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
git commit -m "$(printf 'test: FLOOR check-level reporting — per-row TYPE, static arity once\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 3: end-to-end fixture and CLI check

**Files:**
- Create: `packages/visimark/test/fixtures/floor-nodes.md`
- Create: `packages/visimark/test/cli/floor.test.ts`

**Interfaces:**
- Consumes: the whole pipeline from Tasks 1–2.
- Produces: proof that `visimark check` is clean and `visimark eval --get kubernetes.MaxNodes` prints `48` for the motivating arithmetic.

- [ ] **Step 1: Create the fixture**

`packages/visimark/test/fixtures/floor-nodes.md` — the kubernetes capacity arithmetic as a standalone check-clean document. Integer write precision on the node/CPU/memory scalars (anchors have no decimal point). Cross-sheet refs are qualified. Both sheets are scalar-only (no table), which is legal.
```markdown
# Kubernetes worker-node capacity

Worker-node budget **12000**<!--vmark=budget.WorkerBudget--> USD/month.
Each worker costs **250**<!--vmark=budget.WorkerNodeMonthlyCost-->.

```vmark #budget
WorkerBudget = 12000
WorkerNodeMonthlyCost = 250
ReservedCapacity = 20%
CPUPerWorker = 8
MemoryPerWorker = 32
```

```vmark #kubernetes
MaxNodes = FLOOR(budget.WorkerBudget / budget.WorkerNodeMonthlyCost, 1)
TotalCPU = MaxNodes * budget.CPUPerWorker
UsableCPU = FLOOR(TotalCPU * (1 - budget.ReservedCapacity), 1)
TotalMemory = MaxNodes * budget.MemoryPerWorker
UsableMemory = FLOOR(TotalMemory * (1 - budget.ReservedCapacity), 1)
```

Maximum worker nodes: **48**<!--vmark=kubernetes.MaxNodes-->

Total CPU: **384**<!--vmark=kubernetes.TotalCPU-->
Usable CPU after 20% headroom: **307**<!--vmark=kubernetes.UsableCPU-->

Total memory: **1536**<!--vmark=kubernetes.TotalMemory-->
Usable memory after 20% headroom: **1228**<!--vmark=kubernetes.UsableMemory-->
```
Worked values: `FLOOR(12000 / 250, 1) = 48`; `FLOOR(48 * 8 * 0.8, 1) = FLOOR(307.2, 1) = 307`; `FLOOR(48 * 32 * 0.8, 1) = FLOOR(1228.8, 1) = 1228`. If `check` is not clean, fix the literals, never the formulas.

- [ ] **Step 2: Create the CLI test**

`packages/visimark/test/cli/floor.test.ts` — mirror `test/cli/sqrt.test.ts` exactly (same `capture()` helper, same imports):
```ts
import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "fixtures", "floor-nodes.md");

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the FLOOR kubernetes-capacity fixture exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("eval --get resolves MaxNodes", async () => {
  const c = capture();
  const code = await runCli(["eval", fixture, "--get", "kubernetes.MaxNodes"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe("48");
});

test("eval --get resolves UsableCPU", async () => {
  const c = capture();
  const code = await runCli(["eval", fixture, "--get", "kubernetes.UsableCPU"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe("307");
});
```
`eval` prints the raw decimal for scripts (`48`, not `48.00`); the integer write form is exercised by the clean `check` above (the anchors are non-stale).

- [ ] **Step 3: Run the test**

Run: `bun test packages/visimark/test/cli/floor.test.ts`
Expected: PASS. If `check` reports `STALE` on an anchor, correct that literal in the fixture and re-run. If it reports `WARN` on an unread scalar, that scalar is unused — either anchor it or delete it; do not leave a WARN in a fixture the spec requires to be `0 problems`.

- [ ] **Step 4: Commit**

```bash
git add packages/visimark/test/fixtures/floor-nodes.md packages/visimark/test/cli/floor.test.ts
git commit -m "$(printf 'test: end-to-end FLOOR fixture — kubernetes node capacity\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 4: documentation

**Files:**
- Edit: `docs/visimark-design.md` ([§4](../visimark-design.md#4-syntax) builtin table + the "Eleven, chosen…" sentence; [§14](../visimark-design.md#14-deferred) "beyond the eleven")
- Edit: `docs/vocabulary-catalogue.md` (line 3 count; the `FLOOR` row **moved** from section A into the Shipped register as `UNRELEASED`)
- Edit: `docs/issue-review.md` (the "eleven builtins" phrase)
- Edit: `docs/example-executable-documentation.md` (four `FLOOR` call sites only)
- Edit: `docs/cli-reference.md` (only if it enumerates builtins — it does not today; grep to confirm)
- Edit: `CHANGELOG.md` (`## Unreleased` → `### Added`)
- Edit: `editors/vscode/CHANGELOG.md` (`## Unreleased`)

**Interfaces:**
- Consumes: shipped behaviour from Tasks 1–3.
- Produces: the design doc describes twelve builtins; the catalogue row is `UNRELEASED` in the Shipped register linking this PR; a `## Unreleased` changelog line so a release cut from `master` ships an accurate note. Issue #53 stays open — `releasing.md` / `release.yml` close it and promote the row to `SHIPPED` on the next tag.

- [ ] **Step 1: [§4](../visimark-design.md#4-syntax) builtin table** — in `docs/visimark-design.md`, add a row after the `SQRT` row:
```
| `FLOOR(x, s)` | map | 2 | greatest multiple of positive `s` that does not exceed `x`, toward −∞; a non-positive `s` is a `TYPE` error |
```
and change the section's opening `Eleven, chosen to cover the examples and the two catalogued additions a real document needed (`EOMONTH`, issue #6; `SQRT`, issue #18).` → `Twelve, chosen to cover the examples and the catalogued additions a real document needed (`EOMONTH`, issue #6; `SQRT`, issue #18; `FLOOR`, issue #53).` Re-read the sentence so it still parses.

- [ ] **Step 2: [§14](../visimark-design.md#14-deferred)** — `docs/visimark-design.md` currently reads `A function library beyond the eleven —`. Change `eleven` → `twelve`.

- [ ] **Step 3: catalogue count** — `docs/vocabulary-catalogue.md` line 3: `The language ships **eleven functions and a fixed operator set**` → `**twelve functions and a fixed operator set**`.

- [ ] **Step 4: catalogue row → Shipped register as `UNRELEASED`** — in `docs/vocabulary-catalogue.md` [§A](../vocabulary-catalogue.md#a-mappers-scalar--scalar), **delete** the `FLOOR(number, significance)` row (leave the `CEILING(x, mult)` seed row in place, still `DEFERRED`, still pointing at #53 for the split). Add a condensed row to the [Shipped](../vocabulary-catalogue.md#shipped) table, after the `Σ` / `∑` row:
```
| `FLOOR(number, significance)` | mapper | [#53](https://github.com/michal-niedzwiedzki/visimark/issues/53) | [#56](https://github.com/michal-niedzwiedzki/visimark/pull/56) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/53#issuecomment-5598663415) |
```
Do **not** set Status to `SHIPPED`. Do **not** close issue #53.

- [ ] **Step 5: runbook phrasing** — `docs/issue-review.md` line ~96: `overlap with the eleven builtins` → `overlap with the twelve builtins`.

- [ ] **Step 6: `docs/example-executable-documentation.md`** — rewrite only the four `FLOOR` call sites to arity 2. Do not retitle headers, do not fix name matching, do not make the file check-clean. The `#kubernetes` block becomes:
```
```vmark #kubernetes
MaxNodes = FLOOR(WorkerBudget / WorkerNodeMonthlyCost, 1)

UsableNodes = FLOOR(MaxNodes * (1 - ReservedCapacity), 1)

TotalCPU = MaxNodes * CPUPerWorker
UsableCPU = FLOOR(TotalCPU * (1 - ReservedCapacity), 1)

TotalMemory = MaxNodes * MemoryPerWorker
UsableMemory = FLOOR(TotalMemory * (1 - ReservedCapacity), 1)
```
```

- [ ] **Step 7: `cli-reference.md`** — `grep -n "ABS\\|SUM\\|builtin\\|EOMONTH\\|SQRT\\|FLOOR" docs/cli-reference.md`. Today it names no builtin list, only a `TYPE` example ("calling a function wrongly"). If that is still all, make no change; if a list has appeared, add `FLOOR`.

- [ ] **Step 8: `CHANGELOG.md`** — under `## Unreleased` → `### Added`, a new bullet at the top of the list (keep `### Added` grouped):
```markdown
- **`FLOOR(number, significance)`** — the twelfth builtin (issue #53). A map,
  `number → number`, rounding `number` down to the nearest multiple of a
  positive `significance` toward negative infinity: `FLOOR(17, 5) → 15`,
  `FLOOR(-12, 5) → -15`. `significance` is mandatory — `FLOOR(x)` is a `TYPE`
  arity error, the same as `ROUND(x)` — so integer floor is spelled
  `FLOOR(x, 1)`. Zero and negative `significance` are `TYPE`. Function
  overloading is not decided. `CEILING` is a separate request (#54).
```

- [ ] **Step 9: `editors/vscode/CHANGELOG.md`** — under the existing `## Unreleased`, add a bullet beside the `SQRT` one:
```markdown
- The engine now recognises `FLOOR(number, significance)` (round down to a
  multiple), so a formula that uses it no longer shows an "unknown function"
  diagnostic.
```

- [ ] **Step 10: Commit**

```bash
git add docs/visimark-design.md docs/vocabulary-catalogue.md docs/issue-review.md docs/example-executable-documentation.md docs/cli-reference.md CHANGELOG.md editors/vscode/CHANGELOG.md
git commit -m "$(printf 'docs: FLOOR is the twelfth builtin — design §4, catalogue UNRELEASED, changelog\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```
If `cli-reference.md` was unchanged, drop it from `git add`.

**Verify (whole task):** `bun test` (whole suite), `bun run typecheck`, `bun run build`; then the branch's own CLI against the protected example docs —
`bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md` (clean),
`bun run packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md` (reproduces its transcript),
`bun run packages/visimark/src/cli/main.ts check docs/example-charts.md` (clean),
and `bun run packages/visimark/src/cli/main.ts fmt docs/example-invoice.md` a no-op (`git diff --exit-code docs/example-invoice.md`).
Do **not** use `bunx visimark` — it runs the published build, not this branch.

---

## Done when

- `bun test`, `bun run typecheck`, `bun run build` all green, including the new functions / check / cli cases.
- `FLOOR(17, 5)` evaluates to `15`, `FLOOR(-12, 5)` to `-15`, `FLOOR(17, 0)` and `FLOOR(17, -5)` are `TYPE` "FLOOR significance must be a positive number", and `FLOOR(Qty)` is `TYPE` "FLOOR() takes 2 arguments, got 1".
- `eval --get kubernetes.MaxNodes` on the fixture prints `48`; `eval --get kubernetes.UsableCPU` prints `307`; `check` on the fixture exits 0.
- `docs/example-invoice.md`, `-drift.md` and `example-charts.md` untouched; the [§13](../visimark-design.md#13-testing) acceptance transcript is byte-identical.
- `docs/example-executable-documentation.md` teaches `FLOOR(…, 1)` at its four call sites.
- `docs/visimark-design.md` [§4](../visimark-design.md#4-syntax) lists twelve builtins; `docs/vocabulary-catalogue.md` shows `FLOOR` as `UNRELEASED` in the Shipped register; `CHANGELOG.md` `## Unreleased` carries the `FLOOR` line.
- PR #56 carries spec + plan + implementation, CI is green, and the PR is promoted out of draft. Issue #53 stays open until the next release tag.
