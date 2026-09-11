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
  /** the document's own path — needed to resolve and write its artifacts */
  docPath?: string;
}

/** a generated artifact `fmt` must write: absolute target, and its bytes */
export interface ArtifactWrite {
  target: string;
  svg: string;
  /** path as the document named it; JSON reports this, never `target` */
  path: string | null;
}

export interface FmtResult {
  output: string;
  changed: boolean;
  cellsUpdated: number;
  anchorsUpdated: number;
  datesFixed: number;
  /** import stamps added or corrected — never the CSV file itself */
  stampsUpdated: number;
  unfixable: Finding[];
  /** artifacts that are stale or missing — the caller writes them */
  artifacts: ArtifactWrite[];
}

/** an edit together with the finding it resolves, so a diagnostic can be
 *  turned into a quick fix without re-deriving anything */
export interface PlannedEdit extends Edit {
  finding: Finding;
}

export function planFmt(model: DocModel, result: CheckResult, opts: FmtOptions): PlannedEdit[] {
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
    // an image anchor points at a generated artifact; it is never spliced
    if (a.value.kind === "image") continue;
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

  // 3. import stamps — added when missing, corrected when stale; an `error`
  //    state import is never touched, same as any other non-STALE finding
  for (const sheet of model.sheets.values()) {
    const decl = sheet.imported;
    if (!decl) continue;
    const status = result.imports.get(sheet.id);
    if (!status || status.digest === null) continue;
    if (status.state === "ok" || status.state === "error" || status.state === "skipped") continue;
    const text = `at sha256:${status.digest}`;
    if (decl.stampSpan) {
      edits.push({
        start: decl.stampSpan.start,
        end: decl.stampSpan.end,
        text,
        finding: findingFor(decl.stampSpan.start, decl.stampSpan.end),
      });
    } else {
      edits.push({
        start: decl.declSpan.end,
        end: decl.declSpan.end,
        text: " " + text,
        finding: findingFor(decl.declSpan.start, decl.declSpan.end),
      });
    }
  }

  // 4. decidable non-ISO date inputs — only with --fix-dates
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
  const result = check(model, { docPath: opts.docPath });
  const edits = planFmt(model, result, opts);
  const output = applyEdits(source, edits);

  const cellsUpdated = countCellEdits(model, result, edits);
  const datesFixed = opts.fixDates
    ? edits.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.text)).length
    : 0;
  const stampsUpdated = countStampEdits(model, edits);
  const anchorsUpdated = edits.length - cellsUpdated - datesFixed - stampsUpdated;

  const unfixable = result.findings.filter((f) => {
    if (FIXABLE_BY_FMT.has(f.code)) return false;
    if (opts.fixDates && f.code === "DATE" && f.isoFix) return false;
    // an unstamped import is the one IMPORT finding `fmt` repairs, by adding
    // the stamp — every other IMPORT finding needs a human
    if (f.code === "IMPORT" && f.message === "unstamped import") return false;
    return true;
  });

  // an artifact carrying an ARTIFACT error is not written at all — the same
  // rule a column with a UNIT conflict already follows
  const artifacts = result.charts
    .filter((c) => (c.state === "stale" || c.state === "missing") && c.target && c.svg)
    .map((c) => ({ target: c.target!, svg: c.svg!, path: c.path }));

  return {
    output,
    changed: output !== source,
    cellsUpdated,
    anchorsUpdated,
    datesFixed,
    stampsUpdated,
    unfixable,
    artifacts,
  };
}

/** an edit counts as a stamp update when it lands at one of this document's
 *  import declarations — either replacing an existing `at` clause or
 *  inserting a new one right after the declaration */
function countStampEdits(model: DocModel, edits: Edit[]): number {
  const sites = new Set<string>();
  for (const sheet of model.sheets.values()) {
    const decl = sheet.imported;
    if (!decl) continue;
    if (decl.stampSpan) sites.add(`${decl.stampSpan.start}:${decl.stampSpan.end}`);
    else sites.add(`${decl.declSpan.end}:${decl.declSpan.end}`);
  }
  return edits.filter((e) => sites.has(`${e.start}:${e.end}`)).length;
}

function countCellEdits(model: DocModel, _result: CheckResult, edits: Edit[]): number {
  const cellSpans = new Set<string>();
  for (const sheet of model.sheets.values()) {
    for (const row of sheet.table?.rows ?? []) {
      for (const cell of row.cells) cellSpans.add(`${cell.start}:${cell.end}`);
    }
  }
  return edits.filter((e) => cellSpans.has(`${e.start}:${e.end}`)).length;
}
