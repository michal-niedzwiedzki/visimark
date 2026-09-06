# SQRT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `SQRT(x)` — the eleventh builtin, map-shaped, `number → number` — returning the non-negative square root of a non-negative number, per `docs/vocab/sqrt.md`.

**Architecture:** `SQRT` is a one-line numeric map: `Decimal.prototype.sqrt` (correctly-rounded decimal, already the numeric core) guarded by an explicit negative-operand check, added directly to the `evalCall` map `switch` in `eval/evaluate.ts` — no new module, unlike `EOMONTH`. It is registered in the single builtin table (`eval/functions.ts`) as `{ kind: "map", arity: 1 }`, which the dependency walk, the static arity check and the did-you-mean suggestion all read from automatically. Separately, this change narrows one pre-existing wart the spec review surfaced: the trailing `NOTE` after a column rule (`eval/check.ts`) currently counts rows that raised their *own* error as well as rows suppressed by an upstream dependency failure; it is scoped to upstream suppression only. No parser, model, write, LSP or infer change.

**Tech Stack:** TypeScript; `decimal.js` (already the numeric core); Bun test runner; the engine package `packages/visimark`.

**Spec:** `docs/vocab/sqrt.md`

## Global Constraints

- No new npm dependencies.
- No change to `lang/`, `parse/`, `model/`, `write/`, `infer/`, or `packages/visimark-lsp` — the parser is function-agnostic (builds a call node for any name), completion/hover carry no builtin list, and `infer` never proposes named functions.
- No new `§10` error code — every `SQRT` failure is `TYPE`. `SQRT` does not touch `EvalError.code` or `DateError`.
- Rounding / precision is untouched — the irrational result is rounded at its binding by the existing rule, exactly like `Net / SUM(Net)`.
- Error message strings, verbatim: non-number operand → `SQRT expects a number`; negative operand → `SQRT of a negative number`.
- Reporting granularity: a row-varying negative operand is one `TYPE` finding **on that row**; a scalar binding is one finding on the binding. A row-invariant negative operand in a column rule emitting N identical findings is an accepted, pre-existing property shared with `EOMONTH(Start, 1.5)` — do **not** add row-variance analysis here.
- Work on branch `vocab/issue-18-sqrt-impl` (the spec PR #20); do not open a new PR.
- Acceptance additions are unit tests + one test-only fixture (`packages/visimark/test/fixtures/`). `docs/example-invoice.md` and `docs/example-invoice-drift.md` stay byte-for-byte identical and the §13 transcript does not move.
- Every commit ends with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: register `SQRT` and evaluate it

**Files:**
- Edit: `packages/visimark/src/eval/functions.ts`
- Edit: `packages/visimark/src/eval/evaluate.ts`
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Produces: `SQRT` resolvable from `FUNCTIONS` as `{ kind: "map", arity: 1 }`; `callProblem("SQRT", args)` returns `{ kind: "arity" }` for 0 or 2 args and `null` for 1; `evalExpr` of a `SQRT(x)` call node returns a `num` `Value` or throws `EvalError`.
- Consumes: existing `asNum` helper and `num` constructor in `evaluate.ts`; `Decimal` from `decimal.js`.

- [ ] **Step 1: Update the builtin-list test to expect `SQRT` (RED)**

In `test/eval/functions.test.ts`, the test `"every builtin declares a kind and an arity"` asserts the full sorted key list. Add `"SQRT"` in sorted position:
```ts
  expect([...FUNCTIONS.keys()].sort()).toEqual([
    "ABS",
    "AVG",
    "COUNT",
    "EOMONTH",
    "IF",
    "MAX",
    "MIN",
    "MOD",
    "ROUND",
    "SQRT",
    "SUM",
  ]);
```

- [ ] **Step 2: Add the `SQRT` behaviour tests (RED)**

Append to `test/eval/functions.test.ts`, after the `EOMONTH` block. This file tests **only through snippets** (`run(src)` then inspect findings) — it never calls `evalExpr` directly. Exact values are asserted the way the `EOMONTH` tests do it: an anchor holding the expected literal plus zero findings means the computed value matched. Use the existing `run` / `withColumnRule` / `withScalar` / `typeFindings` helpers.
```ts
// ---- SQRT -----------------------------------------------------------

test("SQRT is a map of arity 1", () => {
  expect(FUNCTIONS.get("SQRT")).toEqual({ kind: "map", arity: 1 });
  expect(isReduce("SQRT")).toBe(false);
  expect(callProblem("SQRT", [{ type: "num" }])).toBeNull();
  expect(callProblem("SQRT", [])).toEqual({ kind: "arity", expected: 1, got: 0 });
  expect(callProblem("SQRT", [{ type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 1,
    got: 2,
  });
});

test("SQRT computes the non-negative root (anchor-verified)", () => {
  const src = `
Roots: **3.00**<!--vmark=r.a-->, **0.00**<!--vmark=r.b-->, **0.50**<!--vmark=r.c-->,
**1.41**<!--vmark=r.d-->.

\`\`\`vmark #r
a = SQRT(9)
b = SQRT(0)
c = SQRT(0.25)
d = SQRT(2)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("SQRT of a non-number is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('SQRT("x")')));
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("SQRT expects a number");
});

test("SQRT of a negative literal is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("SQRT(-1)")));
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("SQRT of a negative number");
});

test("SQRT misspelled gets a did-you-mean", () => {
  const r = run(withScalar("SQR(Price)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("unknown function `SQR`");
  expect(ts[0]!.suggestion).toBe("SQRT");
});
```
Note `withScalar`'s snippet has no anchor on `total`, so an anchor-less scalar keeps full precision — fine here since these tests assert *findings*, not the printed value. `SQR` → `SQRT` is edit distance 1, inside `MAX_FN_SUGGESTION_DISTANCE` (2).

- [ ] **Step 3: Run the tests, verify they fail**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: FAIL — `FUNCTIONS.get("SQRT")` is `undefined`; the key-list assertion fails; `SQRT(...)` snippets report `unknown function \`SQRT\`` (and the misspelled-`SQR` test gets no suggestion, since `SQRT` is not yet a known name).

- [ ] **Step 4: Register `SQRT` (GREEN, part 1)**

In `src/eval/functions.ts`, in the `FUNCTIONS` map, in the `// maps` group after `["MOD", { kind: "map", arity: 2 }]`:
```ts
  ["SQRT", { kind: "map", arity: 1 }],
```
Nothing else in that file changes — `closest(call.name, FUNCTIONS.keys(), MAX_FN_SUGGESTION_DISTANCE)` in `check.ts` picks `SQRT` up for did-you-mean automatically.

- [ ] **Step 5: Evaluate `SQRT` (GREEN, part 2)**

In `src/eval/evaluate.ts`, in `evalCall`'s map `switch`, after the `case "MOD":` line and before `case "IF":`:
```ts
    case "SQRT": {
      const x = asNum(vals[0]!, "SQRT");
      if (x.isNegative() && !x.isZero()) throw new EvalError("SQRT of a negative number");
      return num(x.sqrt());
    }
```
`asNum` already throws `EvalError("SQRT expects a number")` for a non-number operand — that gives the first Global-Constraint message for free. The `&& !x.isZero()` lets a signed zero (`-0`) through to `.sqrt()`, which returns `0`; a genuine negative is rejected. The guard must run **before** `.sqrt()` because `new Decimal(-1).sqrt()` returns `NaN` rather than throwing, and a `NaN` would silently propagate.

- [ ] **Step 6: Run the tests, verify they pass**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/visimark/src/eval/functions.ts packages/visimark/src/eval/evaluate.ts packages/visimark/test/eval/functions.test.ts
git commit -m "$(printf 'feat: SQRT(x) builtin — non-negative square root, map arity 1\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 2: narrow the trailing NOTE to upstream suppression only

**Files:**
- Edit: `packages/visimark/src/eval/check.ts` (the `evalColumn` row loop and its trailing NOTE, ~L300–L372)
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: Task 1's `SQRT`.
- Produces: after a column rule, the `NOTE` counts only rows made unevaluable by an **upstream dependency error** (the `Unevaluable` catch branch), never a row that emitted its own per-row finding (the `EvalError` catch branch). A row with a negative `SQRT` operand therefore yields exactly one `TYPE` finding and no `NOTE`.

- [ ] **Step 1: Add the check-level tests (RED)**

In `test/eval/check.test.ts` (helpers `run`, `idOf`, `clean`, `drift` already imported). Add:
```ts
test("SQRT: a clean brace-length column verifies", () => {
  const src = `
| Brace | Width | Height |  Length |
|-------|------:|-------:|--------:|
| B1    |  3600 |   4200 | 5531.73 |
| B2    |  3600 |   2400 | 4326.66 |
| B3    |  6000 |   3000 | 6708.20 |

\`\`\`vmark #braces
Length = SQRT(Width^2 + Height^2)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("SQRT: one negative-operand row is a single TYPE finding, no NOTE", () => {
  const src = `
| Bay | Area |  Side |
|-----|-----:|------:|
| a   |    9 |  3.00 |
| b   |   -4 |  0.00 |
| c   |   25 |  5.00 |

\`\`\`vmark #bays
Side = SQRT(Area)
\`\`\`
`;
  const codes = run(src).findings.map((f) => f.code).sort();
  expect(codes).toEqual(["TYPE"]);
  const t = run(src).findings.find((f) => f.code === "TYPE")!;
  expect(t).toMatchObject({ name: "Side", rowLabel: "b", message: "SQRT of a negative number" });
});

