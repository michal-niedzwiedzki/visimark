# Declared precision — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** Move a value's decimal width out of prose, per [`docs/design/declared-precision-spec.md`](declared-precision-spec.md). A `precision N` clause on a binding head declares it; otherwise it is derived from the binding's own expression where the operation bounds it exactly; otherwise a new `PRECISION` finding (problem class, not auto-fixable, exit 1). Anchor text stops being a precision source, so a bare anchor becomes seedable and `686.0000` becomes `STALE`. The document-scope `precision` constant is removed. No sheet scope, no rounding-discipline syntax.

**Architecture:** `precision` becomes a lexer keyword and a clause on the binding head, parsed before `=` by `parseBindingInner` (the LHS is already multi-token for `"Header" is symbol`, so the shape has precedent). `Binding` carries `precision?: number` through `lang/ast.ts` and `model/types.ts`. A new `eval/precision.ts` owns the derivation table (§3.3) as a pure function over `Expr` plus a column-precision lookup, returning `number | "not-derivable"`; `eval/check.ts` calls it in place of today's `decimalPlaces(anchorText, fallbackPrecision)` and emits `PRECISION` where it returns `not-derivable` and nothing is declared. `CheckState.fallbackPrecision` and `docPrecision()` are deleted. `parse/document.ts` drops `TRAILING_NUMBER_RE` from `anchorValueSpan`, so a bare text node and an empty anchor both become anchor targets; `check.ts` keeps reading anchor text for **units** only. `write/fmt.ts` renders every anchor at the binding's governing precision and splices into an empty span to seed a bare anchor. The runtime ceiling (§3.5) is a guard in `eval/value.ts`'s rounding path, reported as `PRECISION`. `report/format.ts`, `report/json.ts`, `cli/commands.ts` (`explain`) and `infer/propose.ts` grow the new surfaces. `packages/visimark-lsp` maps engine findings, so it needs only a message case.

**Tech Stack:** TypeScript; `decimal.js` (numeric core, `precision: 40` significant digits); Bun test runner; engine package `packages/visimark`; LSP package `packages/visimark-lsp`; VS Code client `editors/vscode`.

**Spec:** [`docs/design/declared-precision-spec.md`](declared-precision-spec.md)

## Global Constraints

