# VisiMark Engine Amendments — DUP, UNIT, and Finding Spans

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two finding codes to the engine — `DUP` for a name bound twice in one scope, and `UNIT` for currency/physical-unit decorations on materialised values — and give every finding a source span so an editor can place a diagnostic on it.

**Architecture:** Three independent slices over the existing engine. (1) `Finding` gains `span` and `relatedSpan`, populated at every emit site from data already in hand; no behaviour change. (2) `build()` detects duplicate bindings in a sheet or in the merged document scope. (3) A new pure `eval/units.ts` splits a cell's text into decoration + number; `check()` infers one unit per column (the same way it already infers precision), errors when a column is not internally consistent, and strips the decoration for all arithmetic; `fmt` re-applies it on write-back. No module gains a dependency.

**Tech Stack:** TypeScript (ESM), Bun as dev runtime and test runner (`bun test`), `decimal.js`. No new dependencies.

**Spec:** [`doc/visimark-design.md`](../../../doc/visimark-design.md) — sections 6 (`DUP`, name resolution), 7 (unit decorations), 9 (write-back), 10 (error taxonomy), 13 (testing). Worked examples [`doc/example-invoice.md`](../../../doc/example-invoice.md) and [`doc/example-invoice-drift.md`](../../../doc/example-invoice-drift.md) are normative and **must not change**.

## Global Constraints

- **The acceptance suite is untouchable.** `check doc/example-invoice.md` → zero findings. `fmt doc/example-invoice.md` → byte-for-byte identical. `check doc/example-invoice-drift.md` → output equals the fenced `console` block inside that file (26 problems: 21 stale, 5 errors, plus one `NOTE`). Neither `DUP` nor `UNIT` may fire on either example. If a change makes the transcript test fail, the change is wrong — do not edit the example documents.
- **`report/format.ts` output is byte-significant.** Adding `span`/`relatedSpan` must not alter a single character of console output.
- **Ambiguity is an error, never a guess.** When a column's cells disagree about their decoration, report the forms seen and stop; never pick one.
- **A unit is inert.** Never converted, never propagated through a formula, never used in arithmetic. It is a fixed string carried from a column's cells to the computed cells in that same column.
- **`%` is not a unit.** `23%` remains exactly `0.23` via the existing `PERCENT_RE` path, which runs *before* any unit handling.
- **Decoration character class:** `[^\d\s.\-%]` — not a digit, not whitespace, not `.`, not `-`, not `%`.
- **Rounding stays at name bindings only**, half-up, decimal arithmetic throughout. Units never affect precision inference beyond being stripped first.
- **Write precision is inferred** from the *numeric part* of a cell, never the decorated text.
- **Exit codes:** `0` clean, `1` findings, `2` usage or read failure.

---

## Task 1: `span` and `relatedSpan` on every finding

**Files:**
- Modify: `src/model/types.ts` (the `Finding` interface, `FindingCode`)
- Modify: `src/model/build.ts` (two emit sites)
- Modify: `src/eval/check.ts` (every `emit()` call)
- Test: `test/model/spans.test.ts` (create)

**Interfaces:**
- Consumes: `Span` from `src/parse/document.ts` — `{ start: number; end: number }`.
- Produces: `Finding.span?: Span` and `Finding.relatedSpan?: Span`, populated for every finding except `NOTE` and the collapsed anchor-group `STALE`. Later tasks and the editor plugins rely on these being present.

- [ ] **Step 1: Add the fields and the two new codes to `src/model/types.ts`**

Add `"UNIT"` and `"DUP"` to the `FindingCode` union, and two fields to `Finding`. Import `Span` — the file already imports from `../parse/document.js`.

```ts
export type FindingCode =
  | "STALE"
  | "DATE"
  | "UNIT"
  | "UNDEF"
  | "DUP"
  | "VECTOR"
  | "CYCLE"
  | "TYPE"
  | "SHEET"
  | "ANCHOR"
  | "WARN"
  | "NOTE";
```

Add to `Finding`, after `sourceOffset`:

```ts
  /** absolute source span of the text this finding is about. Absent only on
   *  NOTE and on the collapsed anchor-group STALE, which have no single site. */
  span?: Span;
  /** a second, related site — the first binding of a DUP pair. */
  relatedSpan?: Span;
```

Add `Span` to the type import at the top of the file:

```ts
import type {
  LocatedDoc,
  RawAnchor,
  RawBlock,
  RawTable,
  Span,
} from "../parse/document.js";
```

- [ ] **Step 2: Write the failing test**

Create `test/model/spans.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

const drift = readFileSync("doc/example-invoice-drift.md", "utf8");
const run = (s: string) => check(build(locate(s)));

test("every finding except NOTE and the anchor group carries a span", () => {
  const findings = run(drift).findings;
  const missing = findings.filter(
    (f) => f.code !== "NOTE" && !f.anchorGroup && f.span === undefined,
  );
  expect(missing.map((f) => `${f.code} ${f.sheetId}.${f.name}`)).toEqual([]);
});

test("spans are well formed and inside the source", () => {
  const findings = run(drift).findings;
  for (const f of findings) {
    if (!f.span) continue;
    expect(f.span.start).toBeGreaterThanOrEqual(0);
    expect(f.span.end).toBeGreaterThanOrEqual(f.span.start);
    expect(f.span.end).toBeLessThanOrEqual(drift.length);
  }
});

test("a STALE cell span selects exactly the stored text", () => {
  const f = run(drift).findings.find(
    (x) => x.code === "STALE" && x.rowLabel && x.stored,
  )!;
  expect(drift.slice(f.span!.start, f.span!.end)).toBe(f.stored!);
});

test("a DATE span selects exactly the offending literal", () => {
  const f = run(drift).findings.find((x) => x.code === "DATE")!;
  expect(drift.slice(f.span!.start, f.span!.end)).toBe(f.raw!);
});

test("an UNDEF span selects exactly the unknown reference", () => {
  const f = run(drift).findings.find((x) => x.code === "UNDEF")!;
  expect(drift.slice(f.span!.start, f.span!.end)).toBe(f.raw!);
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `bun test test/model/spans.test.ts`
Expected: FAIL — the first test lists every finding code, because nothing populates `span` yet.

- [ ] **Step 4: Populate spans in `src/model/build.ts`**

The `SHEET` finding for a detached table gains the block span:

```ts
      findings.push({
        code: "SHEET",
        sheetId,
        message:
          "this block declares column rules but no table immediately precedes it",
        sourceOffset: block.span.start,
        span: block.span,
      });
```

In `parseOne`, the `TYPE` finding for a binding parse error gains the span of the offending token:

```ts
      findings.push({
        code: "TYPE",
        sheetId: sheetId || undefined,
        message: e.message,
        raw: rb.raw,
        sourceOffset: rb.start + e.start,
        span: { start: rb.start + e.start, end: rb.start + e.end },
      });
