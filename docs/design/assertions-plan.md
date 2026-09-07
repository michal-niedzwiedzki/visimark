# assert statements — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** Ship `assert <boolean expr>` statements in `#id` sheet blocks, per [`docs/design/assertions-spec.md`](assertions-spec.md). `check` reports a new `ASSERT` finding (problem class, not auto-fixable, exit 1) when an assertion evaluates false; it is suppressed to `NOTE` when a binding it reads is itself unevaluable. `eval` exits 1 on a false assertion; `explain` lists a sheet's assertions; `eval --json` gains an `assertions` array; `infer` is untouched.

**Architecture:** An assertion is a new kind of node that flows through the same pipeline as a binding but stores nothing. `assert` is a lexer keyword (a new `TokenKind`), recognised at the start of a `vmark` block line by a new `parseStatement` layer over `parseBinding`; a line beginning with the `assert` token yields an `Assertion` AST/model node instead of a `Binding`. `model/build.ts` collects `Assertion`s onto their `Sheet` (a document-scope block with an `assert` line is a `SHEET` finding). `eval/graph.ts` includes assertions in the dependency graph and topological order as synthetic nodes (`<sheetId>::assert@<offset>`), so they evaluate after everything they read and are pulled into `unevaluable` on a cycle. `eval/check.ts` grows an assertion branch in the `order` loop: evaluate the expression, require a boolean (`TYPE` otherwise), emit `ASSERT` when false with the source text and an operand-substituted form, or fold an unevaluable dependency into a per-sheet `NOTE`. `report/format.ts` grows an `ASSERT` case. `cli/commands.ts` widens `eval` (exit 1 + stderr block + `--json` array) and `explain` (trailing `assertions:` block). No change to `write/` (fmt never owns an assertion — its exit-1-on-unrepairable behaviour already covers a standing `ASSERT`), `infer/`, or the offset splicer. `packages/visimark-lsp` surfaces the new diagnostic automatically (it maps engine findings; confirm no hardcoded code list).

**Tech Stack:** TypeScript; `decimal.js` (numeric core); Bun test runner; engine package `packages/visimark`; LSP package `packages/visimark-lsp`; VS Code client `editors/vscode`.

**Spec:** [`docs/design/assertions-spec.md`](assertions-spec.md)

## Global Constraints

