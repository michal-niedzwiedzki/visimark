# Faster `IRR` and `NPV` evaluation — improvement spec

**Status:** implemented (written after the fact) · **Date:** 2026-10-02 · **Decision:** maintainer request; no issue was filed

## 1. Purpose

`IRR` was slow enough to notice in a document of a few dozen rows. A
benchmark of the engine's own `evalExpr` path under Bun 1.4.2 measured:

| Series | `IRR` | `NPV` |
|---|---|---|
| 4 flows (the brake-press fixture) | 6.4 ms | 0.007 ms |
| outlay + 36 inflows | 54 ms | 0.149 ms |
| outlay + 120 inflows | 259 ms | 0.873 ms |
| outlay + 360 inflows (30 years monthly) | 999 ms | 3.8–5.5 ms |

Both functions spent their time in one place. Every term of the present-value
sum called `Decimal.prototype.pow` for `(1 + r)^k` and then divided by it.
`NPV` does that once per call. `IRR` did it on every step of its search: about
525 present-value evaluations for a 4-flow series, because the search was a
bisection to a 1e-40-wide bracket (about 133 halvings), preceded by a
bracketing loop that evaluated `hi` twice per iteration and followed by a
`snap` that tried 21 short decimals.

This spec records the replacement algorithms, the invariants they keep, and
the one user-visible change: `NPV`'s full 40-digit working value moves in its
last digits, onto the correctly rounded value.

