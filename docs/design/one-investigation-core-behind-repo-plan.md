# One investigation core behind `repo:investigate` and the widget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `repo:scan`, `ensureClone`'s internal scan and the homepage widget's own scan with one pure investigation core (`packages/visimark-investigate`), run by a `repo:investigate` CLI shell and by the widget, so both report the same findings for the same repo and commit.

**Architecture:** The core is a dependency-free TypeScript package. It takes `{path, text}` inputs plus an injected engine and returns a versioned `Report`. It contains a masked Markdown table reader, an exact-decimal verifier, a file policy, posture detection, a rule registry (`total-row`, `line-product`, `engine-check`, `engine-infer`), a merge step and two formatters. The CLI shell (`scripts/repo-investigate.ts`) does the git, clone and cache work. The widget shell (`site/src/pages/repo-scan.ts`) does the GitHub API and raw fetches and the rendering. Neither shell judges anything itself.

**Tech Stack:** TypeScript, Bun (`bun test`, `bun build`), the `visimark` engine through its browser-safe entry (`packages/visimark/src/browser.ts`), happy-dom for the site test.

**Spec:** [`one-investigation-core-behind-repo-spec.md`](one-investigation-core-behind-repo-spec.md). Read it before any task. Section numbers below (§3.5 and so on) refer to it.

## Global Constraints

- Commit trailers follow [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md): exactly one `Co-Authored-By:` line for the agent that actually wrote the commit.
- `packages/visimark-investigate/package.json`: `"name": "visimark-investigate"`, `"private": true`, **no `version`**, `"type": "module"`, scripts `test` (`bun test`) and `typecheck` (`tsc --noEmit`). It has no `dependencies`. `devDependencies` mirror `editors/shared`'s TypeScript and Bun types. It is not added to `scripts/release-manifests.ts`.
- The core imports `visimark` **only** with `import type`. A test fails on any `node:` import, and on any value import of `visimark`, anywhere under `packages/visimark-investigate/src/`.
- No new third-party dependency anywhere (memory: restrict dependencies).
- No new export from `visimark`.
- Exit codes for `repo:investigate`: `0` clean, `1` at least one confirmed finding, `2` usage or failure (§3.1).
- The usage line is exactly `Usage: bun run repo:investigate <owner/repo|git-url|./path> [--branch NAME] [--force] [--json]`.
- The Report has `version: 1`. Field names are exactly those in §3.3.
- Rule ids and labels: `total-row`/`sum check`, `line-product`/`line check`, `engine-check`/`VisiMark`, `engine-infer`/`VisiMark infer`, in that registry order.
- Widget words: `Wrong number` (confirmed) and `Worth a look` (lead).
- Offsets are JavaScript string indices (UTF-16 code units) everywhere: the masker, the table reader, the engine's spans and `Edit`.
- Run `bun run lint`, `bun run format:check`, `bun test` and `bun run typecheck` before every push (memory: lint and format before a PR).
- Deviations from the spec's §3.2 sketch, decided here:
  - The file policy runs in the shells. `investigate` receives `skipped`, not `fileCap`, because the widget must decide which files to fetch before it can call the core.
  - `workflowTexts` is a separate field rather than living in `texts`, so `null` can mean "posture unavailable".
  - Nothing else in the Report changes.

## Review Focus

1. **CRLF files.** A file with `\r\n` line endings must give the same findings, line numbers and correct `Edit` offsets as its LF twin. The masker and the table reader split on `\n` and strip a trailing `\r` from cells. Test in Task 1.
2. **Decorated cells in a `fix`.** `**$1,234.50**` must be rewritten as `**$1,233.50**`, not as `1233.50`. Only the numeric literal is replaced. Thousands separators are kept if the stored value used them, and so are the surrounding emphasis and currency sign. Test in Task 3.
3. **Escaped pipes.** `\|` inside a cell does not split the cell. Test in Task 1.
4. **Non-ASCII text before a table** (`é`, emoji). The engine's `span` and the masked reader's offsets must agree, so the finding sits on the right cell. Test in Task 4 (an engine `STALE` fixture with an emoji in its heading).
5. **An unclosed fence at the end of a file.** Masking runs to the end of the file. A table after an unclosed opening fence is not read. Test in Task 1.

---

### Task 1: Package scaffold, masking, the table reader, exact decimals

**Files:**
- Create: `packages/visimark-investigate/package.json`, `packages/visimark-investigate/tsconfig.json`
- Create: `packages/visimark-investigate/src/mask.ts`, `src/tables.ts`, `src/decimal.ts`, `src/index.ts`
- Test: `packages/visimark-investigate/test/mask.test.ts`, `test/tables.test.ts`, `test/decimal.test.ts`, `test/purity.test.ts`
- Modify: `bun.lock` (from `bun install`)

