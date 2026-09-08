# Σ / ∑ alias for SUM — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** Per [`docs/design/as-an-alias-for-sum-spec.md`](as-an-alias-for-sum-spec.md), make `Σ` (U+03A3) and `∑` (U+2211) lex as the identifier `SUM` — nothing else. No new token kind, no new `FindingCode`, no entry in `FUNCTIONS`; every downstream stage (parser, arity/shape check, evaluator, `infer`, did-you-mean) is unaware an alias exists because it never sees one — it sees `SUM`.

**Architecture:** One lexer-level substitution. In `lang/lexer.ts`'s main scan loop, a new branch recognising the two literal codepoints pushes `{ kind: "ident", value: "SUM", start: i, end: i + 1 }` and advances one character — placed as a sibling check before the existing `isIdentStart(c)` branch (both glyphs are outside the ASCII ranges `isIdentStart`/`isIdentPart` test, so ordering relative to that branch doesn't matter for correctness, but placing it first keeps the two single-codepoint checks visually grouped at the top of the identifier-handling code). No other file in `lang/`, `eval/`, `model/`, `write/`, or `infer/` changes: `FUNCTIONS`, `callProblem`/`describeCallProblem`, the did-you-mean candidate list (`FUNCTIONS.keys()`), and `fmt`'s splicer all consume the resolved `SUM` token exactly as they do today, unaware of the source spelling. `explain` (`cli/commands.ts`, `slice(model, b)`) already echoes raw source bytes for a binding's expression, so it prints whatever glyph the author wrote with no change needed there either.

**Tech Stack:** TypeScript; Bun test runner; engine package `packages/visimark`.

**Spec:** [`docs/design/as-an-alias-for-sum-spec.md`](as-an-alias-for-sum-spec.md)

## Global Constraints