- Work on branch `issue/27-assertions-impl` (draft PR #32). Do **not** open a new PR.
- `docs/example-invoice-drift.md` stays **byte-for-byte identical**; its 26-problem [§13](../visimark-design.md#13-testing) transcript in `test/acceptance.test.ts` does not move.
- `docs/example-invoice.md` gains exactly one `assert` line in `#recon` plus one appendix paragraph; `visimark check` on it stays `0 problems (0 stale, 0 errors)` and `visimark fmt` leaves it byte-for-byte identical (the `fmt` idempotence / no-op acceptance must still pass).
- No new npm dependencies.
- New `FindingCode` value: `ASSERT`, added to `ERROR_CODES` (so it counts under "errors" and fails the run). No other taxonomy change.
- `assert` is a keyword: `assert` may not be a bound name or a column header. Verbatim messages:
  - not a boolean → `assert needs a boolean; \`<expr-or-name>\` is a <type>`
  - `assert` as a name / column header → `` `assert` is a keyword ``
  - `assert` in a document-scope block → `` `assert` must be in a `#id` sheet block ``
- Rounding is untouched: operands compare exactly at their existing binding precision. No tolerance, no new numeric path.
- The `ASSERT` report line is transcript-exact (see spec §4) and column-aligned with the existing grid (`prefix`, `ID_FIELD`, `CONT` in `report/format.ts`).
- `eval`'s exit contract widens from `{0,2}` to `{0,1,2}`; document it in `docs/cli-reference.md`.
- Every commit ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- After each task: `bun test`, `bun run typecheck`, `bun run build` from the repo root, plus `bun run packages/visimark/src/cli/main.ts check` on `docs/example-invoice.md` and `docs/example-invoice-drift.md`. Loop check → fix → check until green. Never `bunx visimark` (published build).

---

### Task 1: `assert` keyword and the `Assertion` node

**Files:**
- Edit: `packages/visimark/src/lang/token.ts` — add `"assert"` to `TokenKind`.
- Edit: `packages/visimark/src/lang/lexer.ts` — emit an `assert` token for the bare word `assert` (before the `ident` fallthrough; `and`/`or`/`not` in `WORD_OPS` are the model, but `assert` is its own kind, not an `op`).
- Edit: `packages/visimark/src/lang/ast.ts` — add `interface Assertion { type: "assert"; expr: Expr } & Pos` and export a `Statement = Binding | Assertion` shape helper if useful (keep `Expr` union unchanged — an assertion is not an expression).
- Edit: `packages/visimark/src/lang/parser.ts` — add `parseStatement(line: string): Binding | Assertion`: lex the line; if the first non-eof token is `assert`, parse the remainder with `new Parser(rest).parseTopLevel()` and return an `Assertion` (spans rebased by the caller as today); otherwise delegate to the existing `parseBinding`. A line whose LHS-of-`=` lexes to an `assert` token → `LangError("`assert` is a keyword", …)`.
- Edit: `packages/visimark/src/model/types.ts` — add `"ASSERT"` to `FindingCode` and to `ERROR_CODES`; add `interface Assertion { sheetId: string; expr: Expr; span: {start:number; end:number}; source: string; parseError?: LangError }`; add `assertions: Assertion[]` to `interface Sheet` (init `[]` in `ensureSheet`).
- Edit: `packages/visimark/src/model/build.ts` — for a `#id` block, route each raw line through `parseStatement`; push `Assertion`s onto `sheet.assertions` (rebasing `expr` spans with the existing `rebase`, capturing `source` = `rb.raw` with the leading `assert ` kept for the report). For a document-scope block, an `assert` line emits `{ code: "SHEET", message: "`assert` must be in a `#id` sheet block", span }` and is dropped.
- Test: `packages/visimark/test/lang/lexer.test.ts`, `packages/visimark/test/lang/parser.test.ts`, `packages/visimark/test/model/build.test.ts`.

**Interfaces:**
- Produces: `parseStatement("assert a == b")` → `{ type: "assert", expr: <Binary ==>, … }`; `parseStatement("x = 1")` → `Binding` unchanged; `parseStatement("assert = 1")` throws `LangError("`assert` is a keyword")`. `build(doc).sheets.get("recon").assertions` is a populated `Assertion[]`. A document-scope `assert` line yields a `SHEET` finding in `model.findings`.
- Consumes: existing `lex`, `Parser`, `parseBinding`, `rebase`.

- [ ] **Step 1: lexer + token tests (RED).** In `lexer.test.ts` assert `lex("assert x")[0]` is `{ kind: "assert", value: "assert" }` and that `assert` mid-expression (e.g. `a + assert`) still lexes the word as `assert` (the parser, not the lexer, rejects misplacement). Add `"assert"` to `TokenKind` and the lexer word-scan.
- [ ] **Step 2: `parseStatement` tests (RED), then implement.** Cover: `assert` statement returns an `Assertion`; a normal binding still returns a `Binding`; `assert = 1` and `assert=1` throw the keyword message; `assert` with a trailing comparison chain error still surfaces (`comparisons do not chain`). Implement `parseStatement` and the `ast.ts` type.
- [ ] **Step 3: model tests (RED), then implement.** In `build.test.ts`: a `#recon` block with `assert variance == 0` populates `sheet.assertions` with the right `source`, `span`, and rebased `expr` offsets; a document-scope `assert` → one `SHEET` finding; `assert` as a **column header** in a table + a `#id` block referencing it → `TYPE` "`assert` is a keyword" (or the header simply cannot be a rule name — pick the path that the parser already forces and assert it). Wire `parseStatement` + `sheet.assertions` into `build.ts`.
- [ ] **Step 4:** `bun test`, `typecheck`, `build`; both example docs still check clean (no assertions in them yet).

---

### Task 2: assertions in the dependency graph

**Files:**
- Edit: `packages/visimark/src/eval/graph.ts` — `topoOrder` adds one synthetic node per assertion (`id = \`${sheetId}::assert@${assertion.span.start}\``, a stable key). `dependencies()` accepts an assertion (or a thin `Binding`-shaped adapter: `{ id, sheetId, name: "", kind: "scalar", expr, span }`) so the existing `visit` walk produces `deps` / `vectorRefs` / `undefRefs` / `callErrors`. Because `kind` is `"scalar"` and never `"column"`, any bare foreign-column or own-column vector reference in an assertion lands in `vectorRefs` — the scalar-only rule falls out for free.
- Edit: `packages/visimark/src/model/types.ts` — if the adapter approach is not used, widen `Binding.kind` to include `"assert"` and make `name` optional; otherwise leave `Binding` alone. **Prefer the adapter** — it keeps `Binding` semantics intact for `write/`, `infer/`, `report/`.
- Test: `packages/visimark/test/eval/graph.test.ts`.

**Interfaces:**
- Produces: `topoOrder(model).order` contains the assertion nodes, each ordered after every binding it reads; `topoOrder(model).cycles` pulls in an assertion that sits on a cycle path; `dependencies(model, <assertion>)` returns `vectorRefs` for `assert Net > 0` (Net a column) and `deps` for `assert SUM(col) == 1`.
- Consumes: existing `resolve`, `dependencies`, `topoOrder` internals.

- [ ] **Step 1: graph tests (RED).** `assert SUM(schedule.Amount) == lines.gross_total` in `#recon` → two `deps`, no `vectorRefs`. `assert Net > 0` in a sheet with a `Net` column → one `vectorRef`. `assert missing == 0` → one `undefRef`. An assertion reading a name on a `CYCLE` path appears in `cycles`.
- [ ] **Step 2:** implement the synthetic-node insertion and the assertion→`dependencies` adapter.
- [ ] **Step 3:** `bun test`, `typecheck`, `build`.

---

### Task 3: evaluate assertions in `check`

**Files:**
- Edit: `packages/visimark/src/eval/check.ts`:
  - In the `for (const binding of order)` loop, branch when the node is an assertion. Reuse the existing pre-flight checks (`callErrors` → `TYPE`, `undefRefs` → `UNDEF`, `vectorRefs` → `VECTOR`, any `unevaluable` dep → mark unevaluable and **increment a per-sheet `assertSuppressed` counter**).
  - Otherwise evaluate `assertion.expr` with `evalExpr` in the sheet env. If the result is not a boolean → `emit({ code: "TYPE", sheetId, message: \`assert needs a boolean; …\`, span })`. If `false` → `emit({ code: "ASSERT", sheetId, source: assertion.source, message: <substituted form>, span })`. If `true` → nothing.
  - Operand substitution: walk `assertion.expr`; for each `Ref`, replace its source slice with the formatted evaluated value (bare number at binding precision via the existing `scalarPrecision` / `roundToPlaces` / value-formatting helpers; ISO text for a date; the raw string for a string). Leave literals and `Call` nodes as written. Assemble left-to-right from `assertion.source` minus the leading `assert `.
  - After the loop, for each sheet with `assertSuppressed > 0` emit one `{ code: "NOTE", sheetId, suppressedCount, message: \`${n} assertion${…} not verified (upstream errors)\` }` — mirror the existing column-rule `NOTE` shape.
  - Include assertion nodes when building the final sorted `findings` (they emit during the `order` walk, so `det` ordering already interleaves them correctly — verify against the sort near the end of `check`).
- Edit: `packages/visimark/src/eval/check.ts` `emitCoverage` / `countBindings` — count `sheet.assertions.length` so a sheet whose only checked content is an `assert` does not trip `COVERAGE`.
- Test: `packages/visimark/test/eval/check.test.ts`, `packages/visimark/test/eval/booleans.test.ts`.

**Interfaces:**
- Produces: `check(model).findings` contains a single `ASSERT` finding (with `source` + substituted `message`) for a false assertion; nothing for a true one; a `TYPE` for `assert Net + 1`; a `VECTOR` for `assert Net > 0`; one `NOTE` per sheet whose assertions are all upstream-suppressed. `check(model).exitCode` is `1` whenever an `ASSERT` is present.
- Consumes: `evalExpr`, `EvalEnv`, value formatting, `Unevaluable`.

- [ ] **Step 1: check tests (RED).** true → 0 findings; false → 1 `ASSERT`, `exitCode 1`; assertion whose dependency is **unevaluable** (`UNDEF`/`VECTOR`/`TYPE`/`CYCLE`/`DATE`) → per-sheet `NOTE` only, `ASSERT` absent; a merely-`STALE` dependency still evaluates; non-boolean → `TYPE`; vector → `VECTOR`; assertion + no column rules + a table → **no** `COVERAGE`. (Note: the spec originally said "STALE suppresses"; corrected — the engine computes behind a `STALE` and the assertion is about the computed value.)
- [ ] **Step 2:** implement the branch, the substitution helper, the per-sheet `NOTE`, the coverage count.
- [ ] **Step 3:** `bun test`, `typecheck`, `build`; example docs still clean.

---

### Task 4: report line, then the `eval` / `explain` / `--json` surfaces

**Files:**
- Edit: `packages/visimark/src/model/types.ts` — add `source?: string` to `Finding` (the verbatim assertion text) if `message` alone is not enough; keep `message` as the substituted form.
- Edit: `packages/visimark/src/report/format.ts` — `case "ASSERT"` in `renderGroup`: head = `prefix("ASSERT") + ("#" + f.sheetId).padEnd(ID_FIELD) + f.source`; continuation = `CONT + f.message + "   is false"`. Confirm `footer()` counts `ASSERT` (it is in `ERROR_CODES`, so the `else if (ERROR_CODES.has(f.code)) errors++` branch already does — add a test).
- Edit: `packages/visimark/src/cli/commands.ts`:
  - `eval`: after computing, if any finding is `ASSERT`, write the rendered `ASSERT` group(s) to **stderr** and set exit `1`. `--get NAME` still prints the value to stdout first, then exits `1`. Update the command's exit-code doc comment.
  - `explain`: after a sheet's existing sections, if `sheet.assertions.length`, print an `assertions:` line then each `assertion.source` indented, in document order.
  - `eval --json`: add a top-level `"assertions"` array — `{ sheet, source, holds, operands }` where `operands` maps each named ref to its formatted value (same formatting as the report substitution).
- Edit: `packages/visimark/test/report/format.test.ts`, `packages/visimark/test/cli/cli.test.ts`.

**Interfaces:**
- Produces: the exact two-line `ASSERT` block from spec §4; `visimark eval FIXTURE` exit `1` with the block on stderr; `visimark eval FIXTURE --json` containing `assertions: [{ holds: false, … }]`; `visimark explain` showing the `assertions:` block.
- Consumes: existing `formatCheck` / `renderGroup`, the CLI command wiring.

- [ ] **Step 1: format test (RED)** for the exact `ASSERT` lines (both the simple and the compound example in spec §4). Implement `renderGroup`'s case.
- [ ] **Step 2: CLI tests (RED)** for `eval` exit 1 + stderr, `eval --json` array, `explain` block. Implement in `commands.ts`.
- [ ] **Step 3:** `bun test`, `typecheck`, `build`.

---

### Task 5: acceptance docs, fixture, and the documentation task

**Files:**
- Edit: `docs/example-invoice.md` — add `assert variance == 0` as the last line of the `#recon` block; add one appendix paragraph ("The `#recon` sheet now *enforces* the reconciliation: `assert variance == 0` fails `check` if the instalments ever stop summing to the invoice.").
- New: `packages/visimark/test/fixtures/assert-fail.md` — `# Share allocation`; a `Milestone | Share` table with input rows `Signature 30%`, `Delivery 40%`, `Acceptance 20%`; a `#plan` block with `total = SUM(Share)` and `assert total == 1`.
- Edit: `packages/visimark/test/acceptance.test.ts` (or `test/cli/cli.test.ts`) — assert the fixture's `check` transcript, verbatim:
  ```
  <path>/assert-fail.md

    ASSERT  #plan          total == 1
            0.90 == 1   is false

    1 problem (0 stale, 1 error)
  ```
  and `exitCode 1`; and `eval --get plan.total` → `0.90` on stdout, exit 1.
- Edit: `docs/visimark-design.md` — **append a new section "17. Assertions"** after §16 (no renumbering of existing sections): statement form, `assert` keyword, scalar-boolean shape rule, the `ASSERT` finding, `NOTE` suppression, `eval` / `explain` behaviour, and the deferred list (per-row, document-scope, prose-anchored). Add one-line cross-references: in §4 after the boolean discussion ("A top-level boolean is consumed by an `assert` statement — §17."); in §8 ("Assertions are nodes in this graph too — §17."); in the §10 table a new row `| \`ASSERT\` | an assertion evaluated false | no |`; in §11 the `eval` line gains "exits 1 if an assertion is false".
- Edit: `docs/cli-reference.md` — Findings table gains an `ASSERT` row; Exit codes / `eval` gains the "exits 1 on a false assertion" note; Options table notes `eval --json` now includes assertions.
- Edit: `CHANGELOG.md` `## Unreleased` → `### Added` — an `assert` statements entry (what it is, the `#recon` motivation, the v1 limits: scalar-only, sheet-blocks-only, explicit rounding).
- Edit: `editors/vscode/CHANGELOG.md` — one line: a false `assert` now shows as a diagnostic.
- Edit: `docs/vocabulary-catalogue.md` — move the `assert` statements row **out of section E** into the [Shipped register](../vocabulary-catalogue.md#shipped) as `UNRELEASED`: `| \`assert\` statements | language feature | [#27](…issues/27) | [#32](…pull/32) | — | [APPROVED](…issuecomment-5570701059) |`. Drop the prose columns.
- Check: `packages/visimark-lsp` — confirm a false assertion produces a diagnostic (the LSP maps engine findings; if it has a code allowlist, add `ASSERT`). Add an LSP test if the package has them for other codes.
- Consider: `.github/workflows/dogfood.yml` — `docs/example-invoice.md` is already in the checked list, so the passing assertion is dogfooded automatically. `docs/design/*` is not checked and does not need to be. No workflow edit.

**Interfaces:**
- Produces: `bun test` green including the new fixture acceptance; `visimark check docs/example-invoice.md` → `0 problems`; `visimark fmt docs/example-invoice.md` → no change; `visimark check docs/example-invoice-drift.md` → the unchanged 26-problem transcript.

- [ ] **Step 1:** add the fixture + its acceptance test (RED — `ASSERT` unimplemented paths now all done, so this should pass once the fixture exists; if the transcript columns are off, fix `report/format.ts`, not the test).
- [ ] **Step 2:** edit `docs/example-invoice.md`; run `check` (0 problems) and `fmt` (no diff); update the `fmt` no-op acceptance if it snapshots the file.
- [ ] **Step 3:** the documentation edits — design doc section + cross-refs, cli-reference, both changelogs, catalogue row to Shipped register.
- [ ] **Step 4:** LSP check + test.
- [ ] **Step 5:** full green sweep — `bun test`, `bun run typecheck`, `bun run build`, and `check` on both example docs. Loop until green.

---

## Done when

- `bun test`, `bun run typecheck`, `bun run build` all green.
- `visimark check` on the new fixture reproduces the spec §6 transcript byte-for-byte and exits 1.
- `docs/example-invoice.md` checks clean and `fmt` is a no-op; `docs/example-invoice-drift.md` is untouched and its transcript test still passes.
- `visimark eval` exits 1 on a false assertion; `explain` lists assertions; `eval --json` carries the `assertions` array.
- Design doc, cli-reference, `CHANGELOG.md` `## Unreleased`, `editors/vscode/CHANGELOG.md`, and the catalogue row (now `UNRELEASED` in the Shipped register) are all updated.
- CI green on PR #32; the PR is promoted out of draft.

<!--vmark:no-formulas-->
