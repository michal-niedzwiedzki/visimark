# EOMONTH — feature spec

**Status:** approved (#6) · **Date:** 2026-09-06 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/6#issuecomment-5559247913>

## 1. Purpose

`EOMONTH(d, months)` returns the last calendar day of the month that is
`months` whole months away from the date `d`. The day component of `d` is
discarded: only its year and month choose the target month, and the result is
that month's final day.

**The document that motivated it** (issue #6) is an invoice whose payment term
is "net two months, end of month":

```vmark #terms
issued = 2026-01-15
due    = EOMONTH(issued, 2)
```

With `issued` at 2026-01-15 the due date is 2026-03-31, and it re-derives
whenever `issued` changes — a hand-typed `2026-03-31` would still look right
after someone moved the issue date to 2026-01-20, which is exactly the class of
silently-wrong derived value VisiMark exists to catch (design [§14](../visimark-design.md#14-deferred)).

**Why existing vocabulary does not reach it.** `date ± number` moves a fixed
number of days, never to a month end — there is no offset from 2026-01-15 that
lands on "the last day of March" without already knowing the length of February
and March. None of the nine builtins (`SUM MIN MAX AVG COUNT ROUND ABS MOD IF`,
design [§4](../visimark-design.md#4-syntax)) navigate the calendar. `YEAR` / `MONTH` / `DAY` and `DATE(y, m, d)`
are both catalogued `DEFERRED`, so the compositional route
`DATE(YEAR(d), MONTH(d) + n, 1) − 1` is unavailable and would itself need
month-overflow handling. A human-typed input column defeats the point, since the
value is derived purely from `issued` and the fixed term.

## 2. Signature and shape

| | |
|---|---|
| Call | `EOMONTH(d, months)` |
| Kind | **map** (scalar → scalar), design [§4](../visimark-design.md#4-syntax) "Shape: map and reduce" |
| Arity | **2**, exact and checked statically ([§4](../visimark-design.md#4-syntax)) |
| `d` | a **date** |
| `months` | a **number** with no fractional part (a whole-number offset); may be negative or zero; may be a computed scalar, not only a literal |
| Result | a **date** — never a boolean, never a "month" value ([§4](../visimark-design.md#4-syntax), [§5](../visimark-design.md#5-dates)) |

`EOMONTH` adds no new value type. It consumes an ordinary date and returns an
ordinary date; the month-offset arithmetic happens internally and no "month"
ever surfaces for the rest of the language to interpret (design [§5](../visimark-design.md#5-dates) keeps the
month type deferred).

## 3. Semantics

`EOMONTH(d, months)` is defined as: take `(year, month)` of `d`; add `months`,
carrying whole years so the month lands in 1–12 (month 13 → January of the next
year, month 0 → December of the previous year, and so on for any offset);
the result is `(carried-year, carried-month, daysInMonth(carried-year,
carried-month))`.

The day of `d` is never read. Leap years are handled by `daysInMonth`
(28 vs 29 February is a total function of the year number).

| Case | Input | Result | Note |
|---|---|---|---|
| Normal, forward | `EOMONTH(2026-01-15, 1)` | `2026-02-28` | 2026 is not a leap year |
| Leap February | `EOMONTH(2024-01-31, 1)` | `2024-02-29` | input day 31 is irrelevant |
| Zero offset | `EOMONTH(2026-01-15, 0)` | `2026-01-31` | end of `d`'s own month |
| Negative offset | `EOMONTH(2026-01-15, -1)` | `2025-12-31` | crosses the year boundary backward |
| Motivating case | `EOMONTH(2026-01-15, 2)` | `2026-03-31` | issue #6 |
| Forward year carry | `EOMONTH(2026-11-10, 3)` | `2027-02-28` | month 14 → February next year |
| Large negative carry | `EOMONTH(2026-03-31, -15)` | `2024-12-31` | month −12 → December, two years back |
| Input day past target length | `EOMONTH(2026-01-31, 1)` | `2026-02-28` | the common case, not an error |
| 30-day target month | `EOMONTH(2026-01-15, 3)` | `2026-04-30` | |

The result is a plain date and composes wherever a date does: `due + 7`,
`MIN(due)` in a reducer over a column, a `<!--vmark=terms.due-->` anchor,
lexical sorting (design [§5](../visimark-design.md#5-dates)).

## 4. Type rules and errors

Static, once per binding, before evaluation (design [§4](../visimark-design.md#4-syntax)):

| Situation | Code ([§10](../visimark-design.md#10-error-taxonomy)) | Reported |
|---|---|---|
| `EOMONTH(x)` / `EOMONTH(a, b, c)` — wrong arity | `TYPE` | against the span of the call, once |
| `EOMONTH` misspelled (`EOMONT`, `EOM`) | `TYPE` with a did-you-mean, once `EOMONTH` is in the known-name set |

At evaluation, reported once against the binding and suppressed downstream
(design [§8](../visimark-design.md#8-evaluation)):

| Situation | Code ([§10](../visimark-design.md#10-error-taxonomy)) | Notes |
|---|---|---|
| `d` is not a date (a number, a string) | `TYPE` | e.g. `EOMONTH("2026-01", 1)` |
| `months` is not a number | `TYPE` | e.g. `EOMONTH(d, "two")` |
| `months` has a non-zero fractional part | `TYPE` | **no tolerance** — `2` and `2.0` are fine, `2.5` and `2.0000001` are errors. A unit decoration on `months` is stripped first (design [§7](../visimark-design.md#7-numeric-semantics)), then the stripped number must be integral. |
| the result year falls outside 1–9999 | `DATE` | e.g. `EOMONTH(9999-12-01, 1)`; the failure is "the result is not a representable calendar date", so it reuses the `DATE` code, not `TYPE` |

**Implementation note.** check.ts currently maps every `EvalError` to a `TYPE`
finding. The out-of-range case must instead surface as `DATE`; the plan decides
the mechanism (a `DateError` subclass, or a range check in the evaluator that
emits a `DATE` finding directly).

## 5. Interaction with the rest of the language

- **Dates ([§5](../visimark-design.md#5-dates)).** The result is an ordinary ISO date. `date − date` and
  `date ± number` already require the same proleptic-Gregorian calendar and
  leap arithmetic `EOMONTH` needs, so nothing new about the calendar is
  introduced. No month / partial-date type is added.
- **Numeric semantics and write precision ([§7](../visimark-design.md#7-numeric-semantics)).** A date is not a decimal
  number; it has no decimal-place count and takes no `precision` inference. A
  written cell or anchor is the 10-character ISO string, exactly as for any
  other date-valued binding (`Due` in the payment-schedule example).
- **Units ([§7](../visimark-design.md#7-numeric-semantics)).** Dates carry no unit decoration. A unit on the `months`
  operand is stripped before the integer check, per the standard rule; the
  result is bare.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** A computed cell or anchor whose formula is `EOMONTH(...)`
  is tool-owned like any computed value; `fmt` rewrites it when stale. No new
  write-back behaviour.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).** `EOMONTH` is a function name, not a bindable name;
  `d` and `months` resolve by the ordinary rules (own columns, own scalars,
  document scope).
- **`infer`.** `infer` proposes rules only for a document that has none and
  never emits `EOMONTH` — the primitive is too specific to guess. Unchanged.
- **`explain`.** An `EOMONTH` call appears in the rule listing and dependency
  order like any other function call. Unchanged.
- **What does not change:** the nine builtins, the operator set, the error
  taxonomy (no new code — `TYPE` and `DATE` already exist), `fmt` idempotence,
  the two acceptance example documents.

## 6. Acceptance

Covered by **unit tests plus a test-only fixture** — the two example documents
(`docs/example-invoice.md`, `docs/example-invoice-drift.md`) are untouched, so
the [§13](../visimark-design.md#13-testing) acceptance transcript does not move.

1. **`test/eval/dates.test.ts`** — a pure `eomonth(iso, months) → iso` helper
   (added next to `addDays` / `daysBetween` in `eval/dates.ts`) against every
   row of the [§3](#3-semantics) table, plus: month 13 and month 0 carries in both directions;
   February in a leap and a non-leap year; the year-1 and year-9999 boundaries
   (in range succeeds, one step past raises).
2. **`test/eval/functions.test.ts`** — `EOMONTH` registered as `{ kind: "map",
   arity: 2 }`; `callProblem("EOMONTH", …)` returns `arity` for 1 and 3 args
   and `null` for 2; evaluating `EOMONTH(date, num)` returns the right date;
   `EOMONTH(number, num)`, `EOMONTH(date, "x")`, `EOMONTH(date, 2.5)` each throw
   `EvalError`.
3. **`test/eval/check.test.ts`** — a binding `due = EOMONTH(issued, 2)` with
   `issued = 2026-01-15` yields no finding and evaluates to `2026-03-31`;
   `EOMONTH(issued)` yields one `TYPE` finding on the binding; a binding whose
   result leaves the date range yields one `DATE` finding and a downstream
   `NOTE` suppression.
4. **`test/cli/` fixture** — `test/fixtures/eomonth-terms.md` (the issue's
   `#lines` + `#terms` document, with `vat` supplied in a document-scope block
   so the file is otherwise clean): `visimark check` exits 0, `visimark eval
   --get terms.due` prints `2026-03-31`.

Expected `check` output for the clean fixture:

```
docs/../test/fixtures/eomonth-terms.md

  0 problems
```

## 7. Non-goals

- **A general `date ± n months` / `EDATE` / `ADDMONTHS`.** The deciding comment
  carved this out: it carries a day-clamp ambiguity (`2026-01-31 + 1 month`
  has no non-arbitrary answer) that `EOMONTH` avoids only because it discards
  the day. It needs its own vocabulary request and its own motivating document.
- **`YEAR` / `MONTH` / `DAY`, `DATE(y, m, d)`.** Still `DEFERRED`; not required
  by this primitive and not unblocked by it.
- **A surfaced "month" value or a month type** (design [§5](../visimark-design.md#5-dates)).
- **Business-day or holiday-aware variants** (`WORKDAY`, already `REJECTED`).
- **Configurable first argument as a "year-month" string** — `d` is a full ISO
  date only.

## 8. Open questions

None.
