# A bare `report deltas` with nothing to read — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `check` fails a bare `report deltas` (no `on`) with a `TYPE` finding when its own sheet has no scalar that is not a `param`.

**Architecture:** One predicate in `checkReports` (`eval/check-reports.ts`), fed by one new boolean on the model's `Sheet`, `droppedLines`, which `model/build.ts` sets when `parseOne` drops a line from one of the sheet's blocks. No new finding code, no grammar change, no evaluation change.

**Tech Stack:** TypeScript, Bun test runner, existing VisiMark model/check pipeline. No new dependencies.

**Spec:** `docs/design/a-bare-report-deltas-in-a-sheet-with-no-spec.md`

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer that `.agents/rules/ai-attribution.md` resolves to for this session. Do not hardcode a vendor name.
- No new [§10](../visimark-design.md#10-error-taxonomy) code: the finding is `TYPE`.
- Only a bare `deltas` is judged. `deltas on REF`, `ledger`, `gates`, `best` and `forbidden` are untouched. A sheet of constants stays clean.
- `fmt` output and `eval` output do not change.
- Run `bun test`, `bun run typecheck` and `bun run build` from the repo root after every task, plus `bun run packages/visimark/src/cli/main.ts check` on `docs/example-battery-storage.md` (must still report `0 problems`). Do not use `bunx visimark`: it runs the published build.

## Review Focus

- A sheet whose only scalar line failed to parse must give that line's own finding and **no** `TYPE` (`droppedLines`).
- A kept binding with a `parseError` still counts as a scalar.
- Params and asserts do not count; imported sheets get no exemption.
- Findings keep `orderFindings` order: the new emit sits inside the existing per-report loop.

---

### Task 1: Record dropped lines on the sheet

**Files:**
- Modify: `packages/visimark/src/model/types.ts` (`Sheet`)
- Modify: `packages/visimark/src/model/build.ts` (the sheet literal near line 527; the `parseOne` loop near line 258)
- Modify: `packages/visimark/src/infer/context.ts` (the sheet literal near line 128)
- Test: `packages/visimark/test/model/` (the existing model-build test file; add a case there)

**Interfaces:** `Sheet.droppedLines: boolean`, with the doc comment "true when a line of one of this sheet's blocks failed to parse and was dropped; see docs/design/a-bare-report-deltas-in-a-sheet-with-no-spec.md §3".

- [ ] **Step 1: Failing test.** Build a model from a document with `x = (` (unparseable) in `#readings`; assert `sheet.droppedLines === true`, and `false` for a clean sheet.
- [ ] **Step 2: Run it, confirm it fails** (`bun test <file>`).
- [ ] **Step 3: Implement.** Add the field to `Sheet`, initialise it `false` in both literals, and in `build.ts` set `sheet.droppedLines = true` where `parseOne(...)` returns `undefined`.
- [ ] **Step 4: Run `bun test`, `bun run typecheck`, `bun run build`; all green. Commit.**

### Task 2: The `TYPE` finding

**Files:**
- Modify: `packages/visimark/src/eval/check-reports.ts`
- Create: `packages/visimark/test/report-nothing-to-read.test.ts`
- Create: `packages/visimark/test/fixtures/simulation/bare-deltas.md` (the issue's document, spec §1)

**Interfaces:** inside `checkReports`, before the `report.refs` loop, for `report.options.kind === "deltas" && report.options.on.length === 0`: skip when `sheet.droppedLines`; otherwise if no `sheet.scalars` value has `param === undefined`, `st.emit({ code: "TYPE", sheetId: report.sheetId, message: <spec §4 message>, sourceOffset: report.span.start, span: report.span }, { sheetId: report.sheetId })`. Update the function's doc comment to mention the rule.

- [ ] **Step 1: Failing tests**, one per numbered acceptance item of spec §6 (the fixture's literal `check` output and `--json`; the fixed variant; the silent cases; the param-only sheet; `simulate` showing `(cannot start)` and exit `0`; `fmt` no-op; the battery example; two sheets giving two findings). Generate variants in memory from the fixture, in the style of `test/simulation-acceptance.test.ts`.
- [ ] **Step 2: Run, confirm they fail.**
- [ ] **Step 3: Implement** the predicate as above.
- [ ] **Step 4: Run the full local checks; also run `check` on `docs/example-battery-storage.md`.** Fix until green. Commit.

### Task 3: Documentation

**Files:**
- Modify: `docs/design/lattice-on-param-and-report-statements-spec.md` §4.2 (new row, message as spec §4) and §7 (reword the "options meaningful" non-goal to name this one case)
- Modify: `docs/design/add-a-simulate-command-spec.md` §4 (`deltas (no on)` row: a sheet with no such scalar is a `TYPE` finding, not an empty body)
- Modify: `docs/simulate.md` §13 (the readings-sheet sentence) and §14 (new mistake, with its output)
- Modify: `docs/visimark-design.md` (the `report` paragraph in §4; the §10 `TYPE` row)
- Modify: `docs/cli-reference.md` and any generated finding docs, only if they list `report` findings
- Modify: `CHANGELOG.md` under `## Unreleased` → `### Added`
- Modify: `docs/vocabulary-catalogue.md`: move the #333 row out of section E into the Shipped register as `UNRELEASED` (columns `Name`, `Kind`, `Request`, `Landed` = this PR, `Released` = `—`, `Decision` = the deciding comment)

- [ ] **Step 1:** Make each edit. `docs/simulate.md` §13 must stop saying a readings sheet "prints a heading and nothing under it"; say instead that such a line is refused by `check`, and point to `deltas on REF`.
- [ ] **Step 2:** Run `bun run packages/visimark/src/cli/main.ts check` on every changed `docs/*.md` that holds a `vmark` block, and the repo's markdown/format lint (`bun run lint` / formatter, as `CONTRIBUTING.md` names it). Fix until clean.
- [ ] **Step 3:** Full local checks (`bun test`, `bun run typecheck`, `bun run build`). Commit. Leave the issue open and the row `UNRELEASED`; `release.yml` closes the issue.
