# Shrink `cmdExplain` (and leave `build()`) — Implementation Plan

**Source:** `docs/reviews/2026-09-15.md` §2.8 (row 21, rated B). Refactor only — no
paired spec, per the repo convention that refactors do not carry a design doc.

**Goal:** Move both renderings of `visimark explain` out of the CLI layer into
`packages/visimark/src/report/explain.ts`, leaving `cmdExplain` as argument parsing,
scope validation and I/O — without changing one byte of output, text or `--json`.

**Architecture:** every other reporting concern in this codebase already lives in
`src/report/` (`format.ts` renders check findings, `infer.ts` renders proposals,
`json.ts` builds envelopes). `cmdExplain` is the one command that renders inline.
The new module exposes the two renderings side by side, because they present the
same model slice and must stay in agreement; splitting them across two files is how
they drift.

**Tech Stack:** TypeScript (`strict` + `noUncheckedIndexedAccess`), Bun test.

---

## Findings from validating the review's brief

The request is well founded, with four corrections that change the plan.

1. **Line numbers have moved; the shape of the finding has not.** §2.1 landed since
   the review, so the figures need restating: `commands.ts` is **562 lines** (review
   said 547) and `cmdExplain` spans **405–556, 152 lines** (review said 390–541, ~151).
   The ratio is unchanged — `cmdExplain` is 27% of the file.

2. **The renderer is not one half, it is two, and the review only names one.**
   The suggested `explainText(model, result, scope): string` covers lines 498–554
   (57 lines). But the `--json` envelope at 441–496 is **56 lines** and is the same
   kind of code: it reads the same derived state (`order`, `assertionIds`, `chartIds`,
   `chartState`, `importState`) and renders it, just into an object instead of lines.
   Moving only the text half would leave `cmdExplain` at ~96 lines and — worse — put
   the two renderings of one data shape in two layers. **Move both.** That is the
   difference between a 152-line command and a ~40-line one.

3. **"Model slicing" is not a separable concern here.** The review describes three
   concerns: arg parsing, model slicing, rendering. In practice the "slice" is five
   lines (`topoOrder`, two `Map` constructions, `wanted`) and every consumer of it is
   a renderer. It moves into the report module as derivation, not out as a third unit.
   The `slice()` helper at 558 moves with it; nothing else in `commands.ts` calls it
   (verified) — the review's note that it "can stay" predates checking that.

4. **`string` is a safe return type, but only because of how `Writer` works.**
   `cmdExplain` today calls `out()` once per line; `formatCheck` returns one joined
   string and `cmdCheck` calls `out()` once. These are byte-identical because
   `main.ts:27` defines the default writer as `process.stdout.write(l + "\n")` and
   `capture()` in `test/cli/cli.test.ts` joins with `"\n"`. The current loop ends each
   sheet with `out("")`, so the joined string must keep that trailing empty element —
   `lines.join("\n")` then ends in `\n` and the writer adds the second one. Verified
   against both writers before committing.

**On `build()`: recommend leaving it.** The review already licenses this — "only if
it reads as genuinely tangled once you are in there". It is not. `build()` is 41–356
(**316 lines**) and is one loop over `doc.blocks` with a doc-scope branch and two
explicitly commented passes over parsed statements; `ensureSheet`, `parseOne` and
`rebase` are already factored out, and `parseOne` does cover per-statement-kind
parsing, which is the seam the review guessed at. The one real seam is the
**document-scope branch, lines 47–104 (58 lines)**, which reads only `block` and
`doc.source` and writes only `docScope` and `findings` — a genuinely narrow signature.
Task 3 below extracts exactly that and stops. Everything past it would be moving
closure variables into parameters over the code that turns source into the model,
for a line count. See "Maintainer decision" below.

---

## Global Constraints

- **Pure refactor. `visimark explain` output must not change by a single byte**,
  `--json` included. Its format is asserted in `test/cli/cli.test.ts` (four tests)
  and in doc transcripts.
- Key order in the JSON envelope is load-bearing — `JSON.stringify` emits insertion
  order, and the conditional `...(sheet.imported ? { import: … } : {})` spread must
  keep its position between `hasTable` and `inputs`.
- Exit codes and the `errorEnvelope` paths stay in `cmdExplain`. The report module
  renders a valid model; it does not decide usage errors.
- No `any`, no `as any`, no `@ts-ignore`/`@ts-expect-error`. Non-null `!` after a
  bounds check is the established idiom and is fine.
- Carry rationale comments across verbatim. Do not rewrite them.
- `parseArgs`, `read`, `showValue` and `bareToQualified` stay in `commands.ts`; they
  serve the other four subcommands.
- **Do not fix bugs found along the way.** Note them in the PR description.
- One concern per commit, `refactor:` prefix, so each is reviewable and bisectable.
- Never `bunx visimark`. Use `bun src/cli/main.ts` from `packages/visimark`, or
  `visimark-dev`.
- Each commit carries exactly one `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the
  session doing the work. Do not copy a trailer out of this plan.

### Verification gate — run after *every* task, loop until green

```
bun test                      # 700 pass, 0 fail
bun run typecheck
bun run lint
git diff --exit-code -- docs/
```

Plus a byte-diff harness captured **once before Task 1** and re-run after each task:

```
for f in docs/example-invoice.md docs/example-invoice-drift.md docs/example-charts.md \
         docs/example-invoice-csv-import.md; do
  for extra in "" "--json"; do
    (cd packages/visimark && bun src/cli/main.ts explain "../../$f" $extra; echo "exit=$?")
  done