```

- [ ] **Step 5: Populate spans in `src/eval/check.ts`**

`UNDEF` (inside the `dep.undefRefs` loop) — the ref carries its own offsets:

```ts
        emit(
          {
            code: "UNDEF",
            sheetId: binding.sheetId,
            name: binding.name,
            raw: refText(ref),
            suggestion: r.kind === "unknown" ? r.suggestion ?? undefined : undefined,
            sourceOffset: ref.start,
            span: { start: ref.start, end: ref.end },
          },
          { sheetId: binding.sheetId },
        );
```

`VECTOR` (inside the `dep.vectorRefs` loop):

```ts
        emit(
          {
            code: "VECTOR",
            sheetId: binding.sheetId,
            name: binding.name,
            raw: refText(ref),
            sourceOffset: ref.start,
            span: { start: ref.start, end: ref.end },
          },
          { sheetId: binding.sheetId },
        );
```

`CYCLE` — anchor it on the first binding in the reported path:

```ts
  for (const cyc of cycles) {
    emit({
      code: "CYCLE",
      sheetId: cyc[0]?.sheetId,
      cyclePath: cyc.map((b) => b.id),
      span: cyc[0]?.span,
    });
    for (const b of cyc) unevaluable.add(b.id);
  }
```

`ANCHOR` — the comment itself:

```ts
      emit({
        code: "ANCHOR",
        sheetId: a.sheetId,
        name: a.name,
        sourceOffset: a.commentSpan.start,
        span: a.commentSpan,
      });
```

`WARN` — the binding line:

```ts
      emit({
        code: "WARN",
        sheetId: b.sheetId,
        name: b.name,
        suggestion: closest(b.name, [...referenced].map(idName)) ?? undefined,
        span: b.span,
      });
```

In `evalColumn`, the `STALE` finding gets the cell span. The cell is already in
scope as `table.rows[r]!.cells[idx]`; hoist it so both the text and the span
come from one lookup:

```ts
        const cell = table.rows[r]!.cells[idx];
        const storedText = cell?.text ?? "";
        if (storedText !== "" && !matchesStored(v, storedText, prec)) {
          emit(
            {
              code: "STALE",
              sheetId: sheet.id,
              name: binding.name,
              rowLabel: rowLabel(table, r),
              stored: storedText,
              computed: showValue(v, prec),
              formula: formulaText(model, binding),
              span: cell ? { start: cell.start, end: cell.end } : undefined,
            },
            { sheetId: sheet.id, rowIndex: r, isColumnCell: true },
          );
        }
```

The `TYPE` finding inside `evalColumn`'s catch gets the same cell:

```ts
          const cell = table.rows[r]?.cells[idx];
          emit(
            {
              code: "TYPE",
              sheetId: sheet.id,
              name: binding.name,
              rowLabel: rowLabel(table, r),
              message: e.message,
              span: cell ? { start: cell.start, end: cell.end } : undefined,
            },
            { sheetId: sheet.id },
          );
```

In `evalScalar`, the scalar `STALE` uses the anchor's value span when there is
one, else the binding line. Add a helper beside `anchorValueText`:

```ts
function anchorValueSpanOf(model: DocModel, id: string): Span | undefined {
  for (const a of model.anchors) {
    if (`${a.sheetId}.${a.name}` === id && a.value) {
      return { start: a.value.start, end: a.value.end };
    }
  }
  return undefined;
}
```

Import `Span` in `check.ts` alongside the existing `RawTable` import:

```ts
import type { RawTable, Span } from "../parse/document.js";
```

and use it at the scalar `STALE` emit:

```ts
          emit(
            {
              code: "STALE",
              sheetId: binding.sheetId,
              name: binding.name,
              stored: anchorText,
              computed: showValue(v, prec),
              formula: formulaText(model, binding),
              span: anchorValueSpanOf(model, binding.id) ?? binding.span,
            },
            { sheetId: binding.sheetId },
          );
```

The `TYPE` finding in `evalScalar`'s catch takes the binding line:

```ts
        emit(
          {
            code: "TYPE",
            sheetId: binding.sheetId,
            name: binding.name,
            message: e.message,
            span: binding.span,
          },
          { sheetId: binding.sheetId },
        );
```

`DATE` is emitted inside `coerceInput`, which does not currently receive the
cell. Change its signature to take the cell span, and update its four call
sites. In `lookupScalar`:

```ts
    const colIdx = ctx.sheet.columnIndex.get(res.column)!;
    const cell = ctx.sheet.table?.rows[ctx.row]?.cells[colIdx];
    return coerceInput(cell?.text ?? "", res.column, ctx.row, ctx.sheet.id, cell);
```

In `lookupVector`:

```ts
      return (sheet.table?.rows ?? []).map((row, r) => {
        const cell = row.cells[colIdx];
        return coerceInput(cell?.text ?? "", res.column, r, sheet.id, cell);
      });
```

And the function itself:

```ts
  function coerceInput(
    text: string,
    column: string,
    row: number,
    sheetId: string,
    cell: { start: number; end: number } | undefined,
  ): Value {
    const t = text.trim();
    if (NUMBER_RE.test(t)) return num(new Decimal(t));
    const pm = PERCENT_RE.exec(t);
    if (pm) return num(new Decimal(pm[1]!).div(100));
    if (t === "true" || t === "false") return bool(t === "true");
    const iso = parseIsoDate(t);
    if (iso.ok) return date(iso.iso);
    if (DATEISH_RE.test(t) || /^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const key = `${sheetId}.${column}#${row}`;
      if (!dateErrorRows.has(key)) {
        dateErrorRows.add(key);
        const table = model.sheets.get(sheetId)!.table!;
        emit(
          {
            code: "DATE",
            sheetId,
            name: column,
            rowLabel: rowLabel(table, row),
            raw: t,
            isoFix: iso.ok ? undefined : iso.decidable,
            altA: iso.ok ? undefined : iso.ambiguous?.a,
            altB: iso.ok ? undefined : iso.ambiguous?.b,
            daysApart: iso.ok ? undefined : iso.ambiguous?.daysApart,
            span: cell ? { start: cell.start, end: cell.end } : undefined,
          },
          { sheetId },
        );
      }
      throw new Unevaluable();
    }
    return str(t);
  }
```

Note the parameter order changed to put `cell` last; make sure both call sites
match.

Structural findings carried in from the model (`for (const f of model.findings) emit(f)`) already carry their spans from step 4 — no change needed there.

- [ ] **Step 6: Run the new test and the full suite**

Run: `bun test test/model/spans.test.ts`
Expected: PASS, all five.

Run: `bun test`
Expected: PASS — the whole suite, including `test/acceptance.test.ts`. The console transcript must be unchanged, which is the proof that adding `span` was inert.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/model/types.ts src/model/build.ts src/eval/check.ts test/model/spans.test.ts
git commit -m "feat(model): source spans on every finding

An editor needs a range to put a squiggle on, and only UNDEF, VECTOR and
ANCHOR carried an offset. Every finding except NOTE and the collapsed
anchor-group STALE now carries the span of the text it is about, taken
from data already in hand at the emit site. report/format.ts ignores the
field, so the console transcript is byte-for-byte unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: `DUP` — a name bound twice in one scope

**Files:**
- Modify: `src/model/build.ts` (both binding loops)
- Modify: `src/report/format.ts` (`renderGroup`, `ERROR_CODES`, `CODE_RANK` is in `check.ts`)
- Modify: `src/eval/check.ts` (`CODE_RANK` in `orderFindings`)
- Test: `test/model/dup.test.ts` (create)

**Interfaces:**
- Consumes: `Finding.span` and `Finding.relatedSpan` from Task 1.
- Produces: a `DUP` finding with `sheetId` (absent for document scope), `name`, `span` on the *second* binding, `relatedSpan` on the first. Resolution keeps the **first** binding.

- [ ] **Step 1: Write the failing test**

Create `test/model/dup.test.ts`:

```ts
import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

