# Decompose `check()` — Implementation Plan

**Source:** `REVIEW.md` §2.1 (row 3, rated C). Refactor only — no paired spec, per
the repo convention that refactors do not carry a design doc.

**Goal:** Replace the single 1,015-line closure in `packages/visimark/src/eval/check.ts`
with module-level phase functions over an explicit `CheckState`, starting with the
chart phase, without changing one byte of observable output.

**Architecture:** `CheckState` is a mutable record holding what is today the closure's
accumulator set. It is defined so that `CheckResult` is derived from it rather than
rebuilt beside it. Each extracted phase is a module-level function whose *parameter
type is a narrowed structural subtype of `CheckState`* — read-only maps for what it
reads, mutable only for what it writes. That narrowing is what makes the boundary
real; a phase taking the whole `CheckState` by value would just rename closure
variables to `st.` properties.

**Tech Stack:** TypeScript (`strict` + `noUncheckedIndexedAccess`), Bun test.

---

## Findings from validating the review's brief

The request is well founded — `check()` is 1,015 lines (99–1113) and is the largest
structural debt in the repo. Three corrections to the brief, which change the plan:

1. **The "1,017 lines / four helpers" framing undercounts the existing structure.**
   `check()` contains **17 named inner function declarations** spanning lines 636–1112
   — 477 of the 1,015 lines. The genuinely straight-line, comment-delimited phase code
   is lines 99–635, about **537 lines**. Half the function is already named units that
   merely happen to be nested. The work is smaller than advertised, and mostly
   mechanical once the state object exists.

2. **"The four closure helpers move out with the chart phase" is wrong.**
   `readColumn` (649) calls `lookupVector` (1058), which calls `coerceInput` (1076),
   which emits `DATE` findings and mutates `dateErrorRows`. Both are *also* used by the
   row-evaluation loop (`rowEnv` → `lookupVector`, `lookupScalar` → `coerceInput`).
   They are shared, not chart-private, and must land in a shared lookup module keyed on
   `CheckState`. Only `base`, `readLabels` and `inputPrecision` are chart-only, and two
   of those three need nothing but `model` — they become plain module functions.

   Consequence: the chart phase **can emit findings** (`DATE`, via `coerceInput` on an
   input column read through `lookupVector`). Its position in the emit sequence is
   therefore load-bearing and must not move.

3. **`CheckResult` is already ~80% of the proposed `CheckState`.** Eight of its eleven
   fields (`values`, `cells`, `columnPrecision`, `scalarPrecision`, `columnUnits`,
   `scalarUnits`, `unitConflicts`, `charts`) are the accumulators verbatim. `CheckState`
   must embed that shape, not parallel it, or the final assembly becomes a copy step
   that invites drift.

**The chart phase is confirmed as the right first target.** A usage matrix over lines
99–1113 shows it touches **9 of ~30 accumulators** — `model`, `opts`, `values`, `cells`,
`columnUnits`, `columnPrecision`, `buildableCharts`, `dateErrorRows`, `emit` — and its
two locals (`claimedPaths`, `charts`) are entirely phase-private. `buildableCharts` is a
clean producer(loop) → consumer(charts) handoff and nothing else reads it.

---

## Global Constraints

- **Pure refactor.** `CheckResult` keeps its shape. Not one finding — code, message,
  `suggestion`, span, or ordering — may differ. Finding order is load-bearing:
  `orderFindings()` (1117) sorts by sheet-first-seen plus a determinism counter, and
  acceptance tests compare CLI output byte-for-byte against transcripts inside
  `docs/example-invoice-drift.md`.
- **Emit order is the invariant, not just the finding set.** Every extracted phase runs
  in exactly its current position, and `emit` calls inside it keep their current order.
- No `any`, no `as any`, no `@ts-ignore`/`@ts-expect-error`. Non-null `!` after a bounds
  check is the established idiom and is fine.
- Carry the existing rationale comments across verbatim onto the new functions. Do not
  rewrite them; they encode decisions (§7 unit rule, labels-are-verbatim, one-note-per-sheet).
- **Do not fix bugs found along the way.** Note them in the PR description and leave the
  behaviour alone.
- One phase per commit, `refactor:` prefix, so each is reviewable and bisectable.
- Never `bunx visimark`. Use `bun src/cli/main.ts` from `packages/visimark`, or `visimark-dev`.
- Each commit carries exactly one `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the
  session doing the work. Do not copy a trailer out of this plan.

### Verification gate — run after *every* task, loop until green

```
bun test                      # 680 pass, 0 fail
bun run typecheck
bun run lint
cd packages/visimark && bun src/cli/main.ts check ../../docs/example-invoice-drift.md
cd packages/visimark && bun src/cli/main.ts check ../../docs/example-charts.md
cd ../.. && git diff --exit-code -- docs/
```

Plus a byte-diff harness captured **once before Task 1** and re-run after each task:

```
for f in docs/example-invoice.md docs/example-invoice-drift.md docs/example-charts.md; do
  for extra in "" "--json"; do
    (cd packages/visimark && bun src/cli/main.ts check "../../$f" $extra; echo "exit=$?")
  done
done > /tmp/check-baseline.txt
```

`diff` against the baseline must be empty. This catches ordering regressions that
`bun test` would miss on documents the suite does not cover.

---

### Task 1: Introduce `CheckState` and the shared lookup seam

**Files:**
- Create: `packages/visimark/src/eval/check-state.ts`
- Create: `packages/visimark/src/eval/check-lookup.ts`
- Modify: `packages/visimark/src/eval/check.ts`

**Interfaces:**

```ts
// check-state.ts
export interface CheckState {
  readonly model: DocModel;
  readonly opts: CheckOptions;
  readonly fallbackPrecision: number;

