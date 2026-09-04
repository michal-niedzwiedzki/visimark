# Design — `visimark infer`

**Status:** implemented. Sections 4, 6 and 13 carry amendments made during
implementation, each marked and argued where it sits.
**Companion:** [`2026-09-04-visimark-infer-editor-design.md`](2026-09-04-visimark-infer-editor-design.md)
— the editor surfaces that consume this.

## 1. What changes

A new command reads a Markdown document that contains arithmetic and **no
formulas**, works out which rules would reproduce the numbers already in it, and
proposes them.

```
visimark infer FILE...          propose rules; print, write nothing
visimark infer FILE --write     insert the blocks and anchors it proposes
```

The point is the adoption cost. Today a document becomes a VisiMark document
because a human learns the format and rewrites the document. After this, a
document becomes a VisiMark document because someone ran one command against
the invoice they already had.

The second effect matters as much as the first. A rule that fits every row but
one is evidence the document is **already wrong**, in a document that has never
heard of VisiMark. `infer` reports that, which means the tool has something to
say to a user who has adopted nothing.

## 2. What inference is, exactly

For each column, search a small space of candidate rules for one that
reproduces **every** cell exactly, at that column's own inferred precision.

This is exact verification, not statistics. A candidate either reproduces all
`n` cells or it does not; there is no score, no threshold, no fitting. With
four rows and non-degenerate operands, an accidental fit is not a practical
concern. With two, it is — see section 7.

Nothing here is heuristic except the ranking in section 6, and that ranking
only ever chooses between candidates that are each already exact.

## 3. The command surface

`infer` is **advisory**. It exits `0` whatever it finds, and `2` on usage or
read failure. It never exits `1`.

A document with no inferable rules is not a failure, it is a document. All CI
pressure stays in `check`, whose contract, output and exit codes this design
does not touch at all — see section 15.

`--write` is the single flag. It is required for the same reason
`fmt --fix-dates` is required: the command is about to put bytes into a region
the tool does not otherwise own.

## 4. The search

Four stages, run in order, because each feeds the next.

**Stage 1 — binary column rules.** `C = A op B` for every ordered pair of
numeric columns in the table and every `op` in `* / + -`.

```
Net   = Qty * Rate
Gross = Net + VAT
```

**Stage 2 — constant multipliers.** `C = A * k`, with `k` solved from the first
row and then *verified against every remaining row*. A `k` that only satisfies
the row it was derived from is not a finding.

```
VAT = Net * 0.23
```

**Stage 3 — reduces, and the prose figures that anchor them.** Every numeric
literal in the document that is not inside a table and not inside a `vmark`
block is a candidate anchor site. For each, test `SUM`, `AVG`, `MIN`, `MAX` and
`COUNT` over every numeric column of every table.

```
net_total   = SUM(Net)      matching the figure at line 33
gross_total = SUM(Gross)    matching the figure at line 35
```

**Amendment — which figures qualify.** A figure states a value only when it is
already written the way `fmt` would write that value back: the value, rounded to
the figure's own decimals, carrying the decoration inferred for the column being
reduced. Comparing the two as numbers is not enough. `00` in a postal code and
`MIN(Share)` of `0.25` agree at zero decimals; `#unnamed1` parses as a decorated
`1` and agrees with `SUM(Share)`. Both disagree about the *text*, which is the
thing an anchor is a promise about.

The test is exact and it introduces nothing: it is `planFmt`'s write-back asked
as a question rather than performed. Rounding at the anchor stays legal, because
a value rounded to the figure's decimals is precisely what `fmt` writes — the
invoice's `eur_total` still matches its `6719.58`. Only forms the tool would
never produce are refused, which is why a figure written `25%` never anchors a
scalar: `fmt` would write `0.25` there. That is the same asymmetry the format
already has, where an input written `30%` stays `30%` forever because nothing
computes it.

**Amendment — which figure a scalar is anchored at.** A scalar may be anchored
only at a figure that follows its own table, and only once. Both halves are
needed and neither is a heuristic about meaning. A document states a total after
the rows it totals, so a figure above the table is not evidence for it; and a
name that is already bound in prose is not a candidate for a second sentence,
which is what makes the *later* claimant of a repeated value ambiguous rather
than the earlier one. Without the first half, `SUM(Gross)` and `SUM(Amount)`
would compete at every figure equal to `28659.00` and none of the three totals
in the worked invoice could be proposed; without the second, the reconciliation
sentence would silently repeat an anchor that already exists.

