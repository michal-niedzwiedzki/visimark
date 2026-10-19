import { excerpt } from "../excerpt.js";
import { cellAt, rowKeys, tableAt } from "../tables.js";
import { emptyResult, type Rule } from "../types.js";

/**
 * What `visimark infer` would write (spec §4.1). A near-miss — a rule that
 * fits every row but one — is a lead at that row. A column or scalar
 * proposal marks its table as one `infer` can write rules for, which the
 * adoption axis counts.
 */
export const engineInfer: Rule = {
  id: "engine-infer",
  label: "VisiMark infer",
  scope: "file",
  run(doc, ctx) {
    const result = emptyResult();
    const proposed = new Set<number>();
    for (const p of ctx.engine.infer(doc.text)) {
      if (p.kind === "near-miss" && p.disagreement) {
        const d = p.disagreement;
        const at = cellAt(doc.tables, d.span.start);
        if (!at) continue;
        const lines: [number, number] = [at.table.headerLine, at.table.rows[at.row]!.line];
        result.findings.push({
          rule: "engine-infer",
          cell: {
            kind: "table",
            table: at.table.index,
            column: at.table.header[at.column]?.text ?? "",
            row: rowKeys(at.table)[at.row]!,
          },
          path: doc.path,
          lines,
          confidence: "lead",
          stored: d.stored,
          computed: d.computed,
          message: `the table says ${d.stored}; ${p.rule}, which fits the other rows, gives ${d.computed}`,
          evidence: excerpt(doc.text, lines[0], lines[1]),
        });
      } else if (p.kind === "column" || p.kind === "scalar") {
        const table = tableAt(doc.tables, p.tableSpan.start);
        if (table) proposed.add(table.index);
      }
    }
    result.proposals = [...proposed].sort((a, b) => a - b).map((table) => ({ table }));
    return result;
  },
};
