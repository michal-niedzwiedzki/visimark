# SQRT — feature spec

**Status:** approved (#18) · **Date:** 2026-09-06 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/18#issuecomment-5560992652>

## 1. Purpose

`SQRT(x)` returns the non-negative square root of a non-negative number. It is a
map: one number in, one number out. The result is irrational in general and
carries full internal precision until it is rounded at its binding, exactly like
every other computed number (design §7).

**The document that motivated it** (issue #18) is a diagonal-brace cutting
schedule — each brace spans a rectangular bay corner to corner, so the length to
cut is the straight-line distance between the end pins, fixed by the bay's width
and height alone:

```vmark #braces
Length = SQRT(Width^2 + Height^2)

longest = MAX(Length)
```

| Brace | Width | Height |  Length |
|-------|------:|-------:|--------:|
| B1    |  3600 |   4200 | 5531.73 |
| B2    |  3600 |   2400 | 4326.66 |
| B3    |  6000 |   3000 | 6708.20 |

`Length` is a total function of `Width` and `Height`; a hand-typed `5531.73`
still looks plausible after someone changes `Height` on B1, which is exactly the
silently-wrong derived value `check` exists to catch. A genuinely external
quantity — a measured field dimension, a supplier's stock length — belongs in an
input column; a length computed from two dimensions in the same table does not.

**Why existing vocabulary does not reach it.** No builtin computes a root: the
numeric maps are `ROUND`, `ABS`, `MOD` and none of the reducers apply (design
§4). `x ^ 0.5` *does* reach the value — `^` is `Decimal.prototype.pow`, which
accepts a fractional exponent — but it is a workaround, not a reason to withhold
the name. A bare `0.5` is a magic constant the reader must decode as "square
root", and a half-power sitting beside a genuine `Width^2` in the same rule
reads as ambiguous intent. Precision is identical: `pow` with a non-integer
exponent is itself an approximation rounded at the binding, so `SQRT` adds no
new precision behaviour, only a spelling that says what the line does. This is
the same reasoning that carried `EOMONTH` (#6) over the "you could write it by
hand" objection.

## 2. Signature and shape

| | |
|---|---|
| Call | `SQRT(x)` |
| Kind | **map** (scalar → scalar), design §4 "Shape: map and reduce" |
| Arity | **1**, exact and checked statically (§4) |
| `x` | a **number**; may be zero; a negative value is a domain error (§4 below). May be a literal, a column reference, or any scalar sub-expression. |
| Result | a **number** — never a boolean, never a date or string (§4) |

`SQRT` adds no new value type and no new in-flight value. It consumes a number
and returns a number; it is in the same class as `ABS` and `MOD`.

## 3. Semantics

`SQRT(x)` is the unique `r ≥ 0` with `r * r = x`. It is computed with
`Decimal.prototype.sqrt`, which is correctly rounded to the active
40-significant-digit working precision (design §7) — a decimal operation, not a
binary-float one. `Decimal(-1).sqrt()` returns `NaN` rather than throwing, so a
negative operand is caught by an explicit guard *before* `.sqrt()` is called
(§4).

| Case | Input | Result (full working precision) | Written at 2 dp |
|---|---|---|---|
| Perfect square | `SQRT(9)` | `3` | `3.00` |
| Zero | `SQRT(0)` | `0` | `0.00` |
| Fractional, exact | `SQRT(0.25)` | `0.5` | `0.50` |
| Perfect square, large | `SQRT(1000000)` | `1000` | `1000.00` |
| Irrational | `SQRT(2)` | `1.41421356237309504880168872420969807857` | `1.41` |
| Motivating row B1 | `SQRT(3600^2 + 4200^2)` = `SQRT(30600000)` | `5531.726674375732386001364569057675894348` | `5531.73` |
| Motivating row B2 | `SQRT(3600^2 + 2400^2)` = `SQRT(18720000)` | `4326.661530556787151743065520964595135502` | `4326.66` |
| Motivating row B3 | `SQRT(6000^2 + 3000^2)` = `SQRT(45000000)` | `6708.203932499369089227521006193828706322` | `6708.20` |
| Negative | `SQRT(-1)` | — | `TYPE` error (§4) |

The result is rounded **once, at the binding it is assigned to**, to that
binding's inferred decimal-place count (design §7): the column's existing cells,
or the anchor's text, or the document `precision` constant (default 2). Nothing
about `SQRT` changes this rule — `Length` writes `5531.73` because its column
cells carry two decimals, not because `SQRT` chose a precision. A trailing zero
is padded on write exactly as `Net` writes `5200.00`.

A reducer over a `SQRT` column reads that column's already-rounded cell values,
so `longest = MAX(Length)` is `MAX(5531.73, 4326.66, 6708.20)` = `6708.20`, then
rounded again at the `longest` binding — the standard behaviour for any computed
column feeding a reducer, unchanged here.

## 4. Type rules and errors

`SQRT` introduces **no new error code** — `TYPE` covers every case.

**Static, once per binding, before evaluation** (design §4):

| Situation | Code (§10) | Reported |
|---|---|---|
| `SQRT()` / `SQRT(a, b)` — wrong arity | `TYPE` | against the span of the call, once. Message from `describeCallProblem`: `SQRT() takes 1 argument, got N`. |
| `SQRT` misspelled (`SQR`, `SQRT2`, `SQTR`) | `TYPE` with a did-you-mean to `SQRT` | automatic once `SQRT` is a key of `FUNCTIONS` — `closest()` with edit distance ≤ 2 ([check.ts:156](../../packages/visimark/src/eval/check.ts)). |

**At evaluation** (design §8):

| Situation | Code (§10) | Message | Notes |
|---|---|---|---|
| `x` is not a number (a date, a string, a boolean) | `TYPE` | `SQRT expects a number` | the ordinary numeric-map operand error, identical in form to `ABS`; produced by the shared `asNum` helper. |
| `x` is a negative number | `TYPE` | `SQRT of a negative number` | a negative operand has no real square root; VisiMark reports the domain error rather than returning a complex value or silently taking `SQRT(ABS(x))`. Excel / Sheets raise `#NUM!` here. A unit decoration on `x` is stripped first (design §7), then the bare number's sign is tested. |

### Reporting granularity

`SQRT` follows the language's split (design §4, §8):

- **Row-data error** — `x` varies by row (`SQRT(Width)`, `SQRT(a - b)`) and a
  particular row's value is negative: **one `TYPE` finding on that row's cell**.
  Every other row still computes and is verified. This matches how `EOMONTH`
  reports an out-of-range row and how a malformed input date is reported per
  cell — the finding points at the cell the author must fix.
- **Scalar binding** — `x = SQRT(-1)`, or any scalar: **one `TYPE` finding on
  the binding**.

A **row-invariant** negative operand inside a column rule (`Length = SQRT(-1)`
over N rows, or `SQRT(k)` with `k` a constant scalar) currently emits N
identical findings — one per row — because the evaluator has no notion of an
argument that cannot vary by row. This is a pre-existing shared property with
`EOMONTH` (`EOMONTH(Start, 1.5)` behaves the same). Collapsing it needs a static
row-variance analysis over the call's argument subtree, applied uniformly to
every map; that is **out of scope for this spec** and recorded as a possible
future consistency pass. It is not hidden — every finding still names a real
cell that will not compute.

### Correctness fix carried by this change

The trailing `NOTE` emitted after a column rule
([check.ts:360](../../packages/visimark/src/eval/check.ts)) currently counts
*every* `null` in the column's result vector — both rows suppressed by an
upstream dependency error **and** rows that threw their own `EvalError` and
already carry a per-row finding — under the hard-coded wording
`N rows not verified (upstream DATE errors)`.

For a `SQRT` negative-operand row that wording is wrong twice (`TYPE`, not
`DATE`; the row itself, not upstream) and it folds a plainly-reported row into a
vague summary. This spec **narrows the `NOTE` to upstream suppression only**: it
counts a row only when that row was made unevaluable by a *dependency's* error
(`Unevaluable`), never when the row emitted its own finding.

- `example-invoice-drift.md` is **unaffected** — its `NOTE schedule.Days · 2
  rows not verified (upstream DATE errors)` is genuinely upstream (`Days = Due -
  issued` and `Due` has two malformed dates), so the §13 transcript stays
  byte-identical.
- One **unreleased** `EOMONTH` test shifts: `test/eval/check.test.ts`
  "an out-of-range row is a DATE finding plus a NOTE" — the direct `DATE` row
  error is no longer double-counted, so the expected codes become `["DATE"]`.
  This is the more correct behaviour and `EOMONTH` has not shipped.

## 5. Interaction with the rest of the language

- **Numeric semantics and write precision (§7).** The result is an ordinary
  decimal number with no special precision rule: full working precision
  internally, rounded at the binding to the inferred decimal-place count, like
  `Net / SUM(Net)` or any other irrational-valued expression. `SQRT` is
  explicitly **not** in the "dents the re-add-on-a-calculator promise" class
  that `SIN` / `COS` / `LN` / `PI()` occupy (catalogue §A): `Decimal.sqrt` is
  correctly-rounded decimal, and `x ^ 0.5` already admits exactly this
  approximation today.
- **Units (§7).** A computed column does not inherit a unit from its operands
  (no dimensional analysis), so a `SQRT`-valued column writes bare numbers until
  its own cells are decorated, then the decoration is re-applied on write-back
  like any other column. A unit on the operand is stripped before the
  arithmetic and the sign test.
- **Dates (§5).** `SQRT` neither accepts nor produces a date. Its result
  composes into `date ± number` only as the number operand, which must be a
  whole number of days — the ordinary rule, nothing `SQRT`-specific.
- **Write-back (§9).** A computed cell or anchor whose formula is `SQRT(...)` is
  tool-owned like any computed value; `fmt` rewrites it when stale and leaves it
  byte-stable when not. No new write-back behaviour.
- **Name resolution (§6).** `SQRT` is a function name, not a bindable name; `x`
  resolves by the ordinary rules (own columns, own scalars, document scope).
- **`infer`.** `infer` proposes rules only for a document that has none, and
  never emits `SQRT` — like `EOMONTH`, the primitive is too specific to guess
  from values. A document already written with `SQRT` and no other rule is still
  reported "no rule found — treating as inputs". Unchanged.
- **`explain`.** A `SQRT` call appears in the rule listing and dependency order
  like any other function call. Unchanged.
- **What does not change:** the operator set, the error taxonomy (no new code),
  `fmt` idempotence, and the two acceptance example documents
  (`docs/example-invoice.md`, `docs/example-invoice-drift.md`) — neither uses
  `SQRT`, so the design §13 acceptance transcript does not move.

## 6. Acceptance

Covered by **unit tests plus a test-only fixture**; the two example documents
are untouched, so the §13 acceptance transcript does not move.

1. **`test/eval/functions.test.ts`**
   - `SQRT` registered as `{ kind: "map", arity: 1 }`.
   - `callProblem("SQRT", …)` returns `{ kind: "arity" }` for 0 and 2 args,
     `null` for 1.
   - `evalExpr` of `SQRT(9)` → `num(3)`; `SQRT(0)` → `num(0)`; `SQRT(0.25)` →
     `num(0.5)`; `SQRT(2)` → a value whose `.pow(2)` rounds back to `2` at 2 dp.
   - `SQRT("x")` and `SQRT(2026-01-01)` throw `EvalError` with message
     `SQRT expects a number`.
   - `SQRT(-1)` and `SQRT(-0.0001)` throw `EvalError` with message
     `SQRT of a negative number`.
2. **`test/eval/check.test.ts`**
   - scalar `d = SQRT(9)` with anchor `**3.00**` → no finding.
   - column rule `Length = SQRT(Width^2 + Height^2)` over the three brace rows →
     no finding; the cells verify at two decimals.
   - `Side = SQRT(Area)` where one row's `Area` is `-4` → **exactly one `TYPE`
     finding on that row**, message `SQRT of a negative number`, the other rows
     verified, **and no `NOTE`** (the narrowed-NOTE fix).
   - `x = SQRT(-1)` scalar → one `TYPE` finding on the binding.
   - `SQRT(9, 4)` → one static `TYPE` finding, `SQRT() takes 1 argument, got 2`.
   - the existing "EOMONTH: an out-of-range row is a DATE finding plus a NOTE"
     test is updated to expect codes `["DATE"]`.
3. **`test/cli/sqrt.test.ts` + `test/fixtures/sqrt-braces.md`** — the issue's
   brace schedule as a standalone clean document (with the
   `**6708.20**<!--vmark=braces.longest-->` anchor):
   - `visimark check <fixture>` exits `0` and its output contains `0 problems`.
   - `visimark eval <fixture> --get braces.longest` exits `0` and prints exactly
     `6708.20`.

## 7. Non-goals

- **`ROOT(x, n)` / a general nth root / `CBRT`.** A separate, wider request with
  its own motivating document. `SQRT` is the square-root-only primitive.
- **Any change to `x ^ 0.5`.** This spec does not touch how `^` handles a
  fractional exponent or a negative base; it only adds a named alternative for
  the square-root case.
- **Complex results, or a `SQRT` that returns `SQRT(ABS(x))` for negative
  input.** A negative operand is a domain error, full stop.
- **A per-column or per-call precision declaration** for the irrational result
  (design §7, §14 — deferred, and dismissed for this request in review: it would
  break the WYSIWYG precision rule).
- **Static row-variance analysis** to collapse N identical per-row findings for
  a row-invariant bad operand — noted in §4, a uniform change across all maps,
  not part of this work.
- **Changing `infer` to recognise or propose square-root rules.**

## 8. Open questions

None.