**Stage 4 — cross-sheet.** `C = A * s` where `s` is a scalar named in stage 3,
in this sheet or another. Stage 4 depends on stage 3's names, which is why the
order is fixed.

```
Amount = Share * lines.gross_total
```

**A column qualifies as numeric** only if every non-empty cell parses as a
decimal after unit stripping. `Item` and `Unit` are excluded by that test alone,
which is why "no rule found, treating as an input" needs no separate rule: it is
what is left over.

*(Amendment.)* The test is `numericValue`, not `parseDecorated` directly: a
percent cell is a number too, and `check` has always coerced one. `Share`, whose
cells read `30%`, has to be numeric or the worked invoice's own stage 4 rule
cannot be found. `numericValue` is the single home for that decision, and
`check`'s input coercion now runs through it, so inference and the evaluator
cannot disagree about which columns are numbers.

Cost is not a concern. A seven-column, four-row table is roughly 120 candidate
evaluations in stage 1, and the stages below it are smaller.

## 5. Verification runs the real evaluator

A candidate is verified by constructing an ordinary `Binding` and evaluating it
with the existing engine, against the existing `CheckResult` machinery for
precision and units.

**There is no second arithmetic implementation, and no reimplemented
rounding.** Rounding happens at the binding, decimals are decimals, a unit is
stripped before arithmetic and irrelevant to the comparison. If inference and
`check` could ever disagree about whether `Net = Qty * Rate` holds, the feature
would be worse than useless, because its entire output is fed straight back
into `check`.

This is the same discipline as the single builtin function table: one place
where the semantics live.

## 6. Selection — the result is a set, not a list

Candidates are not independent findings. `Gross = Net + VAT` and
`Net = Gross - VAT` both fit perfectly, and accepting both produces a document
that fails `check` with a `CYCLE`. So selection produces an **acyclic set**.

Applied in order:

1. **Reject any candidate that would close a cycle** with the already-accepted
   set.
2. **Prefer a rule over materialised columns to one introducing a constant.**
   `Gross = Net + VAT` beats `Gross = Net * 1.23`. This tie-break needs no
   separate defence: it is the same principle that makes a reduce take a column
   reference rather than an expression, so that every intermediate is a number
   the reviewer can see.
3. **Prefer the constructive form of an arithmetic fact to its rearrangement.**
   `*` and `+` outrank `/` and `-`. *(Amendment.)* Cycle rejection says the set
   may contain only one of `Net = Qty * Rate`, `Qty = Net / Rate` and
   `Rate = Net / Qty`, but it does not say which, and without a rule the answer
   is whichever the search reached first. The product is the one a person
   writes: the inverses are the same fact read backwards, and taking one of them
   inverts the direction the whole set then builds in. This is what leaves `Qty`
   and `Rate` as inputs, and it is what leaves `VAT = Net * 0.23` as the only
   survivor for `VAT` once `Gross = Net + VAT` has ruled out `VAT = Gross - Net`.
4. **Build outward from inputs.** Prefer rules whose operands are input columns
   or already-accepted computed columns.
5. **When two survivors still rank equally, report both and propose neither.**

Rule 5 is the general form of constraint 3 in the engine design: ambiguity is
an error, never a guess. It is reported as an `ambiguous` proposal listing the
competing rules, and `--write` skips it.

**Degenerate operands** get one specific rule. If `Qty` were `1` on every row,
then `Net = Rate` and `Net = Rate * Qty` both fit and the data cannot separate
them. Excluding constant columns outright would lose the genuine
`Net = Qty * Rate` case, so instead: **a rule is ambiguous when dropping a
constant operand yields another fitting rule.** That fires exactly when the
data is incapable of choosing and at no other time.

## 7. Evidence

| Rows | Behaviour |
|-----:|-----------|
| ≥ 3 | proposable and writable |
| 2 | reported, marked weak, never written even under `--write` |
| 1 | never reported |
| all but one fit | reported as a near-miss, never proposed, never written |

The single-row floor is why `due = issued + 14` in the worked invoice's header
stays invisible. It fits, and it fits on one observation, which determines `k`
with nothing left over to check it against. An exact match that cannot be
falsified carries no information.

The near-miss row is the one worth stating twice, because it inverts what the
command is for. A rule that fits three of four rows is not a failed inference.
It is the tool telling someone that the document they were about to send has a
wrong number in it, before they have adopted anything or learned any syntax.

