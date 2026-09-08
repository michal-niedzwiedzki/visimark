# Sheet-id / anchor-comment grammar hardening — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** Close the silent-failure hole in issue #38, per [`docs/design/sheet-ids-accept-characters-the-anchor-spec.md`](sheet-ids-accept-characters-the-anchor-spec.md). Tighten `parseSheetId` to the identifier grammar `[A-Za-z_][A-Za-z0-9_]*` (matching `ANCHOR_RE` and the lexer), reporting a `SHEET` error naming the offending characters. Widen anchor-comment collection so any HTML comment matching the loose prefix `/^<!--\s*vmark\s*=/` that does not fully match `ANCHOR_RE` becomes an `ANCHOR` error instead of being silently treated as inert HTML. No new `FindingCode`; both reuse existing codes.

**Architecture:** Two independent, additive checks, both detected before evaluation (parse/model-build phase), both reusing existing `SHEET`/`ANCHOR` codes and the existing findings pipeline (`model.findings` flows into `check()` via the existing `for (const f of model.findings) emit(f);` loop — no new plumbing needed there). (1) Sheet-id grammar: validated in `model/build.ts` at the point `block.sheetId` is already extracted, alongside the existing detached-table `SHEET` check — same block-scoped, "sheet still builds and evaluates regardless" precedent. (2) Anchor-comment hardening: detected in `parse/document.ts`'s `collectAnchors`, which already walks every `html` node and tests it against `ANCHOR_RE`; add a second, looser test on the no-match path and collect malformed spans onto a new `LocatedDoc.malformedAnchors: Span[]` field (mirroring how `RawBlock`/`RawTable` are collected today), which `model/build.ts` turns into `ANCHOR` findings the same way it already turns `doc.detachedTableBlocks` into `SHEET` findings. No change to `report/format.ts`'s `id()`/`sheetId()` helpers — the `SHEET` finding sets `sheetId` (renders via the existing `sheetId(f)` helper, `#<badid>`); the `ANCHOR` finding sets neither `sheetId` nor `name` (renders via the existing `id(f)` helper as `.`, which the format case already tolerates — no format.ts code change required, confirmed against the existing `ANCHOR`/`SHEET` render cases). No change to `eval/`, `write/`, `infer/`, the lexer, or `ANCHOR_RE` itself.

**Tech Stack:** TypeScript; `decimal.js` (numeric core); Bun test runner; engine package `packages/visimark`; LSP package `packages/visimark-lsp`; VS Code client `editors/vscode`.

**Spec:** [`docs/design/sheet-ids-accept-characters-the-anchor-spec.md`](sheet-ids-accept-characters-the-anchor-spec.md)

## Global Constraints