**Interfaces:**
- Produces:
  - `maskMarkdown(text: string): string`
  - `interface Cell { text: string; from: number; to: number }`. `text` is trimmed and has `*`, `_` and `` ` `` stripped. `from`/`to` bracket the raw cell content without its surrounding spaces.
  - `interface TableRow { line: number; label: string; cells: Cell[] }`
  - `interface Table { index: number; headerLine: number; from: number; to: number; header: Cell[]; rows: TableRow[] }`
  - `readTables(masked: string): Table[]`
  - `rowKeys(table: Table): string[]` (labels with `~2`, `~3` for repeats, §3.5)
  - `cellNumber(cell: string): { value: number; decimals: number } | null` (the branch's, unchanged)
  - `scaled(cell: string, places: number): bigint | null`
  - `decimal(n: bigint, places: number): string`
  - `roundToPlaces(n: bigint, from: number, to: number): bigint` (half away from zero)
  - `rewriteNumber(cellRaw: string, value: string): string`. It replaces only the numeric literal and keeps the currency, emphasis and thousands separators if the original had them.

- [ ] **Step 1: Scaffold the package.** Write `package.json` per Global Constraints. `tsconfig.json` copies `editors/shared/tsconfig.json`, minus the `DOM` lib and the `codemirror-visimark` paths, keeping `"visimark": ["../../packages/visimark/src/browser.ts"]`. Run `bun install`, then confirm that `bun.lock` gains a `packages/visimark-investigate` workspace block and that `bun run --filter visimark-investigate test` runs (with 0 tests).

- [ ] **Step 2: Write the failing tests**
  - `mask.test.ts`:
    - "keeps length and newline offsets" over a fixture containing each region in §3.6, asserting `masked.length === text.length`, that every `\n` index is equal, and that only spaces appear inside the regions.
    - "masks ``` and ~~~ fences".
    - "masks an unclosed fence to end of file".
    - "masks indented code, HTML comments, front matter, blockquote lines".
    - "leaves <details> content and list-item tables readable".
    - "CRLF: \r survives outside regions, same length".
  - `tables.test.ts`:
    - "reads the budget table: index 1, headerLine 3, 11 rows, Total row line 15".
    - "a fenced table is not read" (budget fixture from §4.3: exactly 1 table).
    - "escaped pipe stays in the cell" (`| a \| b | 1 |` gives 2 cells, first `a \| b`).
    - "CRLF table matches LF twin".
    - "duplicate labels get ~2" (`rowKeys` gives `["A","A~2","Total"]`).
    - "cell offsets point at the raw cell text".
  - `decimal.test.ts`:
    - `scaled("1,234.50", 2) === 123450n`
    - `decimal(-5n, 2) === "-0.05"`
    - `roundToPlaces(34055n, 2, 1) === 3406n`
    - `roundToPlaces(-34055n, 2, 1) === -3406n`
    - `rewriteNumber("**$1,234.50**", "1233.50") === "**$1,233.50**"`
    - `rewriteNumber("12", "13.00") === "13.00"`
  - `purity.test.ts`: walk `src/**/*.ts`, and fail on `from "node:` and on any `import {` / `import *` (not `import type`) from `"visimark"`.

- [ ] **Step 3: Run the tests to verify they fail.** Run `bun test packages/visimark-investigate`. Expected: FAIL (modules missing).

