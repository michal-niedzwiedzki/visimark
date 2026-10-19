# A bare `report deltas` with nothing to read — feature spec

**Status:** approved (#333) · **Date:** 2026-10-04 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/333#issuecomment-5979384325

An amendment to [`lattice-on-param-and-report-statements-spec.md`](lattice-on-param-and-report-statements-spec.md) §4.2 and §7 (#258), and a clarification of [`add-a-simulate-command-spec.md`](add-a-simulate-command-spec.md) §4 (#259).

## 1. Purpose

A `report deltas` with no `on` reads "every scalar of the report's own sheet that is not a param" (#259 §4). In a sheet with no such scalar it has nothing to read, and today `check` passes it and `simulate` prints a heading with an empty body, exit `0`. The document that found it:

````markdown
```vmark #plan
param price precision 2 in [10, 30] lattice 10 = default 20.00
param units precision 0 integer in [100, 300] lattice 100 = default 200

revenue = price * units

assert revenue >= 2000
```

```vmark #readings
report deltas among all
report gates
```
````

The author meant `revenue`, which lives in `#plan`. An empty reading is a sentinel standing in for "nothing to read" ([§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 3, the family of the column-`REF` refusal). `check` should refuse it at authoring time, as it already refuses a `REF` that names a column. The rule is static: it counts bindings in one sheet and reads only the document (constraint 4).

## 2. Syntax

No syntax change of its own. The line stays inside the fence (constraint 1). The well-formed empty-`on` line is `report deltas among feasible|infeasible|all` (#351). A line with no `among` fails the synopsis and does not also emit the nothing-to-read sentence. `deltas on REF, …` is untouched by this rule.

## 3. Semantics

A `report deltas among feasible|infeasible|all` with no `on` is **well formed** when its own sheet has at least one entry in `sheet.scalars` whose binding carries no `param`; otherwise it is **a `TYPE` finding**. "Its own sheet" is `report.sheetId`. A line with no `among` does not parse, so this rule stays silent and the only finding is the synopsis. Evaluation is unaffected: the rule changes `check`'s finding set and nothing `eval` computes.

| Case | Result |
|---|---|
| `#readings` holds only `report deltas among all` and `report gates` (the issue's document, with the clause #351 requires) | `TYPE` on the `deltas` line |
| the sheet's only scalars are params: `param p … = default 1` then `report deltas among all` | `TYPE` — a param is not read by a `deltas` with no `on` |
| the sheet binds a non-param scalar: `margin = 5` then `report deltas among all` | clean |
| the sheet's only scalar is a constant: `rate = 5` then `report deltas among all` | clean; it gets a flat reading, as today ([§7](#7-non-goals)) |
| a scalar with an evaluation error (`UNDEF` upstream) | counts: it is a declaration, in `sheet.scalars` |
| a scalar line that failed to parse **and was dropped** by the model | the sheet is *not judged*: no `TYPE` (below) |
| a scalar whose binding parsed with a `parseError` and was kept | counts; the one broken line gives one finding, not two |
| `deltas on plan.revenue among all` in `#readings` | clean; the rule does not apply to a `deltas` with `on` |
| `report ledger`, `gates`, `best …`, `forbidden` in a sheet with no scalars | clean; only `deltas` reads own-sheet scalars (`gates` reads the document's asserts) |
| an `assert` in the sheet | not a scalar (it binds no name); does not count |
| a sheet with a `from <path>` import that binds scalars | counts; an imported sheet gets no exemption |
| a `from <path>` sheet with columns only and `report deltas among all` | `TYPE`, correctly: its columns are not scalars |
| two byte-identical `report deltas among all` lines in one sheet | the second is `DUP` and never joins `sheet.reports`; the rule fires once, on the first |
| two `report deltas` lines with no `among` | two synopsis `TYPE`s; neither is this rule's sentence, and they are not a `DUP` |
| `report deltas among all` in two sheets, both without scalars | one `TYPE` per sheet |
| the sheet has a table and columns but no scalar | `TYPE`: columns are not scalars |

**Dropped lines.** When `parseOne` returns no statement for a line in one of the sheet's blocks (the line failed to parse and its finding is already emitted by the model builder), that line may have been the sheet's scalar. The model records this on the sheet as `droppedLines: boolean`, set `true` by `build.ts` when `parseOne` returns `undefined` for any line of a block bound to that sheet; the new rule is silent for a sheet where it is `true`. The reason is one finding per mistake: the parse finding already tells the author what is wrong, and a second `TYPE` on the `deltas` line would be a guess about a line that is not in the model.

## 4. Type rules and errors

No new code joins the taxonomy ([§10](../visimark-design.md#10-error-taxonomy)). `TYPE` already covers "a malformed or unknown `report`": structural well-formedness independent of any particular value (#258 §4). This is that definition.

New row for #258's §4.2 table:

| Case | Code | Message |
|---|---|---|
| a parsed `report deltas among <word>` with no `on`, in a sheet with no scalar that is not a `param` | `TYPE` | `` `report deltas` has nothing to read: this sheet has no scalar that is not a param; name the values with `deltas on REF, …` `` |

The finding carries the sheet (`location.sheet`) and no `name`, as every §4.2 row does. It is static and independent of any value. It is emitted from `checkReports` in `packages/visimark/src/eval/check-reports.ts`, once per qualifying report, anchored to the `report` statement's span (`sourceOffset` and `span` from `report.span`), so `orderFindings` keeps its order. It is `TYPE` and not `WARN` because `WARN` is advice that `check` prints and does not count, so the line would exit `0` and pass CI as silently as today; `report` is unreleased, so no published version accepts this line.

**A line the body table does not need.** A sheet carrying this `TYPE` finding is reported by `simulate` as `(cannot start)` with the finding text (#259 acceptance row 6), so the empty body never reaches #259 §4's *Empty cases* table and no new row is added there. The `deltas (no on)` row of that spec's §4 table gains the sentence that such a sheet is a `TYPE` finding.

## 5. Interaction with the rest of the language

- **Shape system ([§4](../visimark-design.md#4-syntax)).** Unchanged. The rule asks whether a scalar exists, not what shape it has.
- **Evaluation and the graph ([§8](../visimark-design.md#8-evaluation)).** Unchanged. A report is not a graph node; the pass adds no edge and cannot introduce a `CYCLE`. A report reading no scalars changes no unused-name `WARN`.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** `fmt` never rewrites a `report` line; a document stays byte-stable and `fmt` is a no-op on it.
- **`check`.** Gains the finding. Exit `1`; `check --json` carries `code: "TYPE"`, `class: "problem"`, `location.sheet`, no `location.name`, `details.message`.
- **`simulate`.** Reports the sheet as `(cannot start)` with the finding text, exit `0` as in #259 row 6. Its own computation is untouched.
- **`eval`, `explain`, `infer`.** Do not read `report` lines. Unchanged.
- **`N = 0`.** With no lattice param anywhere, `deltas` prints `no grid: no param declares a lattice`. The new finding is independent and fires first (`check` runs before `simulate`); a document may hold an authoring problem and a no-grid reading at once. No fixture combines them.
- **Imports, `param`, `assert`, `chart`, aliases, declared precision.** Only `param` and `assert` matter, and both are in the table in §3.
- **Backward compatibility.** A document that passes today and has this line stops passing. `docs/example-battery-storage.md` (`report deltas among all` in `#returns`, which binds `npv` and `equity_irr`) stays clean. The `report deltas` fixtures in `test/report/simulate.test.ts` sit in `#plan`, which has scalars. `test/lang/report.test.ts` only parses the line. No document in `docs/` stops passing.

## 6. Acceptance

A new transcript test `packages/visimark/test/report-nothing-to-read.test.ts`, in the style of `test/simulation-acceptance.test.ts`, with `runCli`. The issue's document is the fixture (committed as `packages/visimark/test/fixtures/simulation/bare-deltas.md`, the fixed document being generated in memory by replacing `report deltas` with `report deltas on plan.revenue`).

1. **The fixture.** `bare-deltas.md` keeps the line `report deltas` with no `among`. `check` exits `1` and prints the synopsis, and the output does not contain the nothing-to-read sentence:

   ```console
   bare-deltas.md

     TYPE    readings.         `report deltas` takes: [on REF {, REF}] among feasible|infeasible|all

     1 problem (0 stale, 1 error)
   ```

   The nothing-to-read sentence is the finding for `report deltas among all` in that same sheet.

   `check --json` has `status: "problems"`, one finding with `code: "TYPE"`, `class: "problem"`, `location.sheet: "readings"`, no `location.name`, and `details.message` equal to the message above; `summary.errors` is `1`.
2. **Fixed variant.** `report deltas on plan.revenue among all` instead: `check` exits `0` with `0 problems`.
3. **Silent cases**, each generated from the fixture, each exiting `0` with no `TYPE`: a non-param scalar added to `#readings`; a constant-only `#readings`; `report gates` alone in `#readings`; a dropped (unparseable) binding line added to `#readings`, which yields only that line's own finding.
4. **Param-only sheet**: `#readings` holding one `param` and a bare `deltas` gives the `TYPE`.
5. **`simulate` on the fixture.** The bare line fails to parse, so it is dropped. `#readings` still has `report gates`, the sheet runs, stdout has no `(cannot start)`, and stderr says `1 of 1 sheets ran`, exit `0`. A parsed `report deltas among all` that draws the nothing-to-read `TYPE` still makes the sheet `(cannot start)`.
6. **`fmt`** on the fixture is a byte-identical no-op.
7. **The battery example.** `check docs/example-battery-storage.md` still reports `0 problems`.
8. **Two sheets**: a bare `deltas` in two scalar-less sheets gives two `TYPE` findings, one per sheet.

## 7. Non-goals

- **A sheet whose only scalars are constants** still gets a flat reading and no finding. #258 §7 puts "options meaningful for the sheet" out of `check`'s remit; this spec is the one exception, for the zero-scalar case only. #258 §7 is reworded to name it.
- **`deltas on REF`** with a `REF` no sweep varies (the same §7 line).
- **Any change to what `simulate` prints** for the empty case; the finding means it is never reached.
- **A `WARN` tier** or a cap on how many scalars `deltas` shows.
- **A section F row** for the `(cannot start)` wording.

## 8. Open questions

None.

## 9. Documentation to update

The plan's final task:

- `docs/design/lattice-on-param-and-report-statements-spec.md` §4.2 (the new row) and §7 (reword the "options meaningful" non-goal to name this one case).
- `docs/design/add-a-simulate-command-spec.md` §4 (`deltas (no on)` row).
- `docs/simulate.md` §13 (the sentence "In a readings sheet … it prints a heading and nothing under it" becomes false) and §14 (add this case to the mistakes, with its output).
- `docs/visimark-design.md`: the `report` paragraph in §4 ("`check` parses the line, resolves its refs …") and the §10 `TYPE` row.
- `docs/cli-reference.md` and generated finding docs, if either lists `report` findings.
- `CHANGELOG.md` under `## Unreleased`.
- `docs/vocabulary-catalogue.md`: move the row out of section E into the Shipped register as `UNRELEASED`.

<!--vmark:no-formulas-->