- Work on branch `issue/43-as-an-alias-for-sum-impl` (draft PR #49). Do **not** open a new PR.
- No new `TokenKind`, no new `FindingCode`, no change to `FUNCTIONS`, `callProblem`, `describeCallProblem`, or the did-you-mean candidate set.
- Only `Σ` (U+03A3) and `∑` (U+2211) are recognised. Lowercase Greek sigma (`σ`, U+03C3) and final sigma (`ς`, U+03C2) are **not** aliased and must continue to fail exactly as today (`unexpected character` `LangError` from the lexer's fallthrough).
- `example-invoice.md`, `example-charts.md`, `example-invoice-drift.md` are not edited and their required transcripts ([§13](../visimark-design.md#13-testing)) do not change — the alias stays out of the canonical examples (spec §6).
- `fmt` must not rewrite `Σ`/`∑` to `SUM` or back, on any pass — verify explicitly, since this is the property the whole design leans on (spec §5).
- Every commit ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- After each task: `bun test`, `bun run typecheck`, `bun run build` from the repo root, plus `bun run packages/visimark/src/cli/main.ts check` on `docs/example-invoice.md`, `docs/example-charts.md`, and `docs/example-invoice-drift.md`. Loop check → fix → check until green. Never `bunx visimark` (published build).

---

### Task 1: lexer alias

**Files:**
- Edit: `packages/visimark/src/lang/lexer.ts` — add, in the main `while (i < src.length)` loop, a branch testing `c === "Σ" || c === "∑"` that calls `push("ident", "SUM", i, i + 1)` and `i++; continue;`. Place it immediately before the existing `if (isIdentStart(c)) { ... }` branch, with a short comment pointing at the spec (`docs/design/as-an-alias-for-sum-spec.md`) and stating explicitly that this is a **closed, two-codepoint substitution, not a general symbol-alias mechanism** — the scope-creep guard the spec relies on review norms (not a test) to enforce.
- Test: `packages/visimark/test/lang/lexer.test.ts`.

**Interfaces:**
- Produces: `lex("Σ(Net)")` and `lex("∑(Net)")` each equal `lex("SUM(Net)")` token-for-token except the first token's `start`/`end` is `[0, 1]` instead of `[0, 3]`, and every later token's offset is shifted left by 2 relative to the `SUM(Net)` version (own source positions, unaffected in kind/value).
- Consumes: nothing new — pure addition to the existing lexer scan loop.

- [ ] **Step 1: tests (RED).** In `lexer.test.ts`: `pairs("Σ(Net)")` and `pairs("∑(Net)")` each equal `pairs("SUM(Net)")`; the offset test (`toks.map(t => [t.kind, t.value, t.start, t.end])`) for `"Σ(Net)"` equals `[["ident","SUM",0,1],["lparen","(",1,2],["ident","Net",2,5],["rparen",")",5,6],["eof","",6,6]]`; `lex("σ(Net)")` and `lex("ς(Net)")` (lowercase) still throw `LangError` with message `unexpected character "σ"` / `"ς"` (unchanged from today); `lex("Σ")` alone (no call) is `[["ident","SUM",0,1],["eof","",1,1]]`, matching `lex("SUM")`.
- [ ] **Step 2:** implement the lexer branch as described above.
- [ ] **Step 3:** `bun test`, `typecheck`, `build`; both example docs still check clean.

---

### Task 2: full-pipeline behaviour (parser, evaluator, findings, `fmt`, `infer`, did-you-mean)

**Files:**
- Edit: `packages/visimark/test/eval/functions.test.ts` — add cases mirroring the existing `SUM` tests: a fixture using `total = Σ(Net)` evaluates identically to the `SUM(Net)` fixture (reuse `withScalar`); `Σ(Price * Qty)` produces the same `TYPE` finding, same message text (`"SUM() takes a column reference, not an expression"`), as `SUM(Price * Qty)` (spec §3, §4); `Σ()` and `Σ(a, b)` produce the same arity `TYPE` findings as `SUM()`/`SUM(a, b)`, message naming `SUM`; `share = Net / Σ(Net)` type-checks clean, matching the existing `SUM` composition test; `Σ(schedule.Amount)` (foreign column) is legal, matching `SUM(schedule.Amount)`.
- Edit: `packages/visimark/test/eval/functions.test.ts` (did-you-mean section) — an unresolvable name near `SUM` (e.g. `SUMM(Net)`) still suggests only `SUM`, never `Σ`/`∑`; confirms `FUNCTIONS.keys()` (the suggestion candidate set) is unchanged.
- Edit: `packages/visimark/test/write/fmt.test.ts` (the `fmt` round-trip / idempotence suite) — a document with a column rule `total = Σ(Net)` and a stale computed cell: `fmt` rewrites the **cell**, and the rule text `Σ(Net)` in the `vmark` block is byte-identical before and after `fmt` (never rewritten to `SUM(Net)`). Run twice to confirm idempotence.
- Edit: `packages/visimark/test/infer/acceptance.test.ts` (or `figures.test.ts`/`write.test.ts` — whichever already asserts an inferred `SUM(...)` formula text end-to-end; check all three and add the assertion next to the existing `SUM` case) — `infer` reverse-engineering a `SUM`-shaped total from example values proposes `SUM(...)`, never `Σ(...)`/`∑(...)`, confirming spec §5's "infer never emits the alias" claim; this requires no code change, only a test making the existing behaviour explicit.
- Test: as listed above — no new test files, all additions to existing suites.

**Interfaces:**
- Produces: `check()`, `eval`, `fmt`, and `infer` all treat `Σ(Net)`/`∑(Net)` as indistinguishable from `SUM(Net)` in every respect except which source bytes a rule expression contains.

- [ ] **Step 1: tests (RED)** for all cases above.
- [ ] **Step 2:** confirm green with no production-code change beyond Task 1 (expected — Task 1 is the entire implementation; this task exists to prove the "resolves before anything else sees it" design claim, not to add new logic). If any case fails, the failure identifies a place that inspects a call's source text rather than its resolved name — fix that call site, minimally, to use the resolved name (do not special-case the alias anywhere).
- [ ] **Step 3:** `bun test`, `typecheck`, `build`; both example docs still check clean.

---

### Task 3: `explain` echoes source spelling

**Files:**
- Edit: `packages/visimark/test/cli/cli.test.ts` (the `explain` command coverage) — a sheet with `total = Σ(Net)` shown via `visimark explain`: the rule line reads `total = Σ(Net)` (raw source, per `slice(model, b)`), not `total = SUM(Net)`. A companion case for `∑`. No production-code change expected (`explain` already slices source bytes) — this task exists to lock the behaviour spec §5 promises into a test.
- Test: as above.

**Interfaces:**
- Produces: `visimark explain` output for a document using the alias is byte-faithful to what the author wrote.

- [ ] **Step 1: tests (RED)** for the `explain` cases above.
- [ ] **Step 2:** confirm green with no production-code change (expected).
- [ ] **Step 3:** `bun test`, `typecheck`, `build`; both example docs still check clean.

---

### Task 4: documentation

**Files:**
- Edit: `docs/visimark-design.md` — [§4](../visimark-design.md#4-syntax), immediately after the "Builtin functions" table and its closing paragraph ("there is nothing for a second column to mean.", line ~242) and before "## 5. Dates": add a single footnote paragraph, e.g. *"`Σ` (U+03A3) and `∑` (U+2211) lex as `SUM` — nothing else changes. `SUM` is the only spelling documented, generated by `infer`, or suggested by did-you-mean; the alias is a closed, two-codepoint substitution, not a general symbol-notation system."* Keep it to one short paragraph — per the spec's non-goals, this is deliberately not a table row.
- Edit: `CHANGELOG.md` `## Unreleased` → `### Added` — one entry: `Σ` (U+03A3) and `∑` (U+2211) are now accepted as lexical aliases for `SUM` (issue #43) — `total = Σ(Net)` is exactly `total = SUM(Net)`; no new semantics, and `SUM` stays canonical everywhere generated. Note that a document that previously hit a lex error (`unexpected character`) on either glyph now parses.
- Edit: `editors/vscode/CHANGELOG.md` `## Unreleased` — one line: writing `Σ`/`∑` no longer shows as a parse-error diagnostic; it's treated as `SUM`.
- Edit: `docs/vocabulary-catalogue.md` — move the `Σ` / `∑` alias for `SUM` row **out of section E** into the [Shipped register](../vocabulary-catalogue.md#shipped) as `UNRELEASED`: `| Σ / ∑ alias for SUM | language feature | [#43](https://github.com/michal-niedzwiedzki/visimark/issues/43) | <this PR> | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/43#issuecomment-5588631404) |`. Drop the prose columns.
- Check: `docs/cli-reference.md` — search for a builtin-function listing or a `SUM` mention; only edit if it enumerates individual builtins (if it only documents CLI flags/commands, no change is needed — confirm before editing).

**Interfaces:**
- Produces: `bun test` green including all new coverage; design doc §4, both CHANGELOGs, and the catalogue (row now `UNRELEASED` in the Shipped register) all reflect the shipped behavior.

- [ ] **Step 1:** design-doc §4 footnote.
- [ ] **Step 2:** `CHANGELOG.md` entry.
- [ ] **Step 3:** `editors/vscode/CHANGELOG.md` entry.
- [ ] **Step 4:** `docs/vocabulary-catalogue.md` row moved to Shipped register as `UNRELEASED`.
- [ ] **Step 5:** `docs/cli-reference.md` check (edit only if warranted).
- [ ] **Step 6:** full green sweep — `bun test`, `bun run typecheck`, `bun run build`, and `check` on all three example docs. Loop until green.

---

## Done when

- `bun test`, `bun run typecheck`, `bun run build` all green.
- `Σ(Net)` and `∑(Net)` are provably indistinguishable from `SUM(Net)` in `check`, `eval`, `fmt`, and `infer`, and are never suggested or emitted as a spelling by any tool command.
- `example-invoice.md`, `example-charts.md`, `example-invoice-drift.md` are untouched and their acceptance transcripts still pass byte-for-byte.
- Design doc §4 footnote, `CHANGELOG.md` `## Unreleased`, `editors/vscode/CHANGELOG.md`, and the catalogue row (now `UNRELEASED` in the Shipped register) are all updated.
- CI green on the PR; the PR is promoted out of draft.

<!--vmark:no-formulas-->
