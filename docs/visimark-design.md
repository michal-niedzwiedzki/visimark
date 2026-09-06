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
4. **The meaning of a document depends only on its own text and the version of
   `visimark` that reads it.** Nothing ambient may change what a number
   evaluates to: no extension modules, no config file, no environment
   variables, no network, no clock. Two people checking out the same commit get
   the same answer, and a reviewer reading the diff sees every input to it.

**The consequence is that VisiMark will not have a plugin architecture**, and
this is a deliberate refusal rather than an unbuilt feature. A registry of
host-supplied functions would mean a document whose numbers cannot be verified
from the document — the Excel macro problem, where the arithmetic that produced
a figure lives somewhere the reviewer cannot see. It would also make a Markdown
file in a pull request able to select code that CI then executes. Both costs
fall on exactly the property the project exists to provide, so the extension
point is closed.

Where the built-in vocabulary is too small, the fix is to grow it in this
document and ship it in the engine — a primitive everyone can read and everyone
can run — never to let a document reach outside itself. Proposed additions and
the standing decision on each live in
[`vocabulary-catalogue.md`](vocabulary-catalogue.md). Values that genuinely
come from elsewhere (an FX rate, a quoted price) belong in an input column,
where a human or an agent writes them down, dated and diffable. The single
exception to constraint 2, `fmt --fix-dates`, is the shape any future exception
must take: explicit, document-local, and opt-in at the command line.

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

**There are no boolean literals.** `true` and `false` are not part of the
surface syntax, and a boolean can never be materialised into a table cell or an
anchor. The boolean *type* exists inside the engine — it is what a comparison
produces and what `IF()` and `and`/`or`/`not` consume — but it lives only in
flight, between the comparison that creates it and the function that consumes
it.

The rule is enforced at two points. `true` and `false` do not lex — the words
are refused where they are written, so they can be neither a value nor a bound
name — and a binding whose expression evaluates to a boolean is a `TYPE` error
reported once against the binding, never once per row:

```
TYPE    s.Out     a boolean cannot be stored; wrap it in `IF()` to produce a
                  number or a string
```

So `Flag = Days > 30` is refused and `Status = IF(Days > 30, "late", "current")`
is the way to write it. Comparisons, `and`, `or` and `not` are unaffected: they
compose freely inside a condition, which is the only place a boolean was ever
going.

Two reasons. A literal boolean in a formula is dead code — `IF(true, a, b)` is
just `a` — and its only real use is a document-level flag that switches which
arithmetic applies, which makes a figure depend on a toggle far from the table
it appears in. And a materialised boolean reintroduces ambiguity of exactly
the kind constraint 3 forbids: a cell holding the word `true` would have to be
read as a boolean rather than as the string it plainly is, so one English word
in an input column would silently change type. A materialised value is a
number, a date, or a string — nothing else.

**Operators.** `+ - * / ^`, comparison `== != < <= > >=`, and `and or not`.
Equality is `==`; `=` is binding only. Two characters are deliberately absent:
`|` would collide with table syntax, and `%` is postfix-only so that `23%` is
never ambiguous. Use `MOD()` for modulo.

### Shape: map and reduce

Every expression has one of two **shapes**, and this distinction does more work
in the language than the value types do.

A **scalar** is a single value. A **vector** is a column, and exactly one thing
produces one: a reference to a column name. From there the rules are closed:

- A **map** function is scalar → scalar. It runs once per row inside a column
  rule, and its result is a scalar wherever it appears.
- A **reduce** function is vector → scalar. It collapses a column to one value.
- There is **no vector → vector**. Nothing in the language transforms a column
  into another column except a column rule, which is a map applied per row.

A column rule is therefore a map over its sheet's rows, and a scalar binding is
whatever its expression evaluates to. Three rules that otherwise look like
unrelated restrictions all follow from this one:

- `SUM(schedule.Amount)` is legal and a bare `schedule.Amount` is a `VECTOR`
  error, because a vector has no meaning outside a reduce (section 6).
- `Share = Net / SUM(Net)` is legal, because a reduce yields a scalar and a
  scalar composes anywhere a map accepts one — including back inside the column
  rule the reduce read from.
