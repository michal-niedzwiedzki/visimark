# EOMONTH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `EOMONTH(d, months)` — a tenth builtin, map-shaped, `(date, integer) → date` — returning the last day of the month `months` calendar months from `d`, per `docs/vocab/eomonth.md`.

**Architecture:** The primitive is a pure calendar function (`eomonth`) in `eval/dates.ts` beside `addDays` / `daysBetween`, built on the existing `daysInMonth` / `isLeap`. It is registered in the one builtin table (`eval/functions.ts`) as `{ kind: "map", arity: 2 }`, which is all the dependency walk, the arity check and the did-you-mean suggestion need. `eval/evaluate.ts` gains an `EOMONTH` case in the map switch, an `asDate` operand helper mirroring `asNum`, and the integer check on `months`. Out-of-range results (result year outside 1–9999) raise a new `DateError` (a subclass of `EvalError`), which `eval/check.ts` surfaces as a `DATE` finding rather than the default `TYPE` by emitting `e.code` instead of a hardcoded string. No parser, model, write, LSP or infer change.

**Tech Stack:** TypeScript; `decimal.js` (already the numeric core); Bun test runner; the engine package `packages/visimark`.

**Spec:** `docs/vocab/eomonth.md`

## Global Constraints

- No new npm dependencies.
- No change to `lang/`, `parse/`, `model/`, `write/`, `infer/`, or `packages/visimark-lsp` — verified: the parser is function-agnostic (`lang/` builds a call node for any name), completion/hover carry no builtin list, and `infer` never proposes named functions.
- `EvalError`'s `code` is today `readonly code = "TYPE" as const`. Widen it to `readonly code: "TYPE" | "DATE"` with default `"TYPE"`; `DateError` sets `"DATE"`. Both `catch` blocks in `check.ts` then emit `e.code`, not the literal `"TYPE"`.
- Rounding / precision is untouched — a date is not a decimal.
- Every commit ends with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Work on branch `vocab/issue-6-eomonth-impl` (the spec PR #8); do not open a new PR.
- Acceptance additions are unit tests + one test-only fixture (`packages/visimark/test/fixtures/`). `docs/example-invoice.md` and `docs/example-invoice-drift.md` stay byte-for-byte identical and the §13 transcript does not move.

---

### Task 1: `eomonth` calendar function

**Files:**
- Edit: `packages/visimark/src/eval/dates.ts`
- Edit: `packages/visimark/src/eval/value.ts` (add `DateError`)
- Test: `packages/visimark/test/eval/dates.test.ts`

**Interfaces:**
- Produces: `export function eomonth(iso: string, months: number): string` — `iso` a valid `YYYY-MM-DD`, `months` an integer (caller guarantees integrality; this function does not re-check it). Returns a valid `YYYY-MM-DD`.
- Produces: `export class DateError extends EvalError` with `readonly code = "DATE"`.
- Consumes: existing `daysInMonth(y, m)`.

- [ ] **Step 1: `DateError`**

In `value.ts`, widen `EvalError`:
```ts
export class EvalError extends Error {
  readonly code: "TYPE" | "DATE" = "TYPE";
  constructor(message: string) { super(message); this.name = "EvalError"; }
}
export class DateError extends EvalError {
  override readonly code = "DATE" as const;
  constructor(message: string) { super(message); this.name = "DateError"; }
}
```

- [ ] **Step 2: `eomonth`**

In `dates.ts`:
```ts
export function eomonth(iso: string, months: number): string {
  const [y, m] = iso.split("-").map(Number) as [number, number, number];
  const zeroBased = (y * 12 + (m - 1)) + months;      // months since year 0, month 0
  const ty = Math.floor(zeroBased / 12);
  const tm = zeroBased - ty * 12 + 1;                  // 1..12
  if (ty < 1 || ty > 9999) {
    throw new DateError(`EOMONTH result ${ty}-${String(tm).padStart(2, "0")} is outside the supported date range`);
  }
  return `${String(ty).padStart(4, "0")}-${String(tm).padStart(2, "0")}-${String(daysInMonth(ty, tm)).padStart(2, "0")}`;
}
```
Import `DateError` from `value.js` (watch for an import cycle — `value.ts` must not import `dates.ts`; it does not today, keep it that way).

- [ ] **Step 3: tests** — every row of the spec §3 table; plus month-13 and month-0 carries both directions; Feb in a leap (2024) and non-leap (2026) year; `eomonth("0001-01-15", 0)` succeeds, `eomonth("0001-01-15", -1)` throws `DateError`; `eomonth("9999-12-01", 0)` succeeds, `eomonth("9999-12-01", 1)` throws `DateError`.

**Verify:** `bun test packages/visimark/test/eval/dates.test.ts`

---

### Task 2: register `EOMONTH` and wire the evaluator

**Files:**
- Edit: `packages/visimark/src/eval/functions.ts`
- Edit: `packages/visimark/src/eval/evaluate.ts`
- Test: `packages/visimark/test/eval/functions.test.ts`

**Interfaces:**
- Consumes: Task 1's `eomonth`.
- Produces: `EOMONTH` resolvable as `{ kind: "map", arity: 2 }`; `callProblem("EOMONTH", args)` returns `{kind:"arity"}` for 1 or 3 args, `null` for 2; the evaluator returns a `date` value or throws `EvalError` / `DateError`.

- [ ] **Step 1: table row**

In `functions.ts` `FUNCTIONS`, after `["IF", …]`:
```ts
["EOMONTH", { kind: "map", arity: 2 }],
```
Nothing else in that file changes — `closest(call.name, FUNCTIONS.keys(), …)` in `check.ts` picks the name up for did-you-mean automatically.

- [ ] **Step 2: `asDate` helper** in `evaluate.ts`, beside `asNum`:
```ts
function asDate(v: Value, what: string): string {
  if (v.t !== "date") throw new EvalError(`${what} expects a date`);
  return v.iso;
}
```

- [ ] **Step 3: `EOMONTH` case** in `evalCall`'s map `switch`:
```ts
case "EOMONTH": {
  const d = asDate(vals[0]!, "EOMONTH");
  const mo = asNum(vals[1]!, "EOMONTH");
  if (!mo.isInteger()) throw new EvalError("EOMONTH expects a whole number of months");
  return date(eomonth(d, mo.toNumber()));
}
```
Import `eomonth` from `./dates.js`. Order of checks: date first, then number, then integrality — so `EOMONTH("x", 1.5)` blames the date, matching "first bad argument".

- [ ] **Step 4: tests** — registration and `callProblem` arity cases; `EOMONTH(date("2026-01-15"), num(2))` → `date("2026-03-31")`; `EOMONTH(num(1), num(1))`, `EOMONTH(date(...), str("x"))`, `EOMONTH(date(...), num(2.5))` each throw `EvalError`; `EOMONTH(date("9999-12-01"), num(1))` throws `DateError`.

**Verify:** `bun test packages/visimark/test/eval/functions.test.ts`

---

### Task 3: `DATE` finding for an out-of-range result

**Files:**
- Edit: `packages/visimark/src/eval/check.ts` (the `evalColumn` catch ~L340 and the `evalScalar` catch ~L429)
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: `DateError` / the widened `EvalError.code`.
- Produces: a computed binding whose `EOMONTH` result leaves the date range emits **one** `DATE` finding on the binding; downstream rows/bindings get the existing `NOTE` suppression.

- [ ] **Step 1:** in both `catch (e)` blocks, the `e instanceof EvalError` branch currently hardcodes `code: "TYPE"`. Change to `code: e.code`. `DateError instanceof EvalError` is true, so the branch still fires; only the code differs. Confirm the `NOTE` roll-up message ("… not verified (upstream DATE errors)") still reads correctly — it already says "DATE".

- [ ] **Step 2: tests**
  - `due = EOMONTH(issued, 2)` with `issued = 2026-01-15` → no finding, `eval` gives `2026-03-31`.
  - `far = EOMONTH(edge, 1)` with `edge = 9999-12-01` → exactly one `DATE` finding named `far`, no `TYPE`.
  - a column rule `End = EOMONTH(Start, 1)` where one row's `Start` pushes out of range → one `DATE` finding + one `NOTE` for the suppressed row, other rows still verified.
  - `EOMONTH(issued)` (arity 1) → one `TYPE` finding, statically (unchanged path).

**Verify:** `bun test packages/visimark/test/eval/check.test.ts`

---

### Task 4: end-to-end fixture and CLI check

**Files:**
- Create: `packages/visimark/test/fixtures/eomonth-terms.md`
- Create: `packages/visimark/test/cli/eomonth.test.ts`

**Interfaces:**
- Consumes: the whole pipeline from Tasks 1–3.
- Produces: proof that `visimark check` is clean and `visimark eval --get terms.due` prints `2026-03-31` for the motivating document.

- [ ] **Step 1: fixture** — the issue's document, made otherwise-clean by supplying `vat` in a document-scope block:
```markdown
## Lines

| Item                | Unit | Qty |    Rate |     Net |
|---------------------|------|----:|--------:|--------:|
| Consulting          | day  |   6 | 1600.00 | 9600.00 |
| Integration support | hour |  32 |  210.00 | 6720.00 |

```vmark
vat = 23%
```

```vmark #lines
Net = Qty * Rate

subtotal    = SUM(Net)
vat_total   = SUM(Net) * vat
gross_total = SUM(Net) + vat_total
```

Net of tax the work comes to **16320.00**<!--vmark=lines.subtotal--> PLN,
**20073.60**<!--vmark=lines.gross_total--> PLN gross.

## Payment terms

```vmark #terms
issued = 2026-01-15
due    = EOMONTH(issued, 2)
```

Terms are net two months, end of month. Payment falls due
**2026-03-31**<!--vmark=terms.due-->.
```
(Confirm the anchored `subtotal` / `gross_total` / `due` values are the ones the engine computes; adjust the literals so `check` is clean, not the formulas.)

- [ ] **Step 2: test** — mirror the existing `test/cli/*.test.ts` style: run `check` on the fixture, assert exit 0 and "0 problems"; run `eval --get terms.due`, assert stdout `2026-03-31`.

**Verify:** `bun test packages/visimark/test/cli/eomonth.test.ts`

---

### Task 5: documentation

**Files:**
- Edit: `docs/visimark-design.md` (§4 builtin table, §5 month note, the "Nine, chosen…" sentence)
- Edit: `docs/cli-reference.md` (if it enumerates builtins)
- Edit: `docs/vocabulary-catalogue.md` (the EOMONTH row)

**Interfaces:**
- Consumes: shipped behaviour from Tasks 1–4.
- Produces: the design doc describes ten builtins and no longer implies `EOMONTH` is unavailable.

- [ ] **Step 1: §4** — add the row to the builtin table:
  `| \`EOMONTH(d, months)\` | map | 2 | last day of the month \`months\` calendar months from \`d\`; \`months\` is a whole number, \`d\`'s day is discarded |`
  and change "Nine, chosen to cover the examples and nothing more" → "Ten" (and re-read the surrounding sentence so it still parses).

- [ ] **Step 2: §5** — the line "A month type is the omission a reporting table will miss first" stays true, but add a clause that `EOMONTH` covers the end-of-month case without one. Keep it to a sentence.

- [ ] **Step 3: §3 opening** — "The language ships **nine functions and a fixed operator set**" appears in `docs/vocabulary-catalogue.md` line 3 too — update both to "ten functions".

- [ ] **Step 4: catalogue row** — set the EOMONTH row's `Status` cell to note it shipped, linking this PR, keeping the `[APPROVED](…)` link. Follow whatever convention the catalogue's "Status values" section lands on for a shipped primitive (if none exists, add one: `SHIPPED`).

- [ ] **Step 5: `cli-reference.md`** — grep for a builtin list; if present, add `EOMONTH`, else no change.

**Verify:** `bun test` (whole suite), `bunx visimark check docs/example-invoice.md` clean and `bunx visimark fmt docs/example-invoice.md` a no-op (`git diff --exit-code`).

---

## Done when

- `bun test` green, including the new dates / functions / check / cli cases.
- `EOMONTH(2026-01-15, 2)` evaluates to `2026-03-31` through the CLI.
- `docs/example-invoice.md` and `-drift.md` untouched; §13 transcript unchanged.
- `docs/visimark-design.md` describes ten builtins.
- PR #8 carries spec + plan + implementation.
