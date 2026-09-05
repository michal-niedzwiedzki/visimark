import { check, matchesStored, roundValue, showValue } from "../eval/check.js";
import { applyUnit, parseDecorated, type Unit } from "../eval/units.js";
import type { Value } from "../eval/value.js";
import type { Binding } from "../model/types.js";
import type { Span } from "../parse/document.js";
import { type InferContext, type InferSheet, makeBinding, provisional } from "./context.js";

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
  /**
   * True when `fmt` would write this figure exactly as it already stands — the
   * value, at the figure's own decimals, carrying the column's decoration.
   */
  writes(figure: string): boolean;
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
  /** the column the rule reduces, whose decoration the value would carry */
  unitFrom?: string,
): ScalarVerdict {
  const miss: ScalarVerdict = {
    usable: false,
    text: () => "",
    writes: () => false,
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
  const unit = unitFrom ? (result.columnUnits.get(`${sheet.id}.${unitFrom}`) ?? null) : null;

  return {
    usable: true,
    text: (places) => showValue(v, places),
    writes: (figure) => writesExactly(v, unit, figure),
  };
}

/**
 * A figure in prose states this value only if it is already written the way
 * `fmt` would write it back. Comparing the two as numbers is not enough: `00`
 * in a postal code and `MIN(Share)` of `0.25` agree at zero decimals, and
 * `#unnamed1` parses as a decorated `1` and agrees with `SUM(Share)`. Both
 * disagree about the *text*, which is the thing an anchor is a promise about.
 *
 * This is exact, and it is not a new rule: it is `planFmt`'s own write-back,
 * asked as a question instead of performed. Rounding at the anchor stays
 * legal, because a value rounded to the figure's decimals is what `fmt`
 * writes; only forms the tool would never produce are refused.
 */
function writesExactly(v: Value, unit: Unit | null, figure: string): boolean {
  const text = figure.trim();
  const dec = parseDecorated(text);
  if (dec.kind !== "number") return false;
  const m = /^-?\d+(?:\.(\d+))?$/.exec(dec.num);
  if (!m) return false;
  const places = m[1]?.length ?? 0;
  return applyUnit(showValue(roundValue(v, places), places), unit) === text;
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
