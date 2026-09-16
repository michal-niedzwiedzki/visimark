# Function Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one machine-readable registry the single source of truth for what VisiMark's thirteen builtin functions do, and serve it to the CLI, the language server, and two generated documents.

**Architecture:** `eval/functions.ts` keeps `kind` and `arity` and gains a `FunctionName` union by being built from a `const` record. A new `lang/reference.ts` holds the prose, keyed by that union so an undocumented function fails `typecheck`. `describeFunction` is exported from the package; `visimark ref`, LSP hover and `scripts/gen-function-reference.ts` all read it. Every documented example is executed against the evaluator in CI.

**Tech Stack:** TypeScript, Bun (test runner, bundler, script runner), `vscode-languageserver`, oxlint / oxfmt.

**Spec:** [`docs/design/function-reference-spec.md`](function-reference-spec.md)

## Global Constraints

- **The playground is out of scope for this plan.** Spec §5.1 is deferred to a
  later change. Nothing here touches
  `packages/visimark/src/playground/`, `docs/playground.html`, or
  `docs/vendor/visimark-browser.js`. The browser bundle must be byte-identical
  when this plan is done, so the `playground-bundle` CI job stays green without
  a rebuild.
- **`eval/functions.ts` gains no prose.** It keeps `kind` and `arity` only. The
  evaluator must not depend on documentation.
- **`FnError.when` is a noun phrase**, never a sentence: "a negative operand",
  "an empty column", "a non-whole `months`". It is rendered into
  `{when} is a {code} error` and into `{when} -> {code}`; a clause reads
  correctly in neither.
- **Nothing is derived from or written to [`docs/vocab/`](../vocab/).** Those
  are decision records and stay hand-written.
- **No free-prose caveats field.** Everything is a typed `error` or an
  executable `example`.
- **Every `code` value must be a real `FindingCode`** from
  `packages/visimark/src/model/types.ts`.
- Run `bun run format` and `bun run lint` before any commit. CI fails on
  `oxfmt --check` and `oxlint --max-warnings 0`.
- Commit messages follow the repo's Conventional Commits style and end with the
  `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md).
  Do not copy a trailer out of this file or an older commit.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/visimark/src/eval/functions.ts` (modify) | shape table; gains `FunctionName` |
| `packages/visimark/src/lang/reference.ts` (create) | the documentation registry and its types |
| `packages/visimark/src/index.ts` (modify) | export `describeFunction`, `functionNames`, the types |
| `packages/visimark/src/cli/commands.ts` (modify) | `cmdRef` |
| `packages/visimark/src/cli/main.ts` (modify) | route `ref`; usage line |
| `packages/visimark-lsp/src/hover.ts` (modify) | function-name hover case |
| `scripts/gen-function-reference.ts` (create) | renders both generated documents |
| `docs/function-reference.md` (generated) | the full reference |
| `docs/visimark-design.md` (modify) | markers around the §4 table |
| `.github/workflows/ci.yml` (modify) | staleness job |
| `docs/cli-reference.md`, `skills/visimark/SKILL.md` (modify) | point at `ref` |

---

### Task 1: Give the function table a name type

**Files:**
- Modify: `packages/visimark/src/eval/functions.ts:28-44`
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type FunctionName` (a union of the thirteen literals);
  `FUNCTIONS` keeps its existing `ReadonlyMap<string, FnSpec>` type so every
  current consumer is untouched.

- [ ] **Step 1: Write the failing test**

Append to `packages/visimark/test/eval/functions.test.ts`:

```ts
import { FUNCTION_TABLE } from "../../src/eval/functions.js";

