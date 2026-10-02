# Faster `IRR` and `NPV` evaluation — Implementation Plan

> Written after the fact. Every task below is already done on branch
> `perf/irr-npv-horner`. It records the order the work was done in and the check
> that closed each step.

**Goal:** Remove the per-term `pow` from both present-value functions, and the
roughly 525-evaluation search from `IRR`. Rates and precision verdicts stay as
they were, and `NPV`'s working value becomes the correctly rounded one.

**Architecture:** One file of engine code, `packages/visimark/src/eval/evaluate.ts`:
the `irr()` and `npv()` functions and a module-level 50-digit `decimal.js`
clone cache. One development benchmark, `packages/visimark/bench/finance.ts`. One
updated spec, `docs/vocab/npv-spec.md`.

**Tech Stack:** TypeScript, `decimal.js` (`Decimal.clone`), `bun:test`.

**Spec:** [`docs/design/irr-npv-evaluation-speed-spec.md`](irr-npv-evaluation-speed-spec.md)

## Global Constraints

- No change to the language, any finding code, any message, or the order of
  errors.
- `IRR` keeps returning a true sign-change bracket of width under 1e-40, or
  neighbouring 40-digit ends, and keeps recording it for `irrBand`.
- `Decimal.precision` stays 40 for the engine. The guard-digit clone is used
  by `npv()` only.
- Every commit carries the one `Co-Authored-By` trailer from
  [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md)
  for the session doing the commit.

---

### Task 1: Benchmark before touching the engine

**Files:** `packages/visimark/bench/finance.ts` (new),
`packages/visimark/package.json`, `packages/visimark/tsconfig.json`

- [x] Time `evalExpr` on `IRR(Cash)` and `NPV(rate, Cash)` over a 4-flow
  series and an outlay followed by 10 to 360 inflows, a high rate, a rate near −1, and an exact root. Use a 500 ms budget
  per case.
- [x] Add `"bench:finance": "bun bench/finance.ts"` and put `bench` in the
  typecheck `include`.
- [x] Record the baseline in the spec's [§1](irr-npv-evaluation-speed-spec.md#1-purpose)
  table.
- [x] Count `pow` and `div` calls for one 4-flow `IRR` (about 2,100 and
  2,500) to confirm where the time goes.

### Task 2: Keep a copy of the old engine for comparison

- [x] Copy the pre-change `evaluate.ts` outside the repository, with its
  imports rewritten to absolute paths so it loads the same `decimal.js`
  instance, at precision 40.
- [x] Write a comparison script. For random series it checks half-up rounding
  at widths 0–30 and `irrEndsDisagree` at each width, old against new. It
  does not use the presence of a band as a criterion: at a 40-digit midpoint,
  whether rounding noise reads as an exact zero is arbitrary in both engines.

### Task 3: `IRR` — Horner's rule

**Files:** `packages/visimark/src/eval/evaluate.ts`

- [x] Replace `npvAt` with `Q(b)` by Horner's rule, starting from `flows[0]`
  and multiplying by `b = rate + 1` for each later flow.
- [x] Evaluate `hi` once per bracketing iteration instead of twice, and drop
  the `sign()` helper.
- [x] Check: 1,200 random series show no difference in rounding at widths
  0–30 or in any precision verdict. About 9× faster.

### Task 4: `IRR` — the Illinois method

- [x] Keep `fLo` and `fHi` as values rather than signs.
- [x] Take a false-position step inside `(lo, hi)` and fall back to the
  midpoint when the step leaves the open interval. Stop when the midpoint
  also rounds onto an end.
- [x] Halve the stored value at the end that is kept twice in a row.
- [x] Force a bisection step after two steps that fail to halve the bracket,
  and raise the step cap from 400 to 1200.
- [x] Check: no differences over 2,000 random series. The edge series agree
  except `-1, 1e50`, where the exact root is now found. About 35–40× faster,
  at about 55 evaluations a call.

### Task 5: `IRR` — skip far `snap` candidates

- [x] Skip any candidate more than `1e-30 · max(1, |mid|)` from the midpoint.
- [x] Check: no differences over 2,000 random series. About 35 evaluations a
  call, about 40× faster.

### Task 6: `NPV` — choose the form against a reference

- [x] Compare the old sum, Horner in `1/b`, Horner in `b` with one division,
  and Horner in `b` at 45, 50, and 60 digits. Use 3,000 random series
  against a 120-digit reference and count correctly rounded results.
- [x] Pick Horner in `b` at 50 digits. It was correctly rounded in 3,000 of
  3,000 cases, against 981 for the old sum.

### Task 7: `NPV` — implement

**Files:** `packages/visimark/src/eval/evaluate.ts`,
`packages/visimark/test/eval/functions.test.ts`

- [x] Add a module-level cache of `Decimal.clone({ precision, rounding: ROUND_HALF_UP })`
  constructors by width (`wider(digits)`).
- [x] Convert every cell before any arithmetic, so a bad cell is still
  reported first.
- [x] Compute `Q(b) / b^(n-1)` at 50 digits, round with
  `toSignificantDigits(40)`, and return it as an engine `Decimal`.
- [x] Update the two full working values the test pins. Each new value equals
  the 120-digit reference rounded to 40 digits.
- [x] Check: 5,000 random series against a 150-digit reference are all
  correctly rounded. One disagreement at 0–6 decimal places, a value of
  magnitude 1e82. About 2–22× faster.

### Task 8: `NPV` — certify the rounding (from review)

Review on the PR showed that a fixed 50-digit pass can round twice. For
`NPV(1, Cash)` on `1` and `1e-39 − 1e-60`, the numerator rounds up to
`2 + 1e-39`, and the quotient then lands exactly on a 40-digit midpoint.

- [x] Write the test first: the case must evaluate to `1`. It fails on the
  fixed-width version with `1.000000000000000000000000000000000000001`.
- [x] Sum `|flow_k|` by Horner's rule in the same pass, and derive
  `err = A / b^(n-1) · (4n + 8) · 10^(1 - digits)`.
- [x] Return when `value ± err` round to the same 40 digits. Otherwise repeat
  at 100 and then 200 digits, and take the 200-digit rounding as it stands.
- [x] Check: the new test passes, 5,000 random series are still all correctly
  rounded, and the NPV benchmark is about 2× slower than the fixed-width
  version but still up to about 12× faster than the original.

### Task 9: Documents

**Files:** `docs/vocab/npv-spec.md`, `CHANGELOG.md`, this plan and its spec

- [x] `npv-spec.md`: rewrite the computation paragraph in §3, including the
  error bound and the wider retries, update the
  three full working values in the cases table and the §6 acceptance list,
  and the rounding notes in §4 and §5.
- [x] Leave `npv-plan.md` as the record of the previous implementation.
- [x] `CHANGELOG.md`: add two **Changed** entries under Unreleased. The `NPV`
  entry gives a before-and-after full working value.

### Task 10: Verify and ship

- [x] Run `bun test` across the repository, `bun run typecheck` in
  `packages/visimark`, `bun run lint`, and `bun run format:check`.
- [x] Open a PR against `master` (#331).
- [x] Answer the review. Mark the spec `<!--vmark:no-formulas-->` for the
  dogfood check. Relabel the benchmark cases as "outlay + N inflows", since
  `series(n)` returns `n + 1` flows. Qualify the CHANGELOG's declared-width
  claim at the write-time ceiling. Rebuild `docs/vendor/` with the pinned
  Bun.
- [ ] Wait for CI to go green, and merge.