test("SQRT: a negative scalar operand is one TYPE finding on the binding", () => {
  const src = `
\`\`\`vmark #s
x = SQRT(-1)
\`\`\`
`;
  const fs = run(src).findings.filter((f) => f.code === "TYPE");
  expect(fs).toHaveLength(1);
  expect(fs[0]!).toMatchObject({ name: "x", message: "SQRT of a negative number" });
});
```

- [ ] **Step 2: Update the existing EOMONTH NOTE test (RED)**

The test `"EOMONTH: an out-of-range row is a DATE finding plus a NOTE, other rows still verified"` (~L224) currently expects `codes` `["DATE", "NOTE"]`. Under the narrowed NOTE, the directly-errored row is no longer counted and nothing downstream depends on it, so the NOTE disappears. Change the assertion:
```ts
  const codes = r.findings.map((f) => f.code).sort();
  expect(codes).toEqual(["DATE"]);
  const date = r.findings.find((f) => f.code === "DATE")!;
  expect(date).toMatchObject({ name: "End", rowLabel: "b" });
```
and delete the two `note` lines and the test-name clause "plus a NOTE" (rename to `"EOMONTH: an out-of-range row is a DATE finding, other rows still verified"`).

- [ ] **Step 3: Run the tests, verify they fail**

Run: `bun test packages/visimark/test/eval/check.test.ts`
Expected: FAIL — the SQRT negative-row test sees `["NOTE", "TYPE"]`; the EOMONTH test (now expecting `["DATE"]`) sees `["DATE", "NOTE"]`.

- [ ] **Step 4: Scope the NOTE count (GREEN)**

In `check.ts`, in the column-rule evaluation (the function that builds `out` and ends with the `if (missing > 0)` NOTE):

1. Before the `for (let r = 0; ...)` row loop, add a counter:
```ts
    let suppressedUpstream = 0;
