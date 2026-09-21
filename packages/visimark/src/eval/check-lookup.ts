import type { Ref } from "../lang/ast.js";
import type { RawTable } from "../parse/document.js";
import type { Binding } from "../model/types.js";
import type { CheckState } from "./check-state.js";
import { parseIsoDate } from "./dates.js";
import { resolve } from "./graph.js";
import { numericValue } from "./units.js";
import { date, num, str, type Value } from "./value.js";

/**
 * Reading a value is the one thing both the row evaluation loop and the chart
 * pass do, so it lives here rather than in either of them. Splitting it would
 * put two copies of input coercion — and of the `DATE` finding it emits — on
 * either side of a phase boundary.
 */
type LookupState = Pick<CheckState, "model" | "cells" | "dateErrorRows" | "emit">;

/** thrown, not returned, because it unwinds out of `evalExpr`'s own recursion */
export class Unevaluable extends Error {}

const DATEISH_RE = /^\d{1,4}[./-]\d{1,4}[./-]\d{1,4}$/;

export function rowLabel(table: RawTable, row: number): string {
  return table.rows[row]?.cells[0]?.text ?? `row ${row + 1}`;
}

export function lookupVector(st: LookupState, binding: Binding, ref: Ref): Value[] {
  const res = resolve(st.model, binding.sheetId, ref);
  if (res.kind === "column") {
    const col = st.cells.get(res.binding.id);
    if (!col || col.some((v) => v === null)) throw new Unevaluable();
    return col as Value[];
  }
  if (res.kind === "input-column") {
    const sheet = st.model.sheets.get(res.sheetId)!;
    const colIdx = sheet.columnIndex.get(res.column)!;
    return (sheet.table?.rows ?? []).map((row, r) => {
      const cell = row.cells[colIdx];
      return coerceInput(st, cell?.text ?? "", sheet.id, res.column, r, cell);
    });
  }
  throw new Unevaluable();
}

export function coerceInput(
  st: LookupState,
  text: string,
  sheetId: string,
  column: string,
  row: number,
  cell: { start: number; end: number } | undefined,
): Value {
  const t = text.trim();
  const n = numericValue(t);
  if (n !== null) return num(n);
  const iso = parseIsoDate(t);
  if (iso.ok) return date(iso.iso);
  if (DATEISH_RE.test(t) || /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const key = `${sheetId}.${column}#${row}`;
    if (!st.dateErrorRows.has(key)) {
      st.dateErrorRows.add(key);
      const table = st.model.sheets.get(sheetId)!.table!;
      st.emit(
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