test("the function table and the exported map agree", () => {
  const fromTable = Object.keys(FUNCTION_TABLE).sort();
  const fromMap = [...FUNCTIONS.keys()].sort();
  expect(fromMap).toEqual(fromTable);
  expect(fromTable).toHaveLength(13);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark/test/eval/functions.test.ts`
Expected: FAIL — `FUNCTION_TABLE` is not exported.

- [ ] **Step 3: Rewrite the table as a const record**

In `packages/visimark/src/eval/functions.ts`, replace the `FUNCTIONS` map
literal with:

```ts
/**
 * The table itself. Written as a `const` record rather than a `Map` literal so
 * that the set of function names is a type — `lang/reference.ts` keys its
 * documentation by it, and a function added here without a reference entry
 * fails `typecheck` rather than shipping undocumented.
 */
export const FUNCTION_TABLE = {
  // reduces: one column reference in, one scalar out
  SUM: { kind: "reduce", arity: 1 },
  MIN: { kind: "reduce", arity: 1 },
  MAX: { kind: "reduce", arity: 1 },
  COUNT: { kind: "reduce", arity: 1 },
  AVG: { kind: "reduce", arity: 1 },
  // maps: scalars in, one scalar out
  ROUND: { kind: "map", arity: 2 },
  ABS: { kind: "map", arity: 1 },
  MOD: { kind: "map", arity: 2 },
  SQRT: { kind: "map", arity: 1 },
  FLOOR: { kind: "map", arity: 2 },
  CEILING: { kind: "map", arity: 2 },
  IF: { kind: "map", arity: 3 },
  EOMONTH: { kind: "map", arity: 2 },
} as const satisfies Record<string, FnSpec>;

/** Every builtin function name, as a type. */
export type FunctionName = keyof typeof FUNCTION_TABLE;

export const FUNCTIONS: ReadonlyMap<string, FnSpec> = new Map(Object.entries(FUNCTION_TABLE));
```

- [ ] **Step 4: Run the full suite**

Run: `bun test`
Expected: PASS — no existing consumer sees a change.

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/eval/functions.ts packages/visimark/test/eval/functions.test.ts
git commit
```

Message: `refactor: derive the function-name type from the builtin table`

---

### Task 2: The reference registry

**Files:**
- Create: `packages/visimark/src/lang/reference.ts`
- Test: `packages/visimark/test/lang/reference.test.ts` (create)

**Interfaces:**
- Consumes: `FunctionName`, `FUNCTION_TABLE`, `FnSpec` from Task 1;
  `FindingCode` from `../model/types.js`.
- Produces: `FnParam`, `FnError`, `FnExample`, `FnDoc`, `FUNCTION_DOCS`.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/lang/reference.test.ts`:

```ts
import { expect, test } from "bun:test";
import { FUNCTION_TABLE } from "../../src/eval/functions.js";
import { FUNCTION_DOCS } from "../../src/lang/reference.js";
import { ERROR_CODES } from "../../src/model/types.js";

const names = Object.keys(FUNCTION_TABLE) as (keyof typeof FUNCTION_TABLE)[];

test("every builtin has a reference entry", () => {
  expect(Object.keys(FUNCTION_DOCS).sort()).toEqual([...names].sort());
});

test("each entry documents exactly as many parameters as its arity", () => {
  for (const n of names) {
    expect(FUNCTION_DOCS[n].params).toHaveLength(FUNCTION_TABLE[n].arity);
  }
});

test("every documented error code is a real error finding code", () => {
  for (const n of names) {
    for (const e of FUNCTION_DOCS[n].errors) expect(ERROR_CODES.has(e.code)).toBe(true);
  }
});

test("every entry carries at least one example", () => {
  for (const n of names) expect(FUNCTION_DOCS[n].examples.length).toBeGreaterThan(0);
});

test("`see also` never names an unknown function", () => {
  for (const n of names) {
    for (const s of FUNCTION_DOCS[n].see ?? []) expect(names).toContain(s);
  }
});

test("an error condition is a noun phrase, not a sentence", () => {
  for (const n of names) {
    for (const e of FUNCTION_DOCS[n].errors) {
      expect(`${e.when} is a ${e.code} error`).not.toMatch(/ is .* is a /);
      expect(e.when).not.toMatch(/\.$/);
    }
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark/test/lang/reference.test.ts`
Expected: FAIL — `../../src/lang/reference.js` cannot be resolved.

- [ ] **Step 3: Write the registry types**

Create `packages/visimark/src/lang/reference.ts` beginning with:

```ts
/**
 * What each builtin function does, in a form a machine can serve.
 *
 * `eval/functions.ts` holds the shape table the evaluator turns on — `kind`
 * and `arity`, nothing else. This file holds the documentation, keyed by the
 * same names so that adding a function without documenting it fails
 * `typecheck`. Four consumers read it through `describeFunction`: `visimark
 * ref`, the language server's hover, the reference generator, and (later) the
 * playground.
 *
 * There is deliberately no free-prose "caveats" field. A surprise is stated
 * either as a typed `FnError` or as an `FnExample` that CI executes; a
 * behaviour expressible as neither is a design bug, not a documentation entry.
 */
import { FUNCTION_TABLE, type FunctionName } from "../eval/functions.js";
import type { FindingCode } from "../model/types.js";

export interface FnParam {
  name: string;
  type: "number" | "date" | "bool" | "string" | "column";
  note: string;
}

export interface FnError {
  /**
   * The offending thing, as a **noun phrase** — "a negative operand", "an
   * empty column", "a non-whole `months`". Never a sentence: this string is
   * rendered into `{when} is a {code} error` for the design-doc table and into
   * `{when} -> {code}` for `visimark ref`. A clause reads correctly in neither.
   */
  when: string;
  code: FindingCode;
}

export interface FnExample {
  /** an expression in the language */
  expr: string;
  /** what it evaluates to, rendered as the engine renders a value */
  is: string;
  /** Markdown establishing any sheet or column `expr` references */
  given?: string;
}

export interface FnDoc {
  /** one line; this becomes the `Meaning` column of the design-doc table */
  summary: string;
  /** exactly `arity` entries — asserted in `test/lang/reference.test.ts` */
  params: readonly FnParam[];
  returns: string;
  /** only where the function has rounding behaviour of its own */
  precision?: string;
  errors: readonly FnError[];
  examples: readonly FnExample[];
  see?: readonly FunctionName[];
}
```

- [ ] **Step 4: Write the five reduce entries**

A reduce's example needs a column, so each carries a `given`. Append:

```ts
const AMOUNTS = `| Amount |
|-------:|
|  10.00 |
|  20.00 |
|  30.00 |

\`\`\`vmark #t
\`\`\`
`;

export const FUNCTION_DOCS: Record<FunctionName, FnDoc> = {
  SUM: {
    summary: "total of a column",
    params: [{ name: "col", type: "column", note: "the column to total" }],
    returns: "number",
    errors: [],
    examples: [
      { expr: "SUM(t.Amount)", is: "60.00", given: AMOUNTS },
      { expr: "SUM(t.Amount) * 2", is: "120.00", given: AMOUNTS },
    ],
    see: ["AVG", "COUNT"],
  },
  MIN: {
    summary: "least value",
    params: [{ name: "col", type: "column", note: "a column of numbers, or of dates" }],
    returns: "number or date, matching the column",
    errors: [{ when: "a column mixing numbers and dates", code: "TYPE" }],
    examples: [{ expr: "MIN(t.Amount)", is: "10.00", given: AMOUNTS }],
    see: ["MAX"],
  },
  MAX: {
    summary: "greatest value",
    params: [{ name: "col", type: "column", note: "a column of numbers, or of dates" }],
    returns: "number or date, matching the column",
    errors: [{ when: "a column mixing numbers and dates", code: "TYPE" }],
    examples: [{ expr: "MAX(t.Amount)", is: "30.00", given: AMOUNTS }],
    see: ["MIN"],
  },
  COUNT: {
    summary: "number of rows",
    params: [{ name: "col", type: "column", note: "the column whose rows are counted" }],
    returns: "number",
    errors: [],
    examples: [{ expr: "COUNT(t.Amount)", is: "3", given: AMOUNTS }],
    see: ["SUM"],
  },
  AVG: {
    summary: "arithmetic mean",
    params: [{ name: "col", type: "column", note: "the column to average" }],
    returns: "number",
    errors: [{ when: "an empty column", code: "TYPE" }],
    examples: [{ expr: "AVG(t.Amount)", is: "20.00", given: AMOUNTS }],
    see: ["SUM", "COUNT"],
  },
```

Note on `SUM` over an empty column: today's design-doc cell says it is `0`.
That is a semantic, not an error, and it is not expressible as an example
without an empty table. It is carried as part of `summary` in Step 5's check —
see Task 8, Step 4, where the generated cell is compared against today's.

- [ ] **Step 5: Write the eight map entries**

Append, closing the record:

```ts
  ROUND: {
    summary: "half-up to `places` decimals",
    params: [
      { name: "x", type: "number", note: "the value to round" },
      { name: "places", type: "number", note: "how many decimal places to keep" },
    ],
    returns: "number",
    precision: "Ties round away from zero (half-up), not to even.",
    errors: [],
    examples: [
      { expr: "ROUND(2.345, 2)", is: "2.35" },
      { expr: "ROUND(2.5, 0)", is: "3" },
      { expr: "ROUND(-2.5, 0)", is: "-3" },
    ],
    see: ["FLOOR", "CEILING"],
  },
  ABS: {
    summary: "absolute value",
    params: [{ name: "x", type: "number", note: "the value whose sign is discarded" }],
    returns: "number",
    errors: [],
    examples: [
      { expr: "ABS(-7)", is: "7" },
      { expr: "ABS(7)", is: "7" },
    ],
  },
  MOD: {
    summary: "remainder",
    params: [
      { name: "x", type: "number", note: "the dividend" },
      { name: "y", type: "number", note: "the divisor" },
    ],
    returns: "number",
    errors: [],
    examples: [
      { expr: "MOD(7, 3)", is: "1" },
      { expr: "MOD(9, 3)", is: "0" },
    ],
    see: ["FLOOR"],
  },
  SQRT: {
    summary: "non-negative square root",
    params: [{ name: "x", type: "number", note: "a non-negative number" }],
    returns: "number",
    errors: [{ when: "a negative operand", code: "TYPE" }],
    examples: [
      { expr: "SQRT(9)", is: "3" },
      { expr: "SQRT(0)", is: "0" },
    ],
  },
  FLOOR: {
    summary: "greatest multiple of `s` that does not exceed `x`, toward -∞",
    params: [
      { name: "x", type: "number", note: "the value to round down" },
      { name: "s", type: "number", note: "the positive step to round to" },
    ],
    returns: "number",
    errors: [{ when: "a non-positive `s`", code: "TYPE" }],
    examples: [
      { expr: "FLOOR(7, 3)", is: "6" },
      { expr: "FLOOR(-7, 3)", is: "-9" },
    ],
    see: ["CEILING", "ROUND"],
  },
  CEILING: {
    summary: "least multiple of `s` that is not less than `x`, toward +∞",
    params: [
      { name: "x", type: "number", note: "the value to round up" },
      { name: "s", type: "number", note: "the positive step to round to" },
    ],
    returns: "number",
    errors: [{ when: "a non-positive `s`", code: "TYPE" }],
    examples: [
      { expr: "CEILING(7, 3)", is: "9" },
      { expr: "CEILING(-7, 3)", is: "-6" },
    ],
    see: ["FLOOR", "ROUND"],
  },
  IF: {
    summary: "returns `a` or `b`",
    params: [
      { name: "cond", type: "bool", note: "the condition; must be a boolean" },
      { name: "a", type: "number", note: "the value when `cond` holds" },
      { name: "b", type: "number", note: "the value when it does not" },
    ],
    returns: "whichever of `a` or `b` was selected",
    errors: [{ when: "a non-boolean `cond`", code: "TYPE" }],
    examples: [
      { expr: "IF(1 < 2, 10, 20)", is: "10" },
      { expr: "IF(1 > 2, 10, 20)", is: "20" },
    ],
  },
  EOMONTH: {
    summary: "last day of the month `months` calendar months from `d`; `d`'s day is discarded",
    params: [
      { name: "d", type: "date", note: "the date whose month starts the count" },
      { name: "months", type: "number", note: "whole number of months to move; may be negative" },
    ],
    returns: "date",
    errors: [
      { when: "a non-whole `months`", code: "TYPE" },
      { when: "a result outside years 1-9999", code: "DATE" },
    ],
    examples: [
      { expr: "EOMONTH(2026-01-15, 0)", is: "2026-01-31" },
      { expr: "EOMONTH(2026-01-31, 1)", is: "2026-02-28" },
      { expr: "EOMONTH(2024-01-31, 1)", is: "2024-02-29" },
      { expr: "EOMONTH(2026-01-15, -1)", is: "2025-12-31" },
    ],
    see: ["MIN", "MAX"],
  },
};
```

Every `EOMONTH` example above is taken from the table in
[`docs/vocab/eomonth-spec.md` §3](../vocab/eomonth-spec.md), not invented.

- [ ] **Step 6: Run the tests**

Run: `bun test packages/visimark/test/lang/reference.test.ts`
Expected: PASS, six tests.

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/visimark/src/lang/reference.ts packages/visimark/test/lang/reference.test.ts
git commit
```

Message: `feat: add the builtin function reference registry`

---

### Task 3: Execute every documented example

This is the task that makes the registry trustworthy. A wrong example must fail
the build, which is why examples are preferred to prose.

**Files:**
- Test: `packages/visimark/test/lang/reference-examples.test.ts` (create)

**Interfaces:**
- Consumes: `FUNCTION_DOCS` (Task 2), `analyze` from `../../src/index.js`.
- Produces: nothing importable; a test only.

- [ ] **Step 1: Write the harness test**

Create `packages/visimark/test/lang/reference-examples.test.ts`:

```ts
import { expect, test } from "bun:test";
import { FUNCTION_TABLE } from "../../src/eval/functions.js";
import { FUNCTION_DOCS } from "../../src/lang/reference.js";
import { analyze } from "../../src/index.js";

/**
 * Build a document whose last binding is the example expression, evaluate it,
 * and read the value back. A doc-scope binding's id is its bare name
 * (`model/build.ts`), so the binding is named `example` and read by that key.
 */
function evaluate(expr: string, given?: string): string {
  const source = `${given ?? ""}\n\`\`\`vmark\nexample = ${expr}\n\`\`\`\n`;
  const { result } = analyze(source);
  const errors = result.findings.filter((f) => f.code !== "WARN" && f.code !== "NOTE");
  expect(errors.map((f) => `${f.code} ${f.message}`)).toEqual([]);
  const v = result.values.get("example");
  if (!v) throw new Error(`no value for \`${expr}\``);
  return v.t === "num" ? v.d.toString() : v.t === "date" ? v.iso : v.t === "bool" ? String(v.b) : v.s;
}

for (const name of Object.keys(FUNCTION_TABLE) as (keyof typeof FUNCTION_TABLE)[]) {
  for (const ex of FUNCTION_DOCS[name].examples) {
    test(`${name}: ${ex.expr} is ${ex.is}`, () => {
      expect(evaluate(ex.expr, ex.given)).toBe(ex.is);
    });
  }
}
```

- [ ] **Step 2: Run it**

Run: `bun test packages/visimark/test/lang/reference-examples.test.ts`
Expected: some examples FAIL. Two failure modes are likely and both are the
registry's fault, not the harness's:

1. **Rendering mismatch** — `SUM(t.Amount)` may render `60` rather than `60.00`
   depending on the column's inferred precision. Fix the `is` field to whatever
   the engine actually produces; do not change the engine.
2. **A `given` that does not model** — the empty `` ```vmark #t `` block may not
   be enough to bind the sheet. If so, give the block a real rule
   (`Amount = Amount` is not valid) or reference the column as `t.Amount`
   without a block at all. Adjust `AMOUNTS` in `reference.ts` until the reduce
   examples evaluate, keeping it the smallest table that works.

- [ ] **Step 3: Correct the registry until every example passes**

Edit the `is` values and `AMOUNTS` fixture in
`packages/visimark/src/lang/reference.ts`. The engine is the authority; the
documentation is what changes.

- [ ] **Step 4: Verify**

Run: `bun test packages/visimark/test/lang/`
Expected: PASS, every example.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/test/lang/reference-examples.test.ts packages/visimark/src/lang/reference.ts
git commit
```

Message: `test: execute every documented function example`

---

### Task 4: The query API

**Files:**
- Modify: `packages/visimark/src/lang/reference.ts` (append)
- Modify: `packages/visimark/src/index.ts:7`
- Test: `packages/visimark/test/lang/reference.test.ts` (append)

**Interfaces:**
- Consumes: `FUNCTION_DOCS`, `FUNCTION_TABLE`.
- Produces:
  - `export type FnEntry = FnDoc & FnSpec & { name: FunctionName }`
  - `export function describeFunction(name: string): FnEntry | null`
  - `export function functionNames(): readonly FunctionName[]`

- [ ] **Step 1: Write the failing test**

Append to `packages/visimark/test/lang/reference.test.ts`:

```ts
import { describeFunction, functionNames } from "../../src/lang/reference.js";

test("describeFunction returns shape and documentation together", () => {
  const e = describeFunction("EOMONTH");
  expect(e).not.toBeNull();
  expect(e!.name).toBe("EOMONTH");
  expect(e!.kind).toBe("map");
  expect(e!.arity).toBe(2);
  expect(e!.returns).toBe("date");
});

test("describeFunction is case-sensitive and returns null for an unknown name", () => {
  expect(describeFunction("eomonth")).toBeNull();
  expect(describeFunction("NOPE")).toBeNull();
});

test("functionNames lists all thirteen", () => {
  expect(functionNames()).toHaveLength(13);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark/test/lang/reference.test.ts`
Expected: FAIL — `describeFunction` is not exported.

- [ ] **Step 3: Implement**

Append to `packages/visimark/src/lang/reference.ts`:

```ts
export type FnEntry = FnDoc & FnSpec & { name: FunctionName };

/**
 * Shape and documentation for one function, or `null` if the name is not a
 * builtin. Case-sensitive: the language's function names are upper-case, and a
 * lower-case spelling is a `TYPE` error at the call site, not a synonym here.
 */
export function describeFunction(name: string): FnEntry | null {
  if (!Object.hasOwn(FUNCTION_TABLE, name)) return null;
  const n = name as FunctionName;
  return { name: n, ...FUNCTION_TABLE[n], ...FUNCTION_DOCS[n] };
}

export function functionNames(): readonly FunctionName[] {
  return Object.keys(FUNCTION_TABLE) as FunctionName[];
}
```

- [ ] **Step 4: Export from the package**

In `packages/visimark/src/index.ts`, below the existing `FUNCTIONS` export on
line 7, add:

```ts
export {
  describeFunction,
  functionNames,
  type FnDoc,
  type FnEntry,
  type FnError,
  type FnExample,
  type FnParam,
} from "./lang/reference.js";
export type { FunctionName } from "./eval/functions.js";
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/visimark/test/lang/ && bun run typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add packages/visimark/src/lang/reference.ts packages/visimark/src/index.ts packages/visimark/test/lang/reference.test.ts
git commit
```

Message: `feat: expose describeFunction from the visimark package`

---

### Task 5: `visimark ref`

**Files:**
- Modify: `packages/visimark/src/cli/commands.ts` (append `cmdRef`)
- Modify: `packages/visimark/src/cli/main.ts:6,17,40`
- Modify: `packages/visimark/src/report/json.ts:8`
- Test: `packages/visimark/test/cli/ref.test.ts` (create)

**Interfaces:**
- Consumes: `describeFunction`, `functionNames` (Task 4); `closest` from
  `../report/levenshtein.js`; `emitJson`, `errorEnvelope`, `statusFromExit`,
  `readVersion`.
- Produces: `export function cmdRef(args: string[], out: Writer, err: Writer): number`

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/cli/ref.test.ts`:

```ts
import { expect, test } from "bun:test";
import { runCli } from "../../src/cli/main.js";

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("ref with no name lists every function", async () => {
  const c = capture();
  expect(await runCli(["ref"], c.io)).toBe(0);
  expect(c.out()).toContain("EOMONTH");
  expect(c.out()).toContain("SUM");
});

test("ref NAME prints the entry", async () => {
  const c = capture();
  expect(await runCli(["ref", "EOMONTH"], c.io)).toBe(0);
  const text = c.out();
  expect(text).toContain("EOMONTH(d, months)");
  expect(text).toContain("map, 2 arguments");
  expect(text).toContain("a non-whole `months`");
  expect(text).toContain("EOMONTH(2026-01-31, 1)");
});

test("ref reads no file and needs none", async () => {
  const c = capture();
  expect(await runCli(["ref", "SUM"], c.io)).toBe(0);
  expect(c.err()).toBe("");
});

test("an unknown name exits 2 with a suggestion", async () => {
  const c = capture();
  expect(await runCli(["ref", "EOMONTH2"], c.io)).toBe(2);
  expect(c.err()).toContain("EOMONTH");
});

test("a name unlike anything builtin gets no misleading guess", async () => {
  const c = capture();
  expect(await runCli(["ref", "ZZZZZZZZ"], c.io)).toBe(2);
  expect(c.err()).not.toContain("did you mean");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark/test/cli/ref.test.ts`
Expected: FAIL — exit 2, `unknown command \`ref\``.

- [ ] **Step 3: Implement `cmdRef`**

Append to `packages/visimark/src/cli/commands.ts`:

```ts
/**
 * `ref` is the one command that reads no file: it answers about the language,
 * not about a document. Its whole body is formatting over `describeFunction`.
 */
export function cmdRef(args: string[], out: Writer, err: Writer): number {
  const { files, flags } = parseArgs(args);
  const json = flags.has("json");
  const name = files[0];

  if (name === undefined) {
    const all = functionNames().map((n) => describeFunction(n)!);
    if (json) {
      emitJson(out, {
        command: "ref",
        visimark: readVersion(),
        status: statusFromExit(0),
        functions: all.map(publicFnEntry),
      });
    } else {
      for (const e of all) out(`${signature(e)}  —  ${e.kind}, ${plural(e.arity)}`);
    }
    return 0;
  }

  const entry = describeFunction(name);
  if (!entry) {
    const guess = closest(name, functionNames(), 3);
    const msg = `visimark: unknown function \`${name}\`` + (guess ? ` — did you mean \`${guess}\`?` : "");
    err(msg);
    if (json) emitJson(out, errorEnvelope("ref", "USAGE", msg));
    return 2;
  }

  if (json) {
    emitJson(out, {
      command: "ref",
      visimark: readVersion(),
      status: statusFromExit(0),
      function: publicFnEntry(entry),
    });
    return 0;
  }

  out(`${signature(entry)} — ${entry.kind}, ${plural(entry.arity)}`);
  out("");
  out(`  ${entry.summary}.`);
  out("");
  const pad = Math.max(...entry.params.map((p) => p.name.length), 7);
  for (const p of entry.params) {
    out(`  ${p.name.padEnd(pad)}  ${p.type.padEnd(7)}  ${p.note}`);
  }
  out("");
  out(`  returns  ${entry.returns}`);
  if (entry.precision) {
    out("");
    out(`  precision  ${entry.precision}`);
  }
  if (entry.errors.length > 0) {
    out("");
    out("  errors");
    const w = Math.max(...entry.errors.map((e) => e.when.length));
    for (const e of entry.errors) out(`    ${e.when.padEnd(w)}   ${e.code}`);
  }
  out("");
  out("  examples");
  const w = Math.max(...entry.examples.map((e) => e.expr.length));
  for (const e of entry.examples) out(`    ${e.expr.padEnd(w)}  = ${e.is}`);
  if (entry.see && entry.see.length > 0) {
    out("");
    out(`  see also  ${entry.see.join(", ")}`);
  }
  return 0;
}

function signature(e: FnEntry): string {
  return `${e.name}(${e.params.map((p) => p.name).join(", ")})`;
}

function plural(n: number): string {
  return `${n} argument${n === 1 ? "" : "s"}`;
}

function publicFnEntry(e: FnEntry): object {
  return {
    name: e.name,
    kind: e.kind,
    arity: e.arity,
    signature: signature(e),
    summary: e.summary,
    params: e.params.map((p) => ({ name: p.name, type: p.type, note: p.note })),
    returns: e.returns,
    ...(e.precision ? { precision: e.precision } : {}),
    errors: e.errors.map((x) => ({ when: x.when, code: x.code })),
    examples: e.examples.map((x) => ({ expr: x.expr, is: x.is })),
    ...(e.see ? { see: [...e.see] } : {}),
  };
}
```

Add to the imports at the top of `commands.ts`:

```ts
import { describeFunction, functionNames, type FnEntry } from "../lang/reference.js";
import { closest } from "../report/levenshtein.js";
```

- [ ] **Step 4: Widen `CommandName`**

In `packages/visimark/src/report/json.ts:8`, change:

```ts
export type CommandName = "check" | "fmt" | "infer" | "eval" | "explain" | "ref";
```

- [ ] **Step 5: Route it**

In `packages/visimark/src/cli/main.ts`, add `cmdRef` to the import on line 2,
add a case before `-v`:

```ts
    case "ref":
      return cmdRef(rest, out, err);
```

and add to `USAGE`, after the `explain` line:

```
  visimark ref   [NAME] [--json]        the language's builtin functions
```

- [ ] **Step 6: Run the tests**

Run: `bun test packages/visimark/test/cli/ref.test.ts`
Expected: PASS, five tests.

Run: `bun test && bun run typecheck && bun run lint && bun run format`
Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add packages/visimark/src/cli packages/visimark/src/report/json.ts packages/visimark/test/cli/ref.test.ts
git commit
```

Message: `feat: add visimark ref`

---

### Task 6: `visimark ref --json`

**Files:**
- Test: `packages/visimark/test/cli/ref.test.ts` (append)

The implementation landed in Task 5; this task proves the envelope.

**Interfaces:**
- Consumes: `cmdRef` (Task 5).
- Produces: nothing.

- [ ] **Step 1: Write the test**

Append to `packages/visimark/test/cli/ref.test.ts`:

```ts
test("ref --json emits the structured envelope", async () => {
  const c = capture();
  expect(await runCli(["ref", "EOMONTH", "--json"], c.io)).toBe(0);
  const doc = JSON.parse(c.out());
  expect(doc.command).toBe("ref");
  expect(doc.status).toBe("ok");
  expect(typeof doc.visimark).toBe("string");
  expect(doc.function.name).toBe("EOMONTH");
  expect(doc.function.signature).toBe("EOMONTH(d, months)");
  expect(doc.function.errors).toContainEqual({ when: "a non-whole `months`", code: "TYPE" });
});

test("ref --json with no name lists every function", async () => {
  const c = capture();
  expect(await runCli(["ref", "--json"], c.io)).toBe(0);
  expect(JSON.parse(c.out()).functions).toHaveLength(13);
});

test("ref --json on an unknown name emits the error envelope", async () => {
  const c = capture();
  expect(await runCli(["ref", "NOPE", "--json"], c.io)).toBe(2);
  const doc = JSON.parse(c.out());
  expect(doc.status).toBe("error");
  expect(doc.error.code).toBe("USAGE");
});

test("an unrecognised flag is ignored, as elsewhere in the CLI", async () => {
  const c = capture();
  expect(await runCli(["ref", "SUM", "--jsonn"], c.io)).toBe(0);
  expect(c.out()).toContain("SUM(col)");
});
```

- [ ] **Step 2: Run**

Run: `bun test packages/visimark/test/cli/ref.test.ts`
Expected: PASS, nine tests.

- [ ] **Step 3: Commit**

```bash
git add packages/visimark/test/cli/ref.test.ts
git commit
```

Message: `test: cover the ref JSON envelope`

---

### Task 7: Hover on a function name

**Files:**
- Modify: `packages/visimark-lsp/src/hover.ts:28` (a new case before the binding loop)
- Test: `packages/visimark-lsp/test/hover.test.ts` (append; create if absent)

**Interfaces:**
- Consumes: `describeFunction` from `visimark` (Task 4); `Analysis` from
  `./analysis.js`.
- Produces: nothing importable.

- [ ] **Step 1: Write the failing test**

Append to `packages/visimark-lsp/test/hover.test.ts` (match the file's existing
imports and document-construction helper; if the file does not exist, model it
on `packages/visimark-lsp/test/` siblings):

```ts
test("hovering a function name shows its reference entry", () => {
  const src = "```vmark #t\ntotal = SUM(t.Amount)\n```\n";
  const { doc, analysis } = analyzed(src);
  const at = src.indexOf("SUM") + 1;
  const h = hoverAt(doc, analysis, doc.positionAt(at));
  expect(String(h?.contents ?? "")).toContain("total of a column");
});

test("hovering an argument inside a call still shows the binding, not the function", () => {
  const src = "```vmark #t\ntotal = SUM(t.Amount)\n```\n";
  const { doc, analysis } = analyzed(src);
  const at = src.indexOf("t.Amount") + 2;
  const h = hoverAt(doc, analysis, doc.positionAt(at));
  expect(String(h?.contents ?? "")).not.toContain("total of a column");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark-lsp/test/hover.test.ts`
Expected: FAIL — the first test finds no function documentation.

- [ ] **Step 3: Implement**

In `packages/visimark-lsp/src/hover.ts`, extend the `visimark` import on line 3
with `describeFunction` and add, immediately after the `allBindings` array is
built and **before** the binding loop:

```ts
  // A function name, hovered inside a `vmark` block. `Call` spans cover the
  // whole call including its arguments, so hovering `Net` in `SUM(Net)` would
  // match `SUM` too. Narrow to the name token, and let the innermost call win
  // where calls nest.
  const nameHit = innermostCallNameAt(allBindings, off);
  if (nameHit) {
    const e = describeFunction(nameHit);
    if (e) {
      const params = e.params.map((p) => `- \`${p.name}\` (${p.type}) — ${p.note}`).join("\n");
      const errors = e.errors.map((x) => `- ${x.when} → \`${x.code}\``).join("\n");
      return md(
        "```vmark\n" +
          `${e.name}(${e.params.map((p) => p.name).join(", ")})\n` +
          "```\n\n" +
          `${e.summary}.\n\n${params}\n\nreturns: ${e.returns}` +
          (errors ? `\n\nerrors:\n${errors}` : ""),
      );
    }
  }
```

and add this helper at the bottom of the file:

```ts
/** The name of the innermost call whose *name token* covers `off`, if any. */
function innermostCallNameAt(bindings: Binding[], off: number): string | null {
  let best: { name: string; width: number } | null = null;
  const visit = (e: Expr): void => {
    if (e.type === "call") {
      const nameEnd = e.start + e.name.length;
      if (off >= e.start && off < nameEnd) {
        const width = e.end - e.start;
        if (!best || width < best.width) best = { name: e.name, width };
      }
      for (const a of e.args) visit(a);
    } else if (e.type === "binary") {
      visit(e.left);
      visit(e.right);
    } else if (e.type === "unary") {
      visit(e.operand);
    }
  };
  for (const b of bindings) visit(b.expr);
  return best ? best.name : null;
}
```

Import `Expr` alongside `Binding`. If `Expr` is not currently exported from the
`visimark` package index, add `export type { Expr } from "./lang/ast.js";` to
`packages/visimark/src/index.ts` and re-run `bun run typecheck` in both
packages.

- [ ] **Step 4: Run the tests**

Run: `bun test packages/visimark-lsp && bun run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark-lsp packages/visimark/src/index.ts
git commit
```

Message: `feat(lsp): hover a function name for its reference entry`

---

### Task 8: Generate the two documents

**Files:**
- Create: `scripts/gen-function-reference.ts`
- Create: `docs/function-reference.md` (generated output, committed)
- Modify: `docs/visimark-design.md:259-273` (markers around the table)
- Modify: `package.json` (a `gen:docs` script)
- Test: `packages/visimark/test/lang/reference-docs.test.ts` (create)

**Interfaces:**
- Consumes: `describeFunction`, `functionNames` (Task 4).
- Produces: `export function renderReference(): string` and
  `export function renderTable(): string` from the script, so the test can call
  them without spawning a process.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/lang/reference-docs.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderReference, renderTable } from "../../../../scripts/gen-function-reference.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

test("docs/function-reference.md is current", () => {
  expect(readFileSync(join(root, "docs/function-reference.md"), "utf8")).toBe(renderReference());
});

test("the design doc's function table is current", () => {
  const design = readFileSync(join(root, "docs/visimark-design.md"), "utf8");
  expect(design).toContain(renderTable());
});

test("the generated Meaning column carries the error clauses", () => {
  const table = renderTable();
  expect(table).toContain("an empty column is a `TYPE` error");
  expect(table).toContain("a negative operand is a `TYPE` error");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark/test/lang/reference-docs.test.ts`
Expected: FAIL — the script does not exist.

- [ ] **Step 3: Write the generator**

Create `scripts/gen-function-reference.ts`:

```ts
/**
 * Renders the two generated function documents from `lang/reference.ts`.
 *
 * `docs/function-reference.md` is the whole file. The table in
 * `docs/visimark-design.md` §4 is replaced between HTML-comment markers;
 * everything outside them — the shape prose, the exact-arity paragraph, the
 * `Σ` alias note — is hand-written and untouched.
 *
 * Run with `bun run gen:docs`. CI re-runs it and fails on a diff.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeFunction, functionNames, type FnEntry } from "../packages/visimark/src/lang/reference.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BEGIN = "<!-- generated: function-table — `bun run gen:docs` -->";
const END = "<!-- /generated: function-table -->";

const entries = (): FnEntry[] => functionNames().map((n) => describeFunction(n)!);
const sig = (e: FnEntry): string => `${e.name}(${e.params.map((p) => p.name).join(", ")})`;

/**
 * The `Meaning` cell: the summary, then each error rendered back into the
 * prose form the hand-written table used. This is why `FnError.when` must be a
 * noun phrase.
 */
const meaning = (e: FnEntry): string =>
  [e.summary, ...e.errors.map((x) => `${x.when} is a \`${x.code}\` error`)].join("; ");

export function renderTable(): string {
  const rows = entries().map(
    (e) => `| \`${sig(e)}\` | ${e.kind} | ${e.arity} | ${meaning(e)} |`,
  );
  return [
    BEGIN,
    "",
    "| Function | Kind | Arity | Meaning |",
    "|----------|------|------:|---------|",
    ...rows,
    "",
    "Parameters, precision and worked examples for each:",
    "[`function-reference.md`](function-reference.md), or `visimark ref NAME`.",
    "",
    END,
  ].join("\n");
}

export function renderReference(): string {
  const section = (e: FnEntry): string => {
    const lines: string[] = [];
    lines.push(`## \`${sig(e)}\``, "");
    lines.push(`${e.summary[0]!.toUpperCase()}${e.summary.slice(1)}.`, "");
    lines.push(`**Shape:** ${e.kind}, ${e.arity} argument${e.arity === 1 ? "" : "s"}.`, "");
    lines.push("| Parameter | Type | Meaning |", "|---|---|---|");
    for (const p of e.params) lines.push(`| \`${p.name}\` | ${p.type} | ${p.note} |`);
    lines.push("", `**Returns:** ${e.returns}.`, "");
    if (e.precision) lines.push(`**Precision:** ${e.precision}`, "");
    if (e.errors.length > 0) {
      lines.push("**Errors**", "");
      for (const x of e.errors) lines.push(`- ${x.when} — \`${x.code}\``);
      lines.push("");
    }
    lines.push("**Examples**", "", "```vmark");
    for (const x of e.examples) lines.push(`${x.expr}  =  ${x.is}`);
    lines.push("```", "");
    if (e.see && e.see.length > 0) {
      lines.push(`**See also:** ${e.see.map((s) => `\`${s}\``).join(", ")}`, "");
    }
    return lines.join("\n");
  };

  const all = entries();
  const head = [
    "# VisiMark function reference",
    "",
    "**Generated from `packages/visimark/src/lang/reference.ts` by",
    "`bun run gen:docs`. Do not edit this file by hand — edit the registry.**",
    "",
    "Every example below is executed against the evaluator in CI",
    "(`packages/visimark/test/lang/reference-examples.test.ts`), so an example",
    "that stops being true fails the build.",
    "",
    "The narrative account of the language is",
    "[`visimark-design.md`](visimark-design.md); why each function exists is in",
    "[`vocab/`](vocab/). This file answers only what each one does.",
    "",
    "## Reduces",
    "",
    "A reduce is column → scalar and takes a bare column reference, never an",
    "expression.",
    "",
  ];
  const reduces = all.filter((e) => e.kind === "reduce").map(section);
  const maps = all.filter((e) => e.kind === "map").map(section);
  return [
    ...head,
    ...reduces,
    "## Maps",
    "",
    "A map is scalar → scalar and runs once per row inside a column rule.",
    "",
    ...maps,
  ].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function main(): void {
  writeFileSync(join(ROOT, "docs/function-reference.md"), renderReference());
  const path = join(ROOT, "docs/visimark-design.md");
  const design = readFileSync(path, "utf8");
  const a = design.indexOf(BEGIN);
  const b = design.indexOf(END);
  if (a === -1 || b === -1) throw new Error("function-table markers not found in visimark-design.md");
  writeFileSync(path, design.slice(0, a) + renderTable() + design.slice(b + END.length));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) main();
```

- [ ] **Step 4: Insert the markers, keeping every fact**

In `docs/visimark-design.md`, replace lines 259-273 (the table, which the
maintainer has selected in the editor) with the two marker lines:

```
<!-- generated: function-table — `bun run gen:docs` -->
<!-- /generated: function-table -->
```

Before doing so, move `MOD`'s clause out of the table: it is a fact about the
language, not about `MOD`. Add to the prose below the table, next to the
exact-arity paragraph:

> The language has no `%` operator; `MOD(x, y)` is how a remainder is written.

- [ ] **Step 5: Add the script and generate**

In the root `package.json` `scripts`, after `"format:check"`, add:

```json
    "gen:docs": "bun scripts/gen-function-reference.ts",
```

Run: `bun run gen:docs`

- [ ] **Step 6: Read the diff — this is the acceptance gate**

Run: `git diff docs/visimark-design.md`

Compare the generated table against the original, which is in git history at
`git show HEAD:docs/visimark-design.md | sed -n '259,273p'`. **Every fact in the
old table must appear in the new one or in the prose.** Byte-identity is not
expected and is not the test. Where a fact is missing, add it to the registry
as an `error` or fold it into the `summary` — never by hand-editing the
generated output.

Known differences to expect and accept:
- `MOD`'s `%` clause has moved to prose (Step 4).
- `SUM`'s "`0` over an empty column" must be kept inside `summary`; if the
  generated cell has lost it, change `SUM.summary` to
  `"total of a column; \`0\` over an empty column"` and regenerate.
- The new two-line pointer to `function-reference.md` below the table.

- [ ] **Step 7: Run the tests**

Run: `bun test packages/visimark/test/lang/reference-docs.test.ts`
Expected: PASS, three tests.

Run: `bun test && bun run typecheck && bun run lint && bun run format`
Expected: PASS, clean.

- [ ] **Step 8: Confirm the browser bundle is untouched**

Run: `git status --porcelain docs/vendor/`
Expected: no output. If `docs/vendor/` has changed, something imported the
registry into the playground graph — revert it; the playground is out of scope
(Global Constraints).

- [ ] **Step 9: Commit**

```bash
git add scripts/gen-function-reference.ts docs/function-reference.md docs/visimark-design.md package.json packages/visimark/test/lang/reference-docs.test.ts
git commit
```

Message: `feat: generate the function reference and the design-doc table`

---

### Task 9: CI staleness job

**Files:**
- Modify: `.github/workflows/ci.yml` (a new job after `playground-bundle`)

**Interfaces:**
- Consumes: `bun run gen:docs` (Task 8).
- Produces: nothing.

- [ ] **Step 1: Add the job**

After the `playground-bundle` job in `.github/workflows/ci.yml`, add:

```yaml
  # The generated function documents must match the registry. Modelled on
  # `playground-bundle`, but Bun is not pinned: the output is Markdown rendered
  # by our own script, so there is no minifier whose version could churn it.
  function-reference:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - name: the generated function reference must match the registry
        run: |
          bun run gen:docs
          if ! git diff --exit-code -- docs/function-reference.md docs/visimark-design.md; then
            echo "::error::The generated function documents are stale. Run 'bun run gen:docs' and commit the result."
            exit 1
          fi
```

- [ ] **Step 2: Verify locally**

Run:

```bash
bun run gen:docs && git diff --exit-code -- docs/function-reference.md docs/visimark-design.md && echo CLEAN
```

Expected: `CLEAN`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit
```

Message: `ci: fail when the generated function reference is stale`

---

### Task 10: Point the docs and the skill at it

**Files:**
- Modify: `docs/cli-reference.md:17-25,33-43`
- Modify: `skills/visimark/SKILL.md`
- Modify: `README.md` (only if it enumerates commands)

**Interfaces:**
- Consumes: `visimark ref` (Task 5).
- Produces: nothing.

- [ ] **Step 1: Add the command row**

In `docs/cli-reference.md`, after the `explain` row of the Commands table:

```
| `visimark ref [NAME]` | Prints the reference entry for a builtin function, or lists them all | nothing — the only command that reads no file | nothing | `NAME` is not a builtin function |
```

Add to the Options table:

```
| `--json` | also `ref` | — extend the existing `--json` row's command list rather than adding a second row. |
```

Apply that as an edit to the existing `--json` row: its command list becomes
`` `check`, `fmt`, `infer`, `eval`, `explain`, `ref` ``.

Add a sentence below the Commands table:

> `ref` answers about the language rather than about a document, which is why
> it takes no file. The same entries are in
> [`function-reference.md`](function-reference.md).

- [ ] **Step 2: Point the skill at it**

In `skills/visimark/SKILL.md`, add to the rules section:

> **Do not guess a function's behaviour.** `visimark ref NAME` prints its
> signature, parameters, return type, errors and worked examples;
> `visimark ref` lists all thirteen. `visimark ref NAME --json` is the
> machine-readable form. The same content is in
> [`docs/function-reference.md`](../../docs/function-reference.md).

Remove any hand-copied per-function behaviour this makes redundant. Keep the
rules that are about the language rather than one function — map versus reduce,
cross-sheet qualification must be aggregated.

- [ ] **Step 3: Check the README**

Run: `grep -n "visimark explain\|visimark eval" README.md`

If the README enumerates the commands, add `ref` alongside them. If it does
not, change nothing.

- [ ] **Step 4: Verify**

Run: `bun test && bun run typecheck && bun run lint && bun run format:check`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add docs/cli-reference.md skills/visimark/SKILL.md README.md
git commit
```

Message: `docs: point the CLI reference and the skill at visimark ref`

---

## Done when

1. `bun test` passes, including every documented example.
2. `bun run typecheck`, `bun run lint`, `bun run format:check` are clean.
3. Adding an entry to `FUNCTION_TABLE` without one in `FUNCTION_DOCS` fails
   `bun run typecheck`. Verify by hand once, then revert.
4. `visimark ref EOMONTH`, `visimark ref`, `visimark ref NOPE` and
   `visimark ref EOMONTH --json` behave as Task 5 and Task 6 assert.
5. Hovering `SUM` in `SUM(Net)` shows the reference; hovering `Net` shows the
   binding.
6. `bun run gen:docs` leaves the working tree clean.
7. `git status --porcelain docs/vendor/` is empty — the playground is untouched.

## Deferred

- The playground reference panel (spec §5.1).
- `MOD`'s behaviour on negative operands is deliberately undocumented: the
  design doc does not state it and this plan does not invent it. Pin the
  behaviour, then add the example.
- A `--verbose` link from a `TYPE` finding into the reference.
- Reference entries for operators.
