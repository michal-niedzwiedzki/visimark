# Division by zero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a zero divisor in `/` and `MOD` a `TYPE` error, and refuse any non-finite `Decimal` as a document value, per `docs/design/division-by-zero-evaluates-to-infinity-spec.md`.

**Architecture:** Two guards, both throwing `EvalError` (code `TYPE`). `/` and `MOD` test `divisor.isZero()` *before* `Decimal.div` / `Decimal.mod` and throw `division by zero`. `num()` in `eval/value.ts` — the only constructor that produces a numeric `Value` — throws `result is not a finite decimal` when `!d.isFinite()`, so `^` (and any future leak) cannot materialise `Infinity` or `NaN`. No parser, model, write, infer, or LSP change: `check` already maps `EvalError` to a `TYPE` finding, `fmt` already skips unevaluable bindings, and `eval --json` already omits them from `values`.

**Tech Stack:** TypeScript; `decimal.js` (already the numeric core); Bun test runner; the engine package `packages/visimark`.

**Spec:** `docs/design/division-by-zero-evaluates-to-infinity-spec.md`

## Global Constraints

- No new npm dependencies. No new [§10](../visimark-design.md#10-error-taxonomy) error code.
- Error messages, verbatim: zero divisor in `/` or `MOD` → `division by zero`; any other non-finite `Decimal` at the `Value` boundary → `result is not a finite decimal`.
- A divisor is zero when `Decimal#isZero()` is true (`0`, `0.0`, `0%`, `-0`). A non-zero value, however small, is legal.
- Reporting granularity matches `SQRT` of a negative: one `TYPE` per scalar binding; one `TYPE` on the failing row of a column rule; other rows still compute. Downstream dependents fold into the existing per-sheet `NOTE`.
- A `PRECISION` finding does not also fire on the same binding — evaluation throws before rounding.
- `eval --json` `status` still tracks assertion failures only. Failed bindings are absent from `values`. The payload must not contain `Infinity`, `-Infinity`, or `NaN`.
- `fmt` writes nothing for these bindings. Example documents stay byte-identical; the [§13](../visimark-design.md#13-testing) transcripts do not move.
- Work on branch `issue/122-division-by-zero-evaluates-to-infinity-impl` (spec PR #126); do not open a new PR.
- Every commit's message body ends with the `Co-Authored-By` trailer from [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the agent writing the commit. Do not copy a trailer out of this plan or an earlier commit.

---

### Task 1: refuse non-finite Decimals at `num()`

**Files:**
- Modify: `packages/visimark/src/eval/value.ts` (`num`)
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Consumes: existing `num`, `EvalError` in `value.ts`.
- Produces: `num(d)` returns `{ t: "num", d }` only when `d` is finite; otherwise throws `EvalError("result is not a finite decimal")`. `0 ^ -1` and `(-2) ^ 0.5` therefore become `TYPE` findings through the existing `evalBinary` `^` path (`return num(…pow…)`).

- [ ] **Step 1: Add the failing tests**

In `packages/visimark/test/eval/functions.test.ts`, after the existing operator / `SQRT` blocks (before `FLOOR` is fine; after `SQRT` is better). The file already has `run`, `withScalar`, `withColumnRule`, `typeFindings`.

```ts
// ---- finite numeric values ------------------------------------------

test("0 ^ -1 is a TYPE error, not Infinity", () => {
  const fs = typeFindings(run(withScalar("0 ^ -1")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("result is not a finite decimal");
});

test("(-2) ^ 0.5 is a TYPE error, not NaN", () => {
  const fs = typeFindings(run(withScalar("(-2) ^ 0.5")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("result is not a finite decimal");
});
```

`withScalar` wraps the expression as `total = …` with no `precision` clause. Evaluation throws before the width check, so these must be `TYPE` only — not `PRECISION`.

- [ ] **Step 2: Run the tests, verify they fail**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: FAIL — both snippets currently evaluate; `typeFindings` is empty (today `eval --json` would list `"Infinity"` / `"NaN"`).

- [ ] **Step 3: Guard `num()`**

In `packages/visimark/src/eval/value.ts`, replace the `num` helper:

```ts
export const num = (d: Decimal | number | string): Value => {
  const dec = d instanceof Decimal ? d : new Decimal(d);
  if (!dec.isFinite()) throw new EvalError("result is not a finite decimal");
  return { t: "num", d: dec };
};
```

`EvalError` is already in this file. Every numeric `Value` in the engine is built through `num()` (`evaluate.ts` maps, reduces, `COUNT`, date-day differences). `roundToPlaces` still returns a `Decimal`; the caller wraps it with `num` after rounding at the binding, so a non-finite never reaches write-back either.

Do **not** change `/` or `MOD` in this task — those still leak until Task 2, but the `num()` wrap on `div`/`mod` now throws the *generic* message. That is expected and temporary; Task 2's tests lock the specific `division by zero` message by throwing *before* `div`/`mod`.

- [ ] **Step 4: Run the tests, verify they pass**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: PASS for the two new tests. Existing tests stay green.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/eval/value.ts packages/visimark/test/eval/functions.test.ts
git commit -m "$(printf 'fix: refuse non-finite Decimals as numeric Values\n\n%s' '<attribution-trailer>')"
```

`<attribution-trailer>` is the `Co-Authored-By` line from `.claude/rules/ai-attribution.md` for this session.

---

### Task 2: zero divisor in `/` and `MOD` is `division by zero`

**Files:**
- Modify: `packages/visimark/src/eval/evaluate.ts` (`evalBinary` `/`, `evalCall` `MOD`)
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Consumes: Task 1's `num()` guard (fallback only).
- Produces: `/` and `MOD` throw `EvalError("division by zero")` when the divisor `isZero()`, before calling `Decimal.div` / `Decimal.mod`. Message is the same for `x / 0`, `0 / 0`, `MOD(x, 0)`, and `-0`.

- [ ] **Step 1: Add the failing tests**

Append to the finite-values block in `functions.test.ts`:

```ts
test("x / 0 is TYPE division by zero", () => {
  const fs = typeFindings(run(withScalar("100 / 0")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("0 / 0 is TYPE division by zero, not NaN", () => {
  const fs = typeFindings(run(withScalar("0 / 0")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("1 / -0 is TYPE division by zero", () => {
  const fs = typeFindings(run(withScalar("1 / -0")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("a tiny non-zero divisor still divides", () => {
  const src = `
n is **10000.00**<!--vmark=s.n-->.

\`\`\`vmark #s
n precision 2 = 1 / 0.0001
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("MOD(x, 0) is TYPE division by zero", () => {
  const fs = typeFindings(run(withScalar("MOD(5, 0)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("MOD(x, -0) is TYPE division by zero", () => {
  const fs = typeFindings(run(withScalar("MOD(5, -0)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("ordinary MOD is unchanged", () => {
  const src = `
n is **1**<!--vmark=s.n-->.

\`\`\`vmark #s
n = MOD(7, 3)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});
```

After Task 1, `100 / 0` already throws — but with `result is not a finite decimal`. These tests fail until `/` and `MOD` throw first.

- [ ] **Step 2: Run the tests, verify they fail**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: FAIL on the `/` and `MOD` zero-divisor tests — message is `result is not a finite decimal`, not `division by zero`. The tiny-divisor and ordinary-`MOD` tests already pass.

- [ ] **Step 3: Throw before `div` / `mod`**

In `packages/visimark/src/eval/evaluate.ts`, replace the `/` case in `evalBinary`:

```ts
    case "/": {
      const left = asNum(l, "`/`");
      const right = asNum(r, "`/`");
      if (right.isZero()) throw new EvalError("division by zero");
      return num(left.div(right));
    }
```

Replace the `MOD` case in `evalCall`:

```ts
    case "MOD": {
      const x = asNum(vals[0]!, "MOD");
      const y = asNum(vals[1]!, "MOD");
      if (y.isZero()) throw new EvalError("division by zero");
      return num(x.mod(y));
    }
```

Non-number operands still hit `asNum` first (`\`/\` expects a number` / `MOD expects a number`) — unchanged.

- [ ] **Step 4: Run the tests, verify they pass**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/eval/evaluate.ts packages/visimark/test/eval/functions.test.ts
git commit -m "$(printf 'fix: / and MOD throw TYPE division by zero\n\n%s' '<attribution-trailer>')"
```

---

### Task 3: check, fmt, and eval match the acceptance fixture

**Files:**
- Test: `packages/visimark/test/eval/check.test.ts`
- Test: `packages/visimark/test/cli/json.test.ts`

**Interfaces:**
- Consumes: Task 2's `EvalError("division by zero")` and Task 1's finite guard.
- Produces: the spec §6 acceptance document reports three `TYPE` findings, no `STALE`; `fmt` leaves it byte-identical; `eval --json` omits the failed bindings and contains no `Infinity`/`NaN` tokens. A column rule with one zero row reports one per-row `TYPE` and no trailing `NOTE`.

- [ ] **Step 1: Add the check-level tests (RED if Task 2 were missing; they should already pass after Task 2 — write them anyway, they pin reporting)**

In `packages/visimark/test/eval/check.test.ts`, next to the existing `SQRT: one negative-operand row` test:

```ts
test("division by zero: scalar bindings are TYPE, not STALE, no NOTE", () => {
  const src = `
Net is 10<!--vmark=s.net-->. Ratio 1<!--vmark=s.r-->.

\`\`\`vmark #s
z = 0
net precision 2 = 100 / z
r precision 2 = 0 / z
m = MOD(5, z)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code).sort()).toEqual(["TYPE", "TYPE", "TYPE"]);
  for (const f of r.findings) {
    expect(f.message).toBe("division by zero");
  }
  expect(r.findings.map((f) => f.name).sort()).toEqual(["m", "net", "r"]);
  expect(r.values.has("s.net")).toBe(false);
  expect(r.values.has("s.r")).toBe(false);
  expect(r.values.has("s.m")).toBe(false);
});

test("division by zero: one zero row is a single TYPE on that row, no NOTE", () => {
  const src = `
| Item | Amount | Qty | Ratio |
|------|-------:|----:|------:|
| a    |     10 |   2 |  5.00 |
| b    |     10 |   0 |  0.00 |
| c    |     10 |   5 |  2.00 |

\`\`\`vmark #t
Ratio precision 2 = Amount / Qty
\`\`\`
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code).sort()).toEqual(["TYPE"]);
  expect(r.findings[0]!).toMatchObject({
    name: "Ratio",
    rowLabel: "b",
    message: "division by zero",
  });
});
```

`run` / helpers are already in this file (same `check(build(locate(src)))` pattern as the SQRT tests around line 359). Confirm `r.values` is a `Map` keyed by qualified id — `CheckResult.values` is that map (see `eval/check.ts`). If the key is the binding id in another form, match whatever `SQRT` of a negative scalar uses: that test does not assert `values.has`, so if `values` keys differ, assert via `evalValues` from `report/json.ts` instead:

```ts
import { evalValues } from "../../src/report/json.js";
const values = evalValues(r);
expect(values["s.net"]).toBeUndefined();
expect(values["s.z"]).toBe("0");
```

Prefer `evalValues` — it is the public `eval --json` shape.

- [ ] **Step 2: Add the CLI acceptance tests**

In `packages/visimark/test/cli/json.test.ts`, using the existing `capture` / `runCli` / `parseOut` / `mkdtempSync` helpers:

```ts
test("eval --json omits division-by-zero bindings and never says Infinity", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-div0-"));
  const p = join(dir, "div.md");
  writeFileSync(
    p,
    `Net is 10<!--vmark=s.net-->. Ratio 1<!--vmark=s.r-->.

\`\`\`vmark #s
z = 0
net precision 2 = 100 / z
r precision 2 = 0 / z
m = MOD(5, z)
\`\`\`
`,
  );
  const checkCap = capture();
  expect(await runCli(["check", p], checkCap.io)).toBe(1);
  const checkText = checkCap.out();
  expect(checkText).toContain("TYPE");
  expect(checkText).toContain("division by zero");
  expect(checkText).not.toContain("STALE");
  expect(checkText).not.toContain("Infinity");
  expect(checkText).not.toContain("NaN");
  expect(checkText).toContain("3 problems (0 stale, 3 errors)");

  const before = readFileSync(p, "utf8");
  const fmtCap = capture();
  await runCli(["fmt", p], fmtCap.io);
  expect(readFileSync(p, "utf8")).toBe(before);
  expect(fmtCap.out()).toContain("unchanged");

  const evalCap = capture();
  expect(await runCli(["eval", p, "--json"], evalCap.io)).toBe(0);
  const raw = evalCap.out();
  expect(raw).not.toContain("Infinity");
  expect(raw).not.toContain("NaN");
  const j = parseOut(evalCap);
  expect(j.status).toBe("ok");
  const values = j.values as Record<string, string>;
  expect(values["s.z"]).toBe("0");
  expect(values["s.net"]).toBeUndefined();
  expect(values["s.r"]).toBeUndefined();
  expect(values["s.m"]).toBeUndefined();
});
```

- [ ] **Step 3: Run the tests**

Run:
```
bun test packages/visimark/test/eval/check.test.ts packages/visimark/test/cli/json.test.ts
```
Expected: PASS. If `values` keys or `fmt` "unchanged" wording differs, adjust the assertion to the actual helper (`fmt` currently prints `<path>: unchanged` — confirm against the SQRT-negative CLI run). If `runCli(["fmt", p])` exit code is 1 because of the `TYPE` findings, that is existing behaviour (fmt still reports problems); do not assert exit 0, assert the file bytes.

- [ ] **Step 4: Full local checks**

Run from repo root:
```
bun test
bun run typecheck
bun run build
```
Then check the example documents with the *branch* CLI, not `bunx visimark`:
```
bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md
bun run packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md
bun run packages/visimark/src/cli/main.ts check docs/example-charts.md
```
Expected: all green; example `check` transcripts unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/test/eval/check.test.ts packages/visimark/test/cli/json.test.ts
git commit -m "$(printf 'test: division by zero is TYPE, fmt writes nothing\n\n%s' '<attribution-trailer>')"
```

---

### Task 4: documentation

**Files:**
- Modify: `docs/visimark-design.md` §4 operators paragraph; `MOD` row of the generated function table (via the registry, not by hand)
- Modify: `packages/visimark/src/lang/reference.ts` (`MOD.errors`, `MOD.summary` if needed)
- Modify: `docs/function-reference.md` (generated — `bun run gen:docs`)
- Modify: `docs/tutorial.md` (operators / `MOD` one-liners)
- Modify: `docs/cli-reference.md` (`TYPE` row)
- Modify: `CHANGELOG.md` (`## Unreleased` → `### Fixed`)
- Modify: `docs/vocabulary-catalogue.md` — move the #122 row out of section E into the Shipped register as `UNRELEASED`

**Interfaces:**
- Consumes: the shipped behaviour from Tasks 1–3.
- Produces: design doc, function reference, tutorial, CLI reference, changelog, and catalogue all state that a zero divisor is `TYPE` and that a non-finite `Decimal` is not a value.

- [ ] **Step 1: Function reference registry**

In `packages/visimark/src/lang/reference.ts`, `MOD` entry, set:

```ts
    summary: "remainder; a zero divisor is a TYPE error",
    errors: [{ when: "a zero divisor", code: "TYPE" }],
```

Leave the existing examples (`MOD(7, 3)` → `1`, `MOD(9, 3)` → `0`). Do not add a `MOD(5, 0)` example that "is" an error — the examples table is `expr → value` and is executed in CI.

- [ ] **Step 2: Design doc**

In `docs/visimark-design.md` §4 **Operators** paragraph, after "so a binding that divides declares its width", add that a zero divisor is a `TYPE` error (`division by zero`), the same refusal as `SQRT` of a negative.

The generated function-table `MOD` cell currently reads `remainder`. After `bun run gen:docs` it must include the zero-divisor `TYPE` (whatever sentence `gen:docs` derives from `errors` / `summary`). If `gen:docs` only copies `summary`, the Step 1 summary change is what lands in the table. Do not hand-edit inside `<!-- generated: function-table -->`.

Also in §4, the `MOD` table row is generated; the operators paragraph is not.

- [ ] **Step 3: Tutorial and CLI reference**

`docs/tutorial.md` §11 `MOD` row: `Remainder. Zero divisor is an error.`
Operators subsection: one sentence — division by zero is an error, not a value.

`docs/cli-reference.md` `TYPE` row, extend the meaning: "…or dividing by zero."

No `editors/vscode/CHANGELOG.md` entry — the LSP already surfaces `TYPE`; the message is new, the diagnostic code is not.

- [ ] **Step 4: Changelog**

Under `## Unreleased` in `CHANGELOG.md`, add a `### Fixed` section (keep the existing `### Added` for scenario parameters):

```markdown
### Fixed

- **Division by zero is a `TYPE` error**, not a value. `/` and `MOD` with a
  zero divisor (including `-0`) report `division by zero`; a non-finite
  `Decimal` (`0 ^ -1`, `(-2) ^ 0.5`) reports `result is not a finite
  decimal`. `check` no longer treats these as `STALE`, and `fmt` does not
  write `Infinity` or `NaN` into the document. See
  [`division-by-zero-evaluates-to-infinity-spec.md`](docs/design/division-by-zero-evaluates-to-infinity-spec.md)
  and [#122](https://github.com/michal-niedzwiedzki/visimark/issues/122).
```

- [ ] **Step 5: Catalogue — move #122 to Shipped as `UNRELEASED`**

Delete the section E row whose Request is `#122`.

In the Shipped table, add (Landed = this PR's number, which is #126; Released empty):

```markdown
| Division by zero is `TYPE` | language feature | [#122](https://github.com/michal-niedzwiedzki/visimark/issues/122) | [#126](https://github.com/michal-niedzwiedzki/visimark/pull/126) | | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/122#issuecomment-5746529695) |
```

Place it with the other unreleased rows (currently scenario parameters). Do not set Released. Do not close #122.

- [ ] **Step 6: Generate docs and verify**

```
bun run gen:docs
bun test
bun run typecheck
```
Expected: `docs/function-reference.md` `MOD` section lists the zero-divisor `TYPE`; generated §4 table matches; tests green.

- [ ] **Step 7: Commit**

```bash
git add docs/visimark-design.md docs/function-reference.md docs/tutorial.md docs/cli-reference.md CHANGELOG.md docs/vocabulary-catalogue.md packages/visimark/src/lang/reference.ts
git commit -m "$(printf 'docs: division by zero is TYPE (#122)\n\n%s' '<attribution-trailer>')"
```

---

## Self-review

- Spec §3 table (zero, `-0`, `0/0`, `MOD`, tiny non-zero, `0 ^ -1`, `(-2) ^ 0.5`): Tasks 1–2.
- Spec §4 reporting granularity and no extra `PRECISION`: Tasks 2–3.
- Spec §5 CLI (`check` TYPE, `fmt` unchanged, `eval --json` omits values, no Infinity tokens, status still `ok`): Task 3.
- Spec §5 design-doc sentences and function-table `MOD`: Task 4.
- Spec §6 acceptance fixture: Task 3 CLI test.
- Spec §7 non-goals (no new code, no `eval` status change, no infix `%`): Global Constraints; no task implements them.
- Catalogue move to Shipped `UNRELEASED`: Task 4. Issue stays open.
