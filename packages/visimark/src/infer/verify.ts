import {
  check,
  decimalPlaces,
  docPrecision,
  matchesStored,
  showValue,
} from "../eval/check.js";
import { applyUnit } from "../eval/units.js";
import type { Binding } from "../model/types.js";
import type { Span } from "../parse/document.js";
import {
  type InferContext,
  type InferSheet,
  makeBinding,
  provisional,
} from "./context.js";

/** a rule already chosen, carried into the model a candidate is verified in */
export interface Accepted {
  sheet: InferSheet;
  rule: string;
}

export interface Disagreement {
  rowIndex: number;
  rowLabel: string;
  stored: string;
  computed: string;
  span: Span;
}

export interface ColumnVerdict {
  /** false when the rule cannot be evaluated here at all */
  usable: boolean;
  /** rows carrying a stored value to compare against */
  rows: number;
  /** rows the rule reproduces exactly */
  fits: number;
  misses: Disagreement[];
}

export interface ScalarVerdict {
  usable: boolean;
  /** the value rendered at `places` decimals, for comparison against prose */
  text(places: number): string;
  /** true when the value matches a figure written like `stored` */
  matches(stored: string): boolean;
}

/**
 * Verification constructs an ordinary `Binding` and runs the engine. There is
 * no second arithmetic implementation and no reimplemented rounding: if this
 * says a rule holds, `check` says so too, which matters because the whole
 * output of inference is fed straight back into `check`.
 */
export function verifyColumn(
  ctx: InferContext,
  sheet: InferSheet,
  rule: string,
  accepted: Accepted[],
): ColumnVerdict {
  const miss: ColumnVerdict = { usable: false, rows: 0, fits: 0, misses: [] };
  const binding = safeBinding(sheet, rule);
  if (!binding || binding.kind !== "column") return miss;

  const model = provisional(ctx, [...bindings(accepted), binding]);
  const result = check(model);
  const colId = `${sheet.id}.${binding.name}`;

  for (const f of result.findings) {
    if (f.code === "STALE") continue;
    if (f.sheetId === sheet.id && f.name === binding.name) return miss;
    if (f.code === "CYCLE" && f.cyclePath?.includes(binding.id)) return miss;
  }

  const col = result.cells.get(colId);
  if (!col) return miss;
  const places = result.columnPrecision.get(colId) ?? 2;
  const unit = result.columnUnits.get(colId) ?? null;
  const idx = sheet.index.get(binding.name)!;

  const out: ColumnVerdict = { usable: true, rows: 0, fits: 0, misses: [] };
  sheet.table.rows.forEach((row, r) => {
    const cell = row.cells[idx];
    const stored = cell?.text ?? "";
    if (stored.trim() === "") return;
    out.rows++;
    const v = col[r];
    if (v == null) {
      out.usable = false;
      return;
    }
    if (matchesStored(v, stored, places)) {
      out.fits++;
      return;
    }
    out.misses.push({
      rowIndex: r,
      rowLabel: row.cells[0]?.text ?? `row ${r + 1}`,
      stored,
      computed: applyUnit(showValue(v, places), unit),
      span: cell ? { start: cell.start, end: cell.end } : { start: 0, end: 0 },
    });
  });

  return out.usable ? out : miss;
}

export function verifyScalar(
  ctx: InferContext,
  sheet: InferSheet,
  rule: string,
  accepted: Accepted[],
): ScalarVerdict {
  const miss: ScalarVerdict = {
    usable: false,
    text: () => "",
    matches: () => false,
  };
  const binding = safeBinding(sheet, rule);
  if (!binding || binding.kind !== "scalar") return miss;

  const model = provisional(ctx, [...bindings(accepted), binding]);
  const result = check(model);
  for (const f of result.findings) {
    if (f.code === "STALE" || f.code === "WARN") continue;
    if (f.sheetId === sheet.id && f.name === binding.name) return miss;
  }
  const v = result.values.get(binding.id);
  if (!v) return miss;

  // A figure in prose is compared at no less than the document's own
  // precision. Without that floor a bare integer — a postal code, a year —
  // matches any value that rounds to it, so `00` in an address would claim
  // `MIN(Share)`. Two decimals is where the document states money, and a whole
  // number is not a claim about a value that differs in the second place.
  const floor = docPrecision(model);
  return {
    usable: true,
    text: (places) => showValue(v, places),
    matches: (stored) =>
      matchesStored(v, stored, Math.max(decimalPlaces(stored, floor), floor)),
  };
}

function bindings(accepted: Accepted[]): Binding[] {
  const out: Binding[] = [];
  for (const a of accepted) {
    const b = safeBinding(a.sheet, a.rule);
    if (b) out.push(b);
  }
  return out;
}

function safeBinding(sheet: InferSheet, rule: string): Binding | null {
  try {
    return makeBinding(sheet, rule);
  } catch {
    return null;
  }
}
