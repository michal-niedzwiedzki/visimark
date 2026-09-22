# NPV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `NPV(rate, flows)` — the fifteenth builtin, a reduce of one per-period rate and one cash-flow column, row 0 undiscounted — per `docs/vocab/npv-spec.md`.

**Architecture:** `NPV` is a reduce whose column parameter is argument 1, not argument 0. `FnSpec` records that index. `callProblem`, the dependency walk, `evalCall`, and `isCrossSheetAggregate` read it, so a scalar rate is an ordinary scalar and only `flows` is the column. The sum is one loop in `eval/evaluate.ts` over `decimal.js`. `derivePrecision` needs no new arm: an unrecognised call returns `null`, which is the declared-width rule. The reference entry is an `FnDoc` in `lang/reference.ts`. The parser stays function-agnostic. `infer` does not gain `NPV`.

**Tech Stack:** TypeScript; `decimal.js` (already the numeric core); Bun test runner; the engine package `packages/visimark`.

**Spec:** `docs/vocab/npv-spec.md`

## Global Constraints

- No new npm dependencies. No new module. No new [§10](../visimark-design.md#10-error-taxonomy) code.
- No change to `parse/`, `model/`, `write/`, `infer/`, or `packages/visimark-lsp`. `infer` never proposes `NPV`. Do not add `NPV` to the `REDUCES` list in `infer/propose.ts`.
- `FnSpec` is a union. A map is `{ kind: "map"; arity: number }`. A reduce is `{ kind: "reduce"; arity: number; column: number }`. Every reduce that already ships sets `column: 0`. `NPV` sets `column: 1`.
- `FnDoc.precision` is `{ from: "declared" }`. `FnDoc` has no `rounding` field and no `prose` spelling. Do not add a `case "NPV"` in `eval/precision.ts`. The `default` arm returns `null`, including when `rate` is the literal `0`.
- Messages, verbatim, in this order. A non-number `rate` → `NPV expects a number`. `rate <= -1` → `NPV rate must be greater than -1`, including a one-row column and an empty column. An empty column at a legal rate → `NPV() of an empty column`. A non-number cell, blank included → `NPV expects a number`. A non-finite power or quotient → `result is not a finite decimal` from `num()`.
- Wrong arity is the existing static message `NPV() takes 2 arguments, got N`, once per binding. An expression in `flows` is `NPV() takes a column reference, not an expression`. A `flows` reference that resolves to a scalar is `NPV() expects a column`.
- A call that already has an arity or shape error visits every argument as inside a reduce, so a column in `rate` is not also a `VECTOR`. A well-formed call gates only the column parameter. `NPV(Cash, Flows)` is one `VECTOR` on `Cash`.
- A blank cell is not zero and is not skipped. Row `k` is the data-row index in table order. The header is not a period. The engine does not read a Year column.
- The formula is `Σ flows_k / (1 + rate) ^ k` for every rate, including zero. Do not switch the precision rule to `SUM`'s rule at rate zero. Do not adopt Excel's period-1 discount.
- A finite power that needs more than 40 significant digits is rounded by `decimal.js` and is not a finding. The write-time `PRECISION` ceiling is unchanged.
- An unanchored scalar keeps full working precision. An anchored scalar or a column rule whose formula does not derive a width must declare one. `ROUND(NPV(...), 2)` derives its width from `ROUND`.
- A row-varying bad rate is one `TYPE` on that row. A row-invariant failure over N rows emitting N findings is accepted. Do not add row-variance analysis.
- `SUM(someScalar)` keeps today's behaviour. This plan does not close that hole.
- Work on branch `vocab/issue-157-npv-impl` (draft PR #165). Do not open a new PR. Do not close issue #157.
- `docs/example-invoice.md`, `docs/example-charts.md`, and `docs/example-invoice-drift.md` stay byte-identical. Do not edit `.github/ISSUE_TEMPLATE/`.
- Every commit ends with the one `Co-Authored-By` trailer from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session doing the commit. Do not copy a trailer out of this plan, an older plan, or an older commit.

## Review Focus

These are the inputs a reduce that still assumes argument 0 would get wrong. Each one has a test in the task named here.

1. `NPV(0.08, Cash * 1)` is a shape error, and `NPV(Cash, 0.08)` is that same shape error with no second `VECTOR` — Task 1.
2. `NPV(0.08, present)` where `present` is a scalar is `NPV() expects a column`, not a silent skip — Task 1.
3. A blank cell between numbers is `NPV expects a number`, and `NPV(-1, Cash)` on that column is the rate message — Task 1.
4. Anchored `NPV(0, Cash)` with no `precision` clause is `PRECISION`, and the written zero-rate value is `12000.00`, not `6000.00` — Task 3.
5. `NPV(8%, Cash)` is the same value as `NPV(0.08, Cash)`, and a unit on a cash cell is stripped — Task 1.

---

### Task 1: column index, and evaluate `NPV`

**Files:**
- Edit: `packages/visimark/src/eval/functions.ts`
- Edit: `packages/visimark/src/eval/graph.ts`
- Edit: `packages/visimark/src/eval/evaluate.ts`
- Edit: `packages/visimark/src/eval/check.ts` (`isCrossSheetAggregate` only)
- Edit: `packages/visimark/src/eval/precision.ts` (the comment that names the declared-width cases; no new `case`)
- Edit: `packages/visimark/test/eval/precision.test.ts`
- Test: `packages/visimark/test/eval/functions.test.ts`
- Test: `packages/visimark/test/eval/graph.test.ts`

**Interfaces:**
- Produces: `FUNCTIONS.get("NPV")` is `{ kind: "reduce", arity: 2, column: 1 }`. `FUNCTIONS.get("SUM")` is `{ kind: "reduce", arity: 1, column: 0 }`. `callProblem("NPV", args)` is `{ kind: "arity", expected: 2, got: N }` when `N !== 2`, `{ kind: "shape" }` when the argument at `column` is not a reference, and `null` for `(expression, ref)`. `describeCallProblem(name, { kind: "not-column" })` is `` `${name}() expects a column` ``. A well-formed `NPV` call evaluates to a `num` or throws `EvalError` with one of the messages in Global Constraints.
- Consumes: `asNum`, `num`, `EvalError`, and `env.vector` in `evaluate.ts`. `resolve` in `graph.ts`. `Decimal` from `decimal.js`, already imported in `evaluate.ts`.

- [ ] **Step 1: Expect `NPV` in the builtin list (RED)**

In `test/eval/functions.test.ts`, the test `"every builtin declares a kind and an arity"` lists the sorted keys. Insert `"NPV"` between `"MOD"` and `"PMT"`:

```ts
    "MOD",
    "NPV",
    "PMT",
```

In `"the function table and the exported map agree"`, change `toHaveLength(14)` to `toHaveLength(15)`.

- [ ] **Step 2: Add the behaviour tests (RED)**

Append at the end of `test/eval/functions.test.ts`. This file reaches the engine only through `run(src)`.

```ts
// ---- NPV ------------------------------------------------------------

const cashDoc = (rule: string, rows: string) => `
| Cash |
|-----:|
${rows}
\`\`\`vmark #t
present = ${rule}
\`\`\`
`;

test("NPV is a reduce of arity 2 whose column is argument 1", () => {
  expect(FUNCTIONS.get("SUM")).toEqual({ kind: "reduce", arity: 1, column: 0 });
  expect(FUNCTIONS.get("NPV")).toEqual({ kind: "reduce", arity: 2, column: 1 });
  expect(isReduce("NPV")).toBe(true);
  expect(callProblem("NPV", [{ type: "num" }, { type: "ref" }])).toBeNull();
  expect(callProblem("NPV", [])).toEqual({ kind: "arity", expected: 2, got: 0 });
  expect(callProblem("NPV", [{ type: "num" }])).toEqual({ kind: "arity", expected: 2, got: 1 });
  expect(callProblem("NPV", [{ type: "num" }, { type: "ref" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 3,
  });
  expect(callProblem("NPV", [{ type: "num" }, { type: "binary" }])).toEqual({ kind: "shape" });
  expect(callProblem("NPV", [{ type: "ref" }, { type: "num" }])).toEqual({ kind: "shape" });
});

test("NPV exact cases and the motivating full working value", () => {
  const src = `
| Cash |
|-----:|
| -48000 |
|  20000 |
|  20000 |
|  20000 |

\`\`\`vmark #t
zero = NPV(0, Cash)
main = NPV(0.08, Cash)
pct = NPV(8%, Cash)
\`\`\`

| Small |
|------:|
| -1000 |
|   400 |
|   400 |
|   400 |

\`\`\`vmark #small
ten = NPV(0.10, Small)
\`\`\`

| Again |
|------:|
| -48000 |
|  20000 |
|  20000 |
|  20000 |

\`\`\`vmark #again
neg = NPV(-0.05, Again)
\`\`\`

| Only |
|-----:|
| -48000 |

\`\`\`vmark #one
single = NPV(0.08, Only)
\`\`\`

| Pair |
|-----:|
| 100 |
| 100 |

\`\`\`vmark #pair
neg = NPV(-0.5, Pair)
bare = NPV(0, Pair)
\`\`\`

| Tagged |
|-------:|
| 10 PLN |
| -10 PLN |

\`\`\`vmark #tag
units = NPV(0, Tagged)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  const str = (id: string) => {
    const v = r.values.get(id);
    if (!v || v.t !== "num") throw new Error(id);
    return v.d.toString();
  };
  expect(str("t.zero")).toBe("12000");
  expect(str("t.main")).toBe("3541.9397449575776050398821317888533252");
  expect(str("t.pct")).toBe(str("t.main"));
  expect(str("small.ten")).toBe("-5.2592036063110443275732531930879038317");
  expect(str("again.neg")).toBe("18540.31199883364922000291587694999271031");
  expect(str("one.single")).toBe("-48000");
  expect(str("pair.neg")).toBe("300");
  expect(str("pair.bare")).toBe("200");
  expect(str("tag.units")).toBe("0");
});

test("NPV rejects a bad rate before an empty column, a blank, or a non-number", () => {
  const msg = (src: string) => typeFindings(run(src).findings)[0]?.message;
  const series = `| -48000 |\n|  20000 |\n|  20000 |\n|  20000 |`;
  expect(msg(cashDoc('NPV("x", Cash)', series))).toBe("NPV expects a number");
  expect(msg(cashDoc("NPV(-1, Cash)", series))).toBe("NPV rate must be greater than -1");
  expect(msg(cashDoc("NPV(-1.5, Cash)", series))).toBe("NPV rate must be greater than -1");
  expect(msg(cashDoc("NPV(-1, Cash)", "| -48000 |"))).toBe("NPV rate must be greater than -1");
  expect(msg(cashDoc("NPV(-1, Cash)", ""))).toBe("NPV rate must be greater than -1");
  expect(msg(cashDoc("NPV(0.08, Cash)", ""))).toBe("NPV() of an empty column");
  expect(msg(cashDoc("NPV(0.08, Cash)", "| 10 |\n|    |\n|  5 |"))).toBe("NPV expects a number");
  expect(msg(cashDoc("NPV(0.08, Cash)", "| 10 |\n| no |\n|  5 |"))).toBe("NPV expects a number");
  expect(msg(cashDoc("NPV(0.08, Cash)", "| 10 |\n| 2026-01-01 |"))).toBe("NPV expects a number");
  expect(msg(cashDoc("NPV(-1, Cash)", "| 10 |\n|    |"))).toBe("NPV rate must be greater than -1");
});

test("NPV shape, scalar flows, and a column in the rate slot", () => {
  const shape = typeFindings(run(cashDoc("NPV(0.08, Cash * 1)", "| 10 |")).findings);
  expect(shape).toHaveLength(1);
  expect(shape[0]!.message).toBe("NPV() takes a column reference, not an expression");

  const arity = typeFindings(run(cashDoc("NPV(0.08)", "| 10 |")).findings);
  expect(arity).toHaveLength(1);
  expect(arity[0]!.message).toBe("NPV() takes 2 arguments, got 1");

  const swapped = `
| Cash |
|-----:|
|   10 |
\`\`\`vmark #t
present = NPV(Cash, 0.08)
\`\`\`
`;
  const swappedFindings = run(swapped).findings;
  expect(typeFindings(swappedFindings).map((f) => f.message)).toEqual([
    "NPV() takes a column reference, not an expression",
  ]);
  expect(swappedFindings.some((f) => f.code === "VECTOR")).toBe(false);

  const scalar = `
| Cash |
|-----:|
|   10 |
\`\`\`vmark #t
present = 1
value = NPV(0.08, present)
\`\`\`
`;
  expect(typeFindings(run(scalar).findings).map((f) => f.message)).toContain(
    "NPV() expects a column",
  );

  const twoCols = `
| Cash | Flows |
|-----:|------:|
|   10 |    20 |
\`\`\`vmark #t
present = NPV(Cash, Flows)
\`\`\`
`;
  const vec = run(twoCols).findings.filter((f) => f.code === "VECTOR");
  expect(vec).toHaveLength(1);
  expect(vec[0]!.raw).toBe("Cash");
  expect(typeFindings(run(twoCols).findings)).toEqual([]);
});

test("a column rule reports one TYPE on the row whose rate is -1", () => {
  const src = `
| Rate | Cash | Level |
|-----:|-----:|------:|
| 0.08 |  -10 |     0 |
|   -1 |   10 |     0 |

\`\`\`vmark #t
Level precision 2 = NPV(Rate, Cash)
\`\`\`
`;
  const ts = typeFindings(run(src).findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("NPV rate must be greater than -1");
  expect(ts[0]!.rowLabel).toBeDefined();
});

test("a computed flows column with an upstream error adds no NPV finding", () => {
  const src = `
| Den | Cash |
|----:|-----:|
|   1 | 1.00 |
|   0 | 0.00 |
|   1 | 1.00 |

\`\`\`vmark #t
Cash = 1 / Den
present precision 2 = NPV(0, Cash)
assert present == 3
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.message?.startsWith("NPV"))).toEqual([]);
  expect(r.findings.filter((f) => f.message === "division by zero")).toHaveLength(1);
  expect(r.findings.filter((f) => f.code === "NOTE").map((f) => f.message)).toEqual([
    "1 assertion not verified (upstream errors)",
  ]);
});
```

In `test/eval/graph.test.ts`, add:

```ts
test("NPV gates the flows argument and not the rate", () => {
  const src = `
| Cash |
|-----:|
|   10 |

\`\`\`vmark #flow
\`\`\`

| Rate |
|-----:|
| 0.08 |

\`\`\`vmark #here
hurdle = 0.08
present = NPV(hurdle, flow.Cash)
bad = NPV(Rate, flow.Cash)
\`\`\`
`;
  const model = build(locate(src));
  const present = model.sheets.get("here")!.scalars.get("present")!;
  const presentInfo = dependencies(model, present);
  expect(presentInfo.vectorRefs).toEqual([]);
  expect(presentInfo.callErrors).toEqual([]);
  expect(presentInfo.deps.has("flow.Cash")).toBe(true);

  const bad = model.sheets.get("here")!.scalars.get("bad")!;
  const badInfo = dependencies(model, bad);
  expect(badInfo.vectorRefs.map((r) => r.name)).toEqual(["Rate"]);
  expect(badInfo.callErrors).toEqual([]);
  expect(badInfo.deps.has("flow.Cash")).toBe(true);
});
```

`Rate` is a column of sheet `here` used where a scalar is required, so it is a vector reference. `flow.Cash` is the column parameter, so it is a dependency on both bindings. `graph.test.ts` already imports `build` and `locate`.

- [ ] **Step 3: Run the tests and confirm they fail**

From the repo root:

```bash
bun test packages/visimark/test/eval/functions.test.ts packages/visimark/test/eval/graph.test.ts
```

Expected: FAIL. `FUNCTIONS.get("NPV")` is `undefined`, and the sorted key list does not contain `"NPV"`.

- [ ] **Step 4: Register the column index and implement the sum**

Replace `FnSpec` in `packages/visimark/src/eval/functions.ts`:

```ts
export type FnSpec =
  | { kind: "map"; arity: number }
  | { kind: "reduce"; arity: number; column: number };
```

Delete the old `FnSpec` interface. On every existing reduce, add `column: 0`. Add `NPV` after `COUNT`:

```ts
  SUM: { kind: "reduce", arity: 1, column: 0 },
  MIN: { kind: "reduce", arity: 1, column: 0 },
  MAX: { kind: "reduce", arity: 1, column: 0 },
  AVG: { kind: "reduce", arity: 1, column: 0 },
  COUNT: { kind: "reduce", arity: 1, column: 0 },
  NPV: { kind: "reduce", arity: 2, column: 1 },
```

Replace the comment `every reduce takes exactly one` with: a reduce has one column parameter; `column` is its index.

Extend `CallProblem` with `{ kind: "not-column" }`. In `callProblem`, the shape test reads the column index:

```ts
  if (spec.kind === "reduce" && args[spec.column]!.type !== "ref") return { kind: "shape" };
```

In `describeCallProblem`:

```ts
    case "not-column":
      return `${name}() expects a column`;
```

In `packages/visimark/src/eval/graph.ts`, import `FUNCTIONS` beside `callProblem`. Replace the `case "call"` visit:

```ts
      case "call": {
        const problem = callProblem(node.name, node.args);
        if (problem) info.callErrors.push({ call: node, problem });
        const spec = FUNCTIONS.get(node.name);
        if (spec?.kind === "reduce") {
          if (!problem) {
            const col = node.args[spec.column];
            if (col?.type === "ref") {
              const res = resolve(model, binding.sheetId, col);
              if (res.kind === "scalar" || res.kind === "doc-scalar") {
                info.callErrors.push({ call: node, problem: { kind: "not-column" } });
              }
            }
          }
          const malformed = info.callErrors.some((e) => e.call === node);
          const column = spec.column;
          node.args.forEach((a, i) => {
            visit(a, inAggregate || malformed || i === column);
          });
          return;
        }
        for (const a of node.args) visit(a, inAggregate);
        return;
      }
```

`malformed` is computed after the `not-column` push, so a scalar `flows` gates every argument and does not also become a `VECTOR`. A map, and an unknown name, visit their arguments the way they do today.

In `evalCall` in `packages/visimark/src/eval/evaluate.ts`, replace the `isReduce` branch:

```ts
  if (isReduce(name)) {
    const spec = FUNCTIONS.get(name);
    const col = spec?.kind === "reduce" ? spec.column : 0;
    const arg = args[col];
    if (!arg || arg.type !== "ref") {
      throw new EvalError(describeCallProblem(name, { kind: "shape" }));
    }
    if (name === "NPV") {
      const rate = evalExpr(args[0]!, env);
      return npv(rate, env.vector(arg));
    }
    return aggregate(name, env.vector(arg));
  }
```

Import `FUNCTIONS` in `evaluate.ts`. Add `npv` next to `aggregate`:

```ts
function npv(rate: Value, vec: Value[]): Value {
  const r = asNum(rate, "NPV");
  if (!r.gt(-1)) throw new EvalError("NPV rate must be greater than -1");
  if (vec.length === 0) throw new EvalError("NPV() of an empty column");
  let sum = new Decimal(0);
  for (let k = 0; k < vec.length; k++) {
    const flow = asNum(vec[k]!, "NPV");
    sum = sum.plus(flow.div(r.plus(1).pow(k)));
  }
  return num(sum.isZero() ? new Decimal(0) : sum);
}
```

`asNum` on the rate runs before the column is considered, so a non-number rate wins over an empty column and over a blank cell. `num()` still throws `result is not a finite decimal`.

In `isCrossSheetAggregate` in `packages/visimark/src/eval/check.ts`, read the column index instead of `e.args[0]`:

```ts
  const spec = FUNCTIONS.get(e.name);
  if (!spec || spec.kind !== "reduce") return false;
  const arg = e.args[spec.column];
```

`FUNCTIONS` is already imported there. A cross-sheet `flows` follows the path `SUM` already uses. A scalar rate on another sheet stays an ordinary dependency.

In `test/eval/precision.test.ts`, extend the declared-width test. Do not add a `case` in `precision.ts`:

```ts
test("division, AVG, SQRT, PMT and NPV are not derivable", () => {
  expect(P("four / two")).toBeNull();
  expect(P("AVG(two)")).toBeNull();
  expect(P("SQRT(four)")).toBeNull();
  expect(P("PMT(two, two, two)")).toBeNull();
  expect(P("NPV(0, two)")).toBeNull();
  expect(P("NPV(two, two)")).toBeNull();
  expect(P("ROUND(NPV(two, two), 2)")).toBe(2);
});
```

In the comment at the top of `derivePrecision`, name `NPV` with the other declared-width functions. Leave the `default: return null` arm as it is.

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
bun test packages/visimark/test/eval/functions.test.ts packages/visimark/test/eval/graph.test.ts packages/visimark/test/eval/precision.test.ts
```

Expected: PASS. Existing `SUM` / `AVG` tests still pass. `SUM` of an empty column is still `0`.

- [ ] **Step 6: Commit**

```bash
git add packages/visimark/src/eval/functions.ts packages/visimark/src/eval/graph.ts packages/visimark/src/eval/evaluate.ts packages/visimark/src/eval/check.ts packages/visimark/src/eval/precision.ts packages/visimark/test/eval/functions.test.ts packages/visimark/test/eval/graph.test.ts packages/visimark/test/eval/precision.test.ts
git commit -m "$(printf 'feat: evaluate NPV\n\n%s' '<trailer>')"
```

`<trailer>` is the session line from `.agents/rules/ai-attribution.md`.

---

### Task 2: document `NPV` in the registry

**Files:**
- Edit: `packages/visimark/src/lang/reference.ts`
- Test: `packages/visimark/test/lang/reference-examples.test.ts` (already data-driven; do not edit it)
- Edit: `packages/visimark/test/lang/reference.test.ts` (the length assertion only)
- Edit: `packages/visimark/test/cli/ref.test.ts` (the length assertion only)

**Interfaces:**
- Produces: `FUNCTION_DOCS.NPV` with `params.length === 2`, `precision: { from: "declared" }`, no `rounding`, no `prose`, and three examples whose `evaluate()` result equals `is`.
- Consumes: the evaluator from Task 1. `reference-examples.test.ts` builds `example = <expr>` with no anchor and compares `Decimal.toString()`, so `is` is the unrounded value. `12000`, `-48000`, and `300` are the three exact cases. Do not put `3541.94` in `is`.

- [ ] **Step 1: Add the `FnDoc` (RED until the examples run)**

The examples fail until the entry exists, because `reference-examples.test.ts` iterates `FUNCTION_TABLE` and every key of `FUNCTION_DOCS` must match. Add the entry in the same edit as the length assertions. `typecheck` fails if `FUNCTION_TABLE` has `NPV` and `FUNCTION_DOCS` does not, so this task does not leave a red typecheck between commits: Task 1 already added the table row, and this commit adds the docs before the next test run.

In `packages/visimark/src/lang/reference.ts`, after `COUNT` (the reduce block; `PMT` stays with the maps):

```ts
  NPV: {
    summary:
      "present value of a cash-flow column; row 0 is undiscounted; an empty column is a TYPE error",
    params: [
      { name: "rate", type: "number", note: "the rate for one period; must be greater than -1" },
      { name: "flows", type: "column", note: "cash flows in time order; the first row is period 0" },
    ],
    returns: "number",
    precision: { from: "declared" },
    errors: [
      { when: "a non-numeric `rate`", code: "TYPE" },
      { when: "a `rate` of -1 or below", code: "TYPE" },
      { when: "an empty column", code: "TYPE" },
      { when: "a non-numeric cell", code: "TYPE" },
      { when: "a `flows` argument that is not a column", code: "TYPE" },
    ],
    examples: [
      { expr: "NPV(0, t.Cash)", is: "12000", given: CASH },
      { expr: "NPV(0.08, t.Cash)", is: "-48000", given: ONE },
      { expr: "NPV(-0.5, t.Cash)", is: "300", given: PAIR },
    ],
    see: ["SUM", "AVG"],
  },
```

Next to `AMOUNTS`, add the three `given` documents. Each ends with an empty `vmark #t` block, the same way `AMOUNTS` does, so `t.Cash` resolves:

```ts
const CASH = `| Cash |
|-----:|
| -48000 |
|  20000 |
|  20000 |
|  20000 |

\`\`\`vmark #t
\`\`\`
`;

const ONE = `| Cash |
|-----:|
| -48000 |

\`\`\`vmark #t
\`\`\`
`;

const PAIR = `| Cash |
|-----:|
|  100 |
|  100 |

\`\`\`vmark #t
\`\`\`
`;
```

- [ ] **Step 2: Expect fifteen names**

In `packages/visimark/test/lang/reference.test.ts`, rename `functionNames lists all fourteen` to `functionNames lists all fifteen` and expect `15`.

In `packages/visimark/test/cli/ref.test.ts`, the test `ref --json with no name lists every function` expects `15`.

- [ ] **Step 3: Run the reference tests**

```bash
bun test packages/visimark/test/lang/reference-examples.test.ts packages/visimark/test/lang/reference.test.ts packages/visimark/test/cli/ref.test.ts
```

Expected: PASS, including `NPV: NPV(0, t.Cash) is 12000`, `NPV: NPV(0.08, t.Cash) is -48000`, `NPV: NPV(-0.5, t.Cash) is 300`, and `functionNames lists all fifteen`.

- [ ] **Step 4: Commit**

```bash
git add packages/visimark/src/lang/reference.ts packages/visimark/test/lang/reference.test.ts packages/visimark/test/cli/ref.test.ts
git commit -m "$(printf 'docs: reference entry for NPV\n\n%s' '<trailer>')"
```

---

### Task 3: declared width, write-back, and the upstream note

**Files:**
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: Task 1. `emitNotDerivable` already reports `` `<formula>` has no derivable precision ``. `ROUND` already derives its width from `places`. No production edit in this task unless a test shows the write path treating rate zero as `SUM`.

- [ ] **Step 1: Write the check tests**

Append to `packages/visimark/test/eval/check.test.ts`. Use the file's existing `run` helper. The motivating column is the one in the spec.

```ts
const npvSheet = (rule: string, anchor: string) => `
The present value is **${anchor}**<!--vmark=t.present-->.

| Cash |
|-----:|
| -48000.00 |
|  20000.00 |
|  20000.00 |
|  20000.00 |

\`\`\`vmark #t
${rule}
\`\`\`
`;

test("NPV at 8% anchored 3541.94 with a declared width is clean", () => {
  const r = run(npvSheet("present precision 2 = NPV(0.08, Cash)", "3541.94"));
  expect(r.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  const small = `
The present value is **-5.26**<!--vmark=t.present-->.

| Cash |
|-----:|
| -1000.00 |
|   400.00 |
|   400.00 |
|   400.00 |

\`\`\`vmark #t
present precision 2 = NPV(0.10, Cash)
\`\`\`
`;
  expect(run(small).findings.filter((f) => f.code !== "WARN")).toEqual([]);
});

test("NPV anchored at the issue's 6000.00 is STALE, computed 3541.94", () => {
  const r = run(npvSheet("present precision 2 = NPV(0.08, Cash)", "6000.00"));
  const stale = r.findings.filter((f) => f.code === "STALE");
  expect(stale).toHaveLength(1);
  expect(stale[0]!.computed).toBe("3541.94");
});

test("an anchored NPV with no declared width is PRECISION, and rate zero is too", () => {
  const missing = run(npvSheet("present = NPV(0.08, Cash)", "3541.94"));
  const prec = missing.findings.filter((f) => f.code === "PRECISION");
  expect(prec).toHaveLength(1);
  expect(prec[0]!.raw).toBe("NPV(0.08, Cash)");

  const zero = run(npvSheet("present = NPV(0, Cash)", "12000.00"));
  expect(zero.findings.filter((f) => f.code === "PRECISION")).toHaveLength(1);

  const declared = run(npvSheet("present precision 2 = NPV(0, Cash)", "12000.00"));
  expect(declared.findings.filter((f) => f.code !== "WARN")).toEqual([]);
});

test("an unanchored NPV is not PRECISION, and ROUND derives the width", () => {
  const raw = `
| Cash |
|-----:|
| -48000.00 |
|  20000.00 |
|  20000.00 |
|  20000.00 |

\`\`\`vmark #t
raw = NPV(0.08, Cash)
shown precision 2 = ROUND(raw, 2)
\`\`\`

**3541.94**<!--vmark=t.shown-->
`;
  const r = run(raw);
  expect(r.findings.filter((f) => f.code !== "WARN")).toEqual([]);
});

test("a blank cell is TYPE, and the assertion is only the upstream NOTE", () => {
  const src = `
| Cash |
|-----:|
| -48000.00 |
|  |
|  20000.00 |

\`\`\`vmark #t
present precision 2 = NPV(0.08, Cash)
assert present > 0
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.code === "TYPE").map((f) => f.message)).toEqual([
    "NPV expects a number",
  ]);
  expect(r.findings.filter((f) => f.code === "NOTE").map((f) => f.message)).toEqual([
    "1 assertion not verified (upstream errors)",
  ]);
});
```

`emitNotDerivable` sets `raw` to the formula and leaves `message` empty. The printed line `` `NPV(0.08, Cash)` has no derivable precision `` is `format.ts` reading that `raw`. The test asserts `raw`.

- [ ] **Step 2: Run it**

```bash
bun test packages/visimark/test/eval/check.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/visimark/test/eval/check.test.ts
git commit -m "$(printf 'test: NPV declares its width and refuses a blank cell\n\n%s' '<trailer>')"
```

---

### Task 4: the brake-press project note

**Files:**
- Create: `packages/visimark/test/fixtures/npv-press.md`
- Create: `packages/visimark/test/cli/npv.test.ts`

**Interfaces:**
- Consumes: Task 1. `runCli` from `packages/visimark/src/cli/main.ts`, the same harness as `test/cli/pmt.test.ts`.
- Produces: `visimark check` on the fixture exits 0, and `eval --get` prints `3541.94` and `0.08`.

- [ ] **Step 1: Write the fixture**

`packages/visimark/test/fixtures/npv-press.md`, byte for byte the note from spec §1:

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

- [ ] **Step 2: Write the CLI test**

`packages/visimark/test/cli/npv.test.ts`, copied from the shape of `pmt.test.ts`:

```ts
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const fixture = fileURLToPath(new URL("../fixtures/npv-press.md", import.meta.url));

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the brake-press project note exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe(`${fixture}\n\n  0 problems (0 stale, 0 errors)`);
});

test("eval --get prints the present value and the hurdle", async () => {
  const present = capture();
  expect(await runCli(["eval", fixture, "--get", "project.present"], present.io)).toBe(0);
  expect(present.out()).toBe("3541.94");

  const hurdle = capture();
  expect(await runCli(["eval", fixture, "--get", "project.hurdle"], hurdle.io)).toBe(0);
  expect(hurdle.out()).toBe("0.08");
});
```

The two spaces before `0 problems` are part of the summary. Do not drop them.

- [ ] **Step 3: Run it**

```bash
bun test packages/visimark/test/cli/npv.test.ts
```

Expected: PASS. If `check` exits 1, the report is the bug: a `STALE` anchor means a worked value in the fixture drifted from the spec table; a `PRECISION` means a declaration is missing; a `WARN` means a name in the block is unread.

- [ ] **Step 4: Commit**

```bash
git add packages/visimark/test/fixtures/npv-press.md packages/visimark/test/cli/npv.test.ts
git commit -m "$(printf 'test: brake-press project note checks clean\n\n%s' '<trailer>')"
```

---

### Task 5: documentation

**Files:**
- Edit: `packages/visimark/src/lang/reference.ts` is already done; this task regenerates from it
- Edit: `docs/function-reference.md` and the generated table in `docs/visimark-design.md` via `bun run gen:docs`
- Edit: `docs/visimark-design.md` (the hand-written count, the reduce-arity sentence, and [§14](../visimark-design.md#14-deferred))
- Edit: `docs/vocabulary-catalogue.md`
- Edit: `CHANGELOG.md`
- Edit: `editors/vscode/CHANGELOG.md`
- Edit: `skills/visimark/SKILL.md`
- Edit: `docs/cli-reference.md`
- Edit: `README.md`
- Edit: `docs/tutorial.md`
- Edit: `CONTRIBUTING.md`
- Edit: `docs/issue-runbook.md` only if it still says the builtin count is fourteen
- Edit: `docs/vendor/visimark-browser.js` and `docs/vendor/visimark-playground.js` by regenerating them

**Interfaces:**
- Consumes: the `FnDoc` from Task 2. `bun run gen:docs` rewrites `docs/function-reference.md` and the marked table in `docs/visimark-design.md`.
- Produces: the catalogue row leaves section C and sits in the Shipped register as `UNRELEASED`. Issue #157 stays open.

Do not edit historical text that records an older count: `CHANGELOG.md` entries under `## 0.1.x`, the `PMT` bullet already under `## Unreleased`, `docs/reviews/`, `docs/design/*-spec.md`, `docs/design/*-plan.md`, and `docs/vocab/*-plan.md` other than this file. Those are the record of the release or the plan they describe. Do not edit `.github/ISSUE_TEMPLATE/`. `NPV` adds no finding code, no precision variant, and no exit code.

- [ ] **Step 1: Regenerate the reference**

```bash
bun run gen:docs
```

Confirm the design-doc table gained an `NPV(rate, flows)` row whose Precision cell is `**must be declared**`, and `docs/function-reference.md` has a `### NPV(rate, flows)` section with the three examples.

- [ ] **Step 2: Hand-written count and the reduce sentence**

In `docs/visimark-design.md`, the sentence above the generated table: `Fourteen, chosen to cover…` becomes `Fifteen, chosen to cover…`, and the parenthetical gains `` `NPV`, issue #157 ``.

Replace:

```markdown
Every reduce takes exactly one argument by construction, which is the shape
rule restated as a number: there is nothing for a second column to mean.
```

with:

```markdown
A reduce has one column parameter, a bare column reference, and its other
parameters are scalars. `NPV` is the first with a scalar parameter. There is
still nothing for a second column to mean.
```

In the same file, [§14](../visimark-design.md#14-deferred): `A function library beyond the fourteen` becomes `beyond the fifteen`.

The same fourteen → fifteen replacement, and only where the sentence is "how many builtins exist today":

- `docs/vocabulary-catalogue.md` opening sentence (`**fourteen functions` → `**fifteen functions`)
- `docs/cli-reference.md` (`lists all fourteen`)
- `README.md` (`lists all fourteen`)
- `skills/visimark/SKILL.md` (`lists all fourteen`)
- `docs/tutorial.md` (the live sentences: "fourteen functions", "lists all fourteen", "the fourteen builtins")
- `CONTRIBUTING.md` (`**fourteen functions`)
- `docs/issue-runbook.md`, if a search still finds the count

In `skills/visimark/SKILL.md`, add `NPV` beside division, `AVG`, `SQRT`, and `PMT` in both places that name the operations whose width must be declared (the authoring bullet and the "Rules that bite" row).

In `docs/vocabulary-catalogue.md` section C, replace the opening:

```markdown
Collapse one column to one value. Every reducer takes exactly one argument, a
bare column reference — `SUM(Price * Qty)` is refused so every intermediate is a
column the reader can see ([§4](visimark-design.md#4-syntax)). The current set is `SUM MIN MAX AVG COUNT`.
```

with:

```markdown
Collapse one column to one value. A reducer has one column parameter, a bare
column reference, and its other parameters are scalars — `SUM(Price * Qty)` is
refused so every intermediate is a column the reader can see
([§4](visimark-design.md#4-syntax)). `NPV(rate, flows)` is the first reducer
with a scalar parameter. The current set is `SUM MIN MAX AVG COUNT NPV`.
```

- [ ] **Step 3: Move the catalogue row**

Delete the section C row for `` `NPV(rate, flows)` ``.

Insert this row at the top of the Shipped register body, above `PMT`:

```markdown
| `NPV(rate, flows)` | reducer | [#157](https://github.com/michal-niedzwiedzki/visimark/issues/157) | [#165](https://github.com/michal-niedzwiedzki/visimark/pull/165) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/157#issuecomment-5782258164) |
```

`Released` stays `—`. Do not mark it `SHIPPED` and do not close issue #157.

- [ ] **Step 4: Changelogs**

Under `CHANGELOG.md` `## Unreleased` → `### Added`, above the `PMT` bullet:

```markdown
- **`NPV(rate, flows)`** — the fifteenth builtin (issue #157). The present value
  of a cash-flow column at a per-period rate. Row 0 is not discounted; row `k`
  is divided by `(1 + rate) ^ k`. A zero rate equals the sum of the column, and
  a written result still declares its width. A blank cell, an empty column, a
  non-column `flows`, or a rate of -1 or below, is `TYPE`.
  See [`npv-spec.md`](docs/vocab/npv-spec.md).
```

Under `editors/vscode/CHANGELOG.md` `## Unreleased`, above the `PMT` bullet:

```markdown
- The engine now recognises `NPV(rate, flows)`. A call that used to be
  reported as an unknown function is evaluated, and a missing width on a
  written result is the existing `PRECISION` diagnostic.
```

- [ ] **Step 5: Regenerate the playground bundle**

The engine's export set changed. From the repo root, with Bun 1.4.2:

```bash
bun run --filter visimark build:playground
```

This rewrites `docs/vendor/visimark-browser.js` and `docs/vendor/visimark-playground.js`. Commit them. Documents that do not call `NPV` keep the same check result.

- [ ] **Step 6: Full local check**

From the repo root. Run the invoice and the drift file as separate invocations: together they exit 1 because the drift file is supposed to disagree.

```bash
bun test
bun run typecheck
bun run build
bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md
bun run packages/visimark/src/cli/main.ts check docs/example-charts.md
bun run packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md
```

Expected: `bun test`, `typecheck`, and `build` are green. `check` on the invoice and on the charts exits 0. `check` on the drift file exits 1, and `bun test` already holds its transcript. Do not use `bunx visimark`.

- [ ] **Step 7: Commit**

```bash
git add docs/function-reference.md docs/visimark-design.md docs/vocabulary-catalogue.md CHANGELOG.md editors/vscode/CHANGELOG.md skills/visimark/SKILL.md docs/cli-reference.md README.md docs/tutorial.md CONTRIBUTING.md docs/vendor/visimark-browser.js docs/vendor/visimark-playground.js
git commit -m "$(printf 'docs: NPV is the fifteenth builtin\n\n%s' '<trailer>')"
```

Add `docs/issue-runbook.md` to `git add` if Step 2 changed it. The vendor filenames are whatever `build:playground` wrote; do not commit a bundle that was not regenerated from this branch.

---

## Self-review

Spec §3 worked values are either an exact `FnDoc` example (Task 2) or a `toString` / write-form assertion (Tasks 1, 3, 4). Spec §4 messages and the check order are the tests in Task 1. The column index, the scalar-name `TYPE`, and the rate-slot `VECTOR` are Task 1. The unanchored-scalar rule, rate-zero `PRECISION`, and the blank-cell `NOTE` are Task 3. The project note is Task 4. Non-goals (`IRR`, Excel's period numbering, a Year column, a per-cell span, a new finding code, teaching `infer`) have no task. The generated table, the §4 sentence, the catalogue move, both changelogs, the playground bundle, and the live "fourteen" sentences are Task 5.
