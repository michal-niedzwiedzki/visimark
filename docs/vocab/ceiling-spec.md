# CEILING — feature spec

**Status:** approved (#54) · **Date:** 2026-09-09 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/54#issuecomment-5600795875>

## 1. Purpose

`CEILING(number, significance)` returns the least multiple of `significance`
that is not less than `number` — rounding toward positive infinity. It is a map:
two numbers in, one number out. `significance` is mandatory; there is no
implicit "round to 1" default.

**The document that motivated it.** None. No document in the repo calls
`CEILING`, and this spec does not recruit one. The reason to ship it is that
`FLOOR(number, significance)` is already in the language (issue #53): the same
2-arg rounding-to-a-multiple, toward −∞. Leaving `CEILING` out would mean
"round down to a multiple" exists and "round up to a multiple" does not.

Function overloading (one name, two arities) is **undecided** in the language
and this spec does not decide it. The 2-argument form covers integer ceiling
without committing that question: `CEILING(x, 1)`. Shipping the 2-arg form now
is cheaper than shipping a 1-arg `CEILING` and later migrating every call if
the project settles on "no overloading".

The two names agree on an exact multiple (`CEILING(12000 / 250, 1)` is `48`,
same as `FLOOR`) and diverge as soon as the quotient is not whole:
`FLOOR(307 / 8, 1)` is `38` and `CEILING(307 / 8, 1)` is `39`. A hand-typed
`39` still looks right after someone changes the per-worker CPU, which is
exactly the silently-wrong derived value `check` exists to catch.

**Why existing vocabulary does not reach it.** `FLOOR(x, s)` is toward −∞:
`FLOOR(17, 5)` is `15`, not `20`. `ROUND(x, 0)` is half-up, not toward +∞, and
rounds by decimal places rather than by a multiple. `TRUNC` is catalogued
`DEFERRED` and even then drops toward zero. Adding `s` to a `FLOOR` result
fails on exact multiples: `FLOOR(15, 5) + 5` is `20` where `CEILING(15, 5)` is
`15`. Since `FLOOR` shipped, `CEILING(x, s)` is algebraically `-FLOOR(-x, s)`.
That identity is a corollary this spec will state and test; it is not a reason
to omit the name. A document that means "round up to the next 50" should say
`CEILING(load, 50)`, not a double negation a reader does not re-add on a
calculator. An input column would require the rounded value to be
hand-maintained.

This spec **does not** introduce a 1-argument `CEILING(x)`. `CEILING(Qty)` is a
`TYPE` arity error, the same way `ROUND(Qty)` and `FLOOR(Qty)` are today
([§4](../visimark-design.md#4-syntax)).

## 2. Signature and shape

| | |
|---|---|
| Call | `CEILING(number, significance)` |
| Kind | **map** (scalar → scalar), design [§4](../visimark-design.md#4-syntax) "Shape: map and reduce" |
| Arity | **2**, exact and checked statically ([§4](../visimark-design.md#4-syntax)) |
| `number` | a **number**; may be negative, zero, or fractional. May be a literal, a column reference, or any scalar sub-expression. |
| `significance` | a **positive number**; may be fractional (a nickel is `0.05`). Zero and negative are domain errors ([§4](#4-type-rules-and-errors)). |
| Result | a **number** — never a boolean, never a date or string ([§4](../visimark-design.md#4-syntax)) |

`CEILING` adds no new value type and no new in-flight value. It is in the same
class as `FLOOR`, `ROUND` and `MOD`.

## 3. Semantics

For `significance = s > 0`, `CEILING(x, s)` is the unique multiple of `s` in
the half-open interval `[x, x + s)` — equivalently `s * ceil(x / s)`, where
`ceil` is toward +∞. It is computed in decimal, not binary float (design
[§7](../visimark-design.md#7-numeric-semantics)): `Decimal.prototype.div`, then
`.ceil()` (`ROUND_CEIL`), then `.times(s)`. A signed zero result is
normalised to `0`, matching `roundToPlaces` and `FLOOR`.

The sign of `number` is significant; the sign of `significance` is not an
input — a non-positive `s` is refused rather than silently replaced with
`|s|` (constraint 3). Multiples of `s` and of `−s` are the same set, so
taking `|s|` would compute the same number, but it would also hide a sign the
author wrote. VisiMark refuses instead.

**Complementarity.** For every finite `x` and every `s > 0`,
`CEILING(x, s) == -FLOOR(-x, s)`. The two primitives are the same rounding-to-a
multiple, in opposite directions. The identity is a corollary of the
definitions, not an implementation strategy: evaluate `CEILING` with `.ceil()`,
not by calling `FLOOR`.

| Case | Input | Result | Note |
|---|---|---|---|
| Issue example, positive | `CEILING(17, 5)` | `20` | |
| Issue example, negative `number` | `CEILING(-12, 5)` | `-10` | toward +∞, not toward zero |
| Already a multiple | `CEILING(15, 5)` | `15` | identity; `FLOOR(15, 5) + 5` is `20` |
| Zero `number` | `CEILING(0, 5)` | `0` | |
| Integer ceiling, the 1-arg spelling | `CEILING(2.5, 1)` | `3` | `FLOOR(2.5, 1)` is `2`; `ROUND(2.5, 0)` is `3` |
| Integer ceiling, negative | `CEILING(-2.5, 1)` | `-2` | toward +∞; `FLOOR(-2.5, 1)` is `-3` |
| Fractional `significance` | `CEILING(1.23, 0.1)` | `1.3` | decimal-exact; `0.1` is exact in decimal.js |
| Fractional, already on the grid | `CEILING(0.3, 0.1)` | `0.3` | the binary-float trap; decimal does not take this |
| Exact multiple, integer | `CEILING(12000 / 250, 1)` | `48` | same as `FLOOR` on an exact multiple |
| Fixture `MinNodes` | `CEILING(307 / 8, 1)` | `39` | `307 / 8 = 38.375`; `FLOOR` of the same is `38` |
| Tiny positive remainder | `CEILING(5.0001, 5)` | `10` | `FLOOR` of the same is `5` |
| Tiny negative remainder | `CEILING(-0.0001, 1)` | `0` | not `-1`; `FLOOR(-0.0001, 1)` is `-1` |
| Complement of issue example | `-FLOOR(-17, 5)` | `20` | equals `CEILING(17, 5)` |
| Complement, negative | `-FLOOR(12, 5)` | `-10` | equals `CEILING(-12, 5)` |
| Zero `significance` | `CEILING(17, 0)` | — | `TYPE` ([§4](#4-type-rules-and-errors)) |
| Negative `significance` | `CEILING(17, -5)` | — | `TYPE` ([§4](#4-type-rules-and-errors)) |

The result is rounded **once, at the binding it is assigned to**, to that
binding's inferred decimal-place count (design [§7](../visimark-design.md#7-numeric-semantics)).
`CEILING` itself does not choose a write precision. An integer-valued result
written into a 2-dp column is `39.00`; written into a 0-dp column (or an
anchor whose current text has no decimal point) it is `39`.

## 4. Type rules and errors

`CEILING` introduces **no new error code** — `TYPE` covers every case. There is
no `DIV0` in the [§10](../visimark-design.md#10-error-taxonomy) taxonomy.
Division by zero in `/` currently leaks `Infinity` as a value; `CEILING` does
**not** follow that hole. A non-positive `significance` is a domain error,
the same class as `SQRT` of a negative number and `FLOOR` of a non-positive
`significance`.

**Static, once per binding, before evaluation** (design [§4](../visimark-design.md#4-syntax)):

| Situation | Code ([§10](../visimark-design.md#10-error-taxonomy)) | Reported |
|---|---|---|
| `CEILING(x)` / `CEILING()` / `CEILING(a, b, c)` — wrong arity | `TYPE` | against the span of the call, once. Message from `describeCallProblem`: `CEILING() takes 2 arguments, got N`. |
| `CEILING` misspelled (`CELING`, `CEILINGG`) | `TYPE` with a did-you-mean to `CEILING` | automatic once `CEILING` is a key of `FUNCTIONS` |

**At evaluation** (design [§8](../visimark-design.md#8-evaluation)):

| Situation | Code | Message | Notes |
|---|---|---|---|
| `number` is not a number (a date, a string, a boolean) | `TYPE` | `CEILING expects a number` | shared `asNum` helper, same form as `FLOOR` / `ROUND` / `ABS` |
| `significance` is not a number | `TYPE` | `CEILING expects a number` | same helper, same message — `FLOOR` does not distinguish its two operands either |
| `significance` is zero or negative | `TYPE` | `CEILING significance must be a positive number` | includes signed zero; a unit decoration is stripped first ([§7](../visimark-design.md#7-numeric-semantics)), then the bare number is tested |

### Reporting granularity

Same split as `FLOOR` / `SQRT` / `EOMONTH` (design [§4](../visimark-design.md#4-syntax), [§8](../visimark-design.md#8-evaluation)):

- **Row-data error** — an argument varies by row and a particular row's
  `significance` is non-positive, or an operand is the wrong type: **one `TYPE`
  finding on that row's cell**. Other rows still compute.
- **Scalar binding** — one `TYPE` finding on the binding.
- **Row-invariant bad operand inside a column rule** (`CEILING(Qty, -1)` over N
  rows) currently emits N identical findings. Collapsing that is the same
  future consistency pass recorded in the `SQRT` spec; out of scope here.

## 5. Interaction with the rest of the language

- **Numeric semantics and write precision ([§7](../visimark-design.md#7-numeric-semantics)).** Ordinary decimal number; full working precision internally; rounded at the binding. `CEILING` is not in the binary-float class that keeps `SIN` / `LN` / `PI()` deferred: `div` / `ceil` / `times` are decimal operations. A reader re-adding `s * ceil(x / s)` on a decimal calculator gets the same answer.
- **Units ([§7](../visimark-design.md#7-numeric-semantics)).** A unit on either operand is stripped before the arithmetic and the sign test. A computed `CEILING` column does not inherit a unit (no dimensional analysis); it writes bare numbers until its own cells are decorated.
- **Dates ([§5](../visimark-design.md#5-dates)).** `CEILING` neither accepts nor produces a date. `CEILING(2026-01-15, 1)` is `TYPE`.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** A computed cell or anchor whose formula is `CEILING(...)` is tool-owned like any computed value. No new write-back behaviour.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).** `CEILING` is a function name, not a bindable name; both arguments resolve by the ordinary rules.
- **Function overloading.** Not decided. This primitive is arity 2 only. A later 1-arg `CEILING(x)` would be a new vocabulary request, and would have to reopen this spec.
- **`infer`.** Never proposes `CEILING`. Unchanged.
- **`explain`.** A `CEILING` call appears in the rule listing like any other call. Unchanged.
- **What does not change:** the operator set, the error taxonomy (no new code), `fmt` idempotence, the three [§13](../visimark-design.md#13-testing) acceptance documents (`example-invoice.md`, `example-invoice-drift.md`, `example-charts.md`), and `docs/example-executable-documentation.md` — none of them use `CEILING` and none of them are edited.

The catalogue seed row `CEILING(x, mult)` is this primitive. Once this ships,
that seed is deleted and the #54 row moves to the Shipped register.

## 6. Acceptance

Covered by **unit tests plus a test-only fixture**. The three [§13](../visimark-design.md#13-testing)
example documents are untouched. `docs/example-executable-documentation.md` is
untouched.

1. **`test/eval/functions.test.ts`**
   - `CEILING` registered as `{ kind: "map", arity: 2 }`.
   - `callProblem("CEILING", …)` returns `{ kind: "arity" }` for 0, 1 and 3 args,
     `null` for 2.
   - Anchor-verified: `CEILING(17, 5)` → `20`; `CEILING(-12, 5)` → `-10`;
     `CEILING(15, 5)` → `15`; `CEILING(2.5, 1)` → `3`; `CEILING(-2.5, 1)` → `-2`;
     `CEILING(1.23, 0.1)` → `1.3`; `CEILING(0.3, 0.1)` → `0.3`;
     `CEILING(12000 / 250, 1)` → `48`; `CEILING(307 / 8, 1)` → `39`;
     `CEILING(5.0001, 5)` → `10`; `CEILING(-0.0001, 1)` → `0`.
   - Complementarity, same snippet: `CEILING(17, 5) == -FLOOR(-17, 5)`;
     `CEILING(-12, 5) == -FLOOR(12, 5)`.
   - `CEILING("x", 1)`, `CEILING(2026-01-01, 1)`, `CEILING(17, "x")` →
     `CEILING expects a number`.
   - `CEILING(17, 0)`, `CEILING(17, -5)` → `CEILING significance must be a positive number`.
   - `CEILING(Qty)` → static `CEILING() takes 2 arguments, got 1`.
2. **`test/eval/check.test.ts`**
   - scalar `n = CEILING(17, 5)` with anchor `**20**` → no finding.
   - column rule with one row whose `significance` is `0` → exactly one `TYPE`
     finding on that row, other rows verified, no `NOTE`.
   - `CEILING(Qty)` in a column rule → one static `TYPE` finding, not one per row.
3. **`test/cli/ceiling.test.ts` + `test/fixtures/ceiling-nodes.md`** — the
   inverse of the FLOOR kubernetes fixture: given a CPU demand, how many whole
   workers are needed (integer write precision):
   - `RequiredCPU = 307`, `CPUPerWorker = 8` →
     `MinNodes = CEILING(RequiredCPU / CPUPerWorker, 1)` → `39`.
   - `visimark check <fixture>` exits `0` and reports `0 problems`.
   - `visimark eval <fixture> --get kubernetes.MinNodes` prints `39`.

Expected `check` output for the clean fixture:

```
packages/visimark/test/fixtures/ceiling-nodes.md

  0 problems
```

## 7. Non-goals

- **A 1-argument `CEILING(x)`**, or any function overloading. Undecided; out of
  this issue. `CEILING(x, 1)` is the spelling for integer ceiling.
- **Editing `docs/example-executable-documentation.md`.** It does not call
  `CEILING`; this issue does not recruit it as a motivating document.
- **`TRUNC(x, places)`.** Still `DEFERRED`; a different rounding rule (toward
  zero, by decimal places, not by a multiple).
- **Excel's same-sign rule** (`CEILING(-12, 5)` as an error). The issue pins
  toward +∞ with that exact example.
- **Excel `CEILING.MATH` mode argument** (direction toggle). Direction is toward
  +∞, always.
- **Implementing `CEILING` as `-FLOOR(-x, s)`.** The identity holds and is
  tested; the evaluator uses `.ceil()`.
- **Fixing `/ 0` leaking `Infinity`.** Pre-existing; not this primitive's job.
  `CEILING` simply does not leak it for `significance = 0`.
- **Changing `infer` to propose `CEILING`.**

## 8. Open questions

None.
