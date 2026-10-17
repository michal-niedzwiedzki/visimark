import { excerpt } from "../excerpt.js";
import { cellAt, rowKeys, tableAt } from "../tables.js";
import { enginePath } from "../reader.js";
import { emptyResult, tableKey, type CellRef, type RawFinding, type Rule } from "../types.js";

/**
 * The engine's own verdict (spec §4.1). `STALE` — a stored value its rule no
 * longer computes — is a confirmed wrong number. Every other error code is a
 * broken document rather than a wrong number, so it is a lead. `COVERAGE` is
 * counted for the adoption axis, and `WARN`, `NOTE` and the collapsed
 * anchor-group `STALE` (a summary of the others) are not findings.
 */
export const engineCheck: Rule = {
  id: "engine-check",
  label: "VisiMark",
  scope: "file",
  run(doc, ctx) {
    const { engine } = ctx;
    const result = emptyResult();
    const model = engine.build(engine.locate(doc.text));
    const { findings } = engine.check(model, {
      doc: { path: enginePath(doc.path), reader: ctx.reader },
    });

    const ruled = new Set<string>();
    for (const sheet of model.sheets.values()) {
      if (!sheet.table || sheet.columns.size + sheet.scalars.size === 0) continue;
      const table = tableAt(doc.tables, sheet.table.span.start);
      if (table) ruled.add(tableKey(doc.path, table.index));
    }
    result.ruled = [...ruled];
    result.checked = [...ruled];

    for (const f of findings) {
      if (f.code === "COVERAGE") {
        result.coverage++;
        continue;
      }
      if (!engine.isProblem(f) || f.anchorGroup) continue;
      const stale = f.code === "STALE";
      const at = f.span ? cellAt(doc.tables, f.span.start) : null;
      let cell: CellRef;
      let lines: [number, number];
      if (at) {
        cell = {
          kind: "table",
          table: at.table.index,
          column: at.table.header[at.column]?.text ?? "",
          row: rowKeys(at.table)[at.row]!,
        };
        lines = [at.table.headerLine, at.table.rows[at.row]!.line];
      } else {
        const line = f.span ? doc.text.slice(0, f.span.start).split("\n").length : 1;
        cell =
          f.sheetId && f.name
            ? { kind: "named", sheetId: f.sheetId, name: f.name }
            : { kind: "other", code: f.code, name: f.name ?? null };
        lines = [line, line];
      }
      const finding: RawFinding = {
        rule: "engine-check",
        cell,
        path: doc.path,
        lines,
        confidence: stale ? "confirmed" : "lead",
        stored: f.stored ?? "",
        computed: f.computed ?? "",
        message: stale
          ? `the document says ${f.stored ?? ""}; ${f.formula ?? "its rule"} computes ${f.computed ?? ""}`
          : engine.describeFinding(f),
        evidence: excerpt(doc.text, lines[0], lines[1]),
      };
      if (stale && f.span && f.stored !== undefined && f.computed !== undefined) {
        const old = doc.text.slice(f.span.start, f.span.end);
        if (old === f.stored)
          finding.fix = [{ from: f.span.start, to: f.span.end, old, new: f.computed }];
      }
      result.findings.push(finding);
    }
    return result;
  },
};