const run = (s: string) => check(build(locate(s)));

const twiceInASheet = `
| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #order
Net = Price * Qty
Net = 99
total = SUM(Net)
\`\`\`
`;

const twiceInDocScope = `
\`\`\`vmark
rate = 0.23
rate = 0.19
\`\`\`

\`\`\`vmark #s
x = rate
\`\`\`
`;

const acrossTwoBlocksSameSheet = `
| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`

\`\`\`vmark #order
Net = 1
\`\`\`
`;

const splitAcrossBlocksNoCollision = `
| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`

\`\`\`vmark #order
total = SUM(Net)
\`\`\`

Total: **10.00**<!--vmark=order.total-->
`;

test("a name bound twice in one sheet is DUP", () => {
  const dups = run(twiceInASheet).findings.filter((f) => f.code === "DUP");
  expect(dups.length).toBe(1);
  expect(dups[0]!.name).toBe("Net");
  expect(dups[0]!.sheetId).toBe("order");
});

test("DUP keeps the first binding, so the column still computes", () => {
  const r = run(twiceInASheet);
  // Net = Price * Qty wins; 5.00 * 2 = 10.00 matches the stored cell,
  // so there is no STALE finding on top of the DUP.
  expect(r.findings.filter((f) => f.code === "STALE")).toEqual([]);
});

test("DUP points at the second binding and back at the first", () => {
  const d = run(twiceInASheet).findings.find((f) => f.code === "DUP")!;
  expect(twiceInASheet.slice(d.span!.start, d.span!.end)).toBe("Net = 99");
  expect(twiceInASheet.slice(d.relatedSpan!.start, d.relatedSpan!.end)).toBe(
    "Net = Price * Qty",
  );
});

test("a name bound twice in document scope is DUP", () => {
  const dups = run(twiceInDocScope).findings.filter((f) => f.code === "DUP");
  expect(dups.length).toBe(1);
  expect(dups[0]!.name).toBe("rate");
  expect(dups[0]!.sheetId).toBeUndefined();
});

test("two blocks sharing a sheet id collide on a repeated name", () => {
  const dups = run(acrossTwoBlocksSameSheet).findings.filter(
    (f) => f.code === "DUP",
  );
  expect(dups.length).toBe(1);
  expect(dups[0]!.name).toBe("Net");
});

