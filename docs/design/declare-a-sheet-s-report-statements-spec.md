# `report` statements in an HTML comment — feature spec

**Status:** approved (#375) · **Date:** 2026-10-14 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/375#issuecomment-6179053849

A second place to write a sheet's `report` statements. The `vmark` fence form from #258 ([`lattice-on-param-and-report-statements-spec.md`](lattice-on-param-and-report-statements-spec.md) §2.2) stays legal and unchanged. This spec also gives the `<!--vmark:` comment family one rule: a word the tool does not know is a finding, and every colon comment must be at the top level. Every open design question in the [pre-review](https://github.com/michal-niedzwiedzki/visimark/issues/375#issuecomment-6123475693) and the discussion summary on #375 is closed here. Section numbers below cite those questions as "Q1"…"Q16".

## 1. Purpose

`docs/simulate/conference.md` is the model for the `simulate` guide. `check` exits 0 on it. Its last section is two fences with no table:

````markdown
## Readings

```vmark #readings
report gates
report forbidden
report best scalar event.profit direction max among feasible
report best scalar event.ticket direction min among feasible
report deltas on event.profit, event.sponsor_share among all
report slack
```

```vmark #ledger
report ledger assertions broken
```
````

In a preview those fences render as code blocks of machine instructions at the foot of a budget. The statements are configuration for `simulate`, and `simulate` already prints each one back under its `#id` heading. A reader of the rendered budget gets nothing from them.

No existing feature reaches this:

- Wrapping a fence in a hand-written HTML comment hides it from the parser as well as from the preview.
- `<!--vmark=…` is the anchor prefix, and a spaced body there is an `ANCHOR` finding today.
- Putting the lines in the sheet they read (`#event`) is legal, but that fence holds the params and asserts a reviewer should see, and it still renders.
- An input column cannot tell `simulate` which reading to print.

With this feature the same declarations are HTML comments, invisible in every target renderer:

```text
<!--vmark:report #readings
report gates
report forbidden
report best scalar event.profit direction max among feasible
report best scalar event.ticket direction min among feasible
report deltas on event.profit, event.sponsor_share among all
report slack
-->

<!--vmark:report #ledger report ledger assertions broken-->
```

## 2. Syntax

### 2.1 The report comment

```text
<!--vmark:report #ID BODY-->
```

- **Prefix.** `<!--`, optional whitespace, `vmark`, optional whitespace, `:`, optional whitespace, the lowercase word `report`. This is the same surrounding whitespace an anchor and `<!--vmark:no-formulas-->` allow. The word ends at the first character that is not `[A-Za-z0-9_-]`, so `report` must be followed by whitespace, `#`, or `-->`; `reports` and `reporting` are other words (§2.3).
- **Id (Q1).** One or more spaces or tabs, then `#`, then the id: the run of characters up to the next whitespace or `-->`. The id must sit on the opener line. Spaces or tabs, not a newline, separate `report` from `#`.
  - `<!--vmark:report #readings` → id `readings`.
  - `<!--vmark:report #x-->` → id `x` (the run stops at `-->`).
  - `<!--vmark:report# x…`, `<!--vmark:report#x…`, `<!--vmark:report # x…`, and `report` followed by a newline and then `#x` all have **no sheet id** (§4).
  - The id uses the fence's identifier grammar, `[A-Za-z_][A-Za-z0-9_]*`. An id with other characters (`#a/b`) is the fence's existing invalid-id `SHEET` finding, and the sheet still builds under it ([§3](../visimark-design.md#3-document-model)).
- **Body (Q2).** Everything after the id up to the first `-->`. It may start on the opener line and continue on later lines. The one-line form `<!--vmark:report #ledger report ledger assertions broken-->` is the case of a body with one line. The body is split exactly like a fence body (`splitBindings`): blank lines are dropped, and a `#` outside a string starts a line comment that is dropped.
- **Statements.** Each remaining line is a full `report` statement, keyword included, parsed by the existing report grammar. A line is a report line by the parser's own dispatch rule (#258): its first token is the identifier `report` and it has no `=` token. So `report = 5` and `report precision 2 = 5` are bindings and are refused here (§4). For a line the lexer rejects, the same test is made on the text: it starts with `report` followed by whitespace or the end of the line, and it holds no `=` outside a string.
- **Case.** The spelling is lowercase. `<!--VMARK:report` does not match the family at all (as `<!--VMARK=` does not match an anchor today). `<!--vmark:Report …` is an unknown word (§2.3).

### 2.2 Where it may appear (Q5)

Only at the **top level** of the document: an `html` node that is a direct child of the Markdown root. This matches `vmark` fences and `<!--vmark:no-formulas-->`. A comment that starts a line is a top-level block even straight after a paragraph or a table with no blank line between, because an HTML comment block may interrupt both.

A colon comment inside a list item, a blockquote, a table cell, or inline in a paragraph (`text <!--vmark:report #x report gates--> more`) is a finding (§4, Q16). It is never silently ignored.

Text inside any fenced code block is not an `html` node, so an example in the guide stays inert, whatever its fence's info string.

### 2.3 The colon family (Q4, Q15)

Every HTML comment, at any depth, whose trimmed text matches `<!--\s*vmark\s*:` is a **colon comment**. Its **word** is the run of `[A-Za-z0-9_-]` characters after the colon and its optional whitespace (possibly empty).

| Word | Meaning |
|---|---|
| `no-formulas` | The existing marker. It must be exactly `<!--vmark:no-formulas-->` with the existing optional whitespace, at top level. |
| `report` | A report comment (§2.1). |
| anything else, including the empty word | An `ANCHOR` finding (§4). |

`<!--vmark=` (anchors) and every comment that does not match `<!--\s*vmark\s*:` are unaffected.

### 2.4 In an unmodified renderer

GitHub, the VS Code preview, Obsidian's reading view and pandoc's HTML writer hide HTML comments. Pandoc's other writers drop them as raw HTML. The rendered budget is prose and tables (constraint 1, [§2](../visimark-design.md#2-constraints-that-shaped-the-design)). The fence form still renders as a code block, which is what a document that teaches the declaration wants.

## 3. Semantics

### 3.1 Sheets

A report comment is a second way to open a **table-less** sheet, and a second way to add statements to a sheet.

- **Merging (Q8).** A fence and a comment with the same id are one sheet, exactly as two fences with one id are today. A comment has the rights a second fence with that id would have and no others. It may join an imported sheet, a sheet whose fence declares column rules, or a sheet with no fence at all.
- **Order (Q9).** Fences and report comments contribute in **source order**. The sheet is opened by whichever comes first, so `model.sheets` order (and therefore `simulate`'s headings, `N of M sheets`, and `explain`'s list) follows the first appearance of each id. Within a sheet, report statements are kept in source order across fences and comments. `DUP`'s related span is the first of the two in source order.
- **Tables.** A report comment never owns a table. A sheet opened by a comment gets its table later only if a fence with the same id owns one, as `ensureSheet` already does for a second fence.
- **No `blockOfSheet` entry.** `blockOfSheet` still maps an id to its last *fence*. A sheet that only report comments open has no entry, so the LSP's code lens skips it.

### 3.2 Table association (Q6)

When a fence looks backward for its table, it skips every **top-level** `html` node whose trimmed text matches the report prefix (`<!--\s*vmark\s*:\s*report` followed by a character outside `[A-Za-z0-9_-]` or by the end), well-formed or not, the same way it skips a blank line. Several in a row are all skipped. A malformed one between a table and its fence therefore gives its one `SHEET` finding and nothing else, not the detached-table cascade. Any other node between a table and its fence, including an ordinary comment, `<!--vmark:no-formulas-->`, and an unknown-word colon comment, still detaches the table, as today. The detached-table scan is unchanged.

### 3.3 Behaviour table

| Document | Result |
|---|---|
| fence `#ev` with a lattice param, then `<!--vmark:report #ev`↵`report gates`↵`-->` | one sheet `ev`; `simulate` prints `#ev`, `report gates` and its reading |
| `<!--vmark:report #r report gates-->` before fence `#r` | one sheet `r`, opened by the comment; `explain` lists `#r` where the comment sits in the order |
| fence `#r` with `report gates`, then `<!--vmark:report #r report forbidden-->` | `#r` reports `gates` then `forbidden` |
| fence `#r` with `report gates`, then `<!--vmark:report #r report gates-->` | `DUP` on the comment's line, related span the fence's line |
| table, `<!--vmark:report #t report gates-->`, fence `#t` with `B = A * 2` | the fence owns the table; `check` exit 0 |
| table, `<!--vmark:report #t-->`, fence `#t` with `B = A * 2` | one `SHEET` (no report); the fence still owns the table; no `UNDEF` |
| table, `<!-- note -->`, fence `#t` with `B = A * 2` | unchanged: `SHEET` detached + `UNDEF t.B` |
| table, then `<!--vmark:report #t report gates-->`, no fence | `#t` is a table-less sheet; the table has no rules, so `COVERAGE` as today |
| `<!--vmark:report #a report gates-->` and `<!--vmark:report #b report gates-->` with no fence | two sheets; `simulate` no longer says `no report statement` |
| `<!--vmark:report #a/b report gates-->` | sheet `a/b` builds and the invalid-id `SHEET` is reported too |
| `<!--vmark:report #x # just a note-->` | `SHEET` declares no report (the body is only a comment) |

## 4. Type rules and errors

There is no new finding code. `SHEET` and `ANCHOR` widen. All findings are static, from `build`; none depends on evaluation, so none is suppressed by an upstream error ([§8](../visimark-design.md#8-evaluation)).

### 4.1 Order of checks for one colon comment (Q7)

Each colon comment gives **at most one** structural finding: the first row below that applies. A comment with a structural finding contributes nothing: it opens no sheet, joins none, and none of its lines are parsed.

| # | Applies when | Code | Message | `sheetId` | Span |
|---|---|---|---|---|---|
| 1 | the word is not `no-formulas` or `report` | `ANCHOR` | ``unknown `vmark:` comment `WORD` — expected `<!--vmark:no-formulas-->` or `<!--vmark:report #id …-->` ``; for the empty word, ``a `vmark:` comment names no word — expected …`` (same tail) | — | the comment |
| 2 | a report comment below the top level | `SHEET` | ``a report comment must be at top level`` | — | the comment |
| 3 | a `no-formulas` comment below the top level | `ANCHOR` | ``a `vmark:` comment must be at top level`` | — | the comment |
| 4 | a top-level `no-formulas` comment that is not exactly the marker | `ANCHOR` | ``malformed `no-formulas` marker — expected `<!--vmark:no-formulas-->` `` | — | the comment |
| 5 | a report comment with no `-->` (remark runs the node to the end of the document or block) | `SHEET` | ``a report comment is not closed with `-->` `` | — | the comment |
| 6 | non-whitespace after the first `-->` in the same `html` node: trailing text, a second comment on the line, a `-->` inside a `#` line comment | `SHEET` | ``text after a report comment`` | — | the comment |
| 7 | no id as §2.1 defines it | `SHEET` | ``a report comment has no sheet id`` | — | the comment |
| 8 | the body has no line once blank lines and `#` comments are dropped | `SHEET` | ``a report comment declares no report`` | the id | the comment |
| 9 | some body line is not a report line (§2.1): a binding, `assert`, `param`, `chart`, an `is` alias, a unit definition, `report = 5` | `SHEET` | ``a report comment holds report statements only`` | the id | the **first** such line |

Rows 1, 3 and 4 change what `<!--vmark:no-formulas-->` and unknown colon words do. That is a behaviour change, stated as one in the CHANGELOG: a nested or malformed marker, and any other `vmark:` word, used to be an ordinary comment. No tracked Markdown file in the repository has any of them. A second, well-formed, top-level marker stays ignored, as today.

### 4.2 A comment that contributes

A report comment with none of the findings above contributes its lines.

- **Invalid id.** An id outside `[A-Za-z_][A-Za-z0-9_]*` gives the fence's existing message, ``sheet id `a/b` is not a valid identifier — invalid character `/` ``, with the comment as its span, **in addition**. The sheet builds under that id.
- **Each line** is a `report` statement and keeps every rule #258, #333 and #352 gave it. The span is that line inside the comment:
  - a line that breaks the report grammar (unknown report name, bad option) is `TYPE`, the line is dropped, and the sheet is marked as having dropped lines, as in a fence;
  - a ref that resolves to nothing is `UNDEF`; a ref to a column is `TYPE`; a bare `report deltas` with no non-param scalar is `TYPE`; `report slack` in a file with no `assert` is `TYPE`;
  - two byte-identical statements in one sheet are `DUP`, whichever of fence or comment each came from.
- `check` still exits `1` on any finding. `simulate` exit codes are unchanged; a report sheet with a finding cannot start, as for a fence.

## 5. Interaction with the rest of the language

| Surface | Behaviour |
|---|---|
| Shape system ([§4](../visimark-design.md#4-syntax)) | unchanged; the report grammar and its refs are unchanged |
| Evaluation, dependency graph ([§8](../visimark-design.md#8-evaluation)) | unchanged; a comment adds report statements only, which bind nothing |
| Write-back ([§9](../visimark-design.md#9-write-back)) | the tool owns nothing new. `fmt` never writes, moves or rewrites a report comment, and a one-input change leaves the comment out of the diff |
| Anchors ([§3](../visimark-design.md#3-document-model)) | unchanged. A report comment is not an anchor and binds no value; `<!--vmark=` parsing is untouched |
| Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)) | a report ref in a comment resolves exactly as one in a fence of the same sheet |
| `COVERAGE` | a report is not a rule. A report comment neither satisfies nor contradicts `COVERAGE` |
| Prose figures | `html` nodes are skipped already, so numbers inside a report comment are never prose figures and `infer` never sees them |
| `check`, `check --json` | the new findings use the existing envelope |
| `explain`, `explain --json` | a comment-only sheet is listed as `#ledger  (no table)`, like a report-only fence. Report lines are not listed. No new key |
| `infer`, `infer --write` (Q10) | `infer` never emits a report comment. For a table followed by a report comment and no fence, the new fence goes **between the table and the comment**: it is inserted at the table's end, as today. A sheet id taken by a comment is never minted |
| `eval` | does not read a report comment as a value |
| `simulate` | collects comment sheets with fence sheets, in source order, and prints the same `#id` heading, statement text and reading. A file whose only reports are comments no longer gets `no report statement` |
| Playground (`pg-simulate.ts`) | reads the same model; no change of its own |
| LSP, `codemirror-visimark`, `markdownlint-visimark`, `remark-visimark` | diagnostics arrive through the engine. Hover and go-to-definition on report refs are out of scope (Q12) |
| Activation gates (`codemirror-visimark` `hasVmarkBlock`, the LSP's `applicable`, `markdown-it-visimark`) | unchanged: a document is a VisiMark document when it has a `vmark` fence. A document with report comments and no fence holds no params or asserts, so its readings say nothing; it is not activated, the same as a document with only anchors today |

## 6. Acceptance

### 6.1 The guide's document (Q11)

`docs/simulate/conference.md` replaces the `## Readings` heading and its two fences with the two comments from §1. Then:

- `visimark check docs/simulate/conference.md` exits 0.
- `visimark simulate docs/simulate/conference.md` stdout is **byte-identical** to the fenced run on `master` (stderr's timing differs). The test captures the fenced document's stdout in memory from the same file with the comments turned back into fences, and compares.
- `explain` still lists `#readings  (no table)` and `#ledger  (no table)`, in that order.
- `docs/examples/conference/index.html` is regenerated and no longer has a Readings section.
- `slack-acceptance.test.ts` and `assertion-sides.test.ts`, which read this file, still pass.

### 6.2 A fixture per case

Each is a test in `packages/visimark/test/` that runs `check` on an inline document and asserts the codes, messages and spans. `T` is `| A | B |`↵`|--:|--:|`↵`| 1 | 2.00 |` and `F` is the fence `` ```vmark #t``↵`B = A * 2`↵` ``` ``.

| Fixture | Expected |
|---|---|
| `T`, blank, `<!--vmark:report #t report gates-->`, blank, `F` (the pre-review's cascade) | 0 findings (today: `SHEET` detached + `UNDEF t.B`) |
| `T`, `<!--vmark:report #t-->`, `F` | exactly one: `SHEET t. a report comment declares no report` |
| `T`, `<!--vmark:report #t report x = 1-->`, `F` | exactly one: `SHEET t. a report comment holds report statements only`, span `report x = 1` (it has `=`, so it is not a report line) |
| `<!--vmark:report-->` | one `SHEET a report comment has no sheet id` |
| `<!--vmark:report#x report gates-->` | one `SHEET a report comment has no sheet id`; no sheet `x` |
| `<!--vmark:report # x report gates-->` | one `SHEET a report comment has no sheet id` |
| `<!--vmark:report`↵`#x`↵`report gates`↵`-->` | one `SHEET a report comment has no sheet id` |
| `<!--vmark:report #x report gates`↵(end of file, no `-->`) | one `SHEET a report comment is not closed with -->` |
| `<!--vmark:report #r report gates--> trailing` | one `SHEET text after a report comment` |
| `<!--vmark:report #a report gates--><!--vmark:report #b report gates-->` | one `SHEET text after a report comment`; no sheet `a` or `b` |
| `<!--vmark:report #r report gates # see --> here-->` | one `SHEET text after a report comment` |
| fence `#r` with a param, then `<!--vmark:report #r`↵`report = 5`↵`-->` | one `SHEET r. a report comment holds report statements only`, span `report = 5` |
| `<!--vmark:report #r report heatmap-->` | `TYPE r.` ``unknown report `heatmap`; the reports are …``, span the line inside the comment |
| fence `#r` with `report gates`; `<!--vmark:report #r report gates-->` | `DUP r.` `report gates is declared twice in sheet r`, span the comment's line, related span the fence's line |
| `<!--vmark:report #r report forbidden-->` before fence `#r` with a lattice param and `report gates` | 0 findings; `simulate` prints `report forbidden` before `report gates` under one `#r` heading |
| `<!--vmark:report #a/b report gates-->` | `SHEET` ``sheet id `a/b` is not a valid identifier — invalid character `/` ``; the sheet `a/b` exists in the model |
| `<!--vmark:reports #x report gates-->` | one ``ANCHOR unknown `vmark:` comment `reports` — expected …`` |
| `<!--vmark:Report #x report gates-->` | one ``ANCHOR unknown `vmark:` comment `Report` — expected …`` |
| `<!--vmark:-->` | one ``ANCHOR a `vmark:` comment names no word — expected …`` |
| `> <!--vmark:report #x report gates-->` | one `SHEET a report comment must be at top level`; no sheet `x` |
| `- <!--vmark:report #x report gates-->` | the same |
| `text <!--vmark:report #x report gates--> more` | the same |
| `> <!--vmark:no-formulas-->` | one ``ANCHOR a `vmark:` comment must be at top level`` |
| `<!--vmark:no-formulas extra-->` | one ``ANCHOR malformed `no-formulas` marker — expected <!--vmark:no-formulas-->`` |
| `T`, `<!--vmark:report #t report gates-->`, no fence; `infer --write` | the new `` ```vmark #unnamed1 `` fence is written between `T` and the comment; `check` on the result has no finding the fence's rules do not explain |
| a file whose only `report` statements are in comments; `simulate` | stdout has the `#id` headings; stderr has no `no report statement`; exit 0 |
| ```` ```markdown ```` fence holding `<!--vmark:report #x-->` | 0 findings (inert) |

### 6.3 Unchanged

- Every tracked Markdown document that passes `check` on `master` still passes. None contains a colon comment other than a top-level, well-formed `<!--vmark:no-formulas-->`.
- The existing `parse/document.test.ts`, `check.test.ts`, `infer/write.test.ts` cases for `<!--vmark:no-formulas-->` pass unchanged.

## 7. Non-goals

- Hover, go-to-definition and highlighting on refs inside a report comment (Q12, #367). Any such work covers both forms in its own issue.
- Activating the editor integrations on a document with report comments and no fence (§5).
- Any other statement in a comment: params, asserts, rules and charts stay in fences.
- `fmt` or `infer` writing, moving or converting report comments.
- Changing the report grammar or the report list (#351, #352 and later rows do that).

## 8. Documentation to update

- `docs/visimark-design.md` [§3](../visimark-design.md#3-document-model): sheet identity (a report comment opens a table-less sheet; fences and comments merge in source order), table association (the lookup skips a report comment), and the colon family next to the anchor paragraph (`no-formulas`, `report`, unknown words, top level only).
- `docs/visimark-design.md` [§10](../visimark-design.md#10-error-taxonomy): the `SHEET` row (a malformed or nested report comment) and the `ANCHOR` row (an unknown `vmark:` word, a nested or malformed colon comment).
- `docs/simulate.md`: teach both forms. Every listing of `conference.md`'s readings matches the new file; an example that shows a comment beside a `vmark` fence uses a four-backtick outer fence (`.agents/rules/nested-code-fences.md`).
- `docs/simulate/conference.md` and the regenerated `docs/examples/conference/index.html`.
- `docs/cli-reference.md`: the `simulate` row says the `report` statements may be in a fence or a report comment.
- `.agents/skills/visimark/SKILL.md`.
- `CHANGELOG.md` under `## Unreleased`: `### Added` for the report comment; a behaviour-change line for unknown, nested and malformed colon comments. `editors/vscode/CHANGELOG.md`: one line for the new diagnostics.
- `docs/vocabulary-catalogue.md`: the row moves to the Shipped register as `UNRELEASED`.

## 9. Open questions

None.