## 8. Naming

**Scalars are named mechanically** from the column and the reduce:
`<column>_total` for `SUM`, then `_avg`, `_min`, `_max`, `_count`, lowercased.
`SUM(Net)` becomes `net_total`. Deriving a nicer name from the surrounding
prose — "total due of…" becoming `amount_due` — reads better and is a guess
about meaning. The boring scheme is predictable, and a human renames in one
keystroke (companion spec, section 6).

**Constants are detected but never named.** Stage 2 emits `VAT = Net * 0.23`
with the literal inline. Where the same value appears in prose in another form,
the report says so and stops:

```
0.23 also appears as "23%" in prose, line 34 — consider naming it
```

Matching `0.23` against the string `23%` is reliable. Concluding that the
constant is therefore *called* `vat` is not. Detection without the guess.

**Tables with no `vmark` block are named `#unnamed1`, `#unnamed2`,** assigned in
document order at write time, taking the next integer not already in use.

This needs no change to the grammar, the parser, the model or the report:
`parseSheetId` accepts any `#\S+`, and the lexer's identifiers are
`[A-Za-z_][A-Za-z0-9_]*`, so both `#unnamed1` and `unnamed1.gross_total` are
already legal today.

Three properties make the placeholder acceptable:

- **It is honest.** `unnamed1` reads as a placeholder, because it is one.
  A generated `#t1` reads as a name somebody chose badly.
- **The tool names only its own output.** The id sits in a block `infer` just
  wrote. Nothing human is read to produce it, so nothing is guessed.
- **It binds once.** The integer is assigned at write time and then it is a
  frozen name. Inserting a table above it does not change what `unnamed2`
  refers to; a later run simply takes the next free integer.

Section 14 records why the two alternatives lost.

## 9. `--write`

Three kinds of edit, all insertions, applied through the existing
`applyEdits` splicer.

**The block.** A fenced `vmark` block placed immediately after the table, since
`tableBeforeBlock` requires adjacency, ignoring blank lines. Bindings are
emitted in dependency order — inputs first, then columns that depend on them,
then scalars — so the block reads top to bottom the way it evaluates. The fence
carries the sheet's id, minted per section 8 when the table has none.

**Anchors.** `<!--vmark=lines.net_total-->` spliced immediately after the inline
node containing the matched prose figure. The node must be one of the four
kinds `RawAnchor` already models — `strong`, `emphasis`, `inlineCode`, or a text
node whose trailing token is a number — and a figure in any other position is
reported but not anchored.

**Nothing else.** `--write` inserts; it never rewrites an existing byte. Input
columns, prose, headings and existing blocks are untouched by construction,
which is a stronger guarantee than `fmt` needs to make and is worth keeping.

Skipped items are always printed with the reason. `--write` is
non-interactive: it writes everything it can write and reports everything it
cannot.

## 10. Report

The same visual idiom as `check` — path header, two-space indent, aligned
fields, a summary footer — with its own field layout, because the shape of the
content differs.

```
invoice.md  table at line 8 — 4 rows, 7 columns

  column rules
    Net    = Qty * Rate                       4/4 rows
    VAT    = Net * 0.23                       4/4 rows
    Gross  = Net + VAT                        4/4 rows

  constants worth naming
    0.23   also appears as "23%" in prose, line 34

  scalars matching figures in prose
    23300.00  line 33  = SUM(Net)                  net_total
    5359.00   line 34  = SUM(VAT)                  vat_total
    28659.00  line 35  = SUM(Gross)                gross_total

  no rule found — treating as inputs
    Item, Unit, Qty, Rate

  also fits, not proposed
    Gross = Net * 1.23        prefers a rule over materialised columns

3 rules, 3 scalars, 3 anchors.
```

Listing the input columns is not padding. It is what makes the proposal
reviewable: the reader is checking a partition of the table, not four formulas
in isolation.

A near-miss prints the disagreeing row and the difference, which is the whole
value of the case:

```
  near-miss — not proposed
    Net = Qty * Rate                          3/4 rows
      row 4  On-call support
      cell 3120.00, rule gives 5200.00        differs by 2080.00
```

Line numbers use the gutter rules from
[`2026-09-03-check-line-numbers-design.md`](2026-09-03-check-line-numbers-design.md).
Whichever of the two lands first owns the helper; the second shares it.

## 11. Architecture

A new leaf module under `packages/visimark/src/infer/`, depending on the engine
and depended on by nothing:

