# VisiMark — design

This document tracks the intended behaviour of the engine and is kept current.

Worked examples: [`example-invoice.md`](example-invoice.md) (clean) and
[`example-invoice-drift.md`](example-invoice-drift.md) (deliberately broken).
Both are normative: the implementation must reproduce their behaviour exactly.

## 1. Purpose

Markdown made prose reviewable in a diff. Nothing does that for calculation.
VisiMark adds spreadsheet mechanics to Markdown so that a number in a document
can carry the formula that produced it, and so that a machine can prove the two
still agree.

The intended user is a developer or an agent working in a text editor, not a
spreadsheet user. The value is not the arithmetic — it is that the arithmetic
is auditable in code review and enforceable in CI.

**Non-goals.** No grid, no presentation layer, no cell styling, no locale, no
Excel file compatibility, no attempt at Excel's function library.

## 2. Constraints that shaped the design

1. **A VisiMark document must render correctly in unmodified renderers** —
   GitHub, VS Code preview, Obsidian, pandoc. This is a hard requirement and it
   is why computed values live in table cells rather than formulas.
2. **The tool writes only what it owns.** Human input is never rewritten
   without an explicit flag.
3. **Ambiguity is an error, never a guess.** Where a value could mean two
   things, VisiMark refuses rather than picks. This rule produced the ISO-only
   date decision and the rejection of thousands separators.

## 3. Document model

A document contains **sheets**. A sheet is a namespace. It has an optional
table and a mandatory `vmark` block.

````markdown
| Item  | Price | Qty |   Net |
|-------|------:|----:|------:|
| pen   |  5.00 |  10 | 50.00 |

```vmark #lines
Net   = Price * Qty
total = SUM(Net)
```
````

**Sheet identity** comes from the fence info string: ` ```vmark #lines `. A `vmark`
block with no identity contributes to **document scope**, whose names are
visible to every sheet. Multiple document-scope blocks are permitted and merge.

**Table association.** If the block's immediately preceding node, ignoring
blank lines, is a GFM table, the sheet owns that table. Otherwise the sheet is
table-less — legitimate, and used by `#terms` and `#recon` in both examples. A
block that declares column rules but owns no table is a `SHEET` error, so
inserting a paragraph between a table and its block fails loudly rather than
silently detaching the rules.

**Anchors** materialise a scalar into prose:

```markdown
Invoice total: **28659.00**<!--vmark=lines.gross_total-->
```

The anchor rewrites the text content of the inline node immediately preceding
it. That node must be `strong`, `emphasis`, `inlineCode`, or a text node whose
trailing token is a number; anything else is an `ANCHOR` error. HTML comments
are invisible in every target renderer, so the sentence reads normally.

## 4. Syntax

**Bindings.** A block is a list of `name = expression` bindings, one per line.
`#` begins a comment (the sheet id lives in the fence info string, so `#` is
free inside the body). Order is irrelevant; evaluation follows dependencies.

A binding whose name matches a column header of the sheet's table is a **column
rule**, applied uniformly to every row. Any other binding is a **scalar**.
Columns not named by any rule are **inputs**: human-owned, never written.

There are no per-row exceptions and no totals row inside a table. A total is a
scalar, and it reaches the reader through an anchor.

**Literals.**

| Form | Meaning |
|------|---------|
| `1800.00` | decimal number |
| `23%` | number, exactly equal to `0.23` |
| `2026-09-03` | ISO 8601 calendar date |
| `"net 30"` | string |
| `true` / `false` | boolean |

**Operators.** `+ - * / ^`, comparison `== != < <= > >=`, and `and or not`.
Equality is `==`; `=` is binding only. Two characters are deliberately absent:
`|` would collide with table syntax, and `%` is postfix-only so that `23%` is
never ambiguous. Use `MOD()` for modulo.

**Functions, v1.** `SUM MIN MAX COUNT AVG ROUND ABS IF MOD`. Nine, chosen to
cover the examples and nothing more. Growth is expected; it is not a v1 concern.

## 5. Dates

VisiMark accepts exactly one date syntax: ISO 8601 calendar dates,
`YYYY-MM-DD`, ten characters. Anything else is a `DATE` error.

This is a smaller design than locale detection, not merely a stricter one:
there is no locale, no `date_order` directive, no configuration, and no rule for
what a bare `/` means. Dates sort lexicographically, so chronological ordering
is free, and every date has the same width, so columns stay aligned.

The tool responds to a rejected date in one of two ways, and the distinction
matters:

