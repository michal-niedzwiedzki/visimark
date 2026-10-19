# `report` statements in an HTML comment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a sheet's `report` statements live in a top-level `<!--vmark:report #id …-->` comment, and give the whole `<!--vmark:` colon family one rule: an unknown word, a nested comment, or a malformed marker is a finding.

**Architecture:** `locate` walks every `html` node once and classifies the colon comments. It returns well-formed report comments (`reportComments`) and structural problems (`malformedColonComments`). The no-formulas marker is found by the same walk, and a fence's backward table lookup skips top-level report comments. `build` interleaves fences and report comments by source offset. It turns each report comment into report statements on its sheet through the same `parseOne` and `DUP` path a fence uses. It also turns each structural problem into its `SHEET` or `ANCHOR` finding. Nothing downstream of the model changes: `simulate`, `explain`, `infer`, the LSP and the lint adapters read the model.

**Tech Stack:** TypeScript, Bun (`bun test`), remark (already a dependency).

**Spec:** [`declare-a-sheet-s-report-statements-spec.md`](declare-a-sheet-s-report-statements-spec.md)

## Global Constraints

- Every commit carries the `Co-Authored-By:` trailer for this session from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md).
- Every finding message is the spec's §4.1 text, byte for byte. Do not reword one.
- No new dependency and no new public export from `packages/visimark/src/index.ts`.
- `simulate`'s stdout on `docs/simulate/conference.md` is byte-identical before and after (spec §6.1).
- Any Markdown example that nests a `vmark` fence inside an outer fence widens the outer fence to four backticks ([`.agents/rules/nested-code-fences.md`](../../.agents/rules/nested-code-fences.md)).
- Run `bun run format` and `bun run lint` before every push.
- After each task, run `bun test`, `bun run typecheck` and `bun run build` from the repo root.

---

### Task 1: Classify colon comments in `locate`

**Files:**

- Create: `packages/visimark/src/parse/colon-comment.ts`.
- Modify: `packages/visimark/src/parse/document.ts`.
- Create: `packages/visimark/test/parse/colon-comment.test.ts`.

**Interfaces:**

```ts
// parse/colon-comment.ts
export type ColonProblem =
  | "unknown-word" | "nested" | "malformed-marker"
  | "unclosed" | "trailing" | "no-id";

/** `<!--\s*vmark\s*:` — any colon-family comment */
export const COLON_RE: RegExp;
/** the report prefix, well-formed or not: word `report`, then a non-word char or end */
export const REPORT_LOOSE_RE: RegExp;

export type ColonParse =
  | { kind: "marker" }                                   // exact no-formulas
  | { kind: "report"; sheetId: string; body: string; bodyStart: number } // bodyStart absolute
  | { kind: "problem"; problem: ColonProblem; word: string };

/** classify one html node's raw value (not trimmed) starting at absolute `start` */
export function parseColonComment(value: string, start: number, topLevel: boolean): ColonParse | null;
```

```ts
// parse/document.ts additions
export interface RawReportComment {
  sheetId: string;          // as written; build validates it
  bindings: RawBinding[];   // splitBindings(body, bodyStart)
  span: Span;               // the whole html node
}
export interface MalformedColonComment {
  problem: ColonProblem;
  word: string;
  span: Span;
}
// LocatedDoc gains:
reportComments: RawReportComment[];          // top-level, source order
malformedColonComments: MalformedColonComment[];
```

**Steps:**

- [ ] Write the tests first. They cover each row of spec §4.1 at the `locate` level (`problem` and `word`), the id rules of spec §2.1 (`#x-->`, `report#x`, `# x`, the id on the next line), `body`/`bindings` spans that slice back to each report line, a `#` comment in the body being dropped, the comment inside a ```` ```markdown ```` fence being inert, and a nested no-formulas marker.
- [ ] `parseColonComment` order, returning the first that applies:
  1. `null` when `COLON_RE` does not match the trimmed value.
  2. Read the word (`[A-Za-z0-9_-]*` after the colon and optional whitespace). Not `no-formulas` or `report` → `unknown-word`.
  3. `!topLevel` → `nested`.
  4. `no-formulas`: the trimmed value matches the existing `NO_FORMULAS_RE` → `marker`, otherwise `malformed-marker`.
  5. `report`: no `-->` → `unclosed`. Non-whitespace after the first `-->` → `trailing`. After the word, `[ \t]+#` followed by an id run (`[^\s]+?` up to whitespace or `-->`, at least one character) → `report`. Otherwise `no-id`. The body is the text from just after the id to the first `-->`.
- [ ] In `locate`, replace the top-level `NO_FORMULAS_RE` loop with one walk over the tree that records depth. Top level is a direct child of the root. The first `marker` sets `noFormulas`, and later markers are ignored as today. A `report` result pushes a `RawReportComment` with `bindings: splitBindings(body, bodyStart)`. A `problem` result pushes a `MalformedColonComment`. A `vmark` code node is not an html node, so it is never visited as one.
- [ ] Table lookup: when looking for `prev`, step back over top-level `html` nodes whose trimmed value matches `REPORT_LOOSE_RE`, then test for a table. The detached-table scan is unchanged.
- [ ] Commit.

### Task 2: `isReportLine` in the parser

**Files:**

- Modify: `packages/visimark/src/lang/parser.ts`.
- Modify: `packages/visimark/test/lang/` (the existing parser test file for reports; add cases there).

**Interfaces:** `export function isReportLine(line: string): boolean`. It is not re-exported from `index.ts`.

**Steps:**