```
infer/candidates.ts   generate candidate bindings, per stage
infer/verify.ts       evaluate a candidate against the stored cells
infer/select.ts       ranking, cycle rejection, ambiguity, degeneracy
infer/propose.ts      the module's only export — Proposal[]
infer/write.ts        block synthesis and anchor placement -> Edit[]
report/infer.ts       the formatter
```

One thing this needs from the existing code, and it is the only awkward part:
**inference runs on documents whose relevant tables are not sheets at all**,
because a sheet requires a block. So it works from `LocatedDoc.tables` and
`tableBeforeBlock` rather than `DocModel.sheets`, and synthesises provisional
sheets to hand to the evaluator. `build()` does not change.

## 12. Public API

```ts
export type ProposalKind =
  | "column" | "scalar" | "constant" | "near-miss" | "ambiguous";

export interface Proposal {
  kind: ProposalKind;
  stage: 1 | 2 | 3 | 4;
  sheetId: string;
  /** true when `sheetId` was minted for a table that had none */
  mintedSheetId?: boolean;
  name: string;
  /** the binding as source text: `Net = Qty * Rate` */
  rule: string;
  fits: number;
  rows: number;
  tableSpan: Span;
  /** stage 3: the prose figure this would anchor */
  anchorSite?: Span & { kind: AnchorTargetKind };
  /** near-miss: the row that disagrees */
  disagreement?: { rowLabel: string; stored: string; computed: string; span: Span };
  /** ambiguous: the competing rules, none proposed */
  alternatives?: string[];
  /** stage 2: the same value, written another way, in prose */
  constantEcho?: { text: string; span: Span };
}

export interface PlannedInsert extends Edit { proposal: Proposal }

export function infer(source: string): Proposal[];
export function planInfer(source: string, only?: Proposal[]): PlannedInsert[];
```

*(Amendment.)* Four additive fields earned their place during implementation, and
one member on `ProposalKind`. `weak` marks a two-row proposal, which section 7
reports but never writes. `reason` carries why a fitting rule was not proposed.
`disagreement.rowIndex` is what lets the report print `row 4` without recounting.
`kind: "alternative"` is the "also fits, not proposed" line, which section 10
prints and the enum had no member for. On `PlannedInsert`, `kind` distinguishes a
block from an anchor and `proposals` carries the whole set a block insert holds —
a block is one edit covering a sheet's bindings, so a single `proposal` field
cannot describe it.

`planInfer` mirrors `planFmt`, and the optional `only` is what lets an editor
apply one proposal without applying the rest. That split is the whole reason
the editor surfaces are a thin wrapper rather than a second implementation.

## 13. Testing

**The acceptance fixture is `example-invoice.md` stripped of every `vmark` block
and every anchor**, generated from it rather than committed, so it cannot drift.

What inference must recover from it, exactly:

- `#unnamed1`, the services table: `Net = Qty * Rate`, `VAT = Net * 0.23`,
  `Gross = Net + VAT`, and the three totals anchored at lines 33, 34 and 35.