test("splitting one sheet across blocks is legal when names do not collide", () => {
  expect(run(splitAcrossBlocksNoCollision).findings).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test test/model/dup.test.ts`
Expected: FAIL — no `DUP` findings are produced; the duplicate is silently swallowed.

- [ ] **Step 3: Emit `DUP` from `src/model/build.ts`**

Document scope currently drops the duplicate silently. Replace the body of the
document-scope loop:

```ts
    if (block.sheetId === null) {
      for (const rb of block.bindings) {
        const parsed = parseOne(rb, doc.source, findings, DOC_SCOPE);
        if (!parsed) continue;
        const first = docScope.get(parsed.name);
        if (first) {
          findings.push({
            code: "DUP",
            name: parsed.name,
            span: parsed.span,
            relatedSpan: first.span,
          });
          continue;
        }
        docScope.set(parsed.name, parsed);
      }
      continue;
    }
```

The sheet loop currently overwrites. Replace the binding loop body:

```ts
    for (const rb of block.bindings) {
      const parsed = parseOne(rb, doc.source, findings, sheetId);
      if (!parsed) continue;
      const first = sheet.columns.get(parsed.name) ?? sheet.scalars.get(parsed.name);
      if (first) {
        findings.push({
          code: "DUP",
          sheetId,
          name: parsed.name,
          span: parsed.span,
          relatedSpan: first.span,
        });
        continue;
      }
      const isColumn = table !== null && headerIndex.has(parsed.name);
      parsed.kind = isColumn ? "column" : "scalar";
      if (isColumn) {
        sheet.columns.set(parsed.name, parsed);
        sheet.columnIndex.set(parsed.name, headerIndex.get(parsed.name)!);
      } else {
        sheet.scalars.set(parsed.name, parsed);
      }
    }
```

- [ ] **Step 4: Render `DUP` in `src/report/format.ts`**

Add `"DUP"` to `ERROR_CODES` so the footer counts it:

```ts
const ERROR_CODES = new Set([
  "DATE",
  "UNIT",
  "UNDEF",
  "DUP",
  "VECTOR",
  "CYCLE",
  "TYPE",
  "SHEET",
  "ANCHOR",
]);
```

(`UNIT` is added here now so Task 4 does not have to touch this line again.)

Add a case to `renderGroup`, beside `UNDEF`:

```ts
    case "DUP":
      return [
        prefix("DUP") +
          id(f).padEnd(ID_FIELD) +
          "  " +
          "`" +
          (f.name ?? "") +
          "` is already defined in this scope",
        CONT + "the first binding wins; delete or rename one of them",
      ];
```

- [ ] **Step 5: Rank `DUP` in the finding order**

In `src/eval/check.ts`, `orderFindings` has a `CODE_RANK` map. `DUP` is a
name-resolution error and belongs with `UNDEF`:

```ts
  const CODE_RANK: Record<string, number> = {
    SHEET: 0,
    TYPE: 0,
    DATE: 1,
    UNIT: 1,
    NOTE: 1,
    UNDEF: 1,
    DUP: 1,
    VECTOR: 1,
    CYCLE: 2,
    ANCHOR: 3,
    WARN: 4,
  };
```

(`UNIT` is added here now for the same reason.)

- [ ] **Step 6: Run the tests**

Run: `bun test test/model/dup.test.ts`
Expected: PASS, all six.

Run: `bun test`
Expected: PASS. The two examples bind no name twice, so the acceptance transcript is unchanged.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/model/build.ts src/report/format.ts src/eval/check.ts test/model/dup.test.ts
git commit -m "feat(model): DUP — a name bound twice in one scope

Previously silent: a sheet kept the last binding, document scope kept
the first, and nothing said so. Both scopes now keep the first binding
and report DUP on the second, pointing back at the first. Splitting one
sheet's rules across several blocks stays legal; it is only DUP when the
blocks actually collide on a name.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `eval/units.ts` — decorated numbers, as pure functions

**Files:**
- Create: `src/eval/units.ts`
- Test: `test/eval/units.test.ts` (create)

**Interfaces:**
- Consumes: nothing. This module is a pure string utility with no imports.
- Produces:
  - `interface Unit { text: string; side: "prefix" | "suffix" }`
  - `type Decorated = { kind: "number"; num: string; unit: Unit | null } | { kind: "both-sides"; pre: string; post: string } | { kind: "not-a-number" }`
  - `function parseDecorated(text: string): Decorated`
  - `function unitKey(u: Unit | null): string` — a comparable identity; `"(none)"` for bare.
  - `function showUnit(u: Unit | null): string` — for error messages.
  - `function applyUnit(numText: string, unit: Unit | null): string`
  - `interface ColumnUnit { unit: Unit | null; conflict: boolean; forms: string[]; firstDeviantRow: number | null }`
  - `function inferColumnUnit(cellTexts: (string | undefined)[]): ColumnUnit`

- [ ] **Step 1: Write the failing test**

Create `test/eval/units.test.ts`:

```ts
import { expect, test } from "bun:test";
import {
  applyUnit,
  inferColumnUnit,
  parseDecorated,
  showUnit,
  unitKey,
} from "../../src/eval/units.js";

const num = (t: string) => {
  const d = parseDecorated(t);
  if (d.kind !== "number") throw new Error(`${t} did not parse as a number`);
  return d;
};

test("a bare number has no unit", () => {
  const d = num("5.50");
  expect(d.num).toBe("5.50");
  expect(d.unit).toBeNull();
});

test("a prefix decoration is recognised", () => {
  const d = num("$5.50");
  expect(d.num).toBe("5.50");
  expect(d.unit).toEqual({ text: "$", side: "prefix" });
});

test("a suffix decoration is recognised, with or without a space", () => {
  expect(num("12 N").unit).toEqual({ text: "N", side: "suffix" });
  expect(num("12N").unit).toEqual({ text: "N", side: "suffix" });
  expect(num("3.5 kg").num).toBe("3.5");
});

test("a leading minus binds to the number on either side of the decoration", () => {
  expect(num("-$5.00").num).toBe("-5.00");
  expect(num("-$5.00").unit).toEqual({ text: "$", side: "prefix" });
  expect(num("$-5.00").num).toBe("-5.00");
  expect(num("$-5.00").unit).toEqual({ text: "$", side: "prefix" });
});

test("a multi-character decoration works on either side", () => {
  expect(num("PLN 5.50").unit).toEqual({ text: "PLN", side: "prefix" });
  expect(num("5.50 PLN").unit).toEqual({ text: "PLN", side: "suffix" });
});

test("decoration on both sides is reported, not parsed", () => {
  expect(parseDecorated("$5.50 kg")).toEqual({
    kind: "both-sides",
    pre: "$",
    post: "kg",
  });
});

test("percent is never a unit", () => {
  expect(parseDecorated("23%").kind).toBe("not-a-number");
});

test("an ISO date is not a decorated number", () => {
  expect(parseDecorated("2026-09-03").kind).toBe("not-a-number");
});

test("text with no digits is not a decorated number", () => {
  expect(parseDecorated("hour").kind).toBe("not-a-number");
  expect(parseDecorated("true").kind).toBe("not-a-number");
  expect(parseDecorated("").kind).toBe("not-a-number");
});

test("a thousands separator is not rescued by unit parsing", () => {
  expect(parseDecorated("$1,800.00").kind).toBe("not-a-number");
});

test("applyUnit puts the decoration back where it came from", () => {
  expect(applyUnit("16.50", { text: "$", side: "prefix" })).toBe("$16.50");
  expect(applyUnit("16.50", { text: "PLN", side: "suffix" })).toBe("16.50 PLN");
  expect(applyUnit("16.50", null)).toBe("16.50");
});

test("applyUnit keeps a negative sign in front of a prefix", () => {
  expect(applyUnit("-16.50", { text: "$", side: "prefix" })).toBe("-$16.50");
});

test("unitKey and showUnit distinguish side as well as text", () => {
  expect(unitKey(null)).toBe("(none)");
  expect(unitKey({ text: "$", side: "prefix" })).not.toBe(
    unitKey({ text: "$", side: "suffix" }),
  );
  expect(showUnit(null)).toBe("(none)");
  expect(showUnit({ text: "$", side: "prefix" })).toBe("$");
});

test("a uniformly decorated column takes that unit", () => {
  const r = inferColumnUnit(["$5.50", "$4.00", "$1.25"]);
  expect(r.conflict).toBe(false);
  expect(r.unit).toEqual({ text: "$", side: "prefix" });
});

test("a uniformly bare column has no unit and no conflict", () => {
  const r = inferColumnUnit(["5.50", "4.00"]);
  expect(r.conflict).toBe(false);
  expect(r.unit).toBeNull();
});

test("mixed currencies conflict, and the tool names both forms", () => {
  const r = inferColumnUnit(["$5.50", "€4.00"]);
  expect(r.conflict).toBe(true);
  expect(r.unit).toBeNull();
  expect(r.forms.sort()).toEqual(["$", "€"]);
  expect(r.firstDeviantRow).toBe(1);
});

test("one bare cell among decorated ones conflicts", () => {
  const r = inferColumnUnit(["$5.50", "4.00", "$1.25"]);
  expect(r.conflict).toBe(true);
  expect(r.forms.sort()).toEqual(["$", "(none)"].sort());
  expect(r.firstDeviantRow).toBe(1);
});

test("the same text on different sides conflicts", () => {
  const r = inferColumnUnit(["PLN 5.50", "4.00 PLN"]);
  expect(r.conflict).toBe(true);
});

test("empty cells and non-numeric cells are ignored", () => {
  const r = inferColumnUnit(["$5.50", "", undefined, "n/a", "$4.00"]);
  expect(r.conflict).toBe(false);
  expect(r.unit).toEqual({ text: "$", side: "prefix" });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test test/eval/units.test.ts`
Expected: FAIL — `Cannot find module '../../src/eval/units.js'`.

- [ ] **Step 3: Write `src/eval/units.ts`**

```ts
/**
 * A unit is a display decoration on a number: `$` in `$5.50`, `N` in `12 N`.
 * It is inert — never converted, never propagated through a formula. The
 * engine strips it to do arithmetic and puts it back when it writes.
 */
export interface Unit {
  text: string;
  side: "prefix" | "suffix";
}

export type Decorated =
  | { kind: "number"; num: string; unit: Unit | null }
  | { kind: "both-sides"; pre: string; post: string }
  | { kind: "not-a-number" };

/**
 * A decoration is a run of characters that are not digits, whitespace, `.`,
 * `-` or `%`. Excluding `.` and `-` keeps decimal points and signs with the
 * number; excluding `%` keeps `23%` on the existing percent path, because a
 * unit never scales the value it decorates.
 */
const DECOR = "[^\\d\\s.\\-%]";
const DECORATED = new RegExp(
  `^(?<sign1>-?)\\s*(?<pre>${DECOR}*)\\s*(?<sign2>-?)\\s*` +
    `(?<num>\\d+(?:\\.\\d+)?)\\s*(?<post>${DECOR}*)$`,
);

export function parseDecorated(text: string): Decorated {
  const t = text.trim();
  if (t === "") return { kind: "not-a-number" };
  const m = DECORATED.exec(t);
  if (!m?.groups) return { kind: "not-a-number" };
  const { sign1, pre, sign2, num, post } = m.groups as Record<string, string>;
  if (sign1 && sign2) return { kind: "not-a-number" };
  if (pre && post) return { kind: "both-sides", pre, post };
  const sign = sign1 || sign2 ? "-" : "";
  const unit: Unit | null = pre
    ? { text: pre, side: "prefix" }
    : post
      ? { text: post, side: "suffix" }
      : null;
  return { kind: "number", num: sign + num, unit };
}

export function unitKey(u: Unit | null): string {
  return u ? `${u.side}:${u.text}` : "(none)";
}

export function showUnit(u: Unit | null): string {
  return u ? u.text : "(none)";
}

export function applyUnit(numText: string, unit: Unit | null): string {
  if (!unit) return numText;
  if (unit.side === "suffix") return `${numText} ${unit.text}`;
  return numText.startsWith("-")
    ? `-${unit.text}${numText.slice(1)}`
    : `${unit.text}${numText}`;
}

export interface ColumnUnit {
  /** the column's unit when every numeric cell agrees; null when bare or in conflict */
  unit: Unit | null;
  /** true when the numeric cells disagree about their decoration */
  conflict: boolean;
  /** the distinct forms seen, for the error message */
  forms: string[];
  /** row index of the first cell that departs from the first form seen */
  firstDeviantRow: number | null;
}

/**
 * Infer one unit for a column, exactly as write precision is inferred: from
 * the cells that are already there. Cells that are not numbers at all — empty,
 * a date, a word — carry no opinion and are ignored. Where the numeric cells
 * disagree, the column is in conflict and the caller reports it; the tool
 * never decides which decoration was the intended one.
 */
export function inferColumnUnit(cellTexts: (string | undefined)[]): ColumnUnit {
  const seen: { key: string; unit: Unit | null; row: number }[] = [];
  cellTexts.forEach((text, row) => {
    const d = parseDecorated(text ?? "");
    if (d.kind !== "number") return;
    seen.push({ key: unitKey(d.unit), unit: d.unit, row });
  });

  if (seen.length === 0) {
    return { unit: null, conflict: false, forms: [], firstDeviantRow: null };
  }

  const first = seen[0]!;
  const deviant = seen.find((s) => s.key !== first.key);
  if (!deviant) {
    return {
      unit: first.unit,
      conflict: false,
      forms: [showUnit(first.unit)],
      firstDeviantRow: null,
    };
  }

  const forms: string[] = [];
  for (const s of seen) {
    const label = showUnit(s.unit);
    if (!forms.includes(label)) forms.push(label);
  }
  return { unit: null, conflict: true, forms, firstDeviantRow: deviant.row };
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test test/eval/units.test.ts`
Expected: PASS, all nineteen.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/eval/units.ts test/eval/units.test.ts
git commit -m "feat(eval): decorated-number parsing and column unit inference

A pure module: split a cell into decoration plus number, compare and
re-apply decorations, and infer one unit for a column from the cells
already in it. Nothing is wired up yet. The decoration class excludes
digits, whitespace, '.', '-' and '%' — the first three keep the number
intact, and '%' stays on the existing percent path because a unit never
scales the value it decorates.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `UNIT` in `check` — inference, errors, and unit-aware arithmetic

**Files:**
- Modify: `src/eval/check.ts`
- Modify: `src/report/format.ts` (`renderGroup`)
- Test: `test/eval/unit-check.test.ts` (create)

**Interfaces:**
- Consumes: `parseDecorated`, `inferColumnUnit`, `unitKey`, `showUnit`, `applyUnit`, `Unit`, `ColumnUnit` from `src/eval/units.js` (Task 3); `Finding.span` from Task 1.
- Produces:
  - `CheckResult.columnUnits: Map<string, Unit | null>` keyed `"sheet.Column"` — Task 5 reads this to write decorated cells.
  - `CheckResult.unitConflicts: Set<string>` — column ids in conflict, whose staleness is suppressed and which `fmt` must not rewrite.
  - `CheckResult.scalarUnits: Map<string, Unit | null>` keyed by binding id.
  - `UNIT` findings with `sheetId`, `name`, `message`, `span`, and `rowLabel`/`raw` where a specific cell is at fault.
  - `decimalPlaces` and `matchesStored` keep their signatures but now strip a decoration first.

- [ ] **Step 1: Write the failing test**

Create `test/eval/unit-check.test.ts`:

```ts
import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

const run = (s: string) => check(build(locate(s)));

const dollars = `
| Item  | Price | Qty |    Net |
|-------|------:|----:|-------:|
| pen   | $5.50 |   3 | $16.50 |
| paper | $4.00 |   2 |  $8.00 |

\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **24.50**<!--vmark=order.total-->
`;

const mixedCurrency = `
| Item  | Price | Qty |    Net |
|-------|------:|----:|-------:|
| pen   | $5.50 |   3 | $16.50 |
| paper | €4.00 |   2 |  $8.00 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const bareAmongDecorated = `
| Item  | Price | Qty |    Net |
|-------|------:|----:|-------:|
| pen   | $5.50 |   3 | $16.50 |
| paper |  4.00 |   2 |  $8.00 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const bothSides = `
| Item | Price    | Qty |   Net |
|------|---------:|----:|------:|
| pen  | $5.50 kg |   3 | 16.50 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const newtons = `
| Beam | Force |  Span |
|------|------:|------:|
| A    |  12 N | 3.0 m |

\`\`\`vmark #beam
peak = Force * 2
\`\`\`

Peak: **24**<!--vmark=beam.peak-->
`;

const staleDecorated = `
| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  | $5.50 |   3 | $9.99 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

test("a uniformly decorated column computes on the stripped number", () => {
  const r = run(dollars);
  expect(r.findings).toEqual([]);
  expect(r.values.get("order.total")!).toMatchObject({ t: "num" });
  expect(r.columnUnits.get("order.Price")).toEqual({ text: "$", side: "prefix" });
  expect(r.columnUnits.get("order.Net")).toEqual({ text: "$", side: "prefix" });
});

test("a mixed-currency column is a UNIT error naming both forms", () => {
  const f = run(mixedCurrency).findings.filter((x) => x.code === "UNIT");
  expect(f.length).toBe(1);
  expect(f[0]!.name).toBe("Price");
  expect(f[0]!.message).toContain("$");
  expect(f[0]!.message).toContain("€");
});

test("a bare cell among decorated ones is a UNIT error", () => {
  const f = run(bareAmongDecorated).findings.filter((x) => x.code === "UNIT");
  expect(f.length).toBe(1);
  expect(f[0]!.name).toBe("Price");
  expect(f[0]!.message).toContain("(none)");
});

test("a UNIT conflict suppresses staleness in the columns that depend on it", () => {
  const r = run(mixedCurrency);
  expect(r.findings.filter((x) => x.code === "STALE")).toEqual([]);
  expect(r.unitConflicts.has("order.Price")).toBe(true);
});

test("decoration on both sides is a UNIT error", () => {
  const f = run(bothSides).findings.filter((x) => x.code === "UNIT");
  expect(f.length).toBe(1);
  expect(f[0]!.message).toContain("both sides");
});

test("a UNIT span selects the offending cell", () => {
  const f = run(mixedCurrency).findings.find((x) => x.code === "UNIT")!;
  expect(mixedCurrency.slice(f.span!.start, f.span!.end)).toBe("€4.00");
});

test("suffix units work the same way", () => {
  const r = run(newtons);
  expect(r.findings).toEqual([]);
  expect(r.columnUnits.get("beam.Force")).toEqual({ text: "N", side: "suffix" });
  expect(r.columnUnits.get("beam.Span")).toEqual({ text: "m", side: "suffix" });
});

test("staleness compares the stripped number, and reports the decorated text", () => {
  const f = run(staleDecorated).findings.filter((x) => x.code === "STALE");
  expect(f.length).toBe(1);
  expect(f[0]!.stored).toBe("$9.99");
  expect(f[0]!.computed).toBe("$16.50");
});

test("precision is inferred from the number, not the decorated text", () => {
  // columnPrecision is populated for rule columns only, so measure one.
  // "$16.50" must read as two decimal places despite the leading $.
  const r = run(dollars);
  expect(r.columnPrecision.get("order.Net")).toBe(2);

  // A suffix unit must not defeat the trailing-decimals probe either.
  const metres = `
| Beam | Span  | Times |  Total |
|------|------:|------:|-------:|
| A    | 3.5 m |     2 |  7.0 m |

\`\`\`vmark #b
Total = Span * Times
\`\`\`
`;
  expect(run(metres).columnPrecision.get("b.Total")).toBe(1);
});

test("percent still means one hundredth and is not treated as a unit", () => {
  const pct = `
| Row | Share | Amount |
|-----|------:|-------:|
| a   |   30% |  30.00 |

\`\`\`vmark #s
Amount = Share * 100
\`\`\`
`;
  const r = run(pct);
  expect(r.findings.filter((x) => x.code === "UNIT")).toEqual([]);
  expect(r.findings.filter((x) => x.code === "STALE")).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test test/eval/unit-check.test.ts`
Expected: FAIL — `columnUnits` does not exist on `CheckResult`, and `$5.50` currently coerces to a string, so `Net = Price * Qty` is a `TYPE` error.

- [ ] **Step 3: Extend `CheckResult` and add the inference pass**

In `src/eval/check.ts`, import the units module and `Unit`:

```ts
import {
  applyUnit,
  inferColumnUnit,
  parseDecorated,
  showUnit,
  type Unit,
} from "./units.js";
```

Extend the result interface:

```ts
export interface CheckResult {
  findings: Finding[];
  values: Map<string, Value>;
  cells: Map<string, (Value | null)[]>;
  columnPrecision: Map<string, number>;
  scalarPrecision: Map<string, number>;
  /** inferred display decoration per column, keyed `sheet.Column` */
  columnUnits: Map<string, Unit | null>;
  /** inferred display decoration per anchored scalar, keyed by binding id */
  scalarUnits: Map<string, Unit | null>;
  /** column ids whose cells disagree about their decoration */
  unitConflicts: Set<string>;
  exitCode: 0 | 1;
}
```

Declare the three new collections next to `columnPrecision`:

```ts
  const columnUnits = new Map<string, Unit | null>();
  const scalarUnits = new Map<string, Unit | null>();
  const unitConflicts = new Set<string>();
```

Immediately after `const fallbackPrecision = docPrecision(model);`, run the
inference pass over every column of every sheet — rule columns and input
columns alike, because an input column's decoration is what a computed
neighbour never inherits but a reader still sees:

```ts
  for (const sheet of model.sheets.values()) {
    const table = sheet.table;
    if (!table) continue;
    for (const [name, idx] of sheet.columnIndex) {
      const colId = `${sheet.id}.${name}`;
      const texts = table.rows.map((r) => r.cells[idx]?.text);

      const bothSidesRow = texts.findIndex(
        (t) => parseDecorated(t ?? "").kind === "both-sides",
      );
      if (bothSidesRow !== -1) {
        const cell = table.rows[bothSidesRow]!.cells[idx];
        unitConflicts.add(colId);
        columnUnits.set(colId, null);
        emit(
          {
            code: "UNIT",
            sheetId: sheet.id,
            name,
            rowLabel: rowLabel(table, bothSidesRow),
            raw: texts[bothSidesRow],
            message: `\`${texts[bothSidesRow]}\` is decorated on both sides; a unit sits before the number or after it, not both`,
            span: cell ? { start: cell.start, end: cell.end } : undefined,
          },
          { sheetId: sheet.id },
        );
        continue;
      }

      const inferred = inferColumnUnit(texts);
      columnUnits.set(colId, inferred.unit);
      if (inferred.conflict) {
        unitConflicts.add(colId);
        const row = inferred.firstDeviantRow!;
        const cell = table.rows[row]!.cells[idx];
        emit(
          {
            code: "UNIT",
            sheetId: sheet.id,
            name,
            rowLabel: rowLabel(table, row),
            raw: texts[row],
            message: `column mixes units: ${inferred.forms.join(" and ")}`,
            span: cell ? { start: cell.start, end: cell.end } : undefined,
          },
          { sheetId: sheet.id },
        );
      }
    }
  }
```

Return the new fields:

```ts
  return {
    findings,
    values,
    cells,
    columnPrecision,
    scalarPrecision,
    columnUnits,
    scalarUnits,
    unitConflicts,
    exitCode: findings.length > 0 ? 1 : 0,
  };
```

- [ ] **Step 4: Make coercion, precision and comparison unit-aware**

`coerceInput` must read a decorated number. Insert the decorated branch after
the ISO-date check and before the date-ish error branch, so dates still win:

```ts
    const iso = parseIsoDate(t);
    if (iso.ok) return date(iso.iso);
    if (DATEISH_RE.test(t) || /^\d{4}-\d{2}-\d{2}$/.test(t)) {
      // …unchanged DATE branch…
    }
    const dec = parseDecorated(t);
    if (dec.kind === "number") return num(new Decimal(dec.num));
    return str(t);
```

`inferColumnPrecision` must measure the numeric part. Replace its body:

```ts
export function inferColumnPrecision(
  table: RawTable,
  colIndex: number,
  fallback: number,
): number {
  let max = -1;
  for (const row of table.rows) {
    const text = row.cells[colIndex]?.text ?? "";
    const dec = parseDecorated(text);
    if (dec.kind !== "number") continue;
    max = Math.max(max, decimalPlaces(dec.num, fallback));
  }
  return max === -1 ? fallback : max;
}
```

`decimalPlaces` is called with raw anchor text elsewhere, so make it strip
first rather than requiring every caller to:

```ts
export function decimalPlaces(text: string, fallback: number): number {
  const dec = parseDecorated(text);
  const t = (dec.kind === "number" ? dec.num : text).trim();
  const m = /\.(\d+)\s*$/.exec(t);
  if (m) return m[1]!.length;
  if (/^-?\d+$/.test(t)) return 0;
  return fallback;
}
```

`matchesStored` must compare the numbers, not the decorations:

```ts
export function matchesStored(v: Value, storedText: string, places: number): boolean {
  const t = storedText.trim();
  if (v.t === "num") {
    const dec = parseDecorated(t);
    if (dec.kind === "number") {
      return roundToPlaces(new Decimal(dec.num), places).equals(
        roundToPlaces(v.d, places),
      );
    }
    if (!PERCENT_RE.test(t)) return false;
    const stored = new Decimal(PERCENT_RE.exec(t)![1]!).div(100);
    return roundToPlaces(stored, places).equals(roundToPlaces(v.d, places));
  }
  if (v.t === "date") return t === v.iso;
  if (v.t === "bool") return t === String(v.b);
  return t === v.s;
}
```

Note `parseDecorated` returns `not-a-number` for `23%`, so the percent branch
below it still runs — that ordering matters.

- [ ] **Step 5: Report the computed value with its unit, and suppress conflicted columns**

In `evalColumn`, the `STALE` finding's `computed` field should show what `fmt`
would actually write. Take the column's unit and skip columns in conflict.
Replace the top of `evalColumn`:

```ts
  function evalColumn(binding: Binding, sheet: Sheet, table: RawTable): void {
    const colId = `${sheet.id}.${binding.name}`;
    const idx = sheet.columnIndex.get(binding.name)!;
    const prec = inferColumnPrecision(table, idx, fallbackPrecision);
    columnPrecision.set(colId, prec);
    const unit = columnUnits.get(colId) ?? null;
    const suppressed = unitConflicts.has(colId);
    const out: (Value | null)[] = [];
```

and, inside the row loop, guard the emit and decorate the computed text:

```ts
        const cell = table.rows[r]!.cells[idx];
        const storedText = cell?.text ?? "";
        if (
          !suppressed &&
          storedText !== "" &&
          !matchesStored(v, storedText, prec)
        ) {
          emit(
            {
              code: "STALE",
              sheetId: sheet.id,
              name: binding.name,
              rowLabel: rowLabel(table, r),
              stored: storedText,
              computed: applyUnit(showValue(v, prec), unit),
              formula: formulaText(model, binding),
              span: cell ? { start: cell.start, end: cell.end } : undefined,
            },
            { sheetId: sheet.id, rowIndex: r, isColumnCell: true },
          );
        }
```

A column rule whose *operands* are in conflict is also unverifiable. After the
`dep` block in the main binding loop, before evaluation, add:

```ts
    if (
      [...dep.deps].some((d) => unitConflicts.has(d)) ||
      dep.refs.some(
        (r) =>
          r.res.kind === "input-column" &&
          unitConflicts.has(`${r.res.sheetId}.${r.res.column}`),
      )
    ) {
      unitConflicts.add(binding.id);
    }
```

For scalars, record the anchor's unit. In `evalScalar`, after `anchorText` is
read:

```ts
      const anchorUnit =
        anchorText !== undefined
          ? (() => {
              const d = parseDecorated(anchorText);
              return d.kind === "number" ? d.unit : null;
            })()
          : null;
      scalarUnits.set(binding.id, anchorUnit);
```

and decorate the reported computed value at the scalar `STALE` emit:

```ts
              computed: applyUnit(showValue(v, prec), anchorUnit),
```

- [ ] **Step 6: Render `UNIT` in `src/report/format.ts`**

Add a case to `renderGroup`, beside `DATE`:

```ts
    case "UNIT": {
      const head =
        prefix("UNIT") +
        id(f).padEnd(ID_FIELD) +
        "· " +
        (f.rowLabel ?? "").padEnd(DATE_VALUE_COL - 28) +
        `"${f.raw ?? ""}"`;
      return [head, CONT + (f.message ?? "")];
    }
```

`ERROR_CODES` and `CODE_RANK` already list `UNIT` from Task 2.

- [ ] **Step 7: Run the tests**

Run: `bun test test/eval/unit-check.test.ts`
Expected: PASS, all ten.

Run: `bun test`
Expected: PASS. The two examples keep every number bare and every currency in
prose, so no `UNIT` finding fires and the transcript is unchanged.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/eval/check.ts src/report/format.ts test/eval/unit-check.test.ts
git commit -m "feat(eval): UNIT — inferred column units and unit-aware arithmetic

A column's decoration is inferred from its own cells, exactly as write
precision already is, and stripped for every comparison and every
arithmetic operation. A column whose cells disagree — \$ against €,
prefix against suffix, a bare cell among decorated ones — is a UNIT
error naming the forms it saw, and its staleness is suppressed rather
than reported against a value the tool cannot write. Percent keeps its
own path: a unit never scales the number it decorates.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Units on write-back in `fmt`

**Files:**
- Modify: `src/write/fmt.ts`
- Test: `test/write/fmt-units.test.ts` (create)

**Interfaces:**
- Consumes: `CheckResult.columnUnits`, `CheckResult.scalarUnits`, `CheckResult.unitConflicts` from Task 4; `applyUnit` from Task 3.
- Produces: `planFmt` emits decorated replacement text for decorated columns and skips every column in `unitConflicts`. `fmt` stays idempotent.

- [ ] **Step 1: Write the failing test**

Create `test/write/fmt-units.test.ts`:

```ts
import { expect, test } from "bun:test";
import { fmt } from "../../src/write/fmt.js";

const stale = `| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  | $5.50 |   3 | $9.99 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const suffix = `| Beam | Force | Times |  Peak |
|------|------:|------:|------:|
| A    |  12 N |     2 |  99 N |

\`\`\`vmark #beam
Peak = Force * Times
\`\`\`
`;

const conflicted = `| Item  | Price | Qty |    Net |
|-------|------:|----:|-------:|
| pen   | $5.50 |   3 |  $0.01 |
| paper | €4.00 |   2 |  $0.02 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const anchored = `| Item | Price | Qty |    Net |
|------|------:|----:|-------:|
| pen  | $5.50 |   3 | $16.50 |

\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **$0.00**<!--vmark=order.total-->
`;

test("a stale cell in a decorated column is rewritten with its decoration", () => {
  const out = fmt(stale, {}).output;
  expect(out).toContain("| $16.50 |");
  expect(out).not.toContain("$9.99");
});

test("a suffix unit is put back on the far side of the number", () => {
  const out = fmt(suffix, {}).output;
  expect(out).toContain("24 N");
});

test("a column in UNIT conflict is not rewritten at all", () => {
  const r = fmt(conflicted, {});
  expect(r.output).toBe(conflicted);
  expect(r.changed).toBe(false);
  expect(r.unfixable.some((f) => f.code === "UNIT")).toBe(true);
});

test("an anchored scalar keeps its decoration", () => {
  const out = fmt(anchored, {}).output;
  expect(out).toContain("**$16.50**<!--vmark=order.total-->");
});

test("fmt over a decorated document is idempotent", () => {
  const once = fmt(stale, {}).output;
  expect(fmt(once, {}).output).toBe(once);
  expect(fmt(once, {}).changed).toBe(false);
});

test("a decorated document that is already correct is left byte-for-byte alone", () => {
  const correct = fmt(stale, {}).output;
  expect(fmt(correct, {}).output).toBe(correct);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test test/write/fmt-units.test.ts`
Expected: FAIL — the splicer writes bare numbers, so `| 16.50 |` replaces `| $9.99 |` and the `$` is lost.

- [ ] **Step 3: Decorate the planned edits**

In `src/write/fmt.ts`, import `applyUnit`:

```ts
import { applyUnit } from "../eval/units.js";
```

In `planFmt`, the computed-column loop skips conflicted columns and decorates
its replacement text:

```ts
  for (const sheet of model.sheets.values()) {
    if (!sheet.table) continue;
    for (const [name, binding] of sheet.columns) {
      const colId = `${sheet.id}.${name}`;
      if (result.unitConflicts.has(colId)) continue;
      const col = result.cells.get(colId);
      if (!col) continue;
      const prec = result.columnPrecision.get(colId) ?? 2;
      const unit = result.columnUnits.get(colId) ?? null;
      const idx = sheet.columnIndex.get(name)!;
      sheet.table.rows.forEach((row, r) => {
        const v = col[r];
        const cell = row.cells[idx];
        if (!v || !cell) return;
        if (cell.text !== "" && !matchesStored(v, cell.text, prec)) {
          edits.push({
            start: cell.start,
            end: cell.end,
            text: applyUnit(showValue(v, prec), unit),
          });
        }
      });
      void binding;
    }
  }
```

The anchored-scalar loop does the same with the scalar's unit:

```ts
  for (const a of model.anchors) {
    if (!a.value) continue;
    const id = `${a.sheetId}.${a.name}`;
    const v = result.values.get(id);
    if (!v) continue;
    const current = source.slice(a.value.start, a.value.end);
    const prec = decimalPlaces(current, 2);
    const unit = result.scalarUnits.get(id) ?? null;
    const rounded = roundValue(v, prec);
    if (!matchesStored(rounded, current, prec)) {
      edits.push({
        start: a.value.start,
        end: a.value.end,
        text: applyUnit(showValue(rounded, prec), unit),
      });
    }
  }
```

- [ ] **Step 4: Run the tests**

Run: `bun test test/write/fmt-units.test.ts`
Expected: PASS, all six.

Run: `bun test`
Expected: PASS, including `fmt doc/example-invoice.md` byte-for-byte identical
and the drift transcript unchanged.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/write/fmt.ts test/write/fmt-units.test.ts
git commit -m "feat(write): carry the column's unit through write-back

A rewritten cell keeps the decoration its column already had: the number
changes, the \$ or the trailing N does not. A column whose cells
disagree about their decoration is skipped entirely, because the tool
cannot know which one to write. fmt stays idempotent over decorated
documents.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: End-to-end verification through the CLI

**Files:**
- Test: `test/cli/dup-units.test.ts` (create)
- Modify: `README.md` (the "What it refuses to do" section)

**Interfaces:**
- Consumes: everything above, through `runCli`.
- Produces: no new source interfaces. This task proves the two codes reach a user.

- [ ] **Step 1: Write the failing test**

Look at `test/cli/cli.test.ts` first to match how it captures output. Create
`test/cli/dup-units.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";

function withFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "visimark-"));
  const path = join(dir, "doc.md");
  writeFileSync(path, contents);
  return path;
}

async function check(contents: string): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const code = await runCli(["check", withFile(contents)], {
    out: (l) => lines.push(l),
    err: (l) => lines.push(l),
  });
  return { code, out: lines.join("\n") };
}

test("check reports DUP and exits 1", async () => {
  const { code, out } = await check(`
\`\`\`vmark #s
x = 1
x = 2
\`\`\`
`);
  expect(code).toBe(1);
  expect(out).toContain("DUP");
  expect(out).toContain("already defined in this scope");
});

test("check reports a mixed-unit column and exits 1", async () => {
  const { code, out } = await check(`| Item | Price |
|------|------:|
| pen  | $5.50 |
| ink  | €4.00 |

\`\`\`vmark #s
total = SUM(Price)
\`\`\`

Total: **9.50**<!--vmark=s.total-->
`);
  expect(code).toBe(1);
  expect(out).toContain("UNIT");
  expect(out).toContain("mixes units");
});

test("check is silent on a consistently decorated document", async () => {
  const { code, out } = await check(`| Item | Price | Qty |    Net |
|------|------:|----:|-------:|
| pen  | $5.50 |   3 | $16.50 |

\`\`\`vmark #s
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **$16.50**<!--vmark=s.total-->
`);
  expect(code).toBe(0);
  expect(out).toContain("0 problems");
});
```

- [ ] **Step 2: Run it**

Run: `bun test test/cli/dup-units.test.ts`
Expected: PASS if Tasks 2–5 are correct. If the third test fails on the footer
wording, read the actual output and match `formatCheck`'s footer exactly rather
than changing the formatter.

- [ ] **Step 3: Document the two codes in the README**

The README's "What it refuses to do" section explains the ISO-date and
thousands-separator rules. Append two paragraphs after the existing text, before
the "This makes the format smaller" line:

```markdown
A column may carry a currency symbol or a physical unit — `$5.50`, `12 N` —
and VisiMark strips it to compute and puts it back when it writes. What it will
not do is let one column mean two things: a column holding both `$5.00` and
`€5.00` is an error, not a sum. The decoration is inert, never converted and
never propagated through a formula.

A name bound twice in one scope is an error rather than a silent overwrite.
```

- [ ] **Step 4: Run the whole suite one last time**

Run: `bun test`
Expected: PASS, every test including the acceptance suite.

Run: `bun run typecheck`
Expected: no errors.

Run: `bun src/cli/main.ts check doc/example-invoice-drift.md`
Expected: the familiar 26-problem transcript, unchanged.

Run: `bun src/cli/main.ts check doc/example-invoice.md`
Expected: `0 problems (0 stale, 0 errors)`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add test/cli/dup-units.test.ts README.md
git commit -m "test(cli): DUP and UNIT end to end; docs: README

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Done when

- `bun test` passes, including the untouched acceptance suite.
- `bun run typecheck` is clean.
- `check` on a document with a name bound twice reports `DUP` and exits 1.
- `check` on a column mixing `$` and `€` reports `UNIT` and exits 1.
- `check` on a consistently `$`-decorated document reports nothing and exits 0.
- `fmt` on a decorated document rewrites stale cells with their decoration intact and is idempotent.
- Every finding except `NOTE` and the collapsed anchor-group `STALE` carries a `span`.
