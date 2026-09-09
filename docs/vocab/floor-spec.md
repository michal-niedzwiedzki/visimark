# FLOOR — feature spec

**Status:** approved (#53) · **Date:** 2026-09-09 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/53#issuecomment-5598663415>

## 1. Purpose

`FLOOR(number, significance)` returns the greatest multiple of `significance`
that does not exceed `number` — rounding toward negative infinity. It is a map:
two numbers in, one number out. `significance` is mandatory; there is no
implicit "round to 1" default.

**The document that motivated it.** No document in the repo currently calls
`FLOOR` with a `significance` other than 1. The real need on the page is the
integer-capacity arithmetic in
[`docs/example-executable-documentation.md`](../example-executable-documentation.md)
(issue #53, split out of #52):

```vmark #kubernetes
MaxNodes = FLOOR(WorkerBudget / WorkerNodeMonthlyCost)
UsableNodes = FLOOR(MaxNodes * (1 - ReservedCapacity))
UsableCPU = FLOOR(TotalCPU * (1 - ReservedCapacity))
UsableMemory = FLOOR(TotalMemory * (1 - ReservedCapacity))
```

Those four calls are a **1-argument** `FLOOR(x)` — round down to the nearest
integer. Function overloading (one name, two arities) is **undecided** in the
language and this spec does not decide it. The 2-argument form covers the same
arithmetic without committing that question: `FLOOR(x, 1)`. Shipping the 2-arg
form now is cheaper than shipping a 1-arg `FLOOR` and later migrating every
call if the project settles on "no overloading".

With that spelling the kubernetes bindings become:

```vmark #kubernetes
MaxNodes = FLOOR(WorkerBudget / WorkerNodeMonthlyCost, 1)
UsableNodes = FLOOR(MaxNodes * (1 - ReservedCapacity), 1)
UsableCPU = FLOOR(TotalCPU * (1 - ReservedCapacity), 1)
UsableMemory = FLOOR(TotalMemory * (1 - ReservedCapacity), 1)
```

`WorkerBudget = 12000`, `WorkerNodeMonthlyCost = 250` → `MaxNodes = 48`.
`TotalCPU = 384` with 20 % reserved → `UsableCPU = 307`. A hand-typed `48`
still looks right after someone changes the worker-node price, which is exactly
the silently-wrong derived value `check` exists to catch.

**Why existing vocabulary does not reach it.** `ROUND(x, 0)` is half-up, not
toward −∞: `ROUND(2.5, 0)` is `3`, `FLOOR(2.5, 1)` is `2`. `TRUNC` is catalogued
`DEFERRED` and even then drops toward zero, so `TRUNC(-2.5, 0)` would be `-2`
where `FLOOR(-2.5, 1)` is `-3`. No composition of `/` and `*` produces "greatest
multiple of `s` not exceeding `x`" for a negative `x` without reintroducing the
same primitive. An input column would require the rounded value to be
hand-maintained.

This spec **does not** introduce a 1-argument `FLOOR(x)`. `FLOOR(Qty)` is a
`TYPE` arity error, the same way `ROUND(Qty)` is today ([§4](../visimark-design.md#4-syntax)).

## 2. Signature and shape

| | |
|---|---|
| Call | `FLOOR(number, significance)` |
| Kind | **map** (scalar → scalar), design [§4](../visimark-design.md#4-syntax) "Shape: map and reduce" |
| Arity | **2**, exact and checked statically ([§4](../visimark-design.md#4-syntax)) |
| `number` | a **number**; may be negative, zero, or fractional. May be a literal, a column reference, or any scalar sub-expression. |
| `significance` | a **positive number**; may be fractional (a nickel is `0.05`). Zero and negative are domain errors ([§4](#4-type-rules-and-errors)). |
| Result | a **number** — never a boolean, never a date or string ([§4](../visimark-design.md#4-syntax)) |

`FLOOR` adds no new value type and no new in-flight value. It is in the same
class as `ROUND` and `MOD`.

## 3. Semantics

For `significance = s > 0`, `FLOOR(x, s)` is the unique multiple of `s` in
the half-open interval `(x − s, x]` — equivalently `s * floor(x / s)`, where
`floor` is toward −∞. It is computed in decimal, not binary float (design
[§7](../visimark-design.md#7-numeric-semantics)): `Decimal.prototype.div`, then
`.floor()` (`ROUND_FLOOR`), then `.times(s)`. A signed zero result is
normalised to `0`, matching `roundToPlaces`.

The sign of `number` is significant; the sign of `significance` is not an
input — a non-positive `s` is refused rather than silently replaced with
`|s|` (constraint 3). Multiples of `s` and of `−s` are the same set, so
taking `|s|` would compute the same number, but it would also hide a sign the
author wrote. VisiMark refuses instead.

| Case | Input | Result | Note |
|---|---|---|---|
| Issue example, positive | `FLOOR(17, 5)` | `15` | |
| Issue example, negative `number` | `FLOOR(-12, 5)` | `-15` | toward −∞, not toward zero |
| Already a multiple | `FLOOR(15, 5)` | `15` | identity |
| Zero `number` | `FLOOR(0, 5)` | `0` | |
| Integer floor, the 1-arg spelling | `FLOOR(2.5, 1)` | `2` | `ROUND(2.5, 0)` is `3` |
| Integer floor, negative | `FLOOR(-2.5, 1)` | `-3` | toward −∞; `TRUNC` toward zero would be `-2` |
| Fractional `significance` | `FLOOR(1.23, 0.1)` | `1.2` | decimal-exact; `0.1` is exact in decimal.js |
| Fractional, already on the grid | `FLOOR(0.3, 0.1)` | `0.3` | the binary-float trap; decimal does not take this |
| Motivating `MaxNodes` | `FLOOR(12000 / 250, 1)` | `48` | |
| Motivating `UsableCPU` | `FLOOR(384 * 0.8, 1)` | `307` | `FLOOR(307.2, 1)` |
| Motivating `UsableMemory` | `FLOOR(1536 * 0.8, 1)` | `1228` | `FLOOR(1228.8, 1)` |
| Tiny positive remainder | `FLOOR(5.0001, 5)` | `5` | |
| Tiny negative remainder | `FLOOR(-0.0001, 1)` | `-1` | not `0` |
| Zero `significance` | `FLOOR(17, 0)` | — | `TYPE` ([§4](#4-type-rules-and-errors)) |
| Negative `significance` | `FLOOR(17, -5)` | — | `TYPE` ([§4](#4-type-rules-and-errors)) |

The result is rounded **once, at the binding it is assigned to**, to that
binding's inferred decimal-place count (design [§7](../visimark-design.md#7-numeric-semantics)).
`FLOOR` itself does not choose a write precision. An integer-valued result
written into a 2-dp column is `48.00`; written into a 0-dp column (or an
anchor whose current text has no decimal point) it is `48`.

## 4. Type rules and errors

`FLOOR` introduces **no new error code** — `TYPE` covers every case. There is
no `DIV0` in the [§10](../visimark-design.md#10-error-taxonomy) taxonomy.
Division by zero in `/` currently leaks `Infinity` as a value; `FLOOR` does
**not** follow that hole. A non-positive `significance` is a domain error,
the same class as `SQRT` of a negative number.

**Static, once per binding, before evaluation** (design [§4](../visimark-design.md#4-syntax)):

| Situation | Code ([§10](../visimark-design.md#10-error-taxonomy)) | Reported |
|---|---|---|
| `FLOOR(x)` / `FLOOR()` / `FLOOR(a, b, c)` — wrong arity | `TYPE` | against the span of the call, once. Message from `describeCallProblem`: `FLOOR() takes 2 arguments, got N`. |
| `FLOOR` misspelled (`FLOR`, `FLOORR`) | `TYPE` with a did-you-mean to `FLOOR` | automatic once `FLOOR` is a key of `FUNCTIONS` |

**At evaluation** (design [§8](../visimark-design.md#8-evaluation)):

| Situation | Code | Message | Notes |
|---|---|---|---|
| `number` is not a number (a date, a string, a boolean) | `TYPE` | `FLOOR expects a number` | shared `asNum` helper, same form as `ROUND` / `ABS` |
| `significance` is not a number | `TYPE` | `FLOOR expects a number` | same helper, same message — `ROUND` does not distinguish its two operands either |
| `significance` is zero or negative | `TYPE` | `FLOOR significance must be a positive number` | includes signed zero; a unit decoration is stripped first ([§7](../visimark-design.md#7-numeric-semantics)), then the bare number is tested |

### Reporting granularity

Same split as `SQRT` / `EOMONTH` (design [§4](../visimark-design.md#4-syntax), [§8](../visimark-design.md#8-evaluation)):

- **Row-data error** — an argument varies by row and a particular row's
  `significance` is non-positive, or an operand is the wrong type: **one `TYPE`
  finding on that row's cell**. Other rows still compute.
- **Scalar binding** — one `TYPE` finding on the binding.
- **Row-invariant bad operand inside a column rule** (`FLOOR(Qty, -1)` over N
  rows) currently emits N identical findings. Collapsing that is the same
  future consistency pass recorded in the `SQRT` spec; out of scope here.

## 5. Interaction with the rest of the language

- **Numeric semantics and write precision ([§7](../visimark-design.md#7-numeric-semantics)).** Ordinary decimal number; full working precision internally; rounded at the binding. `FLOOR` is not in the binary-float class that keeps `SIN` / `LN` / `PI()` deferred: `div` / `floor` / `times` are decimal operations. A reader re-adding `s * floor(x / s)` on a decimal calculator gets the same answer.
- **Units ([§7](../visimark-design.md#7-numeric-semantics)).** A unit on either operand is stripped before the arithmetic and the sign test. A computed `FLOOR` column does not inherit a unit (no dimensional analysis); it writes bare numbers until its own cells are decorated.
- **Dates ([§5](../visimark-design.md#5-dates)).** `FLOOR` neither accepts nor produces a date. `FLOOR(2026-01-15, 1)` is `TYPE`.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** A computed cell or anchor whose formula is `FLOOR(...)` is tool-owned like any computed value. No new write-back behaviour.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).** `FLOOR` is a function name, not a bindable name; both arguments resolve by the ordinary rules.
- **Function overloading.** Not decided. This primitive is arity 2 only. A later 1-arg `FLOOR(x)` would be a new vocabulary request, and would have to reopen this spec.
- **`infer`.** Never proposes `FLOOR`. Unchanged.
- **`explain`.** A `FLOOR` call appears in the rule listing like any other call. Unchanged.
- **What does not change:** the operator set, the error taxonomy (no new code), `fmt` idempotence, and the three [§13](../visimark-design.md#13-testing) acceptance documents (`example-invoice.md`, `example-invoice-drift.md`, `example-charts.md`) — none of them use `FLOOR`.

The catalogue seed row `CEILING(x, mult) / FLOOR(x, mult)` is split by this
decision: `FLOOR` is this issue; `CEILING` stays on that row and on #54.

## 6. Acceptance

Covered by **unit tests plus a test-only fixture**. The three [§13](../visimark-design.md#13-testing)
example documents are untouched. The published
`docs/example-executable-documentation.md` is rewritten to the 2-arg spelling
(`FLOOR(…, 1)`) so it does not teach a call that is a `TYPE` error; it is
**not** made into a new acceptance document (it is currently not a
check-clean VisiMark file — headers, line-continuation bindings, and name
matching are a separate job).

1. **`test/eval/functions.test.ts`**
   - `FLOOR` registered as `{ kind: "map", arity: 2 }`.
   - `callProblem("FLOOR", …)` returns `{ kind: "arity" }` for 0, 1 and 3 args,
     `null` for 2.
   - Anchor-verified: `FLOOR(17, 5)` → `15`; `FLOOR(-12, 5)` → `-15`;
     `FLOOR(15, 5)` → `15`; `FLOOR(2.5, 1)` → `2`; `FLOOR(-2.5, 1)` → `-3`;
     `FLOOR(1.23, 0.1)` → `1.2`; `FLOOR(0.3, 0.1)` → `0.3`;
     `FLOOR(12000 / 250, 1)` → `48`.
   - `FLOOR("x", 1)`, `FLOOR(2026-01-01, 1)`, `FLOOR(17, "x")` →
     `FLOOR expects a number`.
   - `FLOOR(17, 0)`, `FLOOR(17, -5)` → `FLOOR significance must be a positive number`.
   - `FLOOR(Qty)` → static `FLOOR() takes 2 arguments, got 1`.
2. **`test/eval/check.test.ts`**
   - scalar `n = FLOOR(17, 5)` with anchor `**15**` → no finding.
   - column rule with one row whose `significance` is `0` → exactly one `TYPE`
     finding on that row, other rows verified, no `NOTE`.
   - `FLOOR(Qty)` in a column rule → one static `TYPE` finding, not one per row.
3. **`test/cli/floor.test.ts` + `test/fixtures/floor-nodes.md`** — the
   kubernetes capacity arithmetic as a standalone clean document (integer
   write precision on the node/CPU/memory scalars):
   - `visimark check <fixture>` exits `0` and reports `0 problems`.
   - `visimark eval <fixture> --get kubernetes.MaxNodes` prints `48`.
   - `visimark eval <fixture> --get kubernetes.UsableCPU` prints `307`.

Expected `check` output for the clean fixture:

```
packages/visimark/test/fixtures/floor-nodes.md

  0 problems
```

## 7. Non-goals

- **A 1-argument `FLOOR(x)`**, or any function overloading. Undecided; out of
  this issue. `FLOOR(x, 1)` is the spelling for integer floor.
- **`CEILING`.** Issue #54. Not unblocked by shipping `FLOOR`.
- **`TRUNC(x, places)`.** Still `DEFERRED`; a different rounding rule (toward
  zero, by decimal places, not by a multiple).
- **Excel's same-sign rule** (`FLOOR(-12, 5)` as an error). The issue pins
  toward −∞ with that exact example.
- **Excel `FLOOR.MATH` mode argument** (direction toggle). Direction is toward
  −∞, always.
- **Fixing `/ 0` leaking `Infinity`.** Pre-existing; not this primitive's job.
  `FLOOR` simply does not leak it for `significance = 0`.
- **Changing `infer` to propose `FLOOR`.**
- **Making `docs/example-executable-documentation.md` a check-clean acceptance
  document.** Only the four `FLOOR` call sites are rewritten to arity 2.

## 8. Open questions

None.
