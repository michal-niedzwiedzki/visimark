import { locate } from "../parse/document.js";
import { build } from "../model/build.js";
import {
  check,
  type CheckResult,
  decimalPlaces,
  matchesStored,
  roundValue,
  showValue,
} from "../eval/check.js";
import type { DocModel, Finding } from "../model/types.js";
import { applyUnit } from "../eval/units.js";
import { applyEdits, type Edit } from "./splice.js";

export interface FmtOptions {
  fixDates?: boolean;
}

export interface FmtResult {
  output: string;
  changed: boolean;
  cellsUpdated: number;
  anchorsUpdated: number;
  datesFixed: number;
  unfixable: Finding[];
}

/** an edit together with the finding it resolves, so a diagnostic can be
 *  turned into a quick fix without re-deriving anything */
export interface PlannedEdit extends Edit {
  finding: Finding;
}

export function planFmt(
  model: DocModel,
  result: CheckResult,
  opts: FmtOptions,
): PlannedEdit[] {
  const edits: PlannedEdit[] = [];
  const source = model.source;
  const bySpan = new Map<string, Finding>();
  for (const f of result.findings) {
    if (f.span) bySpan.set(`${f.span.start}:${f.span.end}`, f);
  }
  const findingFor = (start: number, end: number): Finding =>
    bySpan.get(`${start}:${end}`) ?? { code: "STALE" };

  // 1. computed column cells
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
            finding: findingFor(cell.start, cell.end),
          });
        }
      });
      void binding;
    }
  }

  // 2. anchored scalar values
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
        finding: findingFor(a.value.start, a.value.end),
      });
    }
  }

  // 3. decidable non-ISO date inputs — only with --fix-dates
  if (opts.fixDates) {
    for (const f of result.findings) {
      if (f.code !== "DATE" || !f.isoFix || !f.sheetId || !f.name) continue;
      const sheet = model.sheets.get(f.sheetId);
      const table = sheet?.table;
      if (!table) continue;
      const idx = sheet!.columnIndex.get(f.name);
      if (idx === undefined) continue;
      const row = table.rows.find((rr) => rr.cells[0]?.text === f.rowLabel);
      const cell = row?.cells[idx];
      if (cell && cell.text === f.raw) {
        edits.push({
          start: cell.start,
          end: cell.end,
          text: f.isoFix,
          finding: f,
        });
      }
    }
  }

  return dedupe(edits);
}

function dedupe(edits: PlannedEdit[]): PlannedEdit[] {
  const seen = new Set<string>();
  const out: PlannedEdit[] = [];
  for (const e of edits) {
    const key = `${e.start}:${e.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

const FIXABLE_BY_FMT = new Set(["STALE"]);

export function fmt(source: string, opts: FmtOptions = {}): FmtResult {
  const model = build(locate(source));
  const result = check(model);
  const edits = planFmt(model, result, opts);
  const output = applyEdits(source, edits);

  const cellsUpdated = countCellEdits(model, result, edits);
  const datesFixed = opts.fixDates
    ? edits.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.text)).length
    : 0;
  const anchorsUpdated = edits.length - cellsUpdated - datesFixed;

  const unfixable = result.findings.filter((f) => {
    if (FIXABLE_BY_FMT.has(f.code)) return false;
    if (opts.fixDates && f.code === "DATE" && f.isoFix) return false;
    return true;
  });

  return {
    output,
    changed: output !== source,
    cellsUpdated,
    anchorsUpdated,
    datesFixed,
    unfixable,
  };
}

function countCellEdits(
  model: DocModel,
  _result: CheckResult,
  edits: Edit[],
): number {
  const cellSpans = new Set<string>();
  for (const sheet of model.sheets.values()) {
    for (const row of sheet.table?.rows ?? []) {
      for (const cell of row.cells) cellSpans.add(`${cell.start}:${cell.end}`);
    }
  }
  return edits.filter((e) => cellSpans.has(`${e.start}:${e.end}`)).length;
}
