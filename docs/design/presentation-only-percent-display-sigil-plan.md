# Percent display sigil on prose anchors — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** Per [`presentation-only-percent-display-sigil-spec.md`](presentation-only-percent-display-sigil-spec.md), let `<!--vmark=sheet.scalar%-->` tell `fmt` to print that scalar as a percent (stored × 100 at precision − 2) without changing the stored value.

**Architecture:** The parser records an optional `percent` flag on `RawAnchor`. A small `percentDisplay` helper is the single renderer. `check` keeps a numeric verdict (`matchesStored`, now signed) and uses the renderer only for `STALE` computed text and for `PRECISION`/`TYPE`/`UNIT` on the sigil. `fmt` writes the renderer output when the flag is set, and canonical `toFixed` when it is not — including when the current span is already `N%`.

**Tech Stack:** TypeScript; Bun test runner; `packages/visimark`.

**Spec:** [`docs/design/presentation-only-percent-display-sigil-spec.md`](presentation-only-percent-display-sigil-spec.md)

## Global Constraints

- Work on branch `issue/140-presentation-only-percent-display-sigil-impl` (draft PR #144). Do **not** open a new PR.
- No new `FindingCode`. No `^` sigil, no scientific notation, no `infer --maths` (#142).
- `infer --write` never emits `%`. `eval` / `explain` / `--json` values stay stored numbers.
- `example-invoice.md`, `example-charts.md` and `example-invoice-drift.md` are not edited and their transcripts do not change.
- Every commit's trailer is resolved from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for this session. Do not copy a trailer from this plan or an earlier commit.
- After each task: `bun test`, `bun run typecheck` and `bun run build` from the repo root, plus `bun run packages/visimark/src/cli/main.ts check` on `docs/example-invoice.md`, `docs/example-charts.md` and `docs/example-invoice-drift.md`. Never `bunx visimark`.
- Never weaken an assertion, delete a failing test, or leave a `.skip`/`.only`.

---

### Task 1: parse the `%` sigil

**Files:**
- Modify: `packages/visimark/src/parse/document.ts` — `RawAnchor`, `ANCHOR_RE`, `collectAnchors`, malformed-anchor consumers stay in `packages/visimark/src/model/build.ts`.
- Modify: `packages/visimark/src/model/build.ts` — the `ANCHOR` message for malformed comments.
- Test: `packages/visimark/test/parse/document.test.ts`, `packages/visimark/test/eval/check.test.ts`, `packages/visimark/test/report/format.test.ts`.

**Interfaces:**
- Produces: `RawAnchor.percent?: true` (omit when absent). `locate("**0.40**<!--vmark=s.x%-->")` yields `sheetId: "s"`, `name: "x"`, `percent: true`. `<!--vmark=s.x %-->` is `malformedAnchors`, not a `RawAnchor`.
- Consumes: nothing new.

- [ ] **Step 1: tests (RED).** In `document.test.ts`:

```ts
test("a trailing % on an anchor comment is a percent display request", () => {
  const src = "**0.4026**<!--vmark=lines.margin%-->\n";
  const d = locate(src);
  const a = d.anchors[0]!;
  expect(a.sheetId).toBe("lines");
  expect(a.name).toBe("margin");
  expect(a.percent).toBe(true);
  expect(d.malformedAnchors).toEqual([]);
  expect(src.slice(a.value!.start, a.value!.end)).toBe("0.4026");
});

test("a well-formed anchor without % has no percent flag", () => {
  const src = "**0.4026**<!--vmark=lines.margin-->\n";
  expect(locate(src).anchors[0]!.percent).toBeUndefined();
});

test("a space before % is a malformed anchor", () => {
  const src = "**0.40**<!--vmark=lines.margin %-->\n";
  const d = locate(src);
  expect(d.anchors).toEqual([]);
  expect(d.malformedAnchors.length).toBe(1);
});
```

Existing tests that expect the malformed message `malformed anchor comment — expected \`<!--vmark=sheet.name-->\`` must expect the spec §2 string: `malformed anchor comment — expected \`<!--vmark=sheet.name-->\` or \`<!--vmark=sheet.name%-->\``. That is `check.test.ts` (hyphenated sheet id) and `format.test.ts` (`ANCHOR` rendering).

- [ ] **Step 2: implement.** Change `ANCHOR_RE` to:

```ts
const ANCHOR_RE =
  /^<!--\s*vmark\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(%)?\s*-->$/;
```

On `RawAnchor`:

```ts
  /** set when the comment is `<!--vmark=sheet.name%-->` */
  percent?: true;
```

In `collectAnchors`, spread `...(m[3] ? { percent: true as const } : {})`.

In `build.ts`, set the malformed message to the spec §2 wording.

- [ ] **Step 3:** `bun test`, `typecheck`, `build`; the three example docs still check clean.
- [ ] **Step 4:** commit.

---

### Task 2: `percentDisplay` and signed `matchesStored`

**Files:**
- Create: `packages/visimark/src/eval/percent-display.ts`
- Modify: `packages/visimark/src/eval/check.ts` — `PERCENT_RE` / `matchesStored`
- Modify: `packages/visimark/src/eval/units.ts` — `numericValue` and `cellPrecision` percent paths, so a cell `-5%` is the same number as an anchor `-5%`
- Test: `packages/visimark/test/eval/percent-display.test.ts`, existing `packages/visimark/test/eval/units.test.ts` / `check.test.ts` if they pin unsigned-only percent.

**Interfaces:**
- Produces:

```ts
export function percentDisplay(v: Value, places: number): string;
```

`places` is the binding's write precision `N` (`N ≥ 2`). Implementation: `roundToPlaces(v.d.mul(100), N - 2).toFixed(N - 2)`, prefix `-` when `v.d.isNeg() && !v.d.isZero()`, suffix `%`. Non-`num` values are not this function's job (Task 3 reports `TYPE`).

`matchesStored` for numbers: after `parseDecorated` fails, `/^(-?)(\d+(?:\.\d+)?)%$/`; stored = `± digits / 100`.

- Consumes: `Value`, `roundToPlaces` from `eval/value.ts`.

- [ ] **Step 1: tests (RED).** Table from spec §3:

```ts
import { expect, test } from "bun:test";
import { num } from "../../src/eval/value.js";
import { percentDisplay } from "../../src/eval/percent-display.js";
import { matchesStored } from "../../src/eval/check.js";
import { Decimal } from "decimal.js";

test("percentDisplay writes stored × 100 at N − 2", () => {
  expect(percentDisplay(num(new Decimal("0.4026")), 4)).toBe("40.26%");
  expect(percentDisplay(num(new Decimal("0.40")), 2)).toBe("40%");
  expect(percentDisplay(num(new Decimal("0.20")), 2)).toBe("20%");
  expect(percentDisplay(num(new Decimal("0")), 2)).toBe("0%");
  expect(percentDisplay(num(new Decimal("-0.05")), 2)).toBe("-5%");
  expect(percentDisplay(num(new Decimal("1.50")), 2)).toBe("150%");
  expect(percentDisplay(num(new Decimal("0.125")), 3)).toBe("12.5%");
  expect(percentDisplay(num(new Decimal("-0")), 2)).toBe("0%");
});

test("matchesStored accepts a signed percent as the stored ratio", () => {
  expect(matchesStored(num(new Decimal("-0.05")), "-5%", 2)).toBe(true);
  expect(matchesStored(num(new Decimal("0.4026")), "40.26%", 4)).toBe(true);
  expect(matchesStored(num(new Decimal("0.4026")), "0.4026", 4)).toBe(true);
  expect(matchesStored(num(new Decimal("0.4026")), "41.55%", 4)).toBe(false);
});
```

- [ ] **Step 2: implement** `percentDisplay`; set `PERCENT_RE` to `/^(-?)(\d+(?:\.\d+)?)%$/` and fold the sign; widen `numericValue` / `cellPrecision` the same way.
- [ ] **Step 3:** `bun test`, `typecheck`, `build`; three example docs still check clean.
- [ ] **Step 4:** commit.

---

### Task 3: `check` findings

**Files:**
- Modify: `packages/visimark/src/eval/check.ts` — `evalScalar` `STALE` `computed` text; `PRECISION` when any `%` anchor on the binding has `N < 2`; `TYPE` when a `%` anchor's value is a date or string.
- Modify: `packages/visimark/src/eval/check-report.ts` — `TYPE` when `a.percent` and the name is a chart, or `a.value.kind === "image"`.
- Modify: `packages/visimark/src/eval/check-decoration.ts` or `evalScalar`: `UNIT` when `a.percent` and `parseDecorated(span).kind === "number" && d.unit`, or `kind === "both-sides"`. Message: `cannot mix a unit with percent display`.
- Test: `packages/visimark/test/eval/check.test.ts` (and `unit-check.test.ts` if that is where scalar `UNIT` lives).

**Interfaces:**
- Consumes: `RawAnchor.percent`, `percentDisplay`, `matchesStored`.
- Produces: spec §4 table. Verdict stays numeric: `**0.4026**<!--vmark=s.x%-->` with stored `0.4026` is not `STALE`. `STALE.computed` on a `%` comment is `percentDisplay(v, N)`. `PRECISION` message: `percent display needs precision 2 or more; <name> has <N>`. `TYPE` message: `a % sigil is only legal on a numeric scalar`.

- [ ] **Step 1: tests (RED).** A helper document:

```markdown
Margin **40.26%**<!--vmark=s.margin%-->.
Bare **0.4026**<!--vmark=s.margin-->.

```vmark #s
margin precision 4 = 0.4026
```
```

`check` exit 0. Change the percent span to `41.55%`: one `STALE` with `stored: "41.55%"`, `computed: "40.26%"`. `precision 1` + `%` → `PRECISION`. A date scalar with `%` → `TYPE`. `**$0.40**<!--vmark=s.margin%-->` → `UNIT`. `![c](x.svg)<!--vmark=s.ch%-->` plus `chart ch as bar of …` → `TYPE`. Two anchors, one `%` and one bare, both matching → exit 0.

- [ ] **Step 2: implement.** In `evalScalar`, after `v` is rounded: if any `model.anchors` with this `id` has `percent` and `prec < 2`, `emit` `PRECISION` (width known) and do not emit `STALE` for those anchors. If `v.t !== "num"` and a `%` anchor exists, `TYPE`. For `STALE`, when the failing anchor has `percent`, set `computed` to `percentDisplay(v, prec)` (no unit). Skip `STALE` when that anchor already has `PRECISION`/`TYPE`/`UNIT`.

For `UNIT`, walk `%` anchors whose `value` is not `image`, `parseDecorated` the slice, emit if a unit or both-sides.

In `reportAnchors`, if `a.percent` and (`isChart` or `value.kind === "image"`), `TYPE` with the spec message.

Unevaluable scalar: no `STALE` (existing `NOTE` path). `PRECISION` for `N < 2`, `TYPE`, and `UNIT` still fire.

- [ ] **Step 3:** `bun test`, `typecheck`, `build`; three example docs still check clean.
- [ ] **Step 4:** commit.

---

### Task 4: `fmt` writes the convention of the comment

**Files:**
- Modify: `packages/visimark/src/write/fmt.ts` — the anchored-scalar loop (~lines 92–114).
- Test: `packages/visimark/test/write/fmt.test.ts`.

**Interfaces:**
- Consumes: `RawAnchor.percent`, `percentDisplay`, Task 3 findings.
- Produces: wanted text is `percentDisplay(rounded, prec)` when `a.percent`, else `applyUnit(showValue(rounded, prec), unit)`. Rewrite iff `current !== wanted`. Do not rewrite a `%` span that carries `PRECISION`, `TYPE`, or `UNIT` for that binding/anchor. Without `%`, `**20.00%**` with stored `0.20` becomes `0.20`.

- [ ] **Step 1: tests (RED).**

```ts
test("fmt writes percent form on a % comment and is idempotent", () => {
  // stored 0.4026 precision 4, span 0.4155, comment has %
  // after fmt: 40.26%; second fmt: unchanged
});

test("fmt without % rewrites a percent-shaped span to toFixed", () => {
  // **20.00%**<!--vmark=s.x--> with x = 20% → **0.20**
});

test("fmt does not rewrite a % span that is PRECISION", () => {
  // precision 1 + % leaves the span bytes alone
});
```

- [ ] **Step 2: implement.** Replace the `matchesStored` gate in the anchor loop with string inequality against `wanted`. Before pushing an edit, if `a.percent` and `result` has `PRECISION`/`TYPE`/`UNIT` naming this binding (or this span), `continue`. Image anchors still skipped.

- [ ] **Step 3:** `bun test`, `typecheck`, `build`; three example docs still check clean. `fmt` on `example-invoice.md` is still a no-op.
- [ ] **Step 4:** commit.

---

### Task 5: `infer --write` never emits `%`

**Files:**
- Modify: none if `packages/visimark/src/infer/write.ts` still interpolates `` `<!--vmark=${sheet.id}.${p.name}-->` ``.
- Test: `packages/visimark/test/infer/write.test.ts` (or `infer/acceptance.test.ts`).

**Interfaces:**
- Consumes: Task 1 parse (a `%` comment is an anchor, not malformed, so `infer` can see it).
- Produces: inserted comments never contain `%`.

- [ ] **Step 1: tests (RED).** `infer --write` on a table with an unanchored percent-looking figure still inserts `<!--vmark=sheet.name-->` with no `%`. `locate` of a document that already has `%` comments reports those anchors (no extra `ANCHOR`).
- [ ] **Step 2:** only change `write.ts` if a test fails.
- [ ] **Step 3:** `bun test`, `typecheck`, `build`.
- [ ] **Step 4:** commit (skip the commit if the tree is clean).

---

### Task 6: fixture, in-tree document, CLI

**Files:**
- Create: `packages/visimark/test/fixtures/percent-display-sigil.md` — spec §6 happy document, verbatim.
- Modify: `docs/example-executable-documentation.md` — `%` on `budget.reserved_capacity` and `budget.WorkerBudgetPercentage`; after `fmt`, the spans are `20%` and `50%`.
- Test: `packages/visimark/test/cli/cli.test.ts` and/or `packages/visimark/test/acceptance.test.ts`.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: spec §6 sessions.

- [ ] **Step 1:** add the fixture. `check` exit 0. Sabotage the margin span to `41.55%` in a test-local copy: `STALE` line contains `41.55% ≠ 40.26%`, exit 1; `fmt` repairs; second `fmt` is a no-op.
- [ ] **Step 2:** `eval --json` on the fixture lists stored `0.4026` (decimal string), not `40.26`. `explain` does not mention `%`.
- [ ] **Step 3:** edit `example-executable-documentation.md` comments to `%`, run `bun run packages/visimark/src/cli/main.ts fmt docs/example-executable-documentation.md`, expect `20%` and `50%` in the strong nodes, `check` exit 0.
- [ ] **Step 4:** `bun test`, `typecheck`, `build`; three canonical examples still check clean.
- [ ] **Step 5:** commit.

---

### Task 7: documentation

**Files:**
- Modify: `docs/visimark-design.md` — [§3](../visimark-design.md#3-document-model) (anchor grammar, optional `%`, expected-form sentence), [§7](../visimark-design.md#7-numeric-semantics) (percent display does not declare width; `%` on a comment is not a unit), [§9](../visimark-design.md#9-write-back) (second rendering rule for an owned span), [§10](../visimark-design.md#10-error-taxonomy) (`PRECISION` / `TYPE` / `UNIT` triggers from spec §4), [§14](../visimark-design.md#14-deferred) (this one closed carve-out of output formats; column masks stay deferred; `^` is #142).
- Modify: `CHANGELOG.md` — `## Unreleased` → `### Added`, one paragraph pointing at the spec and #140.
- Modify: `docs/vocabulary-catalogue.md` — move the section E row for #140 into the Shipped register as `UNRELEASED`:

| Name | Kind | Request | Landed | Released | Decision |
|------|------|---------|--------|----------|----------|
| Presentation-only `%` display sigil on prose anchors | language feature | [#140](https://github.com/michal-niedzwiedzki/visimark/issues/140) | this PR | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/140#issuecomment-5775547789) |

- Modify: `docs/cli-reference.md` only if it currently describes the malformed-anchor message or shows a `STALE` line shape that would now be wrong; otherwise leave it.
- Do **not** add an `editors/vscode/CHANGELOG.md` line unless hover/diagnostics change (they should not).

**Interfaces:** none.

- [ ] **Step 1:** apply the design-doc and changelog edits. Regenerated files (`docs/function-reference.md`, vendor bundles) are not hand-edited; run their scripts only if a generator input changed (it should not).
- [ ] **Step 2:** move the catalogue row.
- [ ] **Step 3:** `bun test`, `typecheck`, `build`; `bun run packages/visimark/src/cli/main.ts check` on every `docs/example-*.md` the suite already walks.
- [ ] **Step 4:** commit.

---
