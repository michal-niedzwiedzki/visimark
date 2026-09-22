# NPV — feature spec

**Status:** approved (#157) · **Date:** 2026-09-22 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/157#issuecomment-5782258164>

## 1. Purpose

`NPV(rate, flows)` is the present value of a column of cash flows at a per-period rate. Row order is time order. The first data row is period 0 and is not discounted. Row `k` is divided by `(1 + rate) ^ k`.

**The document that motivated it** (issue #157) is a one-asset project note. The outlay and the three savings are already in the table. The hurdle is already in the prose. The present value has to move when any of those figures moves.

```markdown
# Brake press, as a project

Buying the press costs 48000.00 PLN today and is expected to save 20000.00 PLN
at the end of each of the next three years. At a hurdle of
**8%**<!--vmark=project.hurdle%--> the present value of that series is
**3541.94**<!--vmark=project.present--> PLN.

| Year |     Cash |
|-----:|---------:|
|    0 | -48000.00 |
|    1 |  20000.00 |
|    2 |  20000.00 |
|    3 |  20000.00 |

```vmark #project
param hurdle precision 2 = default 8%

present precision 2 = NPV(hurdle, Cash)

assert present > 0
```
```

`8%` is the stored number `0.08`. `NPV(0.08, Cash)` for this column, rounded half-up to 2 decimals, is `3541.94`.

**Why existing vocabulary does not reach it.** A `Period` column plus `PV precision 2 = Cash / (1 + hurdle) ^ Period` and `SUM(PV)` discounts a series with today's operators. The period numbers are a second column the author has to keep aligned with the rows, and an off-by-one discounts money that was spent today. The reducer takes the time index from the row order the reader already sees.

That expanded form declares a width too: `/` bounds nothing, and `^` derives a width only when the exponent is a non-negative integer literal (design [§7](../visimark-design.md#7-numeric-semantics)). `NPV` does not remove the declaration. It removes the index column.

`SUM` totals a column and does not discount it. At a zero rate the two agree numerically, and nowhere else. `PRODUCT` is catalogued and deferred. It multiplies a column. It does not discount one. `PMT` (#156) is the instalment on one loan, a map of three scalars, not a series.

An input cell for the present value goes stale when any year's cash, or the hurdle, changes.

The issue's worked line `NPV(0, Cash) -> 6000.00` does not match the formula. The sum of `-48000, 20000, 20000, 20000` is `12000`. This spec uses `12000.00`.

## 2. Signature and shape

| | |
|---|---|
| Call | `NPV(rate, flows)` |
| Kind | **reduce** (vector → scalar), design [§4](../visimark-design.md#4-syntax) "Shape: map and reduce" |
| Arity | **2**, exact and checked statically ([§4](../visimark-design.md#4-syntax)) |
| `rate` | a **number**, the rate for one period. Any scalar expression: a literal, a name, a `param`, or arithmetic such as `annual / 12`. Must be greater than `-1`. |
| `flows` | a **bare column reference**. A qualified name (`schedule.Cash`) is allowed, on the same rule as `SUM(schedule.Amount)`. An expression is refused. |
| Result | a **number** — never a boolean, date, or string ([§4](../visimark-design.md#4-syntax)) |

`NPV` is the first reduce with a scalar parameter. The column rule does not relax. `NPV(rate, Cash * 1)` is refused, because `flows` has to be the column itself. There is still no second column parameter, and there is still no vector → vector.

The shape table stops assuming the column is argument 0. `FnSpec` becomes a union:

- `{ kind: "map"; arity: number }`
- `{ kind: "reduce"; arity: number; column: number }`

`column` is the index of the bare-column parameter. Every reduce that ships today sets `column: 0`. `NPV` sets `column: 1`. `callProblem`, the dependency walk, `evalCall`, and `isCrossSheetAggregate` read that index.

`FUNCTION_TABLE` gains `NPV: { kind: "reduce", arity: 2, column: 1 }`. `FnDoc.precision` is `{ from: "declared" }`, the same variant as `AVG`, `SQRT`, and `PMT`.

A percent literal is folded by the existing rule before the call, so `NPV(8%, Cash)` is `NPV(0.08, Cash)`. The function does not divide an annual rate by twelve and does not treat `8` as eight percent.

## 3. Semantics

Let `r` be `rate` and let `flows_k` be the numeric value of data row `k`, after the type rules in [§4](#4-type-rules-and-errors). `k` starts at 0. The header row is not a period. The engine does not read a Year column and does not sort the table.

```
NPV(rate, flows) = Σ flows_k / (1 + r) ^ k
```

for `k` from 0 through the last data row. The formula is used at every rate, including zero. At zero every denominator is 1, so the value equals the sum of the cells. The precision rule does not change for that call.

The power is `Decimal.prototype.pow` of a non-negative integer. Because `r > -1`, the base `1 + r` is positive. Arithmetic uses `decimal.js` at the engine's 40-significant-digit working precision (design [§7](../visimark-design.md#7-numeric-semantics)). A finite power that needs more than 40 significant digits is rounded to that width by `decimal.js`. That rounding is not a finding. A non-finite intermediate is rejected by `num()` ([§4](#4-type-rules-and-errors)).

The result is rounded **once, at the binding**, to that binding's declared width, half-up, by the rule already in [§7](../visimark-design.md#7-numeric-semantics). `NPV` adds no tie-break of its own. `FnDoc` carries no `rounding` field.

What a reduce reads:

- An **input column** contributes each cell's parsed number, units stripped, in table order.
- A **computed column** contributes the value already stored for that cell, after that column's own rounding. `NPV` discounts the numbers the reader sees, the same way `SUM` does.

`reference-examples.test.ts` evaluates `example = <expr>` with no anchor and no `precision` clause, then compares `Decimal.toString()`. Those examples are the cases whose result is exact. The rounded figures from the issue are write forms, asserted by `check`, not `FnDoc` `is` strings.

| Case | Input | Full working value (`toString`) | Written at 2 dp |
|---|---|---|---|
| Motivating series | `NPV(0.08, Cash)` on `-48000, 20000, 20000, 20000` | `3541.9397449575776050398821317888533252` | `3541.94` |
| Zero rate, same series | `NPV(0, Cash)` | `12000` | `12000.00` |
| Issue's second series | `NPV(0.10, Cash)` on `-1000, 400, 400, 400` | `-5.2592036063110443275732531930879038317` | `-5.26` |
| One data row | `NPV(0.08, Cash)` on `-48000` | `-48000` | `-48000.00` |
| All zeros | `NPV(0.08, Cash)` on `0, 0, 0` | `0` | `0.00` |
| Negative rate, still above -1 | `NPV(-0.05, Cash)` on the motivating series | `18540.31199883364922000291587694999271031` | `18540.31` |
| Two rows, repeating | `NPV(0.08, Cash)` on `-100, 110` | `1.8518518518518518518518518518518518519` | `1.85` |
| Exact negative rate | `NPV(-0.5, Cash)` on `100, 100` | `300` | `300.00` |
| Rate exactly -1 | `NPV(-1, Cash)` on the motivating series | — | `TYPE` |
| Rate below -1 | `NPV(-1.5, Cash)` | — | `TYPE` |
| Empty column | `NPV(0.08, Cash)` over no data rows | — | `TYPE` |
| Blank cell | a data cell whose trimmed text is empty | — | `TYPE` |

Excel's `NPV` discounts its first value by one period. This function does not. `NPV(0.08, Cash)` on the motivating column is `3541.94`. Discounting all four rows as periods 1–4 is `3279.57`, and that figure is not a result of this function. Excel's `NPV(0.08, 20000, 20000, 20000)` plus an undiscounted `-48000` is the same `3541.94`. A document that wants the Excel timing adds the outlay outside the column and passes only the later rows.

An unanchored scalar keeps the full working value. `raw = NPV(0.08, Cash)` with no anchor is not a `PRECISION` finding and is not rounded. An anchored `ROUND(raw, 2)` then rounds once. That is the rule [§7](../visimark-design.md#7-numeric-semantics) already states for division, `AVG`, `SQRT`, and `PMT`, and `check.ts` implements it: a missing width is reported only when a numeric result is about to be written.

`ROUND(NPV(0.08, Cash), 2)` derives its width from `ROUND`'s `places`. The binding needs no `precision` clause of its own. `derivePrecision` of an `NPV` call is `null`, including when `rate` is the literal `0`, and `null` propagates through `+`, `-`, `*` and `^` the way a division's `null` does. There is no extra "this expression contains `NPV`" check.

Inside a column rule the rate is that row's scalar (a sibling column contributes that row's cell) and `flows` is the whole column. Every row then carries the same present value when the rate is a scalar, and one present value per row when the rate varies by row. Each of those cells is rounded to the column binding's declared width.

## 4. Type rules and errors

`NPV` introduces **no new error code**.

**Static, once per binding, before evaluation** (design [§4](../visimark-design.md#4-syntax)). The first failure is the only one reported. Arity wins over shape. A call that already has an arity or shape error visits every argument as if it were inside a reduce, so a column sitting in `rate` is not also a `VECTOR`.

| Situation | Code ([§10](../visimark-design.md#10-error-taxonomy)) | Reported |
|---|---|---|
| `NPV()` / `NPV(a)` / `NPV(a, b, c)` — wrong arity | `TYPE` | against the span of the call, once. Message from `describeCallProblem`: `NPV() takes 2 arguments, got N`. |
| `flows` is not a reference (`NPV(0.08, Cash * 1)`, `NPV(0.08, 1)`) | `TYPE` | `NPV() takes a column reference, not an expression` |
| `NPV` misspelled within edit distance 2 | `TYPE` with a did-you-mean to `NPV` | automatic once `NPV` is a key of `FUNCTIONS` |

**Resolution, still before the sum.** Unknown names are the existing `UNDEF`, reported on the reference, and `NPV` is not also evaluated.

| Situation | Code | Message |
|---|---|---|
| `rate` mentions a bare column where a scalar is required (`NPV(Cash, Cash)`, `NPV(Cash, Flows)`) | `VECTOR` | the existing wording: `` `Cash` is a column, not a value. ``, with the existing hint to wrap it in an aggregate |
| `flows` names a scalar binding (`NPV(0.08, present)`) | `TYPE` | `NPV() expects a column` |

The scalar-name case is a `TYPE`, not a silent skip. Today's `SUM(someScalar)` can fall through `Unevaluable` without a finding. `NPV` does not copy that hole. This spec does not change `SUM`.

**At evaluation**, after the static and resolution checks. Scalar arguments are evaluated left to right before the column is read. The first failure is the finding.

| Order | Situation | Code | Message |
|---|---|---|---|
| 1 | `rate` is not a number (date, string, boolean) | `TYPE` | `NPV expects a number` |
| 2 | `rate <= -1`, whatever the column contains, including a one-row column and an empty column | `TYPE` | `NPV rate must be greater than -1` |
| 3 | `flows` has no data rows | `TYPE` | `NPV() of an empty column` |
| 4 | a data cell is not a number, in row order. A blank cell is one of these. A date cell is one of these. | `TYPE` | `NPV expects a number` |
| 5 | the power or the quotient is not a finite decimal | `TYPE` | `result is not a finite decimal` |

Order 4 does not skip a blank and does not coerce it to zero. Skipping it would shift every later period. Coercing it would invent a cash flow. The author writes `0`. A blank input cell is already a string after `coerceInput`, so it fails the same number test as a word. The finding sits on the `NPV` binding, not on the cell. Later cells are not separately reported.

Order 5 is the guard `num()` already applies. With `rate > -1` the base is positive, and a finite power that merely exceeds 40 significant digits is rounded, not rejected.

A date-shaped cell that is not an ISO date is the existing `DATE` finding on that cell. The column cannot be read (`Unevaluable`), so `NPV` adds no second finding.

A computed `flows` column with a null cell (an upstream error on that row) is the same `Unevaluable` path `SUM` uses. `NPV` adds no finding of its own. An assertion that depended on it is the existing `NOTE`: `N assertion(s) not verified (upstream errors)`.

A unit on a cell is stripped before these tests (design [§7](../visimark-design.md#7-numeric-semantics)). The result does not inherit one.

**When the result is written:**

| Situation | Code | Message |
|---|---|---|
| An anchored scalar or a column rule whose formula does not derive a width and declares none | `PRECISION` | the existing wording: `` `<formula>` has no derivable precision ``, with the hint `declare the width: `<name> precision N = …`` |
| The declared width plus the result's integer digits exceeds 40 significant digits | `PRECISION` | the existing ceiling message from `emitCeiling` |

`FnDoc.errors`, noun phrases with no trailing period, matching the reference test:

| `when` | code |
|---|---|
| a non-numeric `rate` | `TYPE` |
| a `rate` of -1 or below | `TYPE` |
| an empty column | `TYPE` |
| a non-numeric cell | `TYPE` |
| a `flows` argument that is not a column | `TYPE` |

### Reporting granularity

`NPV` is one call, so a scalar binding produces **one finding**.

A column rule that calls `NPV` follows the map split already used for `SQRT` and `PMT` (design [§8](../visimark-design.md#8-evaluation)):

- A row whose own rate fails is **one `TYPE` on that row**. Other rows still compute. A row that threw its own `EvalError` is not an upstream suppression, so that row adds no `NOTE`.
- A row-invariant failure (`Level = NPV(-1, Cash)` over N rows, or a blank cell in `Cash`) emits N identical findings. Collapsing those needs a row-variance analysis applied to every call. Out of scope, as it was for `SQRT` and `PMT`.

An upstream error on the rate (`UNDEF`, a bad dependency) suppresses the binding with the existing `NOTE` path. `NPV` adds no suppression rule.

## 5. Interaction with the rest of the language

- **Shape ([§4](../visimark-design.md#4-syntax)).** The sentence "Every reduce takes exactly one argument by construction" becomes: a reduce has one column parameter, a bare column reference, and its other parameters are scalars. `NPV` is the first reduce with a scalar parameter. Nothing in the language gains a second column parameter. The catalogue section C preface says the same "exactly one argument" sentence today. The implementation's documentation task amends both sentences together. The dependency walk sets `inAggregate` only on the column parameter of a well-formed reduce. `isCrossSheetAggregate` reads that same parameter, so a cross-sheet `flows` follows the cross-sheet path `SUM` already has, and a scalar rate on another sheet stays an ordinary scalar dependency.
- **Numeric semantics ([§7](../visimark-design.md#7-numeric-semantics)).** `derivePrecision` returns `null` for an `NPV` call, including at rate zero. The binding declares a width when the result is written. Full working precision until that rounding. Half-up stays the global rule. An inexact power is rounded to 40 significant digits and is not a finding. The write-time ceiling is unchanged.
- **Units ([§7](../visimark-design.md#7-numeric-semantics)).** Cell units are stripped. A computed column does not inherit a unit, so a present-value column writes bare numbers until its own cells are decorated.
- **Dates ([§5](../visimark-design.md#5-dates)).** `NPV` neither accepts nor produces a date. The time index is the row position in the document, not a calendar. `EOMONTH` is not involved. A date cell is `TYPE` (`NPV expects a number`).
- **Write-back ([§9](../visimark-design.md#9-write-back)).** A present-value cell or anchor is tool-owned like any other computed number. `fmt` rewrites it when stale and leaves it when not. `fmt` does not insert a `precision` clause.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).** `NPV` is a function name, not a binding. `rate` resolves by the ordinary scalar rules. `flows` resolves by the ordinary column rules. A binding named `NPV` can still exist. The call is what the table classifies.
- **`param` and `eval --scenario`.** The motivating note's hurdle is a param. Changing it through `--scenario` recomputes `present` through the existing graph. A `param` default is still a literal. This spec does not allow `default NPV(...)`.
- **`assert`.** The result is a number, so `assert present > 0` is an ordinary comparison. When `present` is unevaluable, the assertion is the existing upstream `NOTE`.
- **`chart`, imports, aliases.** No new behaviour. An imported column can be `flows`. A blank imported cell is `TYPE` under the same number test. A present-value column can be a chart series.
- **Percent display.** A `%` anchor prints `stored × 100` at `precision − 2`. The note puts `%` on the hurdle, a `param` of precision 2, and leaves `present` as money. A `%` sigil on `present` is legal only in the sense that it is legal on any numeric scalar.
- **`infer`.** The reduce list `infer` searches does not gain `NPV`. `infer` never emits `NPV`. A document whose only rule would be a present value is still reported as having no rule.
- **`explain` and `--json`.** An `NPV` call is listed like any other call. `--json` gains no field.
- **`visimark ref NPV`.** Works once the `FnDoc` entry exists. The entry's examples are three exact rows, each with its own `given` table: `NPV(0, t.Cash)` is `12000` on `-48000, 20000, 20000, 20000`; `NPV(0.08, t.Cash)` is `-48000` on a one-row column `-48000`; `NPV(-0.5, t.Cash)` is `300` on `100, 100`.
- **Playground bundle.** The engine's export set changes, so `docs/vendor/visimark-browser.js` is regenerated with `bun run --filter visimark build:playground` on Bun 1.4.2. Documents that do not call `NPV` keep the same check result.
- **What does not change.** The operator set, the finding codes, `fmt` idempotence, and every example document that passes `check` today. None of `docs/example-invoice.md`, `docs/example-charts.md`, or `docs/example-invoice-drift.md` calls `NPV`. The [§13](../visimark-design.md#13-testing) transcripts stay byte-identical. `SUM`, `MIN`, `MAX`, `AVG`, and `COUNT` keep `column: 0` and their current results, including `SUM` of an empty column being `0`.

The generated builtin table (design [§4](../visimark-design.md#4-syntax)) gains one row, and the sentence above it counts **fifteen** functions, adding `NPV`, issue #157, to the parenthetical. The catalogue preface's "fourteen functions" sentence and `skills/visimark/SKILL.md` follow that count. `docs/function-reference.md` is regenerated from the `FnDoc`. The skill's sentence that names division, `AVG`, `SQRT`, and `PMT` as the operations whose width must be declared gains `NPV`.

## 6. Acceptance

Covered by unit tests plus a test-only fixture. The invoice and charts examples are untouched.

1. **`test/lang/reference-examples.test.ts`** (already data-driven) executes the three `FnDoc` examples and expects `12000`, `-48000`, and `300`.
2. **`test/eval/functions.test.ts`**
   - `NPV` is `{ kind: "reduce", arity: 2, column: 1 }`. `SUM` still has `column: 0`.
   - `callProblem("NPV", …)` is `{ kind: "arity" }` for 0, 1, and 3 arguments, `{ kind: "shape" }` for 2 arguments whose second is not a reference, and `null` for `(number-expression, ref)`.
   - `NPV(0.08, Cash)` on the motivating column evaluates to `3541.9397449575776050398821317888533252`. `NPV(0, Cash)` on that column evaluates to `12000`. `NPV(0.10, Cash)` on `-1000, 400, 400, 400` evaluates to `-5.2592036063110443275732531930879038317`. `NPV(-0.5, Cash)` on `100, 100` evaluates to `300`.
   - `NPV("x", Cash)` throws `NPV expects a number`.
   - `NPV(-1, Cash)` and `NPV(-1.5, Cash)` throw `NPV rate must be greater than -1`, including when the column is empty and when it has one row.
   - `NPV(-1, Cash)` with a blank cell throws the rate message, not the number message.
   - An empty column at rate `0.08` throws `NPV() of an empty column`.
   - A blank cell, a word, and a date cell each throw `NPV expects a number`. A column `0, <blank>, 5` throws on the blank and does not return a number.
   - The live length assertion on the function table becomes 15.
3. **`test/lang/reference.test.ts`** and **`test/cli/ref.test.ts`**: `functionNames()` and `ref --json` each list 15 functions.
4. **`test/eval/check.test.ts`**
   - Anchored `present precision 2 = NPV(0.08, Cash)` on the motivating column, anchor text `3541.94` → no finding.
   - The same binding with anchor `6000.00` → one `STALE`, computed `3541.94`.
   - The same binding with no `precision` clause, anchored → one `PRECISION`, message containing `` `NPV(0.08, Cash)` has no derivable precision ``.
   - Unanchored `raw = NPV(0.08, Cash)` → no finding.
   - `shown = ROUND(NPV(0.08, Cash), 2)` anchored `3541.94` → no finding.
   - `NPV(0, Cash)` anchored `12000.00` at precision 2 → no finding. The same binding with no `precision` clause, anchored → one `PRECISION`.
   - `NPV(0.08, Cash * 1)` → one static `TYPE`, `NPV() takes a column reference, not an expression`.
   - `NPV(0.08)` → one static `TYPE`, `NPV() takes 2 arguments, got 1`.
   - `NPV(Cash, Flows)`, two columns → one `VECTOR` on `Cash`, and no shape error.
   - `NPV(0.08, present)` where `present` is a scalar → one `TYPE`, `NPV() expects a column`.
   - A blank cell in `Cash` → one `TYPE`, `NPV expects a number`.
   - `assert present > 0` when `present` is that `TYPE` → the assertion is not a second `TYPE`. It is the existing upstream `NOTE`.
   - A computed `Cash` column of three rows whose middle row is its own `TYPE` → `NPV` is unevaluable and adds no finding of its own.
5. **`test/cli/npv.test.ts` + `test/fixtures/npv-press.md`** — the note from [§1](#1-purpose), byte for byte.
   - `visimark check <fixture>` exits 0. Stdout is the fixture path, a blank line, and `  0 problems (0 stale, 0 errors)`.
   - `visimark eval <fixture> --get project.present` exits 0 and prints `3541.94`.
   - `visimark eval <fixture> --get project.hurdle` exits 0 and prints `0.08`.

## 7. Non-goals

- **`IRR`.** Issue #158. If it is approved, it uses this period index: the same column, `k` from 0, the same per-period rate. This spec does not say how a root is found, how many sign changes are legal, or how an undetermined root is reported.
- **Excel's period numbering, and Excel's optional arguments.** Row 0 is undiscounted. There is no guess argument and no "values start at period 1" flag.
- **A Year column, a date index, or a check that the printed years are 0, 1, 2, …** The index is table order. An author who sorts the cash out of time gets that order, and `check` does not notice.
- **Skipping or zero-filling a blank cell.**
- **A per-cell span** for the non-numeric cell inside `flows`. The finding is on the call, as it is for `SUM`.
- **A new finding code**, or a new `FnPrecision` variant. Declared width is the variant division already uses. An inexact power is not a new `PRECISION` variant.
- **Fixing `SUM(someScalar)`** if that call still produces no finding.
- **Static row-variance analysis** to collapse N identical per-row findings.
- **Teaching `infer` to propose `NPV`.**
- **Dividing an annual rate by 12, or any day-count convention, inside the function.**

## 8. Open questions

None.