- [ ] **Step 4: Implement `mask.ts`, `tables.ts` and `decimal.ts`.** Build `cellNumber` from `feat/repo-prospect:scripts/repo-prospect-lib.ts`, and `digits`/`scaled`/`decimal` from `feat/repo-prospect:scripts/repo-investigate-lib.ts` (read them with `git show`). A table is a line starting with `|` followed by a delimiter row (the branch's two regexes), plus every following `|` line. `index` counts from 1 per file. `index.ts` re-exports the public names listed in each task's Produces.

- [ ] **Step 5: Run the tests to verify they pass.** Run `bun test packages/visimark-investigate && bun run --filter visimark-investigate typecheck`. Expected: PASS.

- [ ] **Step 6: Commit** with `feat(investigate): package scaffold, masking, table reader, exact decimals`.

### Task 2: File policy, repo references, posture

**Files:**
- Create: `packages/visimark-investigate/src/policy.ts`, `src/repo.ts`, `src/posture.ts`
- Test: `test/policy.test.ts`, `test/repo.test.ts`, `test/posture.test.ts`
- Read only (source of moved code and tests): `scripts/repo-scan-lib.ts`, `scripts/repo-scan-lib.test.ts`, `site/src/pages/repo-scan.ts`, `site/src/pages/repo-scan.test.ts`

**Interfaces:**
- Produces:
  - `type SkipReason = "dot-path" | "excluded-directory" | "size" | "generated" | "file-cap" | "fetch-failed"`
  - `interface Skipped { path: string; reason: SkipReason }`
  - `selectFiles(paths: { path: string; size: number }[], fileCap?: number): { markdown: string[]; skipped: Skipped[] }`
  - `looksGenerated(text: string): boolean`
  - `parseRepoArg(input: string): { cloneUrl: string; label: string } | { error: string }` (unchanged)
  - `hostOf(cloneUrl: string): string`, `isDotPath(path: string): boolean`, `encodePath(path: string): string`
  - `VISIMARK_ACTION_USE: RegExp`, `hasVisimarkAction(workflowTexts: string[]): boolean`
  - `blobUrl(host: string | null, label: string, commit: string, path: string, from: number, to?: number): string | null`
  - `interface Posture { available: boolean; contributing: boolean | null; prTemplate: boolean | null; license: boolean | null; actionUsed: boolean | null; lastCommit: string | null }`
  - `computePosture(paths: string[], workflowTexts: string[] | null, lastCommit: string | null): Posture`. A `null` for `workflowTexts` means unavailable.

- [ ] **Step 1: Write the failing tests.**
  - Move the `hostOf`, `parseRepoArg` and `hasVisimarkAction` describes from `scripts/repo-scan-lib.test.ts` into `repo.test.ts`.
  - Move the `encodePath` describe from `site/src/pages/repo-scan.test.ts` into `repo.test.ts`.
  - Rewrite the `excludeDotPaths` cases as `selectFiles` cases with `reason: "dot-path"`.
  - Add:
    - "excluded-directory is case-insensitive per segment" (`docs/Tests/a.md` is dropped; `docs/testing/a.md` is kept)
    - "size cap is > 500000" (500000 is kept; 500001 is dropped with `size`)
    - "first matching reason wins" (`.github/test/a.md` is `dot-path`)
    - "file cap keeps the first N in byte order and records file-cap"
    - "non-Markdown paths are neither kept nor skipped"
    - `looksGenerated` on a `<!-- DO NOT EDIT -->` first line
    - `blobUrl` returns null for a host other than github.com and for host `null`
  - `posture.test.ts`:
    - CONTRIBUTING found at the root, in `docs/` and in `.github/`
    - the PR template directory form
    - `LICENSE.md` and `COPYING`, but not `docs/LICENSE`
    - `actionUsed` from a workflow text
    - `computePosture(paths, null, null).available === false` with every other field `null`

- [ ] **Step 2: Run the tests to verify they fail.** Run `bun test packages/visimark-investigate`. Expected: FAIL.

- [ ] **Step 3: Implement** with the regexes and lists from spec §3.4 and §4.2. Copy `parseRepoArg`, `hostOf`, `VISIMARK_ACTION_USE` and `encodePath` verbatim. `blobUrl` is the branch's, plus the `null` host case.

- [ ] **Step 4: Run the tests to verify they pass.** Run `bun test packages/visimark-investigate`. Expected: PASS.

- [ ] **Step 5: Commit** with `feat(investigate): file policy, repo references, posture`.

### Task 3: The rule contract, `total-row`, `line-product`, fixture enforcement

**Files:**
- Create: `packages/visimark-investigate/src/types.ts`, `src/rules/registry.ts`, `src/rules/total-row.ts`, `src/rules/line-product.ts`
- Create: `packages/visimark-investigate/test/fixtures/rules/total-row/{good.md,bad.md,bad.expected.json}`, `…/line-product/{good.md,bad.md,bad.expected.json}`
- Test: `test/rules/total-row.test.ts`, `test/rules/line-product.test.ts`, `test/registry.test.ts`
- Modify: `.github/workflows/dogfood.yml` (the `grep -vE` in the docfiles step), `.pre-commit-config.yaml:25` (`exclude:`), `scripts/doc-set.test.ts` if it asserts the pattern

**Interfaces:**
- Consumes: Task 1 (`maskMarkdown`, `readTables`, `rowKeys`, decimals), Task 2 (`Skipped`).
- Produces (in `types.ts`; `Report` per §3.3):
  - `Edit`, `Finding`, `Report` exactly as in §3.3.
  - `interface RawFinding extends Omit<Finding, "id" | "permalink" | "rules"> { rule: string; cell: CellRef }`
  - `type CellRef = { kind: "table"; table: number; column: string; row: string } | { kind: "named"; sheetId: string; name: string } | { kind: "other"; code: string; name: string | null }`
  - `interface DocInput { path: string; text: string; masked: string; tables: Table[] }`
  - `interface RuleContext { engine: Engine; texts: Map<string, string>; reader: ReaderPort }`
  - `interface RuleResult { findings: RawFinding[]; checked: string[]; unreadable: number; proposals: { table: number; afterFix: false }[]; coverage: number }`
  - `interface Rule { id: string; label: string; scope: "file" | "repo"; run(doc: DocInput, ctx: RuleContext): RuleResult }`
  - `type Engine = Pick<typeof import("visimark"), "locate" | "build" | "check" | "infer" | "isProblem" | "memoryReader" | "describeFinding">`
  - `RULES: readonly Rule[]`. This task registers the first two; Task 4 appends the engine rules.

  `checked` holds keys `<path>#t<N>`. `proposals` and `coverage` stay at `[]`/`0` for heuristic rules; Task 4 fills them for the engine rules.

- [ ] **Step 1: Write the fixtures.**
  - `total-row/bad.md` is §4.3's `docs/budget.md`. `good.md` is the same file with Total `340.50`.
  - `line-product/bad.md` is §4.3's `docs/quote.md`. `good.md` has B at `12.00`.
  - Each `bad.expected.json` holds the single Finding from §4.3:
    - total-row: `id` `bad.md#t1/Cost/Total`, `lines` `[3,15]`, `stored` `"341.50"`, `computed` `"340.50"`, `message` `"the table says 341.50; the rows add up to 340.50 (exact); off by 1.00"`, one `fix` edit replacing `341.50` with `340.50`.
    - line-product: `id` `bad.md#t1/Cost/B`, `lines` `[5,7]`, `stored` `"13.00"`, `computed` `"12.00"`, `message` `"the table says 13.00; Qty × Price is 12.00; the other 3 rows agree"`, `fix` replacing `13.00` with `12.00`.

  Paths inside the fixture expectations are the fixture's own file name (`bad.md`).

- [ ] **Step 2: Exclude the fixtures from the repo's own doc check.**
  - In `dogfood.yml`, change `packages/visimark/test/fixtures/` in the `grep -vE` to `packages/(visimark|visimark-investigate)/test/fixtures/`.
  - In `.pre-commit-config.yaml`, change `packages/visimark/test/fixtures/.*` the same way.
  - Run `bun test scripts/doc-set.test.ts`. Expected: PASS. If it pins the literal pattern, update it in the same way.

- [ ] **Step 3: Write the failing tests.**
  - `registry.test.ts`: for each rule in `RULES`, the fixture folder exists; `good.md` gives no finding whose `rules` includes the id; `bad.md` gives `bad.expected.json` exactly, through `investigate()` once Task 5 exists. Until then, through a helper `runRule(rule, path, text)` in `test/support.ts` that maps `RawFinding` to `Finding` with `id` from `cellKey`, `rules: [rule.id]` and `permalink: null`.
  - `total-row.test.ts`:
    - "unreadable cell skips the column and counts 1" (`200+` in a term)
    - "one term is not enough"
    - "a price column totalled as qty*price is not a finding"
    - "total rounded coarser than its rows agrees" (rows `0.333`×3, Total `1.00`: no finding)
    - "checked includes the table on an equal total"
    - "decorated total is fixed in place" (Review Focus 2)
  - `line-product.test.ts`:
    - "needs two agreeing rows" (3 rows, 1 wrong: a finding; 2 rows, 1 wrong: none)
    - "two wrong rows: no finding"
    - "factor columns must be left of the product"
    - "exact: 0.1 × 3 = 0.30 holds" (where floats fail)

- [ ] **Step 4: Run the tests to verify they fail.** Run `bun test packages/visimark-investigate`. Expected: FAIL.

- [ ] **Step 5: Implement both rules.** Port `findTotalMismatches` and `findRowProductMismatches` onto `readTables(doc.masked)`. Replace every float comparison with `scaled`/`roundToPlaces` comparisons at the stored cell's places, so there is no tolerance constant. Build `evidence` with the branch's `excerpt` (moved into `src/excerpt.ts`, which this task creates) over `lines`. Build `fix` from the cell's `from`/`to` and `rewriteNumber`. Use the message templates from §4.1 verbatim.

- [ ] **Step 6: Run the tests to verify they pass.** Run `bun test packages/visimark-investigate`. Expected: PASS.

- [ ] **Step 7: Commit** with `feat(investigate): rule contract, total-row and line-product with enforced fixtures`.

### Task 4: `engine-check` and `engine-infer`

**Files:**
- Create: `packages/visimark-investigate/src/rules/engine-check.ts`, `src/rules/engine-infer.ts`, `src/imports.ts`
- Create: `test/fixtures/rules/engine-check/{good.md,bad.md,bad.expected.json}`, `…/engine-infer/{good.md,bad.md,bad.expected.json}`
- Test: `test/rules/engine-check.test.ts`, `test/rules/engine-infer.test.ts`, `test/imports.test.ts`
- Modify: `src/rules/registry.ts` (append both, in this order)

**Interfaces:**
- Consumes: Task 3 (`Rule`, `RuleContext`, `RawFinding`, `CellRef`).
- Produces: `importTargets(markdown: Map<string, string>, engine: Engine): string[]`. It returns repo-relative paths, normalised (no `..` escaping the root, which are dropped), sorted and deduplicated.

  Tests get the engine with `import * as engine from "../../visimark/src/browser.ts"`, a value import that only test files may make.

- [ ] **Step 1: Write the fixtures.**
  - `engine-check/bad.md` is a copy of `docs/example-lunch-split-drift.md` with its heading changed to `# Team Lunch 🍔 — Cost Split` (Review Focus 4). Expected: one confirmed finding, `id` `bad.md#lunch/Total`, `stored` `"30.00"`, `computed` `"29.50"`, `message` `"the document says 30.00; SUM(Price) computes 29.50"`, and a `fix` replacing that anchored `30.00` with `29.50`. `good.md` is the same file with `29.50`.
  - `engine-infer/bad.md`: a 5-row Hours/Rate/Net table where `infer` reports a `near-miss` on one row. This table was verified on `master`: `infer` prints `near-miss — not proposed  Net = Hours * Rate  4/5 rows … row 4 D  cell 600, rule gives 400`. A small error (D at `410`) is not usable: #409's inversion then absorbs it as `Hours = Net / Rate`.

    ```markdown
    | Item | Hours | Rate | Net |
    |------|------:|-----:|----:|
    | A | 10 | 50 | 500 |
    | B | 4 | 50 | 200 |
    | C | 6 | 50 | 300 |
    | D | 8 | 50 | 600 |
    | E | 2 | 50 | 100 |
    ```

    Expected: one lead at `bad.md#t1/Net/D`, `stored` `"600"`, `computed` `"400"`, and no `fix` key. If `infer` no longer gives this near-miss (for example after #409 is fixed), stop and report it. Do not tune the fixture until something passes. `good.md` has D at `400`.

- [ ] **Step 2: Write the failing tests.**
  - `engine-check.test.ts`:
    - "STALE is confirmed"
    - "UNDEF is a lead with describeFinding's text, no fix" (`Total = SUM(Prise)`)
    - "COVERAGE adds to coverage, not findings" (a bare table: `coverage === 1`, no findings)
    - "anchor-group STALE is dropped" (the lunch file gives exactly 1 finding, not 2)
    - "WARN and NOTE are dropped"
    - "a ruled table is checked"
    - "a STALE cell inside a table gets a table CellRef" (a column rule with one stale cell gives `{kind:"table", column, row}`)
    - "an import resolves through ctx.reader" (a doc importing `data.csv` present in `texts` gives no IMPORT finding)
  - `engine-infer.test.ts`:
    - "near-miss is a lead"
    - "a column proposal adds a table to proposals"
    - "the #409 table yields a proposal and no lead"
  - `imports.test.ts`: "collects from-paths relative to the document's directory" (`docs/a.md` importing `../data/x.csv` gives `data/x.csv`); "drops a path escaping the root".

- [ ] **Step 3: Run the tests to verify they fail.** Run `bun test packages/visimark-investigate`. Expected: FAIL.

- [ ] **Step 4: Implement both rules.**
  - `engine-check` runs `engine.check(engine.build(engine.locate(doc.text)), { doc: { path: doc.path, reader: ctx.reader } })`.
    - Map each finding: `STALE` is confirmed; codes in `ERROR_CODES` other than `COVERAGE` are leads; `COVERAGE` adds to `coverage`; anything else is dropped. Drop findings with `anchorGroup`.
    - Build the `CellRef` from `span`: if it falls inside a `Cell` of a masked-read table, it is `table`; else if it has `sheetId` and `name`, it is `named`; else `other`.
    - `checked` holds each `model.sheets` entry with `table !== null && (columns.size + scalars.size) > 0`, mapped to the masked table containing `table.span.start`.
  - `engine-infer` runs `engine.infer(doc.text)`. A `near-miss` with a `disagreement` becomes a lead at the row the disagreement's `span` falls in. A `column` or `scalar` proposal adds `{ table }` for the masked table containing `tableSpan.start`.
  - `importTargets` walks `model.sheets` for `imported?.path`.

- [ ] **Step 5: Run the tests to verify they pass.** Run `bun test packages/visimark-investigate`. Expected: PASS, including `registry.test.ts` over all four rules.

- [ ] **Step 6: Commit** with `feat(investigate): engine-check and engine-infer rules, import targets`.

### Task 5: `investigate()`: ids, merge, after-fix inference, rating

**Files:**
- Create: `packages/visimark-investigate/src/investigate.ts`, `src/ids.ts`, `src/apply.ts`
- Test: `test/investigate.test.ts`, `test/fix-property.test.ts`, `test/ids.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `interface InvestigateInput { repo: { label: string; host: string | null; commit: string; lastCommit: string | null }; engineVersion: string; paths: { path: string; size: number }[]; texts: Map<string, string>; skipped: Skipped[]; workflowTexts: string[] | null; clonePath: string | null }`
  - `investigate(input: InvestigateInput, engine: Engine): Report`
  - `cellKey(path: string, ref: CellRef): string` (§3.5)
  - `applyEdits(text: string, edits: Edit[]): string`. It throws if an `old` does not match the text at `from..to`.

  `skipped` comes from `selectFiles` plus the shell's `generated` and `fetch-failed` entries. `investigate` treats every `.md`/`.markdown` key in `texts` that is not in `skipped` as a document to read.

- [ ] **Step 1: Write the failing tests.**
  - `ids.test.ts`: the three id forms; `~2`; a column header with `**Cost**` gives `Cost`.
  - `investigate.test.ts`:
    - "fixture repo from §4.3 gives the exact accuracy/adoption/ids" (build `texts` from the §4.3 files in memory; assert `accuracy` `{verdict:"confirmed",confirmed:3,leads:0,tablesRead:3,tablesChecked:3,unreadable:0}`, `adoption` `{withoutRules:2,withArithmetic:2,inferable:0,inferableAfterFix:1}`, the three ids in `path`-then-line order)
    - "merge: line-product and engine-check on one cell give rules [line-product, engine-check], confirmed". Use the #409 table followed by a `vmark #q` block holding `Cost = Qty * Price`; `check` gives `STALE` Cost/B `13.00 ≠ 12.00`, verified on `master`. The id is `<path>#t1/Cost/B`, and there is one finding, not two. `infer` proposes nothing for a table with a Total row, so a `total-row` + `engine-infer` merge cannot be built today.
    - "Q12: #409 table counts inferableAfterFix 1, inferable 0"
    - "verdict ladder" (a leads-only input gives `leads`; a checked clean input gives `clean`; no tables gives `nothing-checkable`)
    - "ruleErrors records a throwing rule and the others still run" (inject a stub rule through an optional third parameter `rules = RULES`)
    - "posture unavailable when workflowTexts is null"
    - "permalink only for github.com"
  - `fix-property.test.ts`: for every `test/fixtures/rules/*/bad.md`, apply every finding's `fix` with `applyEdits`, re-run, and expect no finding with a fixed id. Also: "a finding without fix has no fix key" (`"fix" in f === false`).

- [ ] **Step 2: Run the tests to verify they fail.** Run `bun test packages/visimark-investigate`. Expected: FAIL.

- [ ] **Step 3: Implement `investigate`.**
  - For each document: mask it, read its tables, run every rule in a `try` (record `ruleErrors` on a throw), and collect results.
  - Build `reader = engine.memoryReader(p => texts.get(p))`.
  - Merge by `cellKey` per §3.5.
  - `inferable` counts proposal tables with no confirmed finding and no vmark rules. `withArithmetic` is the union of `checked` and the proposal tables, minus tables a sheet rules.
  - `inferableAfterFix`: for each file with a confirmed finding that has a `fix`, apply its fixes, re-run `engine-infer` only, and count the tables holding a confirmed finding that now get a proposal.
  - Sort findings by `path`, then `lines[1]`.
  - `engine` is `input.engineVersion`.

- [ ] **Step 4: Run the tests to verify they pass.** Run `bun test packages/visimark-investigate`. Expected: PASS.

- [ ] **Step 5: Commit** with `feat(investigate): investigate() with content ids, merge and rating`.

### Task 6: Formatters

**Files:**
- Create: `packages/visimark-investigate/src/format.ts`
- Test: `test/format.test.ts`

**Interfaces:**
- Consumes: `Report`, `Finding`, `RULES` (for labels).
- Produces: `summaryLines(report: Report): string[]` (3 lines) and `findingLines(f: Finding, style: "cli" | "web"): string[]`.

- [ ] **Step 1: Write the failing tests.** Assert these strings exactly, from §4.3 and §4.5:
  - `summaryLines` on the §4.3 Report gives:
    - `"accuracy: 3 confirmed, 0 leads  (3 tables read, 3 checked, 0 unreadable)"`
    - `"adoption: 2 tables with arithmetic and no rules, 0 inferable, 1 inferable after fix"`
    - `"posture:  CONTRIBUTING no  PR template no  LICENSE yes  action no  last commit 2026-09-30"`
  - Unavailable posture gives `"posture:  unavailable"`.
  - `findingLines(budgetFinding, "cli")[0] === "CONFIRMED  docs/budget.md:15  Cost / Total  · found by: sum check"`. The evidence lines follow, then `"  the table says 341.50; the rows add up to 340.50 (exact); off by 1.00"`.
  - A lead's first line starts with `"lead       "` (11 characters wide).
  - With a permalink, line 2 is `"  " + permalink`.
  - The lunch finding's cell prints as `lunch.Total`. An `other` cell prints as `<code> <name>`.
  - `web`: `["Wrong number · docs/budget.md:15 · Cost / Total", "the table says …", "found by: sum check"]`, and `Worth a look · …` for a lead.

- [ ] **Step 2: Run the tests to verify they fail.** Run `bun test packages/visimark-investigate/test/format.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Labels come from `RULES` by id, joined with `", "`.

- [ ] **Step 4: Run the tests to verify they pass.** Expected: PASS.

- [ ] **Step 5: Commit** with `feat(investigate): shared summary and finding formatters`.

### Task 7: The CLI shell; remove `repo:scan`; `repo:pr` on the core

**Files:**
- Create: `scripts/repo-investigate.ts`, `scripts/repo-investigate.test.ts`
- Modify: `scripts/repo-pr-clone.ts` (split into `prepareClone`, `investigateWorkdir`, `recordClone`; `ensureClone` composes them), `scripts/repo-pr.ts` (imports; `clone.report.repo` becomes `clone.report.repo.label`), `scripts/repo-pr-clone.test.ts`, `package.json` (scripts)
- Delete: `scripts/repo-scan.ts`, `scripts/repo-scan-lib.ts`, `scripts/repo-scan-lib.test.ts`

**Interfaces:**
- Consumes: the core's `index.ts` by relative path (`../packages/visimark-investigate/src/index.ts`). The engine is `import * as engine from "../packages/visimark/src/browser.ts"`, and the version is `readVersion` from `../packages/visimark/src/cli/version.ts`.
- Produces, in `repo-pr-clone.ts`:
  - `prepareClone(opts: { repoArg: string; branch?: string; force?: boolean; cacheRoot?: string; onLocalWork: "error" | "reuse" }): { status: "error"; message: string } | { status: "ready"; host: string; label: string; cloneUrl: string; sha: string; workdir: string; defaultBranch: string; reusedLocalWork: boolean }`
  - `investigateWorkdir(workdir: string, meta: { label: string; host: string | null; commit: string; clonePath: string | null }): Report`. It reads `git ls-files` (all files, with sizes from `statSync`), `selectFiles`, the Markdown, `looksGenerated`, `importTargets` and its targets, the workflows, and `git log -1 --format=%cs`.
  - `recordClone(cacheRoot, entry, report): boolean`. It writes the manifest, deletes the clone unless `actionable(report)` (§2.3), and returns `kept`.
  - `ensureClone` keeps its exported signature, and its `scanned` result's `report` is the core `Report`.

- [ ] **Step 1: Write the failing acceptance tests** in `scripts/repo-investigate.test.ts`.
  - A `beforeAll` builds the §4.3 fixture repository in `mkdtempSync` with `git init`, sets `GIT_COMMITTER_DATE`/`GIT_AUTHOR_DATE` to `2026-09-30T12:00:00Z`, and commits.
  - Each case spawns `bun scripts/repo-investigate.ts <args>` and asserts stdout, stderr and the exit code:
    - the full text session from §4.3 (with `<sha12>` substituted, and the budget excerpt lines 3–15 in full)
    - the `--json` row (parse the JSON; assert the fields listed in §4.3's table, and that `stdout.trim()` parses as one JSON value)
    - the README-and-LICENSE-only repo
    - a lead-only repo (`docs/plan.md` with `Total = SUM(Prise)` in a ruled table)
    - no argument; `--explain`; `--branch` with a path; a non-work-tree directory; `nope`
  - Also: `bun run repo:scan` exits non-zero and its stderr contains `Script not found`.

- [ ] **Step 2: Run the tests to verify they fail.** Run `bun test scripts/repo-investigate.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `scripts/repo-investigate.ts`.**
  - Argument parsing per §2.1. The local-path test is `/^(\/|\.\/|\.\.\/)/`. A local path is checked with `git -C <p> rev-parse --show-toplevel`, and `label` is the top level's basename. Unknown option: `repo-investigate: unknown option <x>`.
  - stdout: the header line `repo-investigate: <label> at <sha12>, <files.read> Markdown files`, then `summaryLines`, then `skipped: <path> (<reason>)` per skip, then a blank line and `findingLines(f, "cli")` per finding, with blank lines between findings. Under `--json`, `JSON.stringify(report, null, 2)` alone.
  - stderr: clone progress, and `note: clone kept at <path>` or `note: nothing actionable; clone removed`.
  - Exit `report.accuracy.confirmed > 0 ? 1 : 0`.
  - Header comment: §1 of the spec in four lines, plus the usage line.

- [ ] **Step 4: Refactor `repo-pr-clone.ts`** per the Interfaces. `ensureClone` calls `prepareClone({ …, onLocalWork: "error" })`, then `investigateWorkdir`, then `recordClone`. In `package.json`, replace `"repo:scan": "bun scripts/repo-scan.ts"` with `"repo:investigate": "bun scripts/repo-investigate.ts"`. Delete the three `repo-scan*` files. Update `repo-pr-clone.test.ts` for the new `report` shape.

- [ ] **Step 5: Run the tests to verify they pass.** Run `bun test scripts && bun test packages/visimark-investigate`. Expected: PASS.

- [ ] **Step 6: Commit** with `feat(scripts): repo:investigate on the core; remove repo:scan`.

### Task 8: The widget shell

**Files:**
- Modify: `site/src/pages/repo-scan.ts` (keep the file name, the exports `fetchRawText`, `parseRepoInput`, `mapPool`, `workflowYaml` and `wireRepoScan`, and the DOM ids)
- Modify: `site/src/pages/repo-scan.test.ts` (drop the `encodePath` describe, which moved in Task 2), `site/package.json` (`"visimark-investigate": "workspace:*"`), `site/tsconfig.json` (`paths`: `"visimark-investigate": ["../packages/visimark-investigate/src/index.ts"]`)
- Create: `site/test/pages/repo-scan-parity.test.ts`
- Modify (generated): `docs/vendor/visimark-site-index.js`

**Interfaces:**
- Consumes: the core's `selectFiles`, `importTargets`, `investigate`, `summaryLines`, `findingLines`, `encodePath`, `isDotPath` and `VISIMARK_ACTION_USE`, plus `window.VisiMark` as the `Engine`.
- Produces: `gatherInputs(ref: RepoRef, fetchImpl: typeof fetch, onProgress): Promise<{ input: InvestigateInput; defaultBranch: string }>`, exported for the parity test, and `runScan(ref, onProgress): Promise<Report>`.

- [ ] **Step 1: Write the failing parity test.** Stub `fetch` to serve:
  - `/repos/o/r`, `/repos/o/r/commits/main` (`sha`, `commit.committer.date: "2026-09-30T12:00:00Z"`) and `/repos/o/r/git/trees/<sha>?recursive=1`, built from the §4.3 fixture files;
  - raw URLs from the same files.

  Assert that `investigate((await gatherInputs(...)).input, engine)` deep-equals the core's Report for the same in-memory files, with `clonePath: null`.

  Also assert:
  - "fetches raw at the commit, not the branch" (every raw URL contains the sha)
  - "exactly 3 api.github.com calls"
  - "file-cap 500 records file-cap skips"
  - "a twice-failed raw fetch records fetch-failed"
  - "an action-using repo is still investigated and the add-workflow link is absent" (render into happy-dom and query the report element)

- [ ] **Step 2: Run the tests to verify they fail.** Run `cd site && bun test test/pages/repo-scan-parity.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the adapter.**
  - Make the three API calls (§2.4), with today's `fetchJson` errors. Workflows are fetched first; any failure there sets `workflowTexts` to `null`.
  - Run `selectFiles(paths, 500)`, fetch the Markdown with `mapPool`/`fetchRawText`, check `looksGenerated`, run `importTargets` and fetch the targets, then run `investigate`.
  - `engineVersion` comes from `import pkg from "../../../packages/visimark/package.json" with { type: "json" }`.
  - Render `summaryLines`, then per finding an `<li>` with the `web` lines, the path linking to `permalink`, and the evidence in `<details><pre>`. All text goes through `escapeHtml` and `setTrustedHtml`.
  - Keep the `file-cap` caveat text from today. Show the add-workflow link only when `posture.actionUsed === false`.
  - Delete the local `isDotPath`, `VISIMARK_ACTION_USE` and `encodePath` copies, and their "Mirrors" comments.

- [ ] **Step 4: Rebuild and run all site tests.** Run `bun install && cd site && bun test && bun run build:pages && git diff --stat ../docs/vendor/`. Expected: PASS; only `visimark-site-index.js` changes among the vendor files; `site/test/html-callers.test.ts` still passes unchanged.

- [ ] **Step 5: Smoke-check in a browser.** Serve `docs/` (`bunx serve docs` or the repo's usual way), paste `michal-niedzwiedzki/visimark`, and confirm `docs/example-lunch-split-drift.md` appears as `Wrong number · … · found by: VisiMark`.

- [ ] **Step 6: Commit** with `feat(site): Scan your repo runs the investigation core`.

### Task 9: Documentation

**Files:**
- Modify:
  - `docs/index.html`: the subtitle under `<h2>Scan your repo</h2>`, which becomes "Paste a public GitHub repo and see what VisiMark would catch in its Markdown — wrong totals and line totals, and stale values in documents that already use it. Nothing is cloned or written until you click through to GitHub yourself." Also line 31's comment, which stays pointing at `site/src/pages/repo-scan.ts`; check that it still says what the file does.
  - `site/src/pages/repo-scan.ts`: the header comment. It is the widget shell, the core judges, and the comment gives the three API calls.
  - `scripts/repo-pr-clone.ts`, `scripts/repo-pr.ts`, `scripts/repo-pr-manifest.ts`: the header and doc comments that name `repo-scan`/`repo:scan`, which now name `repo:investigate` and the core.
  - `docs/vocabulary-catalogue.md`: move the #407 row out of section F into the Shipped register as `UNRELEASED`, with columns `Name` (the row's name), `Kind` (`tooling`), `Request` (`[#407](…)`), `Landed` (this PR), `Released` (`—`), `Decision` (the deciding comment).
- Create: `packages/visimark-investigate/README.md`, which covers:
  - what the core is (one paragraph);
  - the rule contract (`Rule`, `RuleResult`);
  - how to add a rule: one file under `src/rules/`, one line in `registry.ts`, and one `test/fixtures/rules/<id>/` folder with `good.md`, `bad.md` and `bad.expected.json`;
  - the Report schema, with a link to the spec's §3.3.

  It ends with `<!--vmark:no-formulas-->`.
- No `CHANGELOG.md` entry (§7: nothing published changes).

- [ ] **Step 1: Make the edits above.**
- [ ] **Step 2: Verify.** Run `bun scripts/check-links.ts && bun run packages/visimark/src/cli/main.ts check packages/visimark-investigate/README.md docs/vocabulary-catalogue.md && grep -rn "repo:scan\|repo-scan-lib\|scripts/repo-scan" --include=*.ts --include=*.md --include=*.html --include=*.json --include=*.yml . | grep -v node_modules | grep -v "docs/design/clear-scanner-errors-lint-repo-in-ci-"`. Expected: links resolve; `0 problems`; the grep prints only this plan and the spec.
- [ ] **Step 3: Full checks.** Run `bun run lint && bun run format:check && bun test && bun run typecheck && bun run build`. Expected: all green.
- [ ] **Step 4: Commit** with `docs: repo:investigate core, widget copy, catalogue row to Shipped`.

<!--vmark:no-formulas-->