- `SUM(Price * Qty)` is refused. **A reduce takes a column reference, never an
  expression.** This is the audit trail rather than a limit of the parser: it
  forces every intermediate to be materialised as a column the reader can see,
  so a total is always the sum of numbers printed on the page. Writing a `Net`
  column first is the point, not a detour.

### Builtin functions

Eleven, chosen to cover the examples and the two catalogued additions a real
document needed (`EOMONTH`, issue #6; `SQRT`, issue #18). Each is declared with
its shape and its exact argument count, in one table in `eval/functions.ts` —
the single home for a classification the dependency walk, the evaluator and the
reporter each need. The parser stays function-agnostic: it builds a call node
for any name, and the name is judged afterwards.

| Function | Kind | Arity | Meaning |
|----------|------|------:|---------|
| `SUM(col)` | reduce | 1 | total of a column; `0` over an empty column |
| `MIN(col)` | reduce | 1 | least value; numbers or dates, not mixed |
| `MAX(col)` | reduce | 1 | greatest value; numbers or dates, not mixed |
| `AVG(col)` | reduce | 1 | arithmetic mean; an empty column is a `TYPE` error |
| `COUNT(col)` | reduce | 1 | number of rows |
| `ROUND(x, places)` | map | 2 | half-up to `places` decimals |
| `ABS(x)` | map | 1 | absolute value |
| `MOD(x, y)` | map | 2 | remainder; the language has no `%` operator |
| `IF(cond, a, b)` | map | 3 | `cond` must be a boolean; returns `a` or `b` |
| `EOMONTH(d, months)` | map | 2 | last day of the month `months` calendar months from `d`; `d`'s day is discarded; `months` is a whole number; a result outside years 1–9999 is a `DATE` error |
| `SQRT(x)` | map | 1 | non-negative square root of a non-negative number; a negative operand is a `TYPE` error |

**Arity is exact and checked statically**, once per binding, before anything is
evaluated. `ROUND(Qty)` is a `TYPE` error blaming the span of the call, not a
crash and not one complaint per row — a malformed call is one root cause and
yields one finding, as section 8 requires. An unrecognised name is a `TYPE`
error carrying a did-you-mean suggestion, bounded by edit distance so that a
name unlike anything builtin is reported without a misleading guess.

Every reduce takes exactly one argument by construction, which is the shape
rule restated as a number: there is nothing for a second column to mean.

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
is the omission a reporting table will miss first — `EOMONTH(d, months)` (§4)
covers the end-of-month case without one, by discarding the day of `d` and
returning an ordinary date, but a general `date ± n months` still awaits a
motivating document and a day-clamp rule.

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
| `TYPE` | illegal operand types, or a malformed call (name, arity, shape) | no |
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
output formats. Per-row exceptions. A function library beyond the eleven —
proposals and the decision on each are tracked in
[`vocabulary-catalogue.md`](vocabulary-catalogue.md). Incremental reparse.

**Named inline function definitions — `NAME(params) = expression` in a block —
are deferred, to be reconsidered on 2028-01-01 if a v2 of this spec is
warranted.** The case for them is real but unevidenced: nothing in either
worked example repeats. `example-invoice.md` computes line items, VAT, a
payment schedule, an FX conversion and a reconciliation in sixteen bindings, no
two of which share a shape a function could factor out — and the closest thing
to repetition, three `SUM()` calls over three columns, is already as short as it
can be. A column rule is itself the abstraction over repetition, and it covers
the cases the format was built for.

The cost, by contrast, is known and is paid up front: a fourth namespace
alongside columns, scalars and document scope, colliding with the builtin table
above; the language's first lexical scope, for parameters, which today's
resolution order (section 6) has no notion of; a shadowing rule; recursion
detection, which the binding-level `CYCLE` machinery cannot see; and a surface
in the language server for names that are neither builtin nor bindings.

The trigger to revisit is a real document in which one scalar → scalar
expression appears in three or more places, or the same expression is needed in
two sheets. That document is the specification's motivation, and until it
exists the feature is speculative. Should it be built, the shape rule above
settles its form without further argument: a user-defined function is a **map**
— scalar parameters, scalar result. Users cannot define a reduce, because doing
so would require vector parameters, and the language does not have them.

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

<!--vmark:no-formulas-->
