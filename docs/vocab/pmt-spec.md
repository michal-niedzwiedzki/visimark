# PMT — feature spec

**Status:** approved (#156) · **Date:** 2026-09-22 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/156#issuecomment-5781382455>

## 1. Purpose

`PMT(rate, nper, pv)` is the instalment that repays a present amount `pv` down to zero over `nper` periods at per-period rate `rate`, paid at the end of each period. A positive `pv` produces a positive instalment. It is a map: three numbers in, one number out.

**The document that motivated it** (issue #156) is a financing quote for one brake press. The price, the annual rate and the term are already in the document; the instalment is what the quote has to state, and it has to move when any of those three moves.

```vmark #press
param price  precision 2 = default 48000.00
param annual precision 2 = default 6%
param term   precision 0 = default 36

monthly_rate precision 3 = annual / 12
instalment   precision 2 = PMT(monthly_rate, term, price)
```

The quote is for one press at **48000.00**<!--vmark=press.price--> PLN. The financing rate is **6%**<!--vmark=press.annual%--> a year, paid monthly over **36**<!--vmark=press.term--> months. The instalment is **1460.25**<!--vmark=press.instalment--> PLN.

`0.06 / 12` is `0.005`. `PMT(0.005, 36, 48000)` rounded half-up to 2 decimals is `1460.25`.

**Why existing vocabulary does not reach it.** The closed form can be written with `*`, `/` and `^`, and that binding would declare a width anyway, because `/` bounds nothing (design [§7](../visimark-design.md#7-numeric-semantics)). Two gaps remain.

When `rate` is zero the denominator `(1 + rate) ^ nper - 1` is zero. `IF` evaluates both arms before it chooses (`evalCall` maps every argument, then selects), so

`IF(rate == 0, pv / nper, pv * rate * (1 + rate) ^ nper / ((1 + rate) ^ nper - 1))`

still evaluates the singular arm on a zero-interest loan. The zero-rate case has to live inside the function, where it is chosen before the division.

`^` derives a width only for a non-negative integer literal. A term stored in `term` is not one, so the expanded formula also leaves the author declaring a width, on an expression that is easy to mistype.

An input cell for the instalment goes stale when the price, the rate, or the term changes. That is the failure `check` exists to catch. No builtin is this formula. `ROUND`, `MOD`, `/`, `^` and `IF` were the ones checked.

## 2. Signature and shape

| | |
|---|---|
| Call | `PMT(rate, nper, pv)` |
| Kind | **map** (scalar → scalar), design [§4](../visimark-design.md#4-syntax) "Shape: map and reduce" |
| Arity | **3**, exact and checked statically ([§4](../visimark-design.md#4-syntax)) |
| `rate` | a **number**, the rate for one period. Must be greater than `-1`. A literal, a name, or any scalar sub-expression. |
| `nper` | a **number**, a positive whole number of periods. `Decimal.isInteger()` is the test, so `36` and `36.0` pass and `36.5` does not. |
| `pv` | a **number**, the present amount repaid down to zero. May be zero or negative. |
| Result | a **number** — never a boolean, date, or string ([§4](../visimark-design.md#4-syntax)) |

`PMT` adds no new value type. The rate is per period. The function does not divide an annual rate by twelve; the document writes that division, as the quote above does.

`FUNCTION_TABLE` gains `PMT: { kind: "map", arity: 3 }`. `FnDoc.precision` is `{ from: "declared" }`, the same variant as `AVG` and `SQRT`.

## 3. Semantics

Let `r` be `rate`, `n` be `nper`, and `p` be `pv`, after the type rules in [§4](#4-type-rules-and-errors).

- When `r` is zero, the result is `p / n`.
- Otherwise the result is `p * r * (1 + r) ^ n / ((1 + r) ^ n - 1)`.

Both are computed with `decimal.js` at the engine's 40-significant-digit working precision (design [§7](../visimark-design.md#7-numeric-semantics)). The zero test happens before the general formula, so a zero rate never divides by zero. The power is `Decimal.prototype.pow` of a whole exponent.

The result is rounded **once, at the binding**, to that binding's declared width, half-up, by the rule already in [§7](../visimark-design.md#7-numeric-semantics). `PMT` adds no tie-break of its own. `FnDoc` carries no `rounding` field.

`reference-examples.test.ts` evaluates `example = <expr>` with no anchor and no `precision` clause, then compares `Decimal.toString()`. Those examples are therefore the cases whose result is exact. The rounded figures from the issue are write forms, asserted by `check`, not `FnDoc` `is` strings.

| Case | Input | Full working value (`toString`) | Written at 2 dp |
|---|---|---|---|
| Issue, 1% × 12 | `PMT(0.01, 12, 10000)` | `888.4878867834170733998783122788652898045` | `888.49` |
| Zero rate | `PMT(0, 12, 1200)` | `100` | `100.00` |
| One period | `PMT(0.10, 1, 1000)` | `1100` | `1100.00` |
| Zero principal | `PMT(0, 4, 0)` | `0` | `0.00` |
| Motivating quote | `PMT(0.005, 36, 48000)` | `1460.252997674645676629785549680054151698` | `1460.25` |
| Negative principal | `PMT(0.01, 12, -10000)` | `-888.4878867834170733998783122788652898045` | `-888.49` |
| Negative rate, still above -1 | `PMT(-0.005, 12, 1000)` | `80.64988715141371165792070491691546452695` | `80.65` |
| Two periods, repeating | `PMT(0.1, 2, 1000)` | `576.1904761904761904761904761904761904762` | `576.19` |
| Rate exactly -1 | `PMT(-1, 12, 1000)` | — | `TYPE` ([§4](#4-type-rules-and-errors)) |
| Rate below -1 | `PMT(-1.5, 12, 1000)` | — | `TYPE` |
| Zero periods | `PMT(0.01, 0, 1000)` | — | `TYPE` |
| Fractional periods | `PMT(0.01, 12.5, 1000)` | — | `TYPE` |
| Negative periods | `PMT(0.01, -12, 1000)` | — | `TYPE` |

A column rule runs the map once per row. `Instalment = PMT(Rate, Term, Principal)` over a table of loans writes one instalment per row, each rounded to the column binding's declared width. A reducer over that column reads the already-rounded cells, as it does for any other computed column.

An unanchored scalar keeps the full working value. `raw = PMT(0.01, 12, 10000)` with no anchor is not a `PRECISION` finding and is not rounded; an anchored `ROUND(raw, 2)` then rounds once. That is the rule [§7](../visimark-design.md#7-numeric-semantics) already states for division and `SQRT`, and `check.ts` implements it: a missing width is reported only when a numeric result is about to be written (an anchored scalar, or a column cell).

`ROUND(PMT(0.01, 12, 10000), 2)` derives its width from `ROUND`'s `places`. The binding needs no `precision` clause of its own. `derivePrecision` of a `PMT` call is `null`, and `null` propagates through `+`, `-`, `*` and `^` the way a division's `null` does. There is no extra "this expression contains `PMT`" check.

## 4. Type rules and errors

`PMT` introduces **no new error code**.

**Static, once per binding, before evaluation** (design [§4](../visimark-design.md#4-syntax)):

| Situation | Code ([§10](../visimark-design.md#10-error-taxonomy)) | Reported |
|---|---|---|
| `PMT()` / `PMT(a, b)` / `PMT(a, b, c, d)` — wrong arity | `TYPE` | against the span of the call, once. Message from `describeCallProblem`: `PMT() takes 3 arguments, got N`. |
| `PMT` misspelled within edit distance 2 | `TYPE` with a did-you-mean to `PMT` | automatic once `PMT` is a key of `FUNCTIONS`. |

**At evaluation**, arguments are checked in this order. The first failure is the finding.

| Order | Situation | Code | Message |
|---|---|---|---|
| 1 | `rate`, `nper`, or `pv` is not a number (date, string, boolean), left to right | `TYPE` | `PMT expects a number` |
| 2 | `nper` is not a positive whole number (`!isInteger()` or `!gt(0)`) | `TYPE` | `PMT expects a positive whole number of periods` |
| 3 | `rate <= -1` | `TYPE` | `PMT rate must be greater than -1` |
| 4 | the power or the division is not a finite decimal | `TYPE` | `result is not a finite decimal` |

Order 4 is the guard `num()` already applies to `/` and `^`. A unit on an operand is stripped before these tests (design [§7](../visimark-design.md#7-numeric-semantics)).

**When the result is written:**

| Situation | Code | Message |
|---|---|---|
| An anchored scalar or a column rule whose formula does not derive a width and declares none | `PRECISION` | the existing wording: `` `<formula>` has no derivable precision ``, with the hint `declare the width: `<name> precision N = …`` |
| The declared width plus the result's integer digits exceeds 40 significant digits | `PRECISION` | the existing ceiling message from `emitCeiling` |

`FnDoc.errors`, noun phrases with no trailing period, matching the reference test:

| `when` | code |
|---|---|
| a non-numeric `rate`, `nper`, or `pv` | `TYPE` |
| a non-positive or non-whole `nper` | `TYPE` |
| a `rate` of -1 or below | `TYPE` |

### Reporting granularity

The same split as `SQRT` and `EOMONTH` (design [§4](../visimark-design.md#4-syntax), [§8](../visimark-design.md#8-evaluation)):

- A row whose own `Rate`, `Term`, or `Principal` fails the rules above is **one `TYPE` finding on that row**. Other rows still compute. No `NOTE` for that row: a row that threw its own `EvalError` is not an upstream suppression.
- A scalar binding is **one `TYPE` finding on the binding**.
- A row-invariant bad argument (`Instalment = PMT(0.01, -1, Principal)` over N rows) emits N identical findings. Collapsing those needs a row-variance analysis applied to every map. Out of scope, as it was for `SQRT`.

An upstream error (`UNDEF`, a bad dependency) suppresses the `PMT` row with the existing `NOTE`. `PMT` adds no suppression rule.

## 5. Interaction with the rest of the language

- **Numeric semantics ([§7](../visimark-design.md#7-numeric-semantics)).** `derivePrecision` returns `null` for a `PMT` call, same as the `default` arm that already covers `AVG` and `SQRT`. The binding declares a width when the result is written. Full working precision until that rounding. Half-up stays the global rule.
- **Units ([§7](../visimark-design.md#7-numeric-semantics)).** Operand units are stripped. A computed column does not inherit a unit, so an instalment column writes bare numbers until its own cells are decorated.
- **Dates ([§5](../visimark-design.md#5-dates)).** `PMT` neither accepts nor produces a date. A date argument is `TYPE` (`PMT expects a number`). Dating the last instalment stays a separate `EOMONTH` call.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** An instalment cell or anchor is tool-owned like any other computed number. `fmt` rewrites it when stale and leaves it when not. `fmt` does not insert a `precision` clause.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).** `PMT` is a function name, not a binding. The three arguments resolve by the ordinary rules.
- **`param` and `eval --scenario`.** The motivating quote's price, rate and term are params. Changing one through `--scenario` recomputes `monthly_rate` and `instalment` through the existing graph. A `param` default is still a literal; this spec does not allow `default PMT(...)`.
- **`assert`.** The result is a number, so `assert instalment <= budget` is an ordinary comparison.
- **`chart`, imports, aliases.** No new behaviour. An instalment column can be a series; an imported column can be an argument.
- **Percent display.** A `%` anchor prints `stored × 100` at `precision − 2`. That is legal on an instalment only in the sense that it is legal on any numeric scalar. The quote puts `%` on the annual rate, which is a `param` of precision 2, and leaves the instalment as money.
- **`infer`.** Never emits `PMT`. A document whose only rule would be an instalment is still reported as having no rule.
- **`explain` and `--json`.** A `PMT` call is listed like any other call. `--json` gains no field.
- **`visimark ref PMT`.** Works once the `FnDoc` entry exists. The entry's examples are the three exact rows: `PMT(0, 12, 1200)` is `100`, `PMT(0.10, 1, 1000)` is `1100`, `PMT(0, 4, 0)` is `0`.
- **What does not change.** The operator set, the finding codes, `fmt` idempotence, and every example document that passes `check` today. None of them calls `PMT`. The [§13](../visimark-design.md#13-testing) transcripts for `docs/example-invoice.md` and `docs/example-invoice-drift.md` stay byte-identical.

The generated builtin table (design [§4](../visimark-design.md#4-syntax)) gains one row, and the sentence above it counts **fourteen** functions, adding `PMT`, issue #156, to the parenthetical. `docs/function-reference.md` is regenerated from the `FnDoc`. `skills/visimark/SKILL.md` adds `PMT` to the sentence that names division, `AVG` and `SQRT` as the operations whose width must be declared.

## 6. Acceptance

Covered by unit tests plus a test-only fixture. The two invoice examples are untouched.

1. **`test/lang/reference-examples.test.ts`** (already data-driven) executes the three `FnDoc` examples and expects `100`, `1100`, and `0`.
2. **`test/eval/functions.test.ts`**
   - `PMT` is `{ kind: "map", arity: 3 }`.
   - `callProblem("PMT", …)` is `{ kind: "arity" }` for 0, 2 and 4 arguments, and `null` for 3.
   - `PMT(0, 12, 1200)` evaluates to `100`; `PMT(0.10, 1, 1000)` to `1100`; `PMT(0.01, 12, 10000)` to the full working value in [§3](#3-semantics); `PMT(0.005, 36, 48000)` to the motivating full value.
   - `PMT("x", 12, 1)`, `PMT(0.01, "x", 1)` and `PMT(0.01, 12, 2026-01-01)` throw `PMT expects a number`.
   - `PMT(0.01, 0, 1)`, `PMT(0.01, -12, 1)` and `PMT(0.01, 12.5, 1)` throw `PMT expects a positive whole number of periods`.
   - `PMT(-1, 12, 1)` and `PMT(-1.5, 12, 1)` throw `PMT rate must be greater than -1`.
   - `PMT(-1, 1.5, 1)` throws the periods message, not the rate message.
3. **`test/eval/check.test.ts`**
   - Anchored `instalment precision 2 = PMT(0.01, 12, 10000)` with anchor text `888.49` → no finding.
   - The same binding with no `precision` clause → one `PRECISION`, message containing `` `PMT(0.01, 12, 10000)` has no derivable precision ``.
   - Unanchored `raw = PMT(0.01, 12, 10000)` → no finding.
   - `shown = ROUND(PMT(0.01, 12, 10000), 2)` anchored `888.49` → no finding.
   - A three-row loan table, one row with `Term` of `-1` → one `TYPE` on that row, message `PMT expects a positive whole number of periods`, the other rows clean, no `NOTE`.
   - `PMT(0.01, 12)` → one static `TYPE`, `PMT() takes 3 arguments, got 2`.
4. **`test/cli/pmt.test.ts` + `test/fixtures/pmt-press.md`** — the quote from [§1](#1-purpose), byte for byte.
   - `visimark check <fixture>` exits 0 and its stdout is the path, a blank line, and `0 problems (0 stale, 0 errors)`.
   - `visimark eval <fixture> --get press.instalment` exits 0 and prints `1460.25`.
   - `visimark eval <fixture> --get press.monthly_rate` exits 0 and prints `0.005`.

## 7. Non-goals

- **A future-value argument, or a type flag for payment at the beginning of the period.** Excel's optional fourth and fifth arguments. A balloon and an annuity-due are separate requests if a document needs them.
- **Excel's sign.** Excel returns a negative instalment for a positive present value. Here a positive `pv` returns a positive instalment. A document that wants the outflow writes `-PMT(...)`.
- **Dividing an annual rate by 12, or any day-count convention, inside the function.** The rate argument is already per period.
- **`NPV` and `IRR`.** Issues #157 and #158. This spec does not depend on either, and neither is required to implement this one.
- **A new finding code** for a domain failure. `TYPE` and the existing `PRECISION` wording cover every case in [§4](#4-type-rules-and-errors).
- **A new `FnPrecision` variant.** Declared width is the variant division already uses.
- **Static row-variance analysis** to collapse N identical per-row findings.
- **Teaching `infer` to propose `PMT`.**

## 8. Open questions

None.