done > /tmp/explain-baseline.txt
# plus one #sheet selector, and one bad selector for the exit-2 path
```

`diff` against the baseline must be empty. The suite's four explain tests do not
cover imports, charts or the multi-sheet document-scope header; this does.

---

### Task 1: Move the text renderer to `src/report/explain.ts`

**Files:**
- Create: `packages/visimark/src/report/explain.ts`
- Modify: `packages/visimark/src/cli/commands.ts`

**Interfaces:**

```ts
// explain.ts
/** the model slice both renderings read: topological order plus per-sheet state */
interface ExplainView {
  readonly model: DocModel;
  readonly order: Binding[];
  readonly assertionIds: ReadonlySet<string>;
  readonly chartIds: ReadonlySet<string>;
  readonly chartState: ReadonlyMap<string, ChartResult>;
  readonly importState: ReadonlyMap<string, ImportStatus>;
  readonly sheets: readonly string[];   // the requested scope, already validated
}
export function explainView(model: DocModel, result: CheckResult,
                            sheets: string[]): ExplainView;
export function explainText(view: ExplainView): string;
```

- [x] **Step 1.1** Capture the byte-diff baseline above.
- [x] **Step 1.2** Add `explain.ts` with `explainView` (the five derivation lines from
      424–431 plus `wanted`) and `explainText` (498–554), building a `string[]` and
      returning `lines.join("\n")`. Move `slice()` in as a module-private helper.
- [x] **Step 1.3** `cmdExplain` calls `out(explainText(view))` in place of the loop.
      Verification gate, including the trailing-blank check in the harness.

**Commit:** `refactor: move the explain text renderer into report/explain.ts`

---

### Task 2: Move the JSON envelope alongside it

**Files:** modify `packages/visimark/src/report/explain.ts`, `src/cli/commands.ts`

**Interfaces:**

```ts
export function explainJson(view: ExplainView, file: string): object;
```

It returns the whole envelope including `command`/`visimark`/`status`, matching how
`errorEnvelope` in `json.ts` already owns its envelope. `readVersion` is imported
from `../cli/version.js` — `json.ts` sets that precedent, so this adds no new edge.

- [x] **Step 2.1** Move 441–496 into `explainJson`, key order untouched.
- [x] **Step 2.2** `cmdExplain` becomes `if (json) { emitJson(out, explainJson(view, path)); return 0; }`.
- [x] **Step 2.3** Add `packages/visimark/test/report/explain.test.ts` exercising both
      renderers directly against a built model — matching how `report/format.test.ts`
      and `report/infer.test.ts` already work, and covering the charts and imports
      branches the CLI tests do not. Do not delete or weaken any existing test.
- [x] **Step 2.4** Verification gate. `cmdExplain` should now be ~40 lines and
      `commands.ts` ~450.

**Commit:** `refactor: move the explain --json envelope into report/explain.ts`

---

### Task 3: Extract `build()`'s document-scope branch

**Files:** modify `packages/visimark/src/model/build.ts`

```ts
/** document-scope blocks carry bare scalars only; everything else is a SHEET finding */
function buildDocScope(block: RawBlock, source: string,
                       docScope: Map<string, Binding>, findings: Finding[]): void;
```

- [x] **Step 3.1** Move 47–104 into `buildDocScope`. The outer loop becomes
      `if (block.sheetId === null) { buildDocScope(…); continue; }`. `build()` drops
      to ~258 lines and the loop reads as the two-case dispatch it is.
- [x] **Step 3.2** Verification gate plus `explain` on a document-scope document.

**Commit:** `refactor: extract build()'s document-scope branch`

---

## Maintainer decision

**Maintainer decision (2026-09-15): option A — run Tasks 1–3.**

- **A (chosen): Tasks 1–3.** Explain renderers move out; `build()` gets the one
  extraction with a genuinely narrow signature and keeps the rest. `build()` is not
  the finding's headline and this is the part of it that pays.
- **B: Tasks 1–2 only.** Close §2.8's `cmdExplain` half, record `build()` as
  reviewed-and-accepted at 316 lines with the reasoning above. Defensible — the
  review itself says not to refactor it to hit a line-count target.
- **C: Tasks 1–3 plus splitting the two sheet passes out of `build()`.** Not
  recommended. Each pass touches `sheet`, `headerIndex`, `table`, `findings`,
  `stmts` and the alias map, so the extracted signatures would be nearly as wide as
  the loop body, over the code that defines the model. High diff, low boundary.

## Outcome

`cmdExplain` ended at **43 lines** (from 152) and `commands.ts` at **449** (from 562);
`build()` at **262** (from 316). `explainView`/`explainText`/`explainJson` live in
`packages/visimark/src/report/explain.ts`, with `slice()` module-private beside them.

Output verified byte-identical for `explain` and `check` across every
`docs/example-*.md`, with and without `--json`, plus a `#sheet` selector, an unknown
selector, and the usage and read-error paths — 27 invocations, 1,389 lines, diff empty.
Tests: **711 pass, 0 fail** (700 before, plus 11 in the new
`test/report/explain.test.ts`).

One behaviour detail worth recording: `explainText` returns `""` for a document with
no scope bindings and no sheets, and `cmdExplain` guards the write. The per-line loop
this replaced made no call at all in that case, so an unguarded single `out()` would
have added a blank line to `visimark explain docs/example-quote-plain.md`. The
harness caught it; there is a comment at the call site and a test pinning it.

No bugs found along the way.

## Out of scope

- Any behaviour change, including ones that look like obvious improvements.
- `cmdFmt` (~105 lines) — the review does not name it and it is one cohesive pass.
- Re-opening §2.1; `check()` is done and `CheckResult` keeps its shape here.