- **Decidable.** `15.10.2026` cannot mean anything but 15 October, because 15 is
  not a month. `visimark fmt --fix-dates` rewrites it. The flag is required
  because this writes to a human-owned input cell.
- **Undecidable.** `11/12/2026` is 2026-12-11 or 2026-11-12, twenty-nine days
  apart. The tool refuses and explains. No flag overrides this.

**Date arithmetic** is closed and small: date − date is a number of days, date ±
number is a date, everything else is a `TYPE` error. Times, timezones, week
dates (`2026-W37`) and partial dates (`2026-09`) are out of scope. A month type
is the omission a reporting table will miss first.

## 6. Name resolution and scoping

Resolution of a bare identifier, in order: the sheet's own columns, then the
sheet's own scalars, then document scope. There is no global name search — a
bare name resolves in its own sheet, then document scope, and nowhere else. A
qualified name `sheet.name` reaches another sheet's columns or scalars
directly. An unresolvable name is an `UNDEF` error carrying a did-you-mean
suggestion by edit distance.

Because there is no global search, two tables that both have a `Net` column
never collide: they are two sheets, and the names are `a.Net` and `b.Net`. A
bare `Net` is always the one in the current sheet.

**A name bound twice in one scope is a `DUP` error**, reported on the second
binding and pointing back at the first. A scope is a single sheet — across all
blocks that share its id, since those merge — or the merged document scope.
Resolution keeps the first binding so
that references to the name still resolve; the error fires regardless. `DUP` is
not auto-fixable. Splitting one sheet's rules across several `vmark #id` blocks
stays legal; it is only `DUP` when the blocks actually collide on a name.

Sheets read each other freely, which makes every column name a public API.
The mitigation is that all references resolve **by name**, so a rename or typo
fails loudly at check time rather than silently producing a different number.

**A foreign column is a vector and may only be consumed by an aggregate.**
`SUM(schedule.Amount)` is legal; a bare `schedule.Amount` in a column rule is a
`VECTOR` error, because two sheets have no reason to share a row count. Joining
sheets by key is deferred.

**An unreferenced scalar is a `WARN`.** This closes the input-column gap: a
typo such as `Ne = Qty * Rate` would otherwise define a scalar nobody reads and
quietly leave the `Net` column unmanaged. The warning carries the same
did-you-mean treatment as `UNDEF`, and is suppressed for any binding that
already carries an error — the three scalars inside the drift example's
`#late_fees` cycle are reported once, as a cycle, not four times.

## 7. Numeric semantics

Arithmetic is **decimal**, not binary floating point. No document may ever
contain `0.30000000000000004`.

**Rounding happens at every name binding — a column cell or a named scalar —
and nowhere else.** Sub-expressions within a single formula carry full
precision. The consequence worth having is that a reader re-adding a column on
a calculator gets the same answer the tool does, which is what makes a printed
invoice defensible.

**Write precision is inferred, not declared.** A computed column takes the
decimal-place count of its existing cells; a scalar takes it from its anchor's
current text. Empty or absent, both fall back to the document-scope `precision`
constant, default 2. This is why `Days` writes `7` rather than `7.00` while
`Net` writes `5200.00`, with no syntax for either. Per-column precision
declarations are deferred until something needs them.

Thousands separators are rejected. They reintroduce exactly what ISO-only dates
eliminated: a separator whose meaning depends on locale, colliding with the
format's own punctuation. Presentation is the renderer's job.

**A materialised value may carry a unit.** `$5.50`, `5.50 PLN`, `12 N` and
`3.5 kg` are numbers with a decoration: a run of characters that are not
digits, whitespace, `.` or `-`, sitting entirely before the number or entirely
after it. A leading `-` binds to the number, so `$-5.00` and `-$5.00` both read
as −5.00. Decoration on both sides is a `UNIT` error. Parenthesised negatives
(`($5.00)`) are not supported.

The decoration is inferred, never declared — the same principle as write
precision and column alignment. **Within a column, every non-empty cell must
carry the identical decoration**, or none at all. Any deviation — `$` against
`€`, prefix against suffix, a decorated cell among bare ones — is a `UNIT`
error that names the forms it saw. The tool never decides which decoration is
the right one; a human does.

A unit is stripped for every arithmetic operation, every comparison, and
precision inference, and is **re-applied on write-back**: a column whose input
cells are uniformly `$5.50`, `$4.00` has its computed cells written `$16.50`;
a bare column stays bare. A computed column does not inherit a unit from its
operands — there is no dimensional analysis — so a column computing
`Force / Length` writes bare numbers until its own cells are decorated.
Operand propagation and an explicit per-column unit declaration are deferred
(section 14).