- [ ] Tests: `report gates` → true, `report heatmap` → true, `report` → true, `report = 5` → false, `report precision 2 = 5` → false, `report x = 1` → false, `x = 1` → false, `assert a < 1` → false, `"Item" is item` → false. A line the lexer rejects that starts with `report` and has no `=` → true.
- [ ] Implement it with the same dispatch `parseStatementInner` uses: lex, first non-eof token is the ident `report`, and no `=` op token. On a lex error, fall back to the text test from spec §2.1: `/^report(\s|$)/`, and no `=` outside a string.
- [ ] Commit.

### Task 3: Report comments in `build`

**Files:**

- Modify: `packages/visimark/src/model/build.ts`.
- Create: `packages/visimark/test/model/report-comment.test.ts`.

**Interfaces:** internal only. Extract two helpers from the fence path so both callers share them:

- `invalidSheetId(sheetId, span): Finding | null`, the existing message;
- `addReport(sheet, report, findings)`, the existing `DUP`-or-push.

**Steps:**

- [ ] Tests from spec §3.3 and every `check`-level row of §6.2 that `build` decides. Each asserts the code, the message, `sheetId`, and the span sliced from the source. They also cover `model.sheets` key order for a comment before its fence, report order across a fence and a comment, and `DUP`'s `relatedSpan`.
- [ ] In `build`, merge `doc.blocks` and `doc.reportComments` into one list sorted by `span.start`, and dispatch on the kind. A fence takes the existing path unchanged.
- [ ] For a report comment:
  - empty `bindings` → `SHEET` "a report comment declares no report", with `sheetId` and the comment span;
  - else the first binding where `!isReportLine(raw)` → `SHEET` "a report comment holds report statements only" at that binding's span;
  - else `ensureSheet(sheets, id, null)`, `invalidSheetId` with the comment span, then `parseOne` each binding. A `null` sets `droppedLines`; a report goes through `addReport`.
  - It never touches `blockOfSheet` or `tableBeforeBlock`.
- [ ] After the loop, next to the malformed-anchor loop, map each `MalformedColonComment` to its finding (spec §4.1 rows 1–7). `nested` gives `SHEET` when the word is `report` and `ANCHOR` otherwise. Name the message strings as exported `const`s in `build.ts`, so the tests import them rather than copying them.
- [ ] Commit.

### Task 4: Acceptance

**Files:**

- Create: `packages/visimark/test/report-comment-acceptance.test.ts`.

**Steps:**

- [ ] Through `runCli` (the `slack-acceptance.test.ts` harness, `now: () => 0`):
  - `check` on each §6.2 fixture prints the finding lines and exits as the spec says;
  - the pre-review's table → comment → fence cascade fixture exits 0;
  - `simulate` on a comment-only file prints its `#id` headings and exits 0 with no `no report statement`;
  - `infer --write` on table → report comment → no fence writes the fence between the two, checked by slicing the written file;
  - `explain` lists `#readings  (no table)` before `#ledger  (no table)`.
- [ ] Commit.

### Task 5: The guide's document

**Files:**

- Modify: `docs/simulate/conference.md`.
- Modify: `packages/visimark/test/report-comment-acceptance.test.ts`.

**Steps:**

- [ ] Write the byte-identity test first, and see it pass against the fenced file. It reads `conference.md` and builds the fenced twin in memory by turning each report comment back into a fence. It writes both under the same basename in two temp dirs, runs `simulate` on each, and expects equal stdout.
- [ ] Replace the `## Readings` heading and both fences with the two comments from spec §1, and keep the intro's "two sheets of readings". Run the test again. `check` on the file exits 0. `slack-acceptance.test.ts` and `assertion-sides.test.ts` stay green.
- [ ] Commit.

### Task 6: Documentation

**Files and steps:**

- [ ] `docs/visimark-design.md` [§3](../visimark-design.md#3-document-model):
  - sheet identity: a report comment opens a table-less sheet, and fences and comments merge in source order;
  - table association: the lookup skips a report comment;
  - after the anchor-announcement paragraph, a paragraph on the colon family: `no-formulas`, `report`, unknown words, top level only.
- [ ] `docs/visimark-design.md` [§10](../visimark-design.md#10-error-taxonomy): widen the `SHEET` row with "a malformed or nested report comment". Widen the `ANCHOR` row with "an unknown `vmark:` word, or a nested or malformed `no-formulas` marker".
- [ ] `docs/simulate.md`:
  - teach both forms where it introduces where reports go (the "A sheet of its own reads as a section of the document" passage);
  - update every listing of `conference.md`'s readings to match the file, and the walkthroughs that change "one line of the example's `#readings` sheet" so they say where that line now lives;
  - four-backtick outer fences wherever a `vmark` block is nested.
- [ ] `docs/cli-reference.md`: the `simulate` row reads the `report` statements "in a `vmark` fence or a `<!--vmark:report #id …-->` comment".
- [ ] `.agents/skills/visimark/SKILL.md`: one paragraph on the report comment and the colon-family rule. Then `bun run gen:mcp` if the MCP skill text is generated from it.
- [ ] Regenerate `docs/examples/conference/index.html` with `bun run gen:examples`, and any other generated file the generators touch.
- [ ] `CHANGELOG.md` `## Unreleased`:
  - under `### Added`, the report comment;
  - under `### Changed`, the behaviour change for an unknown `vmark:` word, a nested colon comment and a malformed `no-formulas` marker.
- [ ] `editors/vscode/CHANGELOG.md`: one line for the new diagnostics.
- [ ] `docs/vocabulary-catalogue.md`: move the #375 row from section E into the Shipped register as `UNRELEASED`, with `Landed` = the implementation PR, `Released` = `—` and `Decision` = the deciding comment.
- [ ] Run `bun run packages/visimark/src/cli/main.ts check` on every tracked `.md` the dogfood job checks; all must pass.
- [ ] Commit.