The language is unchanged. [`irr-spec.md`](../vocab/irr-spec.md) does not
name an algorithm, and its [§3](../vocab/irr-spec.md#3-semantics) still
holds. [`npv-spec.md`](../vocab/npv-spec.md)
[§3](../vocab/npv-spec.md#3-semantics) named `pow` per term and pinned three
full working values; it is updated by this change
([§6](#6-documents-touched)).

## 2. The surface

No command, flag, function, finding code, or message changes. A new
development script, `bun run bench:finance` in `packages/visimark`, times
both functions over fixed series. It is not part of `bun test` and is not
published.

## 3. Semantics

### 3.1 The polynomial form

With `b = 1 + r > 0` and `n` data rows,

```text
NPV(r) = Σ flows_k / b^k = (Σ flows_k · b^(n-1-k)) / b^(n-1)
```

The numerator `Q(b)` is evaluated by Horner's rule: start from `flows_0`, then
for each later flow multiply by `b` and add the flow. That is one multiply and
one add per flow, with no power and no division. Because `b^(n-1) > 0`, `Q(b)`
has the same sign as `NPV(r)` and the same roots for every `r > -1`.

### 3.2 `NPV`

`NPV` evaluates `Q(b)`, raises `b` once to `n - 1`, and divides once. Those
steps run in a `decimal.js` clone at 50 significant digits, ten guard digits
above the engine's 40.

The same pass evaluates `A(b)`, Horner's rule over `|flows_k|`, so `A(b) /
b^(n-1)` is the sum of the absolute discounted terms. Every rounding in the
pass is bounded relative to that sum, so

```text
err = A(b) / b^(n-1) · (4n + 8) · 10^(1 - digits)
```

bounds the distance between the computed quotient and the exact present
value. The factor covers the `2(n - 1)` roundings of Horner's rule, the
rounding of `b` raised to every power it reaches, and the power and the
division, with more than a twofold margin.

If `quotient − err` and `quotient + err` round half-up to the same 40
significant digits, that rounding is the exact present value's, and it is
returned. Otherwise the exact value may lie near a 40-digit rounding midpoint,
where rounding once at 50 digits and again at 40 can disagree with rounding
the exact value once. The pass then repeats at 100 digits and, if still
undecided, at 200. The 200-digit rounding is returned as it stands. That last
step is reached only when the exact value is within about 1e-198 (relative to
the absolute terms) of a midpoint or of zero, and an exact tie rounds half-up
correctly at any width.

The previous per-term sum was not correctly rounded: each term was rounded to
40 digits before the sum, and cancellation between the outlay and the inflows
cost the result its last few digits.

The wider clones are created once per width and cached in `evaluate.ts`. They
do not change `Decimal.precision` for anything else, and nothing outside
`npv()` uses them.

Error order is unchanged. The rate is checked first, then an empty column,
then each cell's type, all before any arithmetic.

### 3.3 `IRR`

`IRR` evaluates `Q(b)` at the engine's ordinary 40 digits. It only ever needs
the sign of `Q`, plus a value to interpolate with.

1. **Bracket.** `lo` stays the last rate above −1 that 40-digit arithmetic can
   tell from −1. `hi` starts at 1 and becomes `2·hi + 1` until `Q` changes
   sign, at most 200 times. Each candidate is evaluated once.
2. **Narrow.** The Illinois method replaces bisection. Each step is a
   false-position (regula falsi) step inside `(lo, hi)`. When the same end
   is kept twice in a row, the value stored at the other end is halved, so
   both ends close in rather than one sticking. Two steps in a row that fail
   to halve the bracket are followed by one bisection step, so at worst one
   step in three halves it. A candidate that rounds onto an end is replaced
   by the midpoint. A midpoint that rounds onto an end means the ends are
   neighbours at 40 significant digits, and the search stops. Otherwise it
   stops when the bracket is narrower than 1e-40, as before. The step cap is
   1200, three times the old 400, which covers the one-in-three guarantee.
3. **Signs stay exact.** The stored end values are only ever scaled by ½, a
   positive factor, so a sign comparison against them is the same comparison
   the bisection made.
4. **Snap.** `snap` still tries the half-up roundings of the midpoint to 0
   through 20 places and returns the first one at which `Q` is exactly zero.
   It now skips a candidate more than `1e-30 · max(1, |mid|)` from the
   midpoint. A short decimal that far from a bracket converged to about 38
   significant digits cannot be the root, and evaluating it was most of the
   remaining cost.
5. **Band.** When no exact root is found, the midpoint is returned and its
   `{lo, hi}` bracket is recorded for `irrBand`, exactly as before. The
   precision check in `check.ts` reads it unchanged.

## 4. Invariants

- `IRR` still returns an exact root whenever one is found, either at a search
  step or by `snap`.
- `IRR` still returns a true sign-change bracket of width under 1e-40, or
  neighbouring 40-digit ends, so `irrEndsDisagree` decides precision exactly
  as the spec requires.
- Every `IRR` error message and its order are unchanged.
- `NPV` at rate zero still equals the sum of the cells. At `b = 1`, `Q` is the
  plain sum and the division is by 1.
- Every value written at a declared width is unchanged, apart from widths at
  the write-time ceiling, where only the 40th digit can differ.

## 5. Verification

All of it was done on the implementation commit, against a copy of the
previous `evaluate.ts`.

- **`IRR`, 2,000 random series** (up to 40 flows, including series built to
  have exact short roots). Half-up rounding at every width from 0 to 30
  matched the old engine in every case, and so did the precision verdict at
  every width. The largest relative difference was about 2e-38.
- **`IRR`, edge series.** Roots between −1 and −1 + 1e-30, rates near 1e50
  and 1e59, outlays of 1e30 and 1e45 against an inflow of 1, and long runs of
  zero flows. All agree with the old engine except `-1, 1e50`, where the old
  bisection returned 1e50 with a bracket 1.5e11 wide and the new search finds
  the exact root, 1e50. The old result would have been a `PRECISION` finding
  at any declared width.
- **`NPV`, the double-rounding case from review.** `NPV(1, Cash)` on `1` and
  `1e-39 − 1e-60` is `1 + 5e-40 − 5e-61`, just below the midpoint between `1`
  and `1 + 1e-39`. A single 50-digit pass rounds the numerator up to
  `2 + 1e-39` and then lands exactly on the midpoint, returning `1 + 1e-39`.
  The bounded pass cannot decide at 50 digits, repeats at 100, and returns
  `1`. A test in `functions.test.ts` pins it.
- **`NPV`, 5,000 random series** (up to 200 flows, rates from −0.9 to 0.9,
  checked against a 150-digit reference). The new value equals the reference
  rounded to 40 significant digits in 5,000 cases, the old one in 1,119. The
  two disagreed at 0 to 6 decimal places only once: a value of magnitude 1e82,
  where only the 40th digit differs.
- **Candidates rejected for `NPV`** (3,000 series against a 120-digit
  reference):
  - Horner in `1/b` at 40 digits was correctly rounded in 1,056 cases, with
    errors up to 181 ulp.
  - Horner in `b` at 40 digits was correctly rounded in 878 cases, with errors
    up to 21 ulp.
  - The guard-digit form was correctly rounded in all 3,000, with 5, 10, or 20
    guard digits alike. Ten was kept for headroom against cancellation. A
    fixed width cannot guarantee it, though (see the review case above),
    which is why the error bound and the wider retries were added. They cost
    about half the speed gained, through the second Horner sum.
- The full repository suite passes.

Measured after the change, in the same harness as [§1](#1-purpose):

| Series | `IRR` | `NPV` |
|---|---|---|
| 4 flows | 0.10–0.15 ms | 0.008 ms |
| outlay + 36 inflows | 2.0–2.4 ms | 0.035 ms |
| outlay + 120 inflows | 3.8–4.0 ms | 0.115 ms |
| outlay + 360 inflows | 10.3–12.4 ms | 0.33–0.46 ms |

## 6. Documents touched

- [`npv-spec.md`](../vocab/npv-spec.md):
  - [§3](../vocab/npv-spec.md#3-semantics) now describes the
    Horner-and-guard-digit computation instead of a `pow` per term.
  - The three full working values in its cases table and in its
    [§6](../vocab/npv-spec.md#6-acceptance) acceptance list move to the
    correctly rounded ones.
  - Its [§4](../vocab/npv-spec.md#4-type-rules-and-errors) and
    [§5](../vocab/npv-spec.md#5-interaction-with-the-rest-of-the-language)
    notes on rounding say 50 digits for intermediate steps and 40 for the
    result.
- [`npv-plan.md`](../vocab/npv-plan.md) is a historical plan. It keeps the
  old values as the record of what that implementation produced.
- [`irr-spec.md`](../vocab/irr-spec.md) needs no change. It requires a
  bracketed search and the printed rate, not an algorithm.
- `CHANGELOG.md` gains two **Changed** entries, one naming the `NPV`
  trailing-digit change with a before-and-after value.

## 7. Non-goals

- **Changing the declared-precision rules.** Only the width of intermediate
  `NPV` arithmetic moves.
- **Raising `IRR`'s working precision.** `IRR` does not need a correctly
  rounded `Q`, only its sign at points the bracket can tell apart.
- **Newton's method for `IRR`.** It would need a derivative evaluation per
  step and a separate fallback to keep a bracket. The Illinois method keeps
  the bracket by construction, which is what `irrBand` depends on.
- **`PMT`.** It makes a single `pow` call and was not slow.

<!--vmark:no-formulas-->