Scalars work the same way: a scalar's unit is the decoration on its anchored
value, and two anchors on one scalar that disagree are a `UNIT` error. The
invoice's `**23300.00**<!--vmark=lines.net_total--> PLN` is unaffected: the
anchored value is bare and `PLN` sits in the prose after the comment.

`%` is not a unit. `23%` remains exactly `0.23` by the rule in section 4; a
unit never scales the number it decorates.

## 8. Evaluation

Parse every block into an AST. Build a dependency graph over bindings, spanning
sheets. Topologically sort; report a `CYCLE` error with the full path through
the cycle rather than a bare "circular reference". Evaluate in order, rounding
at each binding.

A finding is **suppressed** when it derives from an upstream error — the drift
example reports two unverifiable `Days` rows as a single `NOTE` rather than
emitting noise about values it could not compute. Suppression is the general
rule, not a special case: one root cause yields one finding.

Recomputation reparses the document. A full reparse of a large document is
single-digit milliseconds; incremental range remapping is a later optimisation
to be justified by profiling, not assumed.

## 9. Write-back

The tool owns exactly two things: **computed cells** and **anchored values**.
Everything else — input columns, prose, headings, table alignment, the blocks
themselves — is human territory and is never touched. The sole exception is
`fmt --fix-dates`, which is opt-in precisely because it writes to input.

A rewritten cell or anchor keeps its column's or scalar's inferred unit: the
number changes, the `$` or ` kg` around it does not. A column carrying a `UNIT`
error is not rewritten at all — the tool cannot know which decoration to
apply — and its staleness is reported once, as the `UNIT` error, not as a row
of `STALE` findings.

Writing must not reformat the document. The implementation locates targets via
mdast **positions** and then splices the original source buffer by byte offset.
It never round-trips through `remark-stringify`, which would normalise emphasis
markers, list bullets and line wrapping across the whole file and produce a
four-hundred-line diff for a one-cell change — destroying the diffability that
justifies the project.

## 10. Error taxonomy

| Code | Meaning | Auto-fixable |
|------|---------|--------------|
| `STALE` | stored value disagrees with its formula | yes, by `fmt` |
| `DATE` | not an ISO 8601 calendar date | only if decidable, with `--fix-dates` |
| `UNIT` | a column mixes unit decorations, or a value is decorated on both sides | no |
| `UNDEF` | unresolvable name | no |
| `DUP` | a name is bound twice in one scope | no |
| `VECTOR` | foreign column outside an aggregate | no |
| `CYCLE` | circular dependency | no |
| `TYPE` | illegal operand types | no |
| `SHEET` | column rules with no table | no |
| `ANCHOR` | anchor with no rewritable target | no |
| `WARN` | scalar defined and never read | no |
| `NOTE` | finding suppressed by an upstream error | n/a |

`fmt` repairs every `STALE` finding without asking, because those cells are
outputs and the formula is the authority. It repairs none of the others,
because each is a question only a human can answer.

## 11. CLI

The CLI is the product; the VS Code extension is a later thin wrapper. An agent
must be able to verify a document without an editor.

```
visimark check FILE...              read-only; exit 1 if any finding
visimark fmt   FILE... [--fix-dates] rewrite computed cells and anchors
visimark eval  FILE [--get NAME] [--json]
visimark explain FILE [#sheet]      print rules and dependency order
```

Exit codes: `0` clean, `1` findings, `2` usage or parse failure.

`explain` exists to recover what the format gives up by scattering rules across
blocks: a single readable view of a sheet's logic and evaluation order.

## 12. Architecture

TypeScript, distributed via `npx`. A Rust binary would serve the agent story
better but costs the extension path; it is premature. The engine is one package
(`packages/visimark`) in a workspace that also holds the language server and
the editor clients; the split and the editor-facing API it exposes are covered
in the editor-plugins design.

| Module | Responsibility | Depends on |
|--------|----------------|------------|
| `lang/` | tokenizer, Pratt parser, AST | nothing |
| `parse/` | remark + remark-gfm; locate tables, blocks, anchors with positions | remark |
| `model/` | sheets, columns, bindings, scopes | `lang`, `parse` |
| `eval/` | dependency graph, topological order, decimal evaluation | `model` |
| `write/` | offset splicer over the original source text | `model` |
| `report/` | finding formatting, did-you-mean | `model` |
| `cli/` | command surface | all |

No module imports `vscode`. `lang/` and `eval/` are pure functions over data,
which is what makes the whole engine testable without a filesystem.

Never `eval()`. The expression grammar is small enough that a hand-written
Pratt parser is a day's work and gives precise error positions.

