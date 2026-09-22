# IRR — feature spec

**Status:** approved (#158) · **Date:** 2026-09-22 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/158#issuecomment-5783540649>

## 1. Purpose

`IRR(flows)` is the unique rate `r > -1` at which `NPV(r, flows)` is zero. The period index is `NPV`'s: row 0 is undiscounted, row `k` is divided by `(1 + r) ^ k`. There is no guess argument.

**The document that motivated it** (issue #158) is the same brake-press series as #157. The outlay and the three returns are already in the table. The hurdle is already in the prose. The rate the series earns has to move when any of those figures moves.

```markdown
# Brake press, rate of return

The same series — 48000.00 PLN out today, 20000.00 PLN back at the end of each
of the next three years — earns
**12.04%**<!--vmark=project.rate%--> a year. The hurdle is
**8%**<!--vmark=project.hurdle%-->.

| Year |     Cash |
|-----:|---------:|
|    0 | -48000.00 |
|    1 |  20000.00 |
|    2 |  20000.00 |
|    3 |  20000.00 |

```vmark #project
param hurdle precision 2 = default 8%

rate precision 4 = IRR(Cash)

assert rate > hurdle
```
```

`8%` is the stored number `0.08`. `IRR(Cash)` on this column, rounded half-up to 4 decimals, is `0.1204`. The `%` anchor prints that stored rate at precision − 2, which is `12.04%`.

**Why existing vocabulary does not reach it.** `NPV` evaluates the residual at a rate the author already has. It does not find the rate. There is no closed form in `+ - * / ^` for the root of a cash-flow polynomial. A column of candidate rates is an input column wearing a formula. `PMT` is the instalment on one loan, a map of three scalars, not a series.

## 2. Signature and shape

| | |
|---|---|
| Call | `IRR(flows)` |
| Kind | **reduce** (vector → scalar), design [§4](../visimark-design.md#4-syntax) |
| Arity | **1**, exact and checked statically ([§4](../visimark-design.md#4-syntax)) |
| `flows` | a **bare column reference**. A qualified name (`schedule.Cash`) is allowed, on the same rule as `SUM(schedule.Amount)`. An expression is refused. |
| Result | a **number** — never a boolean, date, or string ([§4](../visimark-design.md#4-syntax)). The rate for one period, the same unit `NPV` takes as `rate`. |

`FUNCTION_TABLE` gains `IRR: { kind: "reduce", arity: 1, column: 0 }`. `FnDoc.precision` is `{ from: "declared" }`, the same variant as `AVG`, `SQRT`, `PMT`, and `NPV`.

No second argument. A guess would pick among several roots, and [§4](#4-type-rules-and-errors) refuses every series that has several.

## 3. Semantics

Let `flows_k` be the numeric value of data row `k`, after the type rules in [§4](#4-type-rules-and-errors). `k` starts at 0. The header row is not a period. The engine does not read a Year column and does not sort the table.

`IRR(flows)` is the unique real `r > -1` such that

```
NPV(r, flows) = Σ flows_k / (1 + r) ^ k = 0
```

using `NPV`'s formula, including the undiscounted row 0. Equivalently, `Σ flows_k * x^k = 0` has exactly one positive root `x = 1 / (1 + r)`.

One sign change among the non-zero cash flows produces that unique root (Descartes' rule of signs on the polynomial in `x`). Zero cells are not a sign. The count is defined in [§4](#4-type-rules-and-errors). The function returns a rate only when that count is exactly one.

Arithmetic stays at the engine's 40-significant-digit working precision (design [§7](../visimark-design.md#7-numeric-semantics)). `IRR` does not raise `Decimal.precision`. A bracketed search is sufficient. The spec does not require a particular algorithm. It requires the printed rate below, and a finding when that printing cannot be proved inside 40 significant digits.

The result is rounded **once, at the binding**, to that binding's declared width, half-up, by the rule already in [§7](../visimark-design.md#7-numeric-semantics). `IRR` adds no tie-break of its own. `FnDoc` carries no `rounding` field.

The value written at width `N` is the half-up rounding of that unique root to `N` decimal places. The solver may stop when every rate still inside its bracket rounds to the same `N` decimals. The rate printed at that width does **not** make `NPV` print as zero. On the motivating column, `NPV(0.1204, Cash)` is about `3.63` at 2 decimals. An author who wants the residual bounded writes an `assert` on `NPV`.

What a reduce reads:

- An **input column** contributes each cell's parsed number, units stripped, in table order.
- A **computed column** contributes the value already stored for that cell, after that column's own rounding. `IRR` reads the numbers the reader sees, the same way `SUM` does.

`reference-examples.test.ts` evaluates `example = <expr>` with no anchor and no `precision` clause, then compares `Decimal.toString()`. Those examples are the cases whose root is an exact short decimal. The rounded figures from the issue are write forms, asserted by `check`, not `FnDoc` `is` strings.

| Case | Input | Result | Written form |
|---|---|---|---|
| Motivating series, width 4 | `IRR(Cash)` on `-48000, 20000, 20000, 20000` | the unique root | `0.1204` |
| Same series, width 2 | the same call | the same root | `0.12` |
| Issue's second series, width 4 | `IRR(Cash)` on `-1000, 600, 600` | `(-7 + √69) / 10` = `0.1306623862…` | `0.1307` |
| Same series, width 2 | the same call | the same root | `0.13` |
| Same series, width 38 | the same call | determined inside 40 digits | `0.13066238629180748525842627449074920102` |
| Same series, width 39 | the same call | the 40-digit working precision does not fix the half-up digit | `PRECISION` ([§4](#4-type-rules-and-errors)) |
| Exact tenth | `IRR(Cash)` on `-100, 110` | `0.1` | `0.10` at width 2 |
| A zero between the signs | `IRR(Cash)` on `-100, 0, 121` | `0.1` | `0.10` at width 2 |
| Exact zero rate | `IRR(Cash)` on `-200, 100, 100` | `0` | `0.00` at width 2 |
| Negative rate, one sign change | `IRR(Cash)` on `-100, 0, 60` | the unique root | `-0.2254` at width 4 |
| Inflow first | `IRR(Cash)` on `100, -40, -40` | the unique root | `-0.1367` at width 4 |
| Two sign changes | `IRR(Cash)` on `-100, 230, -132` | — | `TYPE` |
| No sign change | `IRR(Cash)` on `-1000, 600` or on a single row `100` | — | `TYPE` |
| All zeros | `IRR(Cash)` on `0, 0, 0`, or on a single row `0` | — | `TYPE` |
| Empty column | no data rows | — | `TYPE` |
| Blank cell | a data cell whose trimmed text is empty | — | `TYPE` |

Excel's `IRR` takes a guess and can return one root of a series that has several. This function refuses that series. Excel's period numbering is not used. The root is `NPV`'s root.

An unanchored scalar keeps a full working value that half-up-rounds to the written form above at every width the root is determined. `raw = IRR(Cash)` with no anchor is not a `PRECISION` finding and is not rounded to a declared width. An anchored `ROUND(raw, 4)` then rounds once. That is the rule [§7](../visimark-design.md#7-numeric-semantics) already states for division, `AVG`, `SQRT`, `PMT`, and `NPV`. A missing width is reported only when a numeric result is about to be written.

`ROUND(IRR(Cash), 4)` derives its width from `ROUND`'s `places`. The binding needs no `precision` clause of its own. `derivePrecision` of an `IRR` call is `null`, and `null` propagates through `+`, `-`, `*` and `^` the way a division's `null` does.

Inside a column rule the call reads the whole column. Every row then carries the same rate. Each of those cells is rounded to the column binding's declared width.

For the three exact roots, `toString()` of the stored value is `0.1`, `0.1`, and `0`. The implementation returns that decimal, not a 40-digit neighbour at which `NPV` only rounds to zero.

## 4. Type rules and errors

`IRR` introduces **no new error code**. Convergence stays `PRECISION`, with its own message. A new code for "the iteration had no answer" would be a language change and is not part of this request.

**Static, once per binding, before evaluation** (design [§4](../visimark-design.md#4-syntax)). The first failure is the only one reported.

| Situation | Code ([§10](../visimark-design.md#10-error-taxonomy)) | Reported |
|---|---|---|
| `IRR()` / `IRR(a, b)` — wrong arity | `TYPE` | against the span of the call, once. Message from `describeCallProblem`: `IRR() takes 1 argument, got N`. |
| `flows` is not a reference (`IRR(Cash * 1)`, `IRR(1)`) | `TYPE` | `IRR() takes a column reference, not an expression` |
| `IRR` misspelled within edit distance 2 | `TYPE` with a did-you-mean to `IRR` | automatic once `IRR` is a key of `FUNCTIONS` |

**Resolution, still before the root is sought.** Unknown names are the existing `UNDEF`, reported on the reference, and `IRR` is not also evaluated.

| Situation | Code | Message |
|---|---|---|
| `flows` names a scalar binding (`IRR(rate)`) | `TYPE` | `IRR() expects a column` |

The scalar-name case is a `TYPE`, not a silent skip. Today's `SUM(someScalar)` can fall through `Unevaluable` without a finding. `IRR` does not copy that hole. This spec does not change `SUM`.

**At evaluation**, after the static and resolution checks. The first failure is the finding. Cells are read in row order.

| Order | Situation | Code | Message |
|---|---|---|---|
| 1 | `flows` has no data rows | `TYPE` | `IRR() of an empty column` |
| 2 | a data cell is not a number. A blank cell is one of these. A date cell is one of these. | `TYPE` | `IRR expects a number` |
| 3 | every numeric cell is zero | `TYPE` | `IRR() of an all-zero column` |
| 4 | the non-zero cells never change sign | `TYPE` | `IRR needs one sign change` |
| 5 | the non-zero cells change sign more than once | `TYPE` | `IRR has more than one sign change` |
| 6 | the unique root's half-up rounding at the declared width is not determined inside 40 significant digits | `PRECISION` | `IRR did not determine a rate at precision N` |

A sign change is counted only on non-zero cells, in table order. A cell is a change when its sign differs from the previous non-zero cell. Zeros are skipped, so `-100, 0, 60` is one change and has a root. `-100, 230, -132` is two changes and is refused, even though roots exist. A column with one non-zero cell has zero changes.

Order 3 is not order 4. An all-zero column makes every `r > -1` a root, so returning one of them would be a guess. The message is the all-zero sentence, including for a single row whose only cell is `0`.

Order 2 does not skip a blank and does not coerce it to zero. Skipping it would shift every later period. Coercing it would invent a cash flow. The author writes `0`. A blank input cell is already a string after `coerceInput`, so it fails the same number test as a word. The finding sits on the `IRR` binding, not on the cell. Later cells are not separately reported. A blank is reported before the all-zero test and before the sign test.

Order 6 is distinct from a missing `precision` clause, and distinct from the write-time ceiling. `N` is the declared width. The motivating series at width 4 is determined, so it does not take this path. `-1000, 600, 600` at width 39 does: the two ends of a 40-digit bracket round half-up to different 39-decimal strings, while width 38 is one string. Width 40 on that series is the existing ceiling (`1` integer digit + `40` decimals exceeds 40 significant digits), message from `emitCeiling`, not order 6.

A date-shaped cell that is not an ISO date is the existing `DATE` finding on that cell. The column cannot be read (`Unevaluable`), so `IRR` adds no second finding.

A computed `flows` column with a null cell (an upstream error on that row) is the same `Unevaluable` path `SUM` uses. `IRR` adds no finding of its own. An assertion that depended on it is the existing `NOTE`: `N assertion(s) not verified (upstream errors)`.

A unit on a cell is stripped before these tests (design [§7](../visimark-design.md#7-numeric-semantics)). The result does not inherit one.

**When the result is written:**

| Situation | Code | Message |
|---|---|---|
| An anchored scalar or a column rule whose formula does not derive a width and declares none | `PRECISION` | the existing wording: `` `<formula>` has no derivable precision ``, with the hint `declare the width: `<name> precision N = …`` |
| The declared width plus the result's integer digits exceeds 40 significant digits | `PRECISION` | the existing ceiling message from `emitCeiling` |
| Order 6 above | `PRECISION` | `IRR did not determine a rate at precision N` |

`FnDoc.errors`, noun phrases with no trailing period:

| `when` | code |
|---|---|
| an empty column | `TYPE` |
| a non-numeric cell | `TYPE` |
| an all-zero column | `TYPE` |
| a column with no sign change | `TYPE` |
| a column with more than one sign change | `TYPE` |
| a rate not determined at the declared width | `PRECISION` |
| a `flows` argument that is not a column | `TYPE` |

### Reporting granularity

`IRR` is one call, so a scalar binding produces **one finding**.

A column rule that calls `IRR` follows the map split already used for `SQRT` and `PMT` (design [§8](../visimark-design.md#8-evaluation)):

- A row-invariant failure (`Level = IRR(Cash)` over N rows, when `Cash` is all zeros or has two sign changes) emits N identical findings. Collapsing those needs a row-variance analysis applied to every call. Out of scope, as it was for `SQRT`, `PMT`, and `NPV`.

An upstream error (`UNDEF`, a bad dependency) suppresses the binding with the existing `NOTE` path. `IRR` adds no suppression rule.

## 5. Interaction with the rest of the language

- **Shape ([§4](../visimark-design.md#4-syntax)).** `IRR` is an ordinary one-column reduce: `column: 0`, arity 1. It does not add a scalar parameter. `NPV` remains the first reduce with a scalar parameter. The dependency walk sets `inAggregate` on `flows`. `isCrossSheetAggregate` reads that parameter, so a cross-sheet column follows the path `SUM` already has.
- **Numeric semantics ([§7](../visimark-design.md#7-numeric-semantics)).** `derivePrecision` returns `null` for an `IRR` call. The binding declares a width when the result is written. Full working precision until that rounding. Half-up stays the global rule. The search uses 40 significant digits and no more. The write-time ceiling is unchanged.
- **Units ([§7](../visimark-design.md#7-numeric-semantics)).** Cell units are stripped. The rate does not inherit one.
- **Dates ([§5](../visimark-design.md#5-dates)).** `IRR` neither accepts nor produces a date. The time index is the row position in the document, not a calendar. A date cell is `TYPE` (`IRR expects a number`).
- **Write-back ([§9](../visimark-design.md#9-write-back)).** A rate cell or anchor is tool-owned like any other computed number. `fmt` rewrites it when stale and leaves it when not. `fmt` does not insert a `precision` clause. A `%` anchor is rewritten in percent form by the rule already shipped for #140.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).** `IRR` is a function name, not a binding. `flows` resolves by the ordinary column rules. A binding named `IRR` can still exist. The call is what the table classifies.
- **`param` and `eval --scenario`.** The motivating note's hurdle is a param. Changing it through `--scenario` does not change `rate`, because `rate` does not read `hurdle`. The `assert` does. A `param` default is still a literal. This spec does not allow `default IRR(...)`.
- **`assert`.** The result is a number, so `assert rate > hurdle` compares the stored rate with the stored hurdle. `0.1204 > 0.08` holds. When `rate` is unevaluable, the assertion is the existing upstream `NOTE`.
- **`NPV`.** `IRR` is the root of `NPV` on the same column and the same index. Shipping `IRR` does not change `NPV`'s results, messages, or shape. `NPV(IRR(Cash), Cash)` is a legal composition. Its value is a residual at the rounded rate when `IRR(Cash)` has been written, and a residual at the working-precision root when the rate is unanchored.
- **`chart`, imports, aliases.** No new behaviour. An imported column can be `flows`. A blank imported cell is `TYPE` under the same number test. A rate column can be a chart series.
- **Percent display.** A `%` anchor prints `stored × 100` at `precision − 2`. The note puts `%` on `rate` at precision 4, so the anchor text is `12.04%`, and on `hurdle` at precision 2, so the anchor text is `8%`. `eval --get` prints the stored number: `0.1204` and `0.08`.
- **`infer`.** The reduce list `infer` searches does not gain `IRR`. `infer` never emits `IRR`.
- **`explain` and `--json`.** An `IRR` call is listed like any other call. `--json` gains no field.
- **`visimark ref IRR`.** Works once the `FnDoc` entry exists. The entry's examples are three exact rows, each with its own `given` table: `IRR(t.Cash)` is `0.1` on `-100, 110`; `IRR(t.Cash)` is `0.1` on `-100, 0, 121`; `IRR(t.Cash)` is `0` on `-200, 100, 100`.
- **Builtin count.** The generated builtin table gains one row. The sentence above it counts **sixteen** functions, adding `IRR`, issue #158, to the parenthetical that already names `PMT` (#156) and `NPV` (#157). Bare `visimark ref` and `ref --json` list all sixteen, including `IRR`, `NPV`, and `PMT`. Every live sentence that currently says fifteen functions — the catalogue preface, `CONTRIBUTING.md`, `README.md`, `docs/cli-reference.md`, `docs/tutorial.md` (the three sentences that count builtins, not the invoice's "sixteen bindings"), design [§14](../visimark-design.md#14-deferred)'s "beyond the fifteen", and `skills/visimark/SKILL.md` — says sixteen. The skill's sentence that names division, `AVG`, `SQRT`, `PMT`, and `NPV` as the operations whose width must be declared gains `IRR`. Historical changelog lines that record an older count stay as they are. `docs/function-reference.md` is regenerated from the `FnDoc`.
- **Playground bundle.** The engine's export set changes, so `docs/vendor/visimark-browser.js` is regenerated with `bun run --filter visimark build:playground` on Bun 1.4.2.
- **Editor.** `IRR` stops being an unknown name. The language server's hover reads the same `FnDoc`. `editors/vscode/CHANGELOG.md` gains one line under `Unreleased`.
- **What does not change.** The operator set, the finding codes, `fmt` idempotence, `NPV`, `PMT`, and every example document that passes `check` today. None of `docs/example-invoice.md`, `docs/example-charts.md`, or `docs/example-invoice-drift.md` calls `IRR`. The [§13](../visimark-design.md#13-testing) transcripts stay byte-identical. `SUM` of an empty column remains `0`.

## 6. Acceptance

Covered by unit tests plus a test-only fixture. The invoice and charts examples are untouched.

1. **`test/lang/reference-examples.test.ts`** executes the three `FnDoc` examples and expects `0.1`, `0.1`, and `0`.
2. **`test/eval/functions.test.ts`**
   - `IRR` is `{ kind: "reduce", arity: 1, column: 0 }`. `NPV` is still `{ kind: "reduce", arity: 2, column: 1 }`.
   - `callProblem("IRR", …)` is `{ kind: "arity" }` for 0 and 2 arguments, `{ kind: "shape" }` for 1 argument that is not a reference, and `null` for one reference.
   - On `-48000, 20000, 20000, 20000`, rounding the result half-up to 4 decimals yields `0.1204` and to 2 decimals yields `0.12`.
   - On `-1000, 600, 600`, rounding to 4 yields `0.1307`, to 2 yields `0.13`, and to 38 yields `0.13066238629180748525842627449074920102`.
   - `-100, 110` evaluates to a decimal whose `toString()` is `0.1`. `-100, 0, 121` is `0.1`. `-200, 100, 100` is `0`.
   - `-100, 0, 60` rounds to `-0.2254` at 4 decimals. `100, -40, -40` rounds to `-0.1367` at 4 decimals.
   - An empty column throws `IRR() of an empty column`.
   - A blank cell, a word, and a date cell each throw `IRR expects a number`. A column `0, <blank>, 5` throws on the blank.
   - `0, 0, 0` and a one-row `0` throw `IRR() of an all-zero column`.
   - `-1000, 600` and a one-row `100` throw `IRR needs one sign change`.
   - `-100, 230, -132` throws `IRR has more than one sign change`.
   - The live length assertion on the function table becomes 16.
3. **`test/lang/reference.test.ts`** and **`test/cli/ref.test.ts`**: `functionNames()` and `ref --json` each list 16 functions. The JSON names include `IRR`, `NPV`, and `PMT`.
4. **`test/eval/check.test.ts`**
   - Anchored `rate precision 4 = IRR(Cash)` on the motivating column, anchor text `0.1204` → no finding.
   - The same binding with a `%` anchor whose text is `12.04%` → no finding.
   - The same binding with anchor `0.1200` → one `STALE`, computed `0.1204`.
   - The same binding with no `precision` clause, anchored → one `PRECISION`, message containing `` `IRR(Cash)` has no derivable precision ``.
   - Unanchored `raw = IRR(Cash)` → no finding.
   - `shown = ROUND(IRR(Cash), 4)` anchored `0.1204` → no finding.
   - Anchored `rate precision 39 = IRR(Cash)` on `-1000, 600, 600` → one `PRECISION`, message `IRR did not determine a rate at precision 39`.
   - Anchored `rate precision 38 = IRR(Cash)` on that column, anchor text `0.13066238629180748525842627449074920102` → no finding.
   - `IRR(Cash * 1)` → one static `TYPE`, `IRR() takes a column reference, not an expression`.
   - `IRR()` → one static `TYPE`, `IRR() takes 1 argument, got 0`.
   - `IRR(rate)` where `rate` is a scalar → one `TYPE`, `IRR() expects a column`.
   - A blank cell in `Cash` → one `TYPE`, `IRR expects a number`.
   - `assert rate > hurdle` when `rate` is that `TYPE` → the assertion is not a second `TYPE`. It is the existing upstream `NOTE`.
   - A computed `Cash` column whose middle row is its own `TYPE` → `IRR` is unevaluable and adds no finding of its own.
5. **`test/cli/irr.test.ts` + `test/fixtures/irr-press.md`** — the note from [§1](#1-purpose), byte for byte.
   - `visimark check <fixture>` exits 0. Stdout is the fixture path, a blank line, and `  0 problems (0 stale, 0 errors)`.
   - `visimark eval <fixture> --get project.rate` exits 0 and prints `0.1204`.
   - `visimark eval <fixture> --get project.hurdle` exits 0 and prints `0.08`.

## 7. Non-goals

- **A guess argument, or returning one root of a multi-root series.** Both are the behaviour this request refuses. Adding a guess later would reintroduce that choice.
- **Excel's `IRR`, `MIRR`, or `XIRR`.** No finance-date index, no reinvestment rate, no day-count.
- **A new finding code.** Undetermined roots reuse `PRECISION`.
- **Changing `NPV` or `PMT`.** Their results, messages, and shape stay as shipped. The documentation count is updated because `IRR` makes sixteen, and the fifteen already includes those two.
- **Making `NPV` of the printed rate equal zero.** The residual is a further sum. An `assert` is how an author bounds it.
- **A Year column, a date index, or a check that the printed years are 0, 1, 2, …** The index is table order.
- **Skipping or zero-filling a blank cell.**
- **A per-cell span** for the non-numeric cell inside `flows`. The finding is on the call, as it is for `SUM`.
- **Fixing `SUM(someScalar)`** if that call still produces no finding.
- **Static row-variance analysis** to collapse N identical per-row findings.
- **Teaching `infer` to propose `IRR`.**
- **Raising the working precision inside the solver** so that width 39 on `-1000, 600, 600` becomes a number.

## 8. Open questions

None.