- `#unnamed2`, the schedule table: `Amount = Share * unnamed1.gross_total` via
  stage 4, and `amount_total = SUM(Amount)` anchored at line 51. *(Amendment: an
  earlier draft named this one `covered`, which is what the original document
  calls it. Section 8 is what governs — the name is mechanical, and reading the
  original's choice back out of it would be the guess section 8 refuses.)*

What it must **not** recover is the more valuable half of the test:

- **`VAT = Net * vat`.** The original names that constant in a document-scope
  block. Inference emits `Net * 0.23` and reports the `23%` echo instead, per
  section 8, and the test pins that difference rather than treating it as a
  shortfall.
- **`#terms` and `#recon`, in any form.** Both are table-less sheets, and every
  binding in them — `lines.gross_total * (1 - early_pay_disc)`, `variance` —
  lies outside every candidate space in section 4.
- **An anchor on the figures at lines 76 and 77.** `28659.00` there equals
  `SUM(schedule.Amount)`, `SUM(lines.Gross)` and `schedule.covered` alike, so it
  is ambiguous under selection rule 5 and no anchor is proposed.

`check` on the written result must then report `0 problems`.

**It will report `0 problems` while six prose figures remain underived**, because
nothing in the document claims them. That is the green-check hole reproduced
inside the acceptance suite, and the test should assert it deliberately rather
than let someone find it later and mistake it for a bug in inference. It is also
the argument for `check --require-formulas` in section 15, made concrete: a
document can be fully consistent and still be mostly unmanaged.

`example-invoice-drift.md`, stripped the same way, must report `Net` as a
near-miss naming row 4, `3120.00` against `5200.00`, differing by `2080.00`.

Unit coverage, each its own case: cycle rejection on `Gross = Net + VAT` against
`Net = Gross - VAT`; the constant-operand ambiguity rule; the three evidence
floors; anchor insertion into each of the four inline kinds; a minted id
colliding with an existing `#unnamed1`; and a candidate whose `k` fits row 1 and
no other row.

*(Amendment.)* The write-back rule in section 4 earns four more, because each is
a false positive that reached a worked example before it was caught: a bare
integer in a postal code against a fractional `MIN`; a token ending in digits,
`#unnamed1`, against a `SUM` of `1`; a figure written `25%` against the `0.25` it
equals; and a currency-prefixed `**$750.00**` over a `$` column, which must
still anchor, because the rule is about the form the tool writes and not about
refusing decoration.

The line numbers above are the *clean* invoice's, used to name which figure is
meant. The stripped fixture's own numbering differs, and the acceptance test
asserts content rather than lines.

## 14. Rejected alternatives

**Deriving a sheet id from the nearest preceding heading.** `## Services
rendered` becoming `#services` reads better than `#unnamed1` and is a guess
about meaning, produced by reading human prose. That is the class of inference
the engine design refuses everywhere else — for dates, for units, for
constants — and the reason is the same each time: a plausible wrong answer is
worse than an obvious placeholder.

**Positional sheet syntax, `#[1]` and `#[2]`.** Rejected on three counts. It
re-binds on every read, so inserting a table above silently repoints every
reference to it, which is the single failure mode name-based resolution exists
to prevent. It breaks the claim that the diff contains everything, because the
reference text does not change when its meaning does. And it is permanent
grammar — `#[1]` would parse as a fence id today, but `[1].total` would not lex
as a reference — added to serve a code generator, for a problem the format does
not have when a human is writing it.

**`check --suggest`, reporting near-misses as a finding.** Every `check`
finding today is deductive: the document declares a rule, the tool proves a cell
disagrees, and it cannot be wrong. A near-miss is abductive — the tool invents a
rule nobody wrote and complains reality does not match its invention. Folding
both under one exit code means a red build stops having a single meaning, and it
would make the project's first fallible finding a blocking one. It also has no
exit: a wrongly-fired near-miss needs a suppression comment, and a suppression
comment is new format surface of exactly the kind constraint 4 forbids.

The problem `--suggest` was reaching for is real but different. `check` returns
`0 problems` on a document with no formulas, and the honest fix for that is a
coverage gate, not a guess — see section 15.

**Interactive accept/reject in the CLI.** Adds an interactive mode the CLI does
not have and makes the command hostile to agents, which are a primary caller.
Per-proposal control belongs in the editor, where `planInfer(source, only)`
already provides it.

## 15. Deferred

**`check --require-formulas`.** The real answer to the green-check hole: fail
when a table has numeric columns and no rules. It is deductive — the block
exists or it does not — so it has no false-positive mode and needs no
suppression, and the fix for a failure is unambiguous. Its own spec, and small.

**Stage 5, date arithmetic.** `Days = Due - Issued`, and `date ± number`. Left
out of v1 because date columns are the least common shape in the documents this
is for, and because they bring their own near-miss noise.

**Joins.** Out of scope for the same reason they are out of scope for the
engine: two tables have no reason to share a row count.

**Inferring rules for a column that already has one.** `infer` ignores managed
columns entirely. Proposing a *better* rule for a column a human already wrote
one for is a different feature with a different risk profile.

## 16. What deliberately does not change

**The format gains nothing.** Inference emits ordinary rules the engine already
understands: no new syntax, no configuration, no vocabulary, no way for a
document to reach outside itself. A document's numbers still depend only on its
own text and the version of `visimark` reading it.

This is the one kind of tooling that cannot become a plugin architecture by
accident, because its entire output is source the reviewer can read and the
engine can re-verify. If `infer` proposes something wrong, `check` says so.

**`check` does not change.** Not its findings, not its report, not its exit
codes, not one byte of the acceptance transcript. The two commands answer
different questions and the gate stays deductive.

**`fmt` does not change.** `infer --write` only ever inserts; repairing a stale
value is still `fmt`'s job and only `fmt`'s job.
