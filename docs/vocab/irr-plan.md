# IRR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `IRR(flows)` — the sixteenth builtin, the unique rate at which `NPV` of that column is zero — per `docs/vocab/irr-spec.md`, and make `ref` and the live docs count sixteen functions, including `IRR`, `NPV`, and `PMT`.

**Architecture:** `IRR` is an ordinary one-column reduce (`column: 0`, arity 1). The shape machinery `NPV` added already gates argument 0. Evaluation is a new branch beside `NPV` in `eval/evaluate.ts`: read the column, refuse the `TYPE` cases, then isolate the unique root by bisection at the engine's existing 40-significant-digit precision. An exact root is returned as that short decimal. An inexact root keeps a bracket on the returned `Decimal`. `check.ts` consults that bracket when a width is about to be written, and emits `PRECISION` when the two ends do not round to the same decimals. `derivePrecision` needs no new arm. The reference entry is an `FnDoc`. `infer` does not gain `IRR`.

**Tech Stack:** TypeScript; `decimal.js` (already the numeric core); Bun test runner; the engine package `packages/visimark`.

**Spec:** `docs/vocab/irr-spec.md`

## Global Constraints

- No new npm dependencies. No new module. No new [§10](../visimark-design.md#10-error-taxonomy) code. Do not call `Decimal.set`.
- No change to `parse/`, `model/`, `write/`, `infer/`, or the `NPV` / `PMT` function bodies. `infer` never proposes `IRR`. Do not add `IRR` to `REDUCES` in `infer/propose.ts`.
- `FUNCTION_TABLE` gains `IRR: { kind: "reduce", arity: 1, column: 0 }` next to `NPV`. `SUM` stays `{ kind: "reduce", arity: 1, column: 0 }`. `NPV` stays `{ kind: "reduce", arity: 2, column: 1 }`.
- `FnDoc.precision` is `{ from: "declared" }`. No `rounding` field. Do not add a `case "IRR"` in `eval/precision.ts`. The `default` arm returns `null`. Update the comment in `precision.ts` that lists `Division, AVG, SQRT, PMT and NPV` so it also names `IRR`.
- Messages, verbatim, in this order. Empty column → `IRR() of an empty column`. A non-number cell, blank included → `IRR expects a number`. Every cell zero → `IRR() of an all-zero column`. No sign change → `IRR needs one sign change`. More than one sign change → `IRR has more than one sign change`. A root whose half-up form at declared width `N` is not fixed by the 40-digit bracket → `IRR did not determine a rate at precision N`.
- Wrong arity is `IRR() takes 1 argument, got N`, once per binding. An expression argument is `IRR() takes a column reference, not an expression`. A scalar in the column slot is `IRR() expects a column`. `SUM(someScalar)` keeps today's behaviour.
- Zeros do not count as a sign change. A blank is not zero and is not skipped. Row `k` is the data-row index. The header is not a period. The formula is `NPV`'s, row 0 undiscounted. There is no guess argument.
- The printed rate is the half-up rounding of the unique root. It does not make `NPV` print as zero. Exact roots return a decimal whose `toString()` is `0.1` or `0`, not a 40-digit neighbour.
- An unanchored scalar keeps full working precision. `ROUND(IRR(...), 4)` derives its width from `ROUND` and rounds that working value; it does not take the undetermined-rate path. The undetermined-rate path runs only when the value about to be rounded is the `Decimal` `IRR` itself returned, and a declared width is in force. The write-time ceiling still wins when integer digits plus the width exceed 40.
- A row-invariant failure over N rows emitting N findings is accepted. Do not add row-variance analysis.
- Work in the worktree `/home/michal/Projects/visimark-irr` on branch `vocab/issue-158-irr-impl` (draft PR #167). Do not open a new PR. Do not close issue #158. Do not switch the main checkout off its current branch.
- `docs/example-invoice.md`, `docs/example-charts.md`, and `docs/example-invoice-drift.md` stay byte-identical. Do not edit `.github/ISSUE_TEMPLATE/`.
- Every commit ends with the one `Co-Authored-By` trailer from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session doing the commit. Do not copy a trailer out of this plan, an older plan, or an older commit.

## Review Focus

These are the inputs a root-finder would get wrong. Each one has a test in the task named here.

1. `-100, 0, 60` has one sign change and a negative rate; `-100, 230, -132` is `IRR has more than one sign change` — Task 1.
2. A column of zeros is `IRR() of an all-zero column`, including one row of `0`; a blank between numbers is `IRR expects a number` — Task 1.
3. `IRR(rate)` where `rate` is a scalar is `IRR() expects a column`. `IRR(Cash * 1)` is the shape error — Task 1.
4. Anchored precision 39 on `-1000, 600, 600` is `IRR did not determine a rate at precision 39`. Precision 38 on that column writes `0.13066238629180748525842627449074920102`. Precision 40 is the existing ceiling message — Task 2.
5. The motivating `%` anchor text is `12.04%` while `eval --get project.rate` prints `0.1204`. `NPV` and `PMT` stay in the sixteen-name `ref --json` list — Task 3 and Task 4.

---

### Task 1: evaluate `IRR`

**Files:**
- Modify: `packages/visimark/src/eval/functions.ts` (the `IRR` row)
- Modify: `packages/visimark/src/eval/evaluate.ts` (`evalCall`, new `irr`)
- Modify: `packages/visimark/src/eval/graph.ts` (the scalar-in-column check, today `node.name === "NPV"`)
- Modify: `packages/visimark/src/eval/precision.ts` (comment only)
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Consumes: `asNum`, `num`, `EvalError`, `env.vector`, `Decimal`, `roundToPlaces` is not used here. `callProblem` and `describeCallProblem` already handle arity and shape from `FnSpec`.
- Produces: `FUNCTIONS.get("IRR")` is `{ kind: "reduce", arity: 1, column: 0 }`. `irr(vec: Value[]): Value` throws `EvalError` with the messages in Global Constraints, or returns `{ t: "num", d }` whose `d` is the exact root when one was proved (`toString()` `0.1` or `0`) and otherwise the midpoint of the bracket. `export function irrBand(d: Decimal): { lo: Decimal; hi: Decimal } | undefined` returns the bracket when `lo` and `hi` round apart at some width, and `undefined` when the root is exact. `graph.ts` pushes `{ kind: "not-column" }` for a scalar `IRR` argument the same way it does for `NPV`.

- [ ] **Step 1: Install and expect `IRR` in the builtin list (RED)**

From the worktree root:

```bash
bun install
```

In `test/eval/functions.test.ts`, the test `"every builtin declares a kind and an arity"` lists the sorted keys. Insert `"IRR"` between `"IF"` and `"MAX"`:

```ts
    "IF",
    "IRR",
    "MAX",
```

In `"the reduces are exactly the aggregates"`, expect:

```ts
  expect(reduces).toEqual(["AVG", "COUNT", "IRR", "MAX", "MIN", "NPV", "SUM"]);
```

In `"the function table and the exported map agree"`, change `toHaveLength(15)` to `toHaveLength(16)`.

- [ ] **Step 2: Add the behaviour tests (RED)**

Append at the end of `test/eval/functions.test.ts`. `run` is already `check(build(locate(src)))`. `typeFindings` is already defined.

```ts
// ---- IRR ------------------------------------------------------------

const irrDoc = (rule: string, rows: string) => `
| Cash |
|-----:|
${rows}
\`\`\`vmark #t
rate = ${rule}
\`\`\`
`;

test("IRR is a reduce of arity 1 whose column is argument 0", () => {
  expect(FUNCTIONS.get("IRR")).toEqual({ kind: "reduce", arity: 1, column: 0 });
  expect(FUNCTIONS.get("NPV")).toEqual({ kind: "reduce", arity: 2, column: 1 });
  expect(isReduce("IRR")).toBe(true);
  expect(callProblem("IRR", [{ type: "ref" }])).toBeNull();
  expect(callProblem("IRR", [])).toEqual({ kind: "arity", expected: 1, got: 0 });
  expect(callProblem("IRR", [{ type: "ref" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 1,
    got: 2,
  });
  expect(callProblem("IRR", [{ type: "binary" }])).toEqual({ kind: "shape" });
  expect(callProblem("IRR", [{ type: "num" }])).toEqual({ kind: "shape" });
});

test("IRR exact roots and the rounded motivating rates", () => {
  const src = `
| Cash |
|-----:|
| -48000 |
|  20000 |
|  20000 |
|  20000 |

\`\`\`vmark #press
rate = IRR(Cash)
\`\`\`

| Cash |
|-----:|
| -1000 |
|   600 |
|   600 |

\`\`\`vmark #two
rate = IRR(Cash)
\`\`\`

| Cash |
|-----:|
| -100 |
|  110 |

\`\`\`vmark #tenth
rate = IRR(Cash)
\`\`\`

| Cash |
|-----:|
| -100 |
|    0 |
|  121 |

\`\`\`vmark #mid
rate = IRR(Cash)
\`\`\`

| Cash |
|-----:|
| -200 |
|  100 |
|  100 |

\`\`\`vmark #zero
rate = IRR(Cash)
\`\`\`

| Cash |
|-----:|
| -100 |
|    0 |
|   60 |

\`\`\`vmark #neg
rate = IRR(Cash)
\`\`\`

| Cash |
|-----:|
|  100 |
|  -40 |
|  -40 |

\`\`\`vmark #first
rate = IRR(Cash)
\`\`\`

| Cash |
|-----:|
| -100 PLN |
|  110 PLN |

\`\`\`vmark #unit
rate = IRR(Cash)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  const str = (id: string) => {
    const v = r.values.get(id);
    if (!v || v.t !== "num") throw new Error(id);
    return v.d;
  };
  const places = (id: string, n: number) => str(id).toDecimalPlaces(n).toFixed(n);
  expect(places("press.rate", 4)).toBe("0.1204");
  expect(places("press.rate", 2)).toBe("0.12");
  expect(places("two.rate", 4)).toBe("0.1307");
  expect(places("two.rate", 2)).toBe("0.13");
  expect(places("two.rate", 38)).toBe("0.13066238629180748525842627449074920102");
  expect(str("tenth.rate").toString()).toBe("0.1");
  expect(str("mid.rate").toString()).toBe("0.1");
  expect(str("zero.rate").toString()).toBe("0");
  expect(places("neg.rate", 4)).toBe("-0.2254");
  expect(places("first.rate", 4)).toBe("-0.1367");
  expect(str("unit.rate").toString()).toBe("0.1");
});

test("IRR refuses empty, blank, zero, and the wrong number of sign changes", () => {
  const msg = (rows: string) => typeFindings(run(irrDoc("IRR(Cash)", rows)).findings)[0]?.message;
  expect(msg("")).toBe("IRR() of an empty column");
  expect(msg("| 10 |\n|    |\n|  5 |")).toBe("IRR expects a number");
  expect(msg("| 10 |\n| no |\n|  5 |")).toBe("IRR expects a number");
  expect(msg("| 10 |\n| 2026-01-01 |")).toBe("IRR expects a number");
  expect(msg("| 0 |\n| 0 |\n| 0 |")).toBe("IRR() of an all-zero column");
  expect(msg("| 0 |")).toBe("IRR() of an all-zero column");
  expect(msg("| -1000 |\n|  600 |")).toBe("IRR needs one sign change");
  expect(msg("| 100 |")).toBe("IRR needs one sign change");
  expect(msg("| -100 |\n|  230 |\n| -132 |")).toBe("IRR has more than one sign change");
});
```

- [ ] **Step 3: Run the new tests to verify they fail**

```bash
bun test packages/visimark/test/eval/functions.test.ts
```

Expected: FAIL. `FUNCTIONS.get("IRR")` is `undefined`, and the sorted key list does not contain `"IRR"`.

- [ ] **Step 4: Register `IRR` and solve it**

In `FUNCTION_TABLE`, after `NPV`:

```ts
  IRR: { kind: "reduce", arity: 1, column: 0 },
```

In `eval/graph.ts`, the comment and the condition that today mention only `NPV` become: `NPV` and `IRR` report a scalar in the column slot. The older reduces still fall through `Unevaluable` with no finding.

```ts
          if (!problem && (node.name === "NPV" || node.name === "IRR")) {
```

In `eval/precision.ts`, add `` `IRR` `` to the comment that names the declared-width functions. No new `case`.

In `eval/evaluate.ts`, import nothing new. `Decimal` is already imported. Add the band table next to the other helpers, and branch before `aggregate`:

```ts
const irrBands = new WeakMap<Decimal, { lo: Decimal; hi: Decimal }>();

/** The bracket `IRR` isolated, when the returned decimal is not an exact root. */
export function irrBand(d: Decimal): { lo: Decimal; hi: Decimal } | undefined {
  return irrBands.get(d);
}
```

Inside `evalCall`, after the `NPV` branch:

```ts
    if (name === "IRR") return irr(env.vector(arg));
```

Then the function. `npvAt` is the same sum `npv` already computes, on decimals, so a later edit to `NPV`'s formula has to be repeated here on purpose: this plan does not refactor `npv`.

```ts
function irr(vec: Value[]): Value {
  if (vec.length === 0) throw new EvalError("IRR() of an empty column");
  const flows = vec.map((v) => asNum(v, "IRR"));
  if (flows.every((f) => f.isZero())) throw new EvalError("IRR() of an all-zero column");
  let changes = 0;
  let prev: Decimal | null = null;
  for (const f of flows) {
    if (f.isZero()) continue;
    if (prev !== null && prev.isNegative() !== f.isNegative()) changes++;
    prev = f;
  }
  if (changes === 0) throw new EvalError("IRR needs one sign change");
  if (changes > 1) throw new EvalError("IRR has more than one sign change");

  const sum = flows.reduce((acc, f) => acc.plus(f), new Decimal(0));
  if (sum.isZero()) return num(new Decimal(0));

  const npvAt = (rate: Decimal): Decimal => {
    let s = new Decimal(0);
    const base = rate.plus(1);
    for (let k = 0; k < flows.length; k++) s = s.plus(flows[k]!.div(base.pow(k)));
    return s;
  };
  const sign = (rate: Decimal): number => {
    const v = npvAt(rate);
    if (v.isZero()) return 0;
    return v.isNeg() ? -1 : 1;
  };
  let lo = new Decimal(-1).plus(new Decimal(10).pow(-30));
  let hi = new Decimal(1);
  const sLo = sign(lo);
  if (sLo === 0) return num(lo);
  let guard = 0;
  while (sign(hi) === sLo && guard < 200) {
    hi = hi.times(2).plus(1);
    guard++;
  }
  if (sign(hi) === 0) return num(hi);
  if (sign(hi) === sLo) throw new EvalError("IRR did not determine a rate at precision 0");
  for (let i = 0; i < 400; i++) {
    const mid = lo.plus(hi).div(2);
    const sm = sign(mid);
    if (sm === 0) return num(snap(mid));
    if (sm === sLo) lo = mid;
    else hi = mid;
    if (hi.minus(lo).lt(new Decimal(10).pow(-40))) break;
  }
  const mid = lo.plus(hi).div(2);
  const snapped = snap(mid);
  if (npvAt(snapped).isZero()) return num(snapped);
  irrBands.set(mid, { lo, hi });
  return num(mid);

  function snap(mid: Decimal): Decimal {
    for (let p = 0; p <= 20; p++) {
      const c = mid.toDecimalPlaces(p, Decimal.ROUND_HALF_UP);
      if (c.gt(-1) && npvAt(c).isZero()) return c.isZero() ? new Decimal(0) : c;
    }
    return mid;
  }
}
```

`num(mid)` keeps the same `Decimal` object (`num` does not copy an existing `Decimal`), so `irrBand` still finds the bracket on the value `check` holds.

- [ ] **Step 5: Run the function tests**

```bash
bun test packages/visimark/test/eval/functions.test.ts
```

Expected: PASS. If `0.1` comes back as a 40-digit neighbour, the snap loop did not see an exact `npvAt`. Fix the snap, do not loosen the assertion.

- [ ] **Step 6: Commit**

```bash
git add packages/visimark/src/eval/functions.ts packages/visimark/src/eval/evaluate.ts packages/visimark/src/eval/graph.ts packages/visimark/src/eval/precision.ts packages/visimark/test/eval/functions.test.ts
git commit -m "$(printf 'feat: evaluate IRR\n\n%s' '<trailer>')"
```

`<trailer>` is the one `Co-Authored-By` line from `.agents/rules/ai-attribution.md` for this session.

### Task 2: write the rate, and refuse an undetermined width

**Files:**
- Modify: `packages/visimark/src/eval/check.ts` (`evalScalar` and `evalColumn`, next to `emitCeiling`)
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: `irrBand` from `evaluate.ts`. `roundToPlaces` from `value.ts`. `emit`, `unevaluable`, `governingPrecision`, `exceedsWorkingPrecision`.
- Produces: when `irrBand(v0.d)` is set, `prec !== null`, and `roundToPlaces(lo, prec)` is not equal to `roundToPlaces(hi, prec)`, one `PRECISION` finding whose message is `` `IRR did not determine a rate at precision ${prec}` ``, and the binding is unevaluable. The ceiling check still runs first.

- [ ] **Step 1: Write the failing check tests (RED)**

Append to `test/eval/check.test.ts`. `run` is already defined in that file.

```ts
const irrAnchored = (rule: string, anchor: string, rows: string) => `
The rate is **${anchor}**<!--vmark=t.rate-->.

| Cash |
|-----:|
${rows}

\`\`\`vmark #t
${rule}
\`\`\`
`;

const pressRows = `| -48000.00 |\n|  20000.00 |\n|  20000.00 |\n|  20000.00 |`;
const twoRows = `| -1000.00 |\n|   600.00 |\n|   600.00 |`;

test("IRR at precision 4 anchored 0.1204 is clean, and the percent anchor is 12.04%", () => {
  const plain = run(irrAnchored("rate precision 4 = IRR(Cash)", "0.1204", pressRows));
  expect(plain.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  const pct = `
The series earns **12.04%**<!--vmark=t.rate-->.

| Cash |
|-----:|
${pressRows}

\`\`\`vmark #t
rate precision 4 = IRR(Cash)
\`\`\`
`;
  expect(run(pct).findings.filter((f) => f.code !== "WARN")).toEqual([]);
});

test("a stale IRR anchor names the rounded rate", () => {
  const r = run(irrAnchored("rate precision 4 = IRR(Cash)", "0.1200", pressRows));
  const stale = r.findings.filter((f) => f.code === "STALE");
  expect(stale).toHaveLength(1);
  expect(stale[0]!.computed).toBe("0.1204");
});

test("an anchored IRR with no precision clause is PRECISION", () => {
  const r = run(irrAnchored("rate = IRR(Cash)", "0.1204", pressRows));
  const p = r.findings.filter((f) => f.code === "PRECISION");
  expect(p).toHaveLength(1);
  expect(p[0]!.message).toContain("`IRR(Cash)` has no derivable precision");
});

test("an unanchored IRR and ROUND(IRR, 4) are clean", () => {
  const raw = `
| Cash |
|-----:|
${pressRows}

\`\`\`vmark #t
raw = IRR(Cash)
shown = ROUND(IRR(Cash), 4)
\`\`\`

Shown **0.1204**<!--vmark=t.shown-->.
`;
  expect(run(raw).findings.filter((f) => f.code !== "WARN")).toEqual([]);
});

test("precision 39 on the two-period series is undetermined, 38 is written, 40 is the ceiling", () => {
  const wide = "0.13066238629180748525842627449074920102";
  const at38 = run(irrAnchored("rate precision 38 = IRR(Cash)", wide, twoRows));
  expect(at38.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  const at39 = run(irrAnchored("rate precision 39 = IRR(Cash)", wide, twoRows));
  const p = at39.findings.filter((f) => f.code === "PRECISION");
  expect(p).toHaveLength(1);
  expect(p[0]!.message).toBe("IRR did not determine a rate at precision 39");
  const at40 = run(irrAnchored("rate precision 40 = IRR(Cash)", "0.13", twoRows));
  expect(at40.findings.filter((f) => f.code === "PRECISION")[0]!.message).toContain(
    "40-significant-digit working precision",
  );
});

test("IRR shape errors and a scalar column argument", () => {
  const shape = run(`
| Cash |
|-----:|
| -100 |
|  110 |

\`\`\`vmark #t
rate precision 4 = IRR(Cash * 1)
\`\`\`
`);
  expect(shape.findings.find((f) => f.code === "TYPE")?.message).toBe(
    "IRR() takes a column reference, not an expression",
  );
  const arity = run(`
\`\`\`vmark #t
rate precision 4 = IRR()
\`\`\`
`);
  expect(arity.findings.find((f) => f.code === "TYPE")?.message).toBe(
    "IRR() takes 1 argument, got 0",
  );
  const scalar = run(`
\`\`\`vmark #t
known precision 2 = 0.08
rate precision 4 = IRR(known)
\`\`\`
`);
  expect(scalar.findings.find((f) => f.code === "TYPE")?.message).toBe("IRR() expects a column");
});

test("a computed cash column with one bad row leaves IRR silent", () => {
  const src = `
| n | Cash |
|--:|-----:|
| 1 |    0 |
| 0 |    0 |
| 1 |    0 |

\`\`\`vmark #t
Cash = 1 / n
rate precision 4 = IRR(Cash)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.some((f) => f.message?.includes("IRR"))).toBe(false);
  expect(r.findings.some((f) => f.code === "TYPE")).toBe(true);
});

test("a blank in the cash column makes the assert a NOTE", () => {
  const src = `
| Cash |
|-----:|
| -100 |
|      |
|  110 |

\`\`\`vmark #t
rate precision 4 = IRR(Cash)
assert rate > 0
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.code === "TYPE")).toHaveLength(1);
  expect(r.findings.find((f) => f.code === "TYPE")?.message).toBe("IRR expects a number");
  expect(r.findings.some((f) => f.code === "NOTE")).toBe(true);
  expect(r.findings.some((f) => f.code === "ASSERT")).toBe(false);
});
```

- [ ] **Step 2: Run to verify the new assertions fail**

```bash
bun test packages/visimark/test/eval/check.test.ts -t "IRR"
```

Expected: FAIL. Precision 39 currently writes a number. The shape and blank tests may already pass from Task 1; the precision-39 message will not.

- [ ] **Step 3: Refuse the undetermined width in `check.ts`**

Import `irrBand` from `./evaluate.js`. Add this next to `emitCeiling`:

```ts
  function rejectUndeterminedIrr(
    binding: Binding,
    v0: Value,
    prec: number | null,
    rowLabel?: string,
  ): boolean {
    if (prec === null || v0.t !== "num") return false;
    const band = irrBand(v0.d);
    if (!band) return false;
    if (roundToPlaces(band.lo, prec).eq(roundToPlaces(band.hi, prec))) return false;
    emit(
      {
        code: "PRECISION",
        sheetId: binding.sheetId,
        name: binding.name,
        ...(rowLabel === undefined ? {} : { rowLabel }),
        message: `IRR did not determine a rate at precision ${prec}`,
        span: binding.span,
      },
      { sheetId: binding.sheetId },
    );
    unevaluable.add(binding.id);
    return true;
  }
```

In `evalScalar`, after the `exceedsWorkingPrecision` block and before `const v = prec === null ? v0 : roundValue(...)`:

```ts
      if (rejectUndeterminedIrr(binding, v0, prec)) return;
```

In `evalColumn`, after the ceiling block and before `const v = prec === null ? v0 : roundValue(...)`:

```ts
        if (rejectUndeterminedIrr(binding, v0, prec, rowLabel(table, r))) return;
```

`roundToPlaces` is already imported in `check.ts` if `roundValue` uses it from `value.ts`. If it is not in scope, import `{ roundToPlaces }` from `./value.js`. Do not import it twice.

- [ ] **Step 4: Run the check tests**

```bash
bun test packages/visimark/test/eval/check.test.ts packages/visimark/test/eval/functions.test.ts
```

Expected: PASS. If precision 39 does not fire, the bracket ends are rounding to the same 39-decimal string. Narrow the bisection stop in Task 1 until `lo` and `hi` still disagree at 39 places on `-1000, 600, 600`, and still agree at 38. Do not change the expected strings.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/eval/check.ts packages/visimark/test/eval/check.test.ts
git commit -m "$(printf 'feat: IRR write precision\n\n%s' '<trailer>')"
```

### Task 3: reference entry, and `ref` lists sixteen

**Files:**
- Modify: `packages/visimark/src/lang/reference.ts`
- Test: `packages/visimark/test/lang/reference.test.ts`
- Test: `packages/visimark/test/lang/reference-examples.test.ts` (data-driven; no new test function)
- Test: `packages/visimark/test/cli/ref.test.ts`

**Interfaces:**
- Consumes: `FunctionName` now includes `"IRR"`, so `FUNCTION_DOCS` does not typecheck until the entry exists.
- Produces: `describeFunction("IRR")` and three executed examples: `IRR(t.Cash)` is `0.1`, `0.1`, and `0`. `functionNames()` and `ref --json` have length 16, and the JSON names include `IRR`, `NPV`, and `PMT`.

- [ ] **Step 1: Expect sixteen names (RED)**

In `test/lang/reference.test.ts`, rename `functionNames lists all fifteen` to `functionNames lists all sixteen` and expect `16`.

In `test/cli/ref.test.ts`, `ref --json with no name lists every function` expects `16`. `functions` is an array of objects with `name` (`publicFnEntry` in `cli/commands.ts`). Add, after the length assertion:

```ts
  const names = JSON.parse(c.out()).functions.map((f: { name: string }) => f.name);
  expect(names).toEqual(expect.arrayContaining(["IRR", "NPV", "PMT"]));
```

- [ ] **Step 2: Run to verify failure**

```bash
bun test packages/visimark/test/lang/reference.test.ts packages/visimark/test/cli/ref.test.ts
```

Expected: FAIL on the length, and typecheck would fail once `IRR` is in `FUNCTION_TABLE` without an `FnDoc`. Task 1 already added the table row, so `bun run typecheck` is currently red until this entry exists. That is expected. Do not delete the table row.

- [ ] **Step 3: Add the `FnDoc`**

In `reference.ts`, after the `NPV` entry, add `IRR`. Three `given` tables, each a sheet `t` with a `Cash` column and an empty vmark block, matching `CASH` / `ONE` / `PAIR` above `FUNCTION_DOCS`.

```ts
const IRR_TENTH = `| Cash |
|-----:|
| -100 |
|  110 |

\`\`\`vmark #t
\`\`\`
`;

const IRR_MID = `| Cash |
|-----:|
| -100 |
|    0 |
|  121 |

\`\`\`vmark #t
\`\`\`
`;

const IRR_ZERO = `| Cash |
|-----:|
| -200 |
|  100 |
|  100 |

\`\`\`vmark #t
\`\`\`
`;
```

```ts
  IRR: {
    summary:
      "rate at which a cash-flow column has present value zero; row 0 is undiscounted",
    params: [
      {
        name: "flows",
        type: "column",
        note: "cash flows in time order; the first row is period 0; exactly one sign change",
      },
    ],
    returns: "number",
    precision: { from: "declared" },
    errors: [
      { when: "an empty column", code: "TYPE" },
      { when: "a non-numeric cell", code: "TYPE" },
      { when: "an all-zero column", code: "TYPE" },
      { when: "a column with no sign change", code: "TYPE" },
      { when: "a column with more than one sign change", code: "TYPE" },
      { when: "a rate not determined at the declared width", code: "PRECISION" },
      { when: "a `flows` argument that is not a column", code: "TYPE" },
    ],
    examples: [
      { expr: "IRR(t.Cash)", is: "0.1", given: IRR_TENTH },
      { expr: "IRR(t.Cash)", is: "0.1", given: IRR_MID },
      { expr: "IRR(t.Cash)", is: "0", given: IRR_ZERO },
    ],
    see: ["NPV", "PMT"],
  },
```

`see` must name functions that exist. `NPV` and `PMT` do.

- [ ] **Step 4: Run the reference tests**

```bash
bun test packages/visimark/test/lang/reference-examples.test.ts packages/visimark/test/lang/reference.test.ts packages/visimark/test/cli/ref.test.ts
```

Expected: PASS, including `IRR: IRR(t.Cash) is 0.1` twice, `IRR: IRR(t.Cash) is 0`, and `functionNames lists all sixteen`.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/lang/reference.ts packages/visimark/test/lang/reference.test.ts packages/visimark/test/cli/ref.test.ts
git commit -m "$(printf 'docs: reference entry for IRR\n\n%s' '<trailer>')"
```

### Task 4: the brake-press fixture

**Files:**
- Create: `packages/visimark/test/fixtures/irr-press.md`
- Create: `packages/visimark/test/cli/irr.test.ts`

**Interfaces:**
- Consumes: `runCli` from `src/cli/main.ts`, the same harness as `test/cli/npv.test.ts`.
- Produces: `check` exits 0 with `` `  0 problems (0 stale, 0 errors)` ``. `eval --get project.rate` prints `0.1204`. `eval --get project.hurdle` prints `0.08`.

- [ ] **Step 1: Write the fixture and the test (RED until the engine from Task 1–2 is present; it is)**

`packages/visimark/test/fixtures/irr-press.md`, byte for byte the note in spec §1 (the markdown inside the fence, not the fence):

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

`packages/visimark/test/cli/irr.test.ts`, copied from `npv.test.ts` with the names changed:

```ts
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const fixture = fileURLToPath(new URL("../fixtures/irr-press.md", import.meta.url));

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the brake-press rate note exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe(`${fixture}\n\n  0 problems (0 stale, 0 errors)`);
  expect(c.err()).toBe("");
});

test("eval --get prints the rate and the hurdle", async () => {
  const rate = capture();
  expect(await runCli(["eval", fixture, "--get", "project.rate"], rate.io)).toBe(0);
  expect(rate.out()).toBe("0.1204");

  const hurdle = capture();
  expect(await runCli(["eval", fixture, "--get", "project.hurdle"], hurdle.io)).toBe(0);
  expect(hurdle.out()).toBe("0.08");
});
```

- [ ] **Step 2: Run it**

```bash
bun test packages/visimark/test/cli/irr.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/visimark/test/fixtures/irr-press.md packages/visimark/test/cli/irr.test.ts
git commit -m "$(printf 'test: brake-press IRR fixture\n\n%s' '<trailer>')"
```

### Task 5: documentation

This is the last task. It moves the catalogue row, regenerates the builtin table, and makes every live count say sixteen, with `IRR`, `NPV`, and `PMT` all named.

**Files:**
- Modify: `docs/visimark-design.md` (the §4 count sentence and parenthetical; the generated table via `gen:docs`; §14 "beyond the fifteen" only)
- Modify: `docs/function-reference.md` (generated; do not hand-edit)
- Modify: `docs/vocabulary-catalogue.md` (preface count; section C current-set sentence; delete the section C `IRR` row; prepend a Shipped row)
- Modify: `docs/cli-reference.md` (the `ref` row that says fifteen)
- Modify: `docs/tutorial.md` (the three sentences that say fifteen functions: around the "two kinds of binding" line, the bare `visimark ref` line, and the function-reference index line)
- Modify: `README.md` (the `ref` row that says fifteen)
- Modify: `CONTRIBUTING.md` (the opening "fifteen functions" sentence)
- Modify: `skills/visimark/SKILL.md` (`lists all fifteen`; the three sentences that name division, `AVG`, `SQRT`, `PMT` and `NPV`)
- Modify: `CHANGELOG.md` (`## Unreleased` → `### Added`)
- Modify: `editors/vscode/CHANGELOG.md` (`## Unreleased`)
- Modify: `docs/vendor/visimark-browser.js` (regenerated)
- Modify: `packages/visimark/src/eval/precision.ts` only if Task 1 left the comment stale

**Interfaces:**
- Consumes: the `FnDoc` from Task 3. `bun run gen:docs` rewrites the design-doc table between the `generated: function-table` markers and rewrites `docs/function-reference.md`.
- Produces: a tree where `git grep -n fifteen` on the live docs listed above no longer finds a current builtin count. Historical lines in `CHANGELOG.md` that say fourteenth or fifteenth stay. The invoice sentence in design §14 that says "sixteen bindings" stays. Section C's current set reads `` `SUM MIN MAX AVG COUNT NPV IRR` ``.

- [ ] **Step 1: Regenerate the table and the function reference**

Hand-edit the sentence above the generated table:

```markdown
Sixteen, chosen to cover the examples and the catalogued additions a real
document needed (`EOMONTH`, issue #6; `SQRT`, issue #18; `FLOOR`, issue #53;
`CEILING`, issue #54; `PMT`, issue #156; `NPV`, issue #157; `IRR`, issue #158).
```

In §14, change `A function library beyond the fifteen` to `beyond the sixteen`. Leave `in sixteen bindings` alone.

```bash
bun run gen:docs
```

Expected: `docs/function-reference.md` gains `### IRR(flows)` with the three examples, and the design-doc table gains an `IRR(flows)` row whose Precision cell is **must be declared**. `NPV` and `PMT` rows stay.

- [ ] **Step 2: Counts, the skill, the changelogs, the catalogue**

Replace the current-count "fifteen" with "sixteen" in:

- `docs/vocabulary-catalogue.md` first paragraph: `**sixteen functions`
- `CONTRIBUTING.md`: `**sixteen functions`
- `README.md` `ref` row: `lists all sixteen`
- `docs/cli-reference.md` `ref` row: `lists all sixteen`
- `docs/tutorial.md`: the three builtin-count sentences only
- `skills/visimark/SKILL.md`: `lists all sixteen`

In that skill, add `` `IRR` `` to the three declared-width sentences:

- `**Division, \`AVG\`, \`SQRT\`, \`PMT\`, \`NPV\` and \`IRR\` bound nothing**`
- the table row `A division, \`AVG\`, \`SQRT\`, \`PMT\`, \`NPV\` or \`IRR\` with no \`precision N\``
- the red-flag bullet that names those same functions

In section C of the catalogue, the current-set sentence becomes:

```markdown
The current set is `SUM MIN MAX AVG COUNT NPV IRR`.
```

Delete the `IRR(flows)` row from the section C table. Prepend this row to the Shipped table, above `NPV`. `Landed` is PR #167. `Released` is `—`.

```markdown
| `IRR(flows)` | reducer | [#158](https://github.com/michal-niedzwiedzki/visimark/issues/158) | [#167](https://github.com/michal-niedzwiedzki/visimark/pull/167) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/158#issuecomment-5783540649) |
```

`CHANGELOG.md`, at the top of `### Added` under `## Unreleased`:

```markdown
- **`IRR(flows)`** — the sixteenth builtin (issue #158). The rate at which a
  cash-flow column has present value zero, using `NPV`'s period index: row 0
  is not discounted. Exactly one sign change among the non-zero cells. No
  guess. A written result declares its width, and that width is the rounding
  of the root. A blank, an empty column, an all-zero column, or any other
  number of sign changes, is `TYPE`. A root the 40-digit working precision
  cannot pin is `PRECISION`. `ref` lists sixteen functions: `IRR`, `NPV`, and
  `PMT` among them.
  See [`irr-spec.md`](docs/vocab/irr-spec.md).
```

Leave the existing fifteenth (`NPV`) and fourteenth (`PMT`) bullets as they are.

`editors/vscode/CHANGELOG.md`, under `## Unreleased`:

```markdown
- The engine now recognises `IRR(flows)`. A call that used to be reported as
  an unknown function is evaluated, and a missing width on a written result is
  the existing `PRECISION` diagnostic.
```

- [ ] **Step 3: Regenerate the playground bundle**

Bun 1.4.2, from the worktree root. `packageManager` pins that version.

```bash
bun run --filter visimark build:playground
```

Expected: `docs/vendor/visimark-browser.js` changes. Documents that do not call `IRR` keep the same check result.

- [ ] **Step 4: Full local check**

```bash
bun test
bun run typecheck
bun run build
bun run lint
bun run format:check
bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md docs/example-charts.md
bun run packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md
```

Expected: tests, typecheck, build, lint, and format pass. The invoice and charts checks print `0 problems`. The drift check exits 1; that file is supposed to disagree. Do not use `bunx visimark`.

Search the live count sentences once more:

```bash
git grep -n fifteen -- README.md CONTRIBUTING.md docs/cli-reference.md docs/tutorial.md docs/vocabulary-catalogue.md docs/visimark-design.md skills/visimark/SKILL.md
```

Expected: no hit that still claims the language has fifteen builtins. A hit inside an old spec or a "sixteen bindings" line is not this sentence. `docs/vocab/npv-spec.md` saying fifteen is historical. Leave it.

- [ ] **Step 5: Commit**

```bash
git add docs/visimark-design.md docs/function-reference.md docs/vocabulary-catalogue.md docs/cli-reference.md docs/tutorial.md README.md CONTRIBUTING.md skills/visimark/SKILL.md CHANGELOG.md editors/vscode/CHANGELOG.md docs/vendor/visimark-browser.js
git commit -m "$(printf 'docs: IRR is the sixteenth builtin\n\n%s' '<trailer>')"
```

If `format:check` rewrites a file, include that file in this commit only when the rewrite is from `oxfmt` on a file this task already touched. Do not format the repository at large.