- Work on branch `issue/38-sheet-ids-accept-characters-the-anchor-impl` (draft PR #48). Do **not** open a new PR.
- No new `FindingCode`. `SHEET` and `ANCHOR` are already in `ERROR_CODES` — no taxonomy change.
- `example-invoice.md`, `example-charts.md`, `example-invoice-drift.md` use only plain identifier sheet ids and well-formed anchors — their required transcripts ([§13](../visimark-design.md#13-testing)) do not change. Do not edit any of the three.
- Verbatim messages (spec §3.1, §3.2):
  - Sheet id: `` sheet id `<id>` is not a valid identifier — invalid character `<c>` `` (singular) or `` invalid characters `<c1>`, `<c2>`, … `` (plural, unique, in order of first appearance in the raw id).
  - Malformed anchor: `` malformed anchor comment — expected `<!--vmark=sheet.name-->` `` (same message regardless of what specifically failed to parse).
- Sheet-id `SHEET` finding fires **once per offending block** (not deduplicated across merged blocks sharing a bad id) — matches the existing detached-table `SHEET` precedent.
- The sheet is still built and evaluated when its id is invalid; the `SHEET` finding does not suppress the sheet's other findings.
- Detection order for anchors: try full `ANCHOR_RE` first (unchanged, existing valid-anchor path); on no match, try the loose prefix `/^<!--\s*vmark\s*=/`; a match there is the new malformed-anchor case; no match on either leaves the comment untouched (ordinary HTML comment, including `<!--vmark:no-formulas-->`, which uses `:` not `=` and never reaches the loose prefix).
- No relaxation of `ANCHOR_RE` or the lexer. No hardening of `assert`/`chart` malformed-syntax (both already produce `TYPE` findings; out of scope, spec §7).
- No changelog callout beyond the normal `## Unreleased` entry — no special breaking-change note; project is pre-1.0 (spec §7).
- Every commit ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- After each task: `bun test`, `bun run typecheck`, `bun run build` from the repo root, plus `bun run packages/visimark/src/cli/main.ts check` on `docs/example-invoice.md`, `docs/example-charts.md`, and `docs/example-invoice-drift.md`. Loop check → fix → check until green. Never `bunx visimark` (published build).

---

### Task 1: sheet-id grammar validation (`SHEET`)

**Files:**
- Edit: `packages/visimark/src/model/build.ts` — add a module-level `SHEET_ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/` (or reuse a shared identifier-grammar constant if one already exists in `lang/`; check `lang/lexer.ts` / `lang/token.ts` first and import rather than duplicate if so). At the point `const sheetId = block.sheetId;` is set (right where `blockOfSheet.set(sheetId, block)` and `ensureSheet(...)` are called), if `!SHEET_ID_RE.test(sheetId)`, compute the unique offending characters in order of first appearance and push `{ code: "SHEET", sheetId, message: <verbatim per Global Constraints>, sourceOffset: block.span.start, span: block.span }` onto `findings`. Continue building the sheet as today — do not `continue`/skip.
- Test: `packages/visimark/test/model/build.test.ts`.

**Interfaces:**
- Produces: `build(locate(src)).findings` contains one `SHEET` finding per offending block, with the exact message; `build(locate(src)).sheets.get("cost-centre")` still exists and evaluates normally elsewhere in the pipeline.
- Consumes: existing `block.sheetId`, `findings.push`, `ensureSheet`.

- [x] **Step 1: tests (RED).** In `build.test.ts`: `#cost-centre` → one `SHEET` finding, message names `` `-` ``; `#a/b..c` → one `SHEET` finding naming `/` and `.` once each (not twice); `#1abc` → one `SHEET` finding naming `1`; `#lines` (existing plain-id fixtures) → no new `SHEET` finding; a bad id repeated across two merged `` ```vmark #bad-id `` blocks → two `SHEET` findings; the sheet's columns/scalars still populate despite the bad id (e.g. `sheets.get("cost-centre").scalars` still has `total`).
- [x] **Step 2:** implement the regex check and offending-character extraction; wire into `build.ts`.
- [x] **Step 3:** `bun test`, `typecheck`, `build`; both example docs still check clean.

---

### Task 2: anchor-comment hardening (`ANCHOR`)

**Files:**
- Edit: `packages/visimark/src/parse/document.ts` — add `const ANCHOR_LOOSE_RE = /^<!--\s*vmark\s*=/;` near `ANCHOR_RE`. Add `malformedAnchors: Span[]` to the `LocatedDoc` interface (alongside `anchors`), populate it in `collectAnchors`: in the `if (child.type !== "html") continue;` loop, after the existing `ANCHOR_RE.exec` fails, test the trimmed value against `ANCHOR_LOOSE_RE`; on a match push `{ start: off(child, "start"), end: off(child, "end") }` onto `malformedAnchors` (does not produce a `RawAnchor` — `value`/`sheetId`/`name` stay absent, matching today's silent-ignore behavior for everything else). Wire the new array into the `locate()` return object.
- Edit: `packages/visimark/src/model/build.ts` — after processing `doc.blocks` (near where `doc.detachedTableBlocks` would be consulted, or as a small standalone loop before `return`), push one `{ code: "ANCHOR", sourceOffset: span.start, span, message: <verbatim per Global Constraints> }` per entry in `doc.malformedAnchors`.
- Test: `packages/visimark/test/parse/document.test.ts`, `packages/visimark/test/model/build.test.ts`.

**Interfaces:**
- Produces: `locate(src).malformedAnchors` contains a span for `<!--vmark=cost-centre.total-->`, `<!--vmark=lines.tot al-->` (stray space), `<!--vmark=lines.-->` (empty name); is empty for `<!--vmark=lines.total-->` (valid), `<!--vmark:no-formulas-->` (marker), `<!-- TODO -->` (unrelated), `<!--vmarkFoo=bar.baz-->` (not the loose prefix). `build(locate(src)).findings` carries one `ANCHOR` finding per malformed-anchor span, with the exact message and no `sheetId`/`name`.
- Consumes: existing `ANCHOR_RE`, `collectAnchors`, `off`.

- [x] **Step 1: parse tests (RED).** In `document.test.ts`: each malformed case above lands in `malformedAnchors` with the right span; each non-match case leaves both `anchors` and `malformedAnchors` as today (empty or unaffected); `<!--vmark:no-formulas-->` still sets `noFormulas` and is absent from both anchor arrays.
- [x] **Step 2:** implement `ANCHOR_LOOSE_RE` and the `malformedAnchors` collection in `collectAnchors`/`locate`.
- [x] **Step 3: model tests (RED).** In `build.test.ts`: a document with one malformed `vmark=` comment → one `ANCHOR` finding with the verbatim message, `sheetId`/`name` both `undefined`.
- [x] **Step 4:** wire `doc.malformedAnchors` into `build.ts`'s `findings`.
- [x] **Step 5:** `bun test`, `typecheck`, `build`; both example docs still check clean.

---

### Task 3: full-pipeline acceptance and report rendering

**Files:**
- Edit: `packages/visimark/test/eval/check.test.ts` — the combined fixture from spec §6 (the `#cost-centre` document with the wrong `999.00` anchor): assert `check(model).findings` contains exactly one `SHEET`, one `ANCHOR`, and the existing `WARN` for `cost-centre.total` (defined and never read); assert `exitCode` is `1` (errors present); assert no `STALE` is produced for the anchor (it never became a `RawAnchor`, so it cannot be compared to the computed value — confirm this against the spec's semantics table, §3.2).
- Edit: `packages/visimark/test/report/format.test.ts` (or wherever `SHEET`/`ANCHOR` rendering is covered, per the existing `formatCheck`/`renderGroup` test conventions) — a rendered `SHEET` line for a bad sheet id (`sheetId(f)`-style `#cost-centre` head, per Architecture) and a rendered `ANCHOR` line for a malformed comment (message only, no id prefix content beyond the empty `.`/blank field — confirm the exact column output against the real formatter rather than hand-deriving it, and update the spec's illustrative transcript in §6 if the real byte layout differs).
- Test: `packages/visimark/test/eval/check.test.ts`, `packages/visimark/test/report/format.test.ts`.

**Interfaces:**
- Produces: `visimark check` on the spec §6 fixture produces the two new findings plus the pre-existing `WARN`, exits 1; the report lines are captured verbatim in a test so any future formatting drift fails the build.

- [x] **Step 1: tests (RED)** for the combined-document `check()` result and the rendered report lines.
- [x] **Step 2:** fix any formatting gap surfaced by Step 1 (expected to be none — both codes already have `renderGroup` cases; this step exists to confirm, not to add new format.ts code).
- [x] **Step 3:** `bun test`, `typecheck`, `build`; both example docs still check clean.

---

### Task 4: documentation

**Files:**
- Edit: `docs/visimark-design.md` — [§3](../visimark-design.md#3-document-model) "Sheet identity comes from the fence info string": add the identifier-grammar sentence and the `SHEET` consequence (a sheet id must match `[A-Za-z_][A-Za-z0-9_]*`; anything else is a `SHEET` error naming the offending characters). Anchors paragraph in the same section: add that a comment beginning `vmark=` that fails to parse is an `ANCHOR` error rather than being ignored. [§10](../visimark-design.md#10-error-taxonomy) taxonomy table: no new row (existing `SHEET`/`ANCHOR` rows already cover it), but their one-line descriptions may need a word added if they currently read as narrower than the new trigger — check and adjust only if misleading.
- Edit: `docs/cli-reference.md` — Findings table rows for `SHEET` (line ~72) and `ANCHOR` (line ~73): widen the one-line descriptions to cover the new trigger conditions (bad sheet-id grammar; a malformed `vmark=` comment) alongside the existing ones.
- Edit: `CHANGELOG.md` `## Unreleased` → `### Added` — one entry: sheet ids are now validated against the identifier grammar (`SHEET` error on mismatch), and a malformed `vmark=` anchor comment is now an `ANCHOR` error instead of being silently ignored. Note the behavioural-break framing briefly (a previously-silent-wrong document now fails loudly) without a special version-note section (Global Constraints).
- Edit: `docs/vocabulary-catalogue.md` — move the "Sheet-id / anchor-comment grammar hardening" row **out of section E** into the [Shipped register](../vocabulary-catalogue.md#shipped) as `UNRELEASED`: `| Sheet-id / anchor-comment grammar hardening | language feature | [#38](https://github.com/michal-niedzwiedzki/visimark/issues/38) | <this PR> | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/38#issuecomment-5588230949) |`. Drop the prose columns.
- Check: `docs/visimark-editor-plugins-design.md` (lines ~131, ~309-310) hardcodes the `SHEET`/`ANCHOR` span source and the exact message shown in the editor tooltip (`no value to rewrite in front of this anchor`). Confirm whether the LSP's diagnostic-message mapping needs the new malformed-anchor message added, or whether it already forwards `Finding.message` verbatim (if so, no code change, but consider a doc note that `ANCHOR` now covers a second message).
- Check: `packages/visimark-lsp` — confirm both `SHEET` and `ANCHOR` diagnostics surface automatically (the LSP maps engine findings; confirm no hardcoded per-message allowlist). Add an LSP test only if the package already has equivalent coverage for other codes.

**Interfaces:**
- Produces: `bun test` green including all new coverage; design doc, cli-reference, both catalogue placement, and CHANGELOG all reflect the shipped behavior.

- [x] **Step 1:** design-doc §3 edits (grammar + anchor-hardening sentences).
- [x] **Step 2:** `docs/cli-reference.md` Findings table edits.
- [x] **Step 3:** `CHANGELOG.md` entry.
- [x] **Step 4:** `docs/vocabulary-catalogue.md` row moved to Shipped register as `UNRELEASED`.
- [x] **Step 5:** editor-plugins doc + LSP check.
- [x] **Step 6:** full green sweep — `bun test`, `bun run typecheck`, `bun run build`, and `check` on all three example docs. Loop until green.

---

## Done when

- `bun test`, `bun run typecheck`, `bun run build` all green.
- `visimark check` on the spec §6 fixture reproduces one `SHEET`, one `ANCHOR`, and the existing `WARN`, and exits 1.
- `example-invoice.md`, `example-charts.md`, `example-invoice-drift.md` are untouched and their acceptance transcripts still pass byte-for-byte.
- Design doc §3 (and §10 if needed), `docs/cli-reference.md`, `CHANGELOG.md` `## Unreleased`, and the catalogue row (now `UNRELEASED` in the Shipped register) are all updated.
- CI green on the PR; the PR is promoted out of draft.

<!--vmark:no-formulas-->