## 13. Testing

**The two example documents are the acceptance suite.**

- `example-invoice.md` must produce zero findings, and `fmt` must leave it
  byte-for-byte identical.
- `example-invoice-drift.md` must reproduce the transcript in its own appendix
  exactly — 26 problems, being 21 stale values and 5 errors, plus one
  suppression note. The test asserts `check` output against the fenced console
  block in that file, so the documentation cannot drift from the implementation
  without failing the build.

Beyond those: unit tests per module; golden-file tests for the splicer proving
that a one-cell change touches one line; and a property test that `fmt` is
idempotent.

`DUP` and `UNIT` must not fire on either example — both keep their numbers bare
and their currency in prose — so adding those two codes leaves the acceptance
transcript unchanged. Each gets its own unit coverage: a sheet that binds a
name twice; a column mixing `$` and `€`; a column with one bare cell among
decorated ones; a value decorated on both sides; a `$`-decorated input column
whose computed neighbour is rewritten `$`-decorated and stays byte-stable
under a second `fmt`.

## 14. Deferred

Month and partial-date types. Joining sheets by key. Per-column precision and
output formats. Per-row exceptions. A function library beyond the nine.
Incremental reparse.

**Units, beyond the inferred decoration in section 7.** Propagating a unit
through a formula so that a computed column inherits `$` from `Price * Qty`
without a seed cell; an explicit `Col :: "unit"` declaration for computed
columns whose cells cannot be inferred from; anything resembling dimensional
analysis, where `N` divided by `m` yields `N/m`. The v1 rule is deliberately
flat: a unit is a display decoration on one column, inferred from that column's
own cells, and it does not compute.

The editor plugins are specified separately in
[`visimark-editor-plugins-design.md`](visimark-editor-plugins-design.md).

## 15. Known tensions

**Full cross-reference contradicts the private-addressing instinct the project
started with.** Every column name is now a public API, and renaming one can
break a sheet three pages away. Accepted deliberately, mitigated by name-based
resolution so the break is loud, by `check` in CI, and by `WARN` on unused
scalars.

**Unit decorations let locale back in through a side door.** `$` and `kg` are
exactly the presentational, culture-bound noise the ISO-only date rule and the
thousands-separator ban were meant to keep out. The compromise: a unit is
inert. It is never parsed for meaning, never converted, never propagated
through a formula; it is a fixed string the tool carries from an input cell to
the computed cells beside it, and a column that is not internally consistent
about it is an error. The number is still the value; the decoration is still
the renderer's concern, just pinned in place.

**Anchors depend on renderers permitting raw HTML.** Verified on 2026-09-03;
see section 16. Seven of eight tested configurations pass. The one failure is
cosmetic and is accepted.

## 16. Renderer verification

Measured 2026-09-03 against a probe containing a bold prose anchor, a
bare-number prose anchor, anchors in a table header cell and a body cell, and a
`vmark` block.

| Renderer | Anchor handling | Verdict |
|----------|-----------------|---------|
| GitHub (`api.github.com/markdown`, gfm) | stripped from output | pass |
| pandoc 3.11 → html5 | passed through as a comment | pass |
| pandoc 3.11 → docx | dropped; values retained | pass |
| markdown-it `html: true` (VS Code preview) | passed through as a comment | pass |
| marked, default options | passed through as a comment | pass |
| remark-rehype, default | stripped from output | pass |
| remark-rehype, `allowDangerousHtml` | passed through as a comment | pass |
| markdown-it `html: false` — the library default | escaped to visible text | **fail** |

Tables, column alignment, bold values and the `vmark` code block rendered
correctly in every case, including the failing one.

The single failure is markdown-it's own default setting. VS Code sets
`html: true`, so VS Code preview is unaffected, but a tool embedding
markdown-it without configuring it will print `<!--vmark=order.total-->` as
literal text after the number. This is cosmetic, not a correctness failure —
the value still renders and nothing is lost or altered — it cannot be fixed
from inside the format, and it is accepted.

Two findings that bear on the implementation:

- GitHub parses the fence info string into `lang="vmark" data-meta="#order"`,
  and remark exposes the same string as `node.meta`. Sheet identity comes free
  from the parser; no custom info-string parsing is needed.
- Every anchor arrives as an inline `html` node carrying a byte offset,
  including inside a `tableCell`. This confirms the section 9 splicing strategy
  directly, and means header-cell anchors remain technically available should
  the block-only decision ever be revisited.

Obsidian was not tested; it is not scriptable in this environment. It is
believed to hide HTML comments in reading view, but that is unverified and no
document should claim it.