```
2. In the `catch (e)` block, the `e instanceof Unevaluable` branch, increment it:
```ts
        if (e instanceof Unevaluable) {
          out.push(null);
          suppressedUpstream++;
        } else if (e instanceof EvalError) {
```
3. Replace the trailing NOTE's count. Currently:
```ts
    const missing = out.filter((v) => v === null).length;
    if (missing > 0) {
      emit({ code: "NOTE", /* ... */ suppressedCount: missing,
             message: `${missing} row${missing === 1 ? "" : "s"} not verified (upstream DATE errors)` });
    }
```
becomes:
```ts
    if (suppressedUpstream > 0) {
      emit({ code: "NOTE", /* ...same fields... */ suppressedCount: suppressedUpstream,
             message: `${suppressedUpstream} row${suppressedUpstream === 1 ? "" : "s"} not verified (upstream DATE errors)` });
    }
```
Leave `out.push(null)` in the `EvalError` branch as it is — a column with any failed row still becomes `Unevaluable` for a downstream reducer via `lookupVector`'s `col.some((v) => v === null)` check; only the NOTE's accounting changes. Leave the NOTE **wording** unchanged (the maintainer chose narrowed-count, not a re-worded parenthetical); it stays correct for the genuinely-upstream `example-invoice-drift.md` case.

- [ ] **Step 5: Run the targeted tests, verify they pass**

Run: `bun test packages/visimark/test/eval/check.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the acceptance suite, verify the drift transcript is unmoved**

Run: `bun test packages/visimark/test/acceptance.test.ts packages/visimark/test/eval/functions.test.ts`
Expected: PASS — `example-invoice-drift.md`'s `NOTE schedule.Days · 2 rows not verified (upstream DATE errors)` is unchanged, because those rows fail through the `Unevaluable` branch (a malformed input date in the `Due` column), which is exactly what `suppressedUpstream` still counts.

- [ ] **Step 7: Commit**

```bash
git add packages/visimark/src/eval/check.ts packages/visimark/test/eval/check.test.ts
git commit -m "$(printf 'fix: trailing NOTE counts only upstream-suppressed rows, not self-errored ones\n\nA row whose own binding raised an error already carries its per-row\nfinding; folding it into the "N rows not verified" summary double-reports\nit under EOMONTH-specific wording. Scope the count to the Unevaluable\n(upstream dependency) branch. Drift transcript unchanged; one unreleased\nEOMONTH test assertion updated.\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 3: end-to-end fixture and CLI check

**Files:**
- Create: `packages/visimark/test/fixtures/sqrt-braces.md`
- Create: `packages/visimark/test/cli/sqrt.test.ts`

**Interfaces:**
- Consumes: the whole pipeline from Tasks 1–2.
- Produces: proof that `visimark check` is clean and `visimark eval --get braces.longest` prints `6708.20` for the motivating document.

- [ ] **Step 1: Create the fixture**

`packages/visimark/test/fixtures/sqrt-braces.md` — the issue's document, verbatim where possible:
```markdown
## Diagonal brace schedule

Each brace spans one rectangular bay corner to corner. The length to cut
is the straight-line distance between the end pins, fixed by the bay's
width and height alone.

| Brace | Width | Height |  Length |
|-------|------:|-------:|--------:|
| B1    |  3600 |   4200 | 5531.73 |
| B2    |  3600 |   2400 | 4326.66 |
| B3    |  6000 |   3000 | 6708.20 |

```vmark #braces
Length = SQRT(Width^2 + Height^2)

longest = MAX(Length)
```

All dimensions in mm. The longest brace to cut is
**6708.20**<!--vmark=braces.longest--> mm.
```
(The three `Length` literals and the `6708.20` anchor are what the engine computes — `SQRT(30600000)=5531.73`, `SQRT(18720000)=4326.66`, `SQRT(45000000)=6708.20` at two decimals. If `check` is not clean, fix the literals, never the formulas.)

- [ ] **Step 2: Create the CLI test**

`packages/visimark/test/cli/sqrt.test.ts` — mirror `test/cli/eomonth.test.ts` exactly (same `capture()` helper, same imports):
```ts
import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "fixtures", "sqrt-braces.md");

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the SQRT brace-schedule fixture exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("eval --get resolves the longest brace length", async () => {
  const c = capture();
  const code = await runCli(["eval", fixture, "--get", "braces.longest"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe("6708.20");
});
```

- [ ] **Step 3: Run the test**

Run: `bun test packages/visimark/test/cli/sqrt.test.ts`
Expected: PASS. If `check` reports STALE on a `Length` cell, correct that literal in the fixture and re-run.

- [ ] **Step 4: Commit**

```bash
git add packages/visimark/test/fixtures/sqrt-braces.md packages/visimark/test/cli/sqrt.test.ts
git commit -m "$(printf 'test: end-to-end SQRT fixture — diagonal brace schedule\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 4: documentation

**Files:**
- Edit: `docs/visimark-design.md` (§4 builtin table + the "Ten, chosen…" sentence; §14 "beyond the nine")
- Edit: `docs/vocabulary-catalogue.md` (line 3 count; the `SQRT` row → `SHIPPED`)
- Edit: `docs/vocabulary-review.md` (the "nine builtins" phrase, stale since EOMONTH)
- Edit: `docs/cli-reference.md` (only if it enumerates builtins — it does not today; grep to confirm)
- Edit: `CHANGELOG.md` (`## Unreleased` → `### Added`)
- Edit: `editors/vscode/CHANGELOG.md` (`## Unreleased`)

**Interfaces:**
- Consumes: shipped behaviour from Tasks 1–3.
- Produces: the design doc describes eleven builtins; the catalogue row is `SHIPPED` linking this PR; a `## Unreleased` changelog line so a release cut from `master` ships an accurate note.

- [ ] **Step 1: §4 builtin table** — in `docs/visimark-design.md`, add a row after the `EOMONTH` row:
```
| `SQRT(x)` | map | 1 | non-negative square root of a non-negative number; a negative operand is a `TYPE` error |
```
and change the section's opening word `Ten, chosen to cover the examples and the one catalogued addition a real document needed (`EOMONTH`, issue #6).` → `Eleven, chosen to cover the examples and the two catalogued additions a real document needed (`EOMONTH`, issue #6; `SQRT`, issue #18).` Re-read the sentence so it still parses.

- [ ] **Step 2: §14** — `docs/visimark-design.md` line ~457 reads `A function library beyond the nine —`. It was already stale after `EOMONTH`. Change `nine` → `eleven`.

- [ ] **Step 3: catalogue count** — `docs/vocabulary-catalogue.md` line 3: `The language ships **ten functions and a fixed operator set**` → `**eleven functions and a fixed operator set**`.

- [ ] **Step 4: catalogue row → SHIPPED** — in `docs/vocabulary-catalogue.md` §A, the `SQRT(x)` row: set its `Status` cell to `[SHIPPED](https://github.com/michal-niedzwiedzki/visimark/pull/20) · [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/18#issuecomment-5560992652)` — matching the format the `EOMONTH` row uses (`[SHIPPED](pull/8) · [APPROVED](comment)`). Leave `Request`, `What it does`, `Pros`, `Cons` as they are.

- [ ] **Step 5: runbook phrasing** — `docs/vocabulary-review.md` line ~75: `overlap with the nine builtins` → `overlap with the eleven builtins`.

- [ ] **Step 6: `cli-reference.md`** — `grep -n "ABS\|SUM\|builtin\|EOMONTH" docs/cli-reference.md`. Today it names no builtin list, only a `TYPE` example ("calling a function wrongly"). If that is still all, make no change; if a list has appeared, add `SQRT`.

- [ ] **Step 7: `CHANGELOG.md`** — under `## Unreleased` → `### Added`, a new bullet in the file's idiom, above the `EOMONTH` bullet or below it (keep `### Added` grouped):
```markdown
- **`SQRT(x)`** — the eleventh builtin and the second from the vocabulary
  catalogue (issue #18). A map, `number → number`, returning the non-negative
  square root of a non-negative number. It exists because a diagonal-brace
  cutting schedule computes each length as `SQRT(Width^2 + Height^2)` from two
  columns in the same table — a hand-typed length drifts silently after an edit,
  which is what `check` is for. `(Width^2 + Height^2) ^ 0.5` already reaches the
  value; `SQRT` is the spelling that says what the line does, and carries the
  same rounding — `Decimal.js` `.sqrt()` is correctly-rounded decimal, so it is
  not in the binary-float class that keeps `SIN` / `LN` deferred. A negative
  operand is a `TYPE` error — no complex result, no silent `SQRT(ABS(x))`.
```
Also add, under `### Fixed` (create the sub-section under `## Unreleased` if absent, after `### Added` / `### Changed`):
```markdown
- The `N rows not verified` note after a column rule no longer counts rows that
  raised their own error and already carry a per-row finding — only rows
  suppressed by an upstream dependency error.
```

- [ ] **Step 8: `editors/vscode/CHANGELOG.md`** — under the existing `## Unreleased`, add a bullet beside the `EOMONTH` one:
```markdown
- The engine now recognises `SQRT(x)` (square root), so a formula that uses it
  no longer shows an "unknown function" diagnostic.
```

- [ ] **Step 9: Commit**

```bash
git add docs/visimark-design.md docs/vocabulary-catalogue.md docs/vocabulary-review.md docs/cli-reference.md CHANGELOG.md editors/vscode/CHANGELOG.md
git commit -m "$(printf 'docs: SQRT is the eleventh builtin — design §4, catalogue SHIPPED, changelog\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

**Verify (whole task):** `bun test` (whole suite), `bun run typecheck`, `bun run build`; then the branch's own CLI against the protected example docs —
`bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md` (clean) and
`bun run packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md` (reproduces its transcript), and
`bun run packages/visimark/src/cli/main.ts fmt docs/example-invoice.md` a no-op (`git diff --exit-code docs/example-invoice.md`).
Do **not** use `bunx visimark` — it runs the published build, not this branch.

---

## Done when

- `bun test`, `bun run typecheck`, `bun run build` all green, including the new functions / check / cli cases and the updated EOMONTH assertion.
- `SQRT(9)` evaluates to `3` and `SQRT(-1)` is a `TYPE` "SQRT of a negative number" through the branch's CLI; `eval --get braces.longest` on the fixture prints `6708.20`.
- `docs/example-invoice.md` and `-drift.md` untouched; the §13 acceptance transcript (including the `schedule.Days` NOTE) is byte-identical.
- `docs/visimark-design.md` §4 lists eleven builtins; `docs/vocabulary-catalogue.md` shows `SQRT` as `SHIPPED`; `CHANGELOG.md` `## Unreleased` carries the `SQRT` line and the NOTE-fix line.
- PR #20 carries spec + plan + implementation, CI is green, and the PR is promoted out of draft.