- Work on branch `feat/declared-precision`. One PR; do not open a second.
- Every commit ends with the `Co-Authored-By` trailer resolved from [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the session doing the work. Do not copy a trailer from another plan or an earlier commit.
- New `FindingCode` value: `PRECISION`, added to `ERROR_CODES` in `packages/visimark/src/model/types.ts` **and** to the hardcoded `errorCodes` set in `packages/visimark/test/acceptance.test.ts`. Omitting the second lets the drift error count pass while a sixth error exists.
- `precision` is a keyword: it may not be a bound name or a column header. Verbatim messages:
  - keyword misuse → `` `precision` is a keyword — write `precision 2`, not `precision = 2` ``
  - out of range → `` precision must be a whole number from 0 to 18 ``
  - on a non-numeric binding → `` a string or date value has no precision ``
- `N` is `0`–`18` inclusive ([spec §3.5](declared-precision-spec.md#35-the-working-precision-ceiling)). Do **not** raise `Decimal.precision` to make a wider cap work; that is a separate change with its own evidence.
- Rounding discipline is untouched: half-up, global, and `ROUND`/`FLOOR`/`CEILING` remain the only per-binding control. No `truncated` / `half up` / `half even` keywords, no `TRUNC`.
- No document-scope and no sheet-scope precision. Delete `docPrecision()` and `CheckState.fallbackPrecision` rather than leaving them unread.
- No new npm dependencies.
- `docs/example-invoice.md` gains exactly two `precision` clauses ([spec §7](declared-precision-spec.md#7-migration)) and must still report `0 problems (0 stale, 0 errors)` with `fmt` a byte-for-byte no-op.
- `docs/example-charts.md` must still report zero findings with both SVGs byte-identical.
- `docs/example-invoice-drift.md`'s fenced console transcript is **regenerated, not hand-edited**, and the three count assertions in `acceptance.test.ts` are re-derived from the run rather than assumed.
- After each task: `bun test`, `bun run typecheck`, `bun run build`, `bun run lint`, `bun run format:check` from the repo root, plus `bun run packages/visimark/src/cli/main.ts check` on every `docs/example-*.md`. Loop check → fix → check until green. Never `bunx visimark` (published build).

---

### Task 1: the `precision` keyword and the clause on the binding head

**Files:**
- Edit: `packages/visimark/src/lang/token.ts` — add `"precision"` to `TokenKind`.
- Edit: `packages/visimark/src/lang/lexer.ts` — emit a `precision` token for the bare word, beside the existing `chart` / `assert` / `is` cases (~L136-149).
- Edit: `packages/visimark/src/lang/ast.ts` — add `precision?: number` to the parser's binding shape.
- Edit: `packages/visimark/src/lang/parser.ts` — `parseBindingInner` accepts `name precision N`, `"Header" precision N` and `alias precision N` before `=`; a `precision` token anywhere else on a line, or as the LHS of `=`, is a `LangError` with the keyword message. Reject a non-integer, negative or `> 18` `N`.
- Edit: `packages/visimark/src/model/types.ts` — add `precision?: number` to `interface Binding`; add `"PRECISION"` to `FindingCode` and `ERROR_CODES`.
- Edit: `packages/visimark/src/model/build.ts` — carry `precision` from the parsed binding onto the model `Binding`.
- Test: `packages/visimark/test/lang/lexer.test.ts`, `.../parser.test.ts`, `.../model/build.test.ts`.

**Interfaces:**
- Produces: `parseStatement("total precision 2 = SUM(Net)")` → `Binding` with `precision: 2`; `parseStatement("total = SUM(Net)")` → `precision` absent; `parseStatement("precision = 2")` throws the keyword message; `parseStatement("x precision 19 = 1")` throws the range message.
- Consumes: existing `lex`, `Parser`, `parseBinding`, `parseStatement`, `rebase`.

- [ ] **Step 1 (RED):** lexer tests — the bare word lexes as `precision`; case-sensitivity holds (`Precision` stays an `ident`, so a `Precision` column header is unaffected). Then implement the token and lexer case.
- [ ] **Step 2 (RED):** parser tests — all three LHS forms with a clause; clause absent; `precision = 2`; `precision` as a column header via the quoted form; `N` of `-1`, `2.5`, `19`. Then implement in `parseBindingInner`.
- [ ] **Step 3 (RED):** `build.test.ts` — a `#lines` block with `net_total precision 2 = SUM(Net)` yields a model `Binding` carrying `precision: 2`; a column rule carries it too. Then wire `build.ts`.
- [ ] **Step 4:** full verification loop. Nothing observable changes yet — the clause parses and is stored, and is not read.

---

### Task 2: the derivation table

**Files:**
- Add: `packages/visimark/src/eval/precision.ts` — `derivePrecision(expr, ctx): number | null` (`null` = not derivable), implementing [spec §3.3](declared-precision-spec.md#33-derivation-table) exactly. `ctx` resolves a `Ref` to a column's or scalar's precision.
- Edit: `packages/visimark/src/eval/units.ts` — `decimalPlaces` keeps its cell/column role; the `fallback` parameter goes where its only remaining caller is a column with cells.
- Test: `packages/visimark/test/eval/precision.test.ts` — one case per table row, plus the percent-literal case (`vat = 23%` must be `2`, not `0`).

**Interfaces:**
- Produces: `derivePrecision` per the table — `+ - MIN MAX SUM` → max; `*` → sum; `^` → `P(a) × b` for integer `b ≥ 0`; `COUNT` → 0; `ROUND(x,n)` → `n`; `FLOOR/CEILING(x,s)` → `P(s)`; `ABS` → passthrough; `MOD` → max; `IF` → max of branches; `/ AVG SQRT` and non-integer `^` → `null`.
- Consumes: `Expr` from `lang/ast.ts`; a column-precision lookup.

- [ ] **Step 1 (RED):** a table-driven test with one row per construct, asserting the derived width.
- [ ] **Step 2 (RED):** the invariant test — for every derivable case, the exact result equals the result rounded to the derived width ([spec §3.2](declared-precision-spec.md#32-the-invariant)).
- [ ] **Step 3:** implement `precision.ts`. Pure, no `CheckState`.
- [ ] **Step 4:** full verification loop.

---

### Task 3: `check` stops reading precision from prose

**Files:**
- Edit: `packages/visimark/src/eval/check.ts` — replace `decimalPlaces(anchorText, fallbackPrecision)` (~L400-407) with declared → derived → `PRECISION`. Keep the anchor-text read for **units** only. Delete `docPrecision()` (~L806-810).
- Edit: `packages/visimark/src/eval/check-state.ts` — delete `fallbackPrecision`.
- Edit: `packages/visimark/src/eval/check-charts.ts` — its `decimalPlaces(t, 2)` fallback (~L291) and `inputPrecision` call follow the new source of truth.
- Edit: `packages/visimark/src/eval/check-report.ts` — emit `PRECISION`; suppress it under an upstream error per [spec §4.2](declared-precision-spec.md#42-suppression).
- Test: `packages/visimark/test/eval/` — the `400.00` case (anchoring a constant must no longer move a downstream value), the `686.0000` case, and a `PRECISION` on an undeclared division.

**Interfaces:**
- Produces: a scalar's precision from its declaration or its expression, never its anchor; `PRECISION` findings with `{sheet, name}` and the offending expression text.
- Consumes: `derivePrecision`, `Binding.precision`.

- [ ] **Step 1 (RED):** regression tests for the three defects in [spec §1](declared-precision-spec.md#1-purpose) — `fx`/`derived` staying `426.50` with the anchor present, `686.0000` no longer order-dependent, and a `PRECISION` on `gross / fx`.
- [ ] **Step 2:** rewire `check.ts`; delete `docPrecision` and `fallbackPrecision`.
- [ ] **Step 3:** full verification loop. Examples will now fail; that is expected until Task 6.

---

### Task 4: anchors become outputs only

**Files:**
- Edit: `packages/visimark/src/parse/document.ts` — `anchorValueSpan` (~L391-404) accepts a bare text node without `TRAILING_NUMBER_RE`, and an anchor with no preceding inline node yields a zero-width span at the comment's start so `fmt` can seed it. `TRAILING_NUMBER_RE` stays for `collectFigures`/`infer`.
- Edit: `packages/visimark/src/write/fmt.ts` — render each anchor at the binding's governing precision; splice into a zero-width span.
- Edit: `packages/visimark/src/eval/check.ts` — an anchor whose rendered text disagrees is `STALE`; the `ANCHOR` cases narrow to an unrewritable preceding node, an image/chart mismatch, and a malformed comment.
- Test: `packages/visimark/test/write/fmt.test.ts`, `.../parse/document.test.ts`.

**Interfaces:**
- Produces: `fmt` seeds `<!--vmark=s.total-->`; `0`, `686.0000` and an empty anchor all converge on the same rendering; a bare string anchor (`no<!--vmark=s.x-->`) is `STALE` and repaired.
- Consumes: the governing precision from Task 3.

- [ ] **Step 1 (RED):** the string-anchor defect as a regression test — `fmt` then `check` on the [spec §1](declared-precision-spec.md#1-purpose) repro must end clean, exit 0.
- [ ] **Step 2 (RED):** the new property test — **`fmt` output re-reads identically**: for every fixture, the anchors `fmt` writes are found again by the scanner on the next parse. This is the invariant whose absence let the original defect ship; the existing idempotency test cannot catch it.
- [ ] **Step 3:** implement the scanner and splicer changes.
- [ ] **Step 4:** full verification loop.

---

### Task 5: the working-precision ceiling

**Files:**
- Edit: `packages/visimark/src/eval/value.ts` — guard the `toDecimalPlaces` path (~L41): a value whose integer digits plus its governing precision exceed `Decimal.precision` is reported, not padded.
- Edit: `packages/visimark/src/eval/check.ts` — surface it as `PRECISION` (the runtime trigger, [spec §4.1](declared-precision-spec.md#41-precision--new-code)).
- Test: `packages/visimark/test/eval/precision.test.ts`.

**Interfaces:**
- Produces: `PRECISION` rather than a fabricated tail.
- Consumes: `Decimal.precision`.

- [ ] **Step 1 (RED):** the fabrication test, with a **raised working precision as the oracle** — recompute at `Decimal.precision = 120` and require the same rendered value. Pin 30 integer digits at `precision 18`, whose fractional part is today eighteen invented zeros. Do not eyeball: at 23 integer digits the correct and truncated results agree.
- [ ] **Step 2:** implement the guard.
- [ ] **Step 3:** full verification loop.

---

### Task 6: surfaces — report, JSON, `explain`, `infer`, LSP

**Files:**
- Edit: `packages/visimark/src/report/format.ts` — the `PRECISION` line, column-aligned with the existing grid, two-line form per [spec §4.1](declared-precision-spec.md#41-precision--new-code).
- Edit: `packages/visimark/src/report/json.ts` — `PRECISION` in the findings array.
- Edit: `packages/visimark/src/cli/commands.ts` — `explain` shows each binding's precision and whether declared or derived; the result only, never a derivation chain.
- Edit: `packages/visimark/src/infer/propose.ts`, `.../verify.ts`, `.../write.ts`, `packages/visimark/src/report/infer.ts` — propose `precision N` only where verified from what the document already renders; refuse where anchors disagree or none exists.
- Edit: `packages/visimark-lsp/src/diagnostics.ts` — the `PRECISION` message case (~L57).
- Edit: `docs/cli-reference.md` — the `PRECISION` row; the `ANCHOR` row loses "has no number in front of it to rewrite".
- Test: `packages/visimark/test/report/`, `.../cli/infer.test.ts`.

- [ ] **Step 1 (RED):** transcript tests for the `PRECISION` line and the `--json` shape.
- [ ] **Step 2 (RED):** `infer` proposes `precision 2` for a scalar whose anchors all render two decimals, and refuses when they disagree.
- [ ] **Step 3:** implement; confirm the LSP has no hardcoded code list.
- [ ] **Step 4:** full verification loop.

---

### Task 7: documents, spec text, template, catalogue

**Files:**
- Edit: `docs/example-invoice.md` — `eur_total precision 2` (required) and `early_pay_total precision 2` (elective).
- Edit: `docs/example-invoice-drift.md` — regenerate the fenced transcript from a real run.
- Edit: `docs/example-ci-sharding.md`, `docs/example-quote-plain.md`, `docs/example-structural-check.md` — declarations per [spec §7.1](declared-precision-spec.md#71-document-inventory); re-audit every `docs/example-*.md` rather than trusting the table.
- Edit: `packages/visimark/test/acceptance.test.ts` — `PRECISION` into `errorCodes`; re-derive the three drift counts.
- Edit: `docs/visimark-design.md` — §3 anchor sentence; §4 clause grammar, reserved words, **a precision-behaviour column on the thirteen-function table** and the same statement for the operator set; §7 replaced by the spec's model, constant removed, unit asymmetry sentence; §9 write-back; §10 `PRECISION` row plus `STALE`/`ANCHOR` amendments; §13 the three new property tests; §14 per-column precision landed, output formats still deferred.
- Edit: `.github/ISSUE_TEMPLATE/vocabulary-request.yml` — required `Precision behaviour` dropdown (derives from operands / fixed by an argument / not derivable / not sure) and a fourth judging bullet in the preface.
- Edit: `docs/vocabulary-catalogue.md` — the matching judging criterion, and a section E row for this feature.
- Edit: `CHANGELOG.md`, `editors/vscode/CHANGELOG.md` — `## Unreleased`.

- [ ] **Step 1:** annotate the documents; run `check` on all of `docs/example-*.md` and fix until every one is clean or intentionally not.
- [ ] **Step 2:** regenerate the drift transcript; re-derive the counts.
- [ ] **Step 3:** the design-doc sections, the template, the catalogue, the changelogs.
- [ ] **Step 4:** full verification loop.

---

### Task 8: final documentation pass

The non-test-enforced tier from [spec §7.2](declared-precision-spec.md#72-documentation). Deliberately last: earlier means writing prose against moving behaviour, and folding it into Task 7 blocks code on copy edits.

- [ ] **Step 1:** `README.md`, the narrative examples, `docs/visimark-editor-plugins-design.md`, and the `skills/` copy — introduce the notion of precision and remove any claim that it comes from an anchor.
- [ ] **Step 2:** full verification loop; CI green; promote the PR out of draft.

---

## Done when

- `bun test`, `bun run typecheck`, `bun run build`, `bun run lint`, `bun run format:check` all green.
- `docs/example-invoice.md` checks clean with two `precision` clauses and `fmt` is a byte-for-byte no-op; `docs/example-charts.md` unchanged with both SVGs byte-identical; `docs/example-invoice-drift.md` reproduces its regenerated transcript exactly.
- Anchoring a constant no longer changes any downstream value — the `400.00` case is gone.
- `686.0000` is `STALE` and `fmt` repairs it; order no longer matters.
- A bare anchor is seeded by `fmt`; the string-anchor repro from [spec §1](declared-precision-spec.md#1-purpose) ends clean at exit 0.
- An undeclared division reports `PRECISION` and `fmt` does not silence it.
- No value renders a digit `decimal.js` did not compute, verified against a raised working precision.
- `docPrecision()` and `CheckState.fallbackPrecision` are deleted, not merely unread.
- The design doc, `cli-reference.md`, the issue template, the catalogue, and both changelogs are updated; the final documentation pass is done.

<!--vmark:no-formulas-->