  // the accumulators that CheckResult is built from
  readonly values: Map<string, Value>;
  readonly cells: Map<string, (Value | null)[]>;
  readonly columnPrecision: Map<string, number>;
  readonly scalarPrecision: Map<string, number>;
  readonly columnUnits: Map<string, Unit | null>;
  readonly scalarUnits: Map<string, Unit | null>;
  readonly unitConflicts: Set<string>;

  // private to evaluation
  readonly unevaluable: Set<string>;
  readonly staleScalars: Set<string>;
  readonly dateErrorRows: Set<string>;
  readonly buildableCharts: Set<string>;

  emit(f: Finding, extra?: EmitExtra): void;
}
```

`readonly` on each field means the *binding* cannot be reassigned; the maps stay
mutable. That is deliberate — it keeps identity stable so `CheckResult` can hand the
same objects out, exactly as today.

```ts
// check-lookup.ts — shared by the eval loop and the chart phase
type LookupState = Pick<CheckState, "model" | "cells" | "dateErrorRows" | "emit">;
export function lookupVector(st: LookupState, binding: Binding, ref: Ref): Value[];
export function coerceInput(st: LookupState, text: string, sheetId: string,
                            column: string, row: number,
                            cell: { start: number; end: number } | undefined): Value;
export class Unevaluable extends Error {}
```

`Unevaluable` moves here because both callers throw and catch it. Confirm nothing else
in the package imports it (it is currently module-private).

- [ ] **Step 1.1** Capture the byte-diff baseline above.
- [ ] **Step 1.2** Add `check-state.ts` and construct a `CheckState` at the top of
      `check()`. Keep every existing `const` as a local **alias** into the state object
      (`const { values, cells, … } = st;`) so no body line changes yet. This commit
      should be provably no-op.
- [ ] **Step 1.3** Move `lookupVector`, `coerceInput` and `Unevaluable` to
      `check-lookup.ts`, threading `st`. Update `rowEnv`, `lookupScalar`, `readColumn`.
      `lookupScalar` stays inside `check()` for now — it reads `values` and
      `unevaluable` and is not needed by charts.
- [ ] **Step 1.4** Verification gate.

**Commit:** `refactor: introduce CheckState and extract the shared value lookups`

---

### Task 2: Extract the chart phase

**Files:**
- Create: `packages/visimark/src/eval/check-charts.ts`
- Modify: `packages/visimark/src/eval/check.ts`

**Interfaces:**

```ts
// check-charts.ts
type ChartState = Pick<CheckState,
  "model" | "opts" | "cells" | "columnUnits" | "columnPrecision" |
  "dateErrorRows" | "buildableCharts" | "emit">;

/** validates every `chart` declaration and compares it against the file on disk */
export function checkCharts(st: ChartState): ChartResult[];
```

The narrowed `ChartState` is the point of the exercise: the signature now *states* that
the chart pass cannot touch `values`, `scalarUnits`, `staleScalars`, `assertionResults`
or anything else. Today that is only knowable by reading 199 lines.

- [ ] **Step 2.1** Move lines 349–547 into `checkCharts`. `claimedPaths` and the
      `charts` array become locals of the new function; `charts` is its return value.
      The per-sheet `skipped` NOTE stays inside the same sheet loop, in position.
- [ ] **Step 2.2** Move `base`, `readLabels`, `inputPrecision` (636–691) into
      `check-charts.ts`. `base` takes only a `Chart`; `readLabels` and `inputPrecision`
      take `model` plus their arguments — none of the three needs `CheckState`.
- [ ] **Step 2.3** `readColumn` moves too, now a thin wrapper over `lookupVector(st, …)`.
      Keep its `try/catch → "contains a blank cell"` message exactly as written.
- [ ] **Step 2.4** `check()` calls `const charts = checkCharts(st);` at line 349's
      position. Verification gate.
- [ ] **Step 2.5** Add `packages/visimark/test/eval/check-charts.test.ts` exercising
      `checkCharts` directly against a built model, so the pass is testable without
      running the whole checker. Do not delete or weaken any existing test.

**Commit:** `refactor: extract the chart validation pass into check-charts.ts`

---

### Task 3: the cheap remaining phases

**Maintainer decision (2026-09-15): run through 3a and 3b.** 3c stands — the binding
loop stays inside `check()`.

The risk with phases B (the 105-line binding loop) and A (the 105-line
decoration inference) is that they each touch 12–15 accumulators, so hoisting them
converts closure variables into `st.` property accesses and buys a narrowed signature
that is barely narrower than `CheckState` itself. That is cosmetic, and it costs a
1,000-line diff over the most output-sensitive code in the repo.

After Task 2, `check()` drops to roughly **800 lines, of which ~340
is straight-line phase code**, and the sharpest remaining edges are cheap and
independent:

- [ ] **3a** Extract phase A (decoration/precision inference, 152–204) — it writes
      `columnUnits`/`unitConflicts` and reads nothing else. Genuinely narrow. ~55 lines.
- [ ] **3b** Extract phases C + E (cycles, unreachable assertions, anchors, unused-scalar
      and unused-alias WARNs — 310–348 and 549–635). Each is small, terminal, and mostly
      emit-only. ~130 lines.
- [ ] **3c** Leave the binding loop (205–309) and its eval helpers (694–1022) *inside*
      `check()` unless a concrete need appears. They are cohesive, they are the thing the
      function is actually for, and they are the highest-risk lines to move.

If 3a–3c land, `check()` ends at roughly 500 lines with the evaluation core intact —
which is a defensible resting point, not a compromise.

---

## Out of scope

- §2.8 (`cmdExplain`, `build()`) — blocked behind this, per the review.
- Any behaviour change, including ones that look like obvious improvements.
- Adding a test dependency or a property-test generator (that is §2.4).
