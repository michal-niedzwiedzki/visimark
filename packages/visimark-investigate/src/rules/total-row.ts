import { cellNumber, decimal, places, rewriteNumber, roundToPlaces, scaled } from "../decimal.js";
import { excerpt } from "../excerpt.js";
import { rowKeys } from "../tables.js";
import { emptyResult, tableKey, type Rule } from "../types.js";

/**
 * A "Total" row against the sum of the numbers above it, since the previous
 * total row, in exact scaled integers at the total's own decimal places
 * (spec §4.1). A column whose total equals quantity × price for some other
 * column is a priced total, not a mismatch.
 */
const TOTAL_LABEL = /^(grand\s+)?(sub)?\s*total(\s+cost)?:?$/i;

const value = (raw: string): string => raw.replace(/&nbsp;/g, "").trim();

export const totalRow: Rule = {
  id: "total-row",
  label: "sum check",
  scope: "file",
  run(doc) {
    const result = emptyResult();
    const checked = new Set<string>();
    for (const table of doc.tables) {
      const keys = rowKeys(table);
      let start = 0;
      table.rows.forEach((row, r) => {
        if (!TOTAL_LABEL.test(row.label)) return;
        const above = table.rows.slice(start, r);
        start = r + 1;
        for (let c = 1; c < table.header.length; c++) {
          if (!table.header[c]!.text) continue;
          const storedCell = row.cells[c];
          if (!storedCell || !cellNumber(storedCell.text)) continue;
          const terms: string[] = [];
          let unreadable = false;
          for (const a of above) {
            const raw = value(a.cells[c]?.text ?? "");
            if (!raw) continue;
            if (!cellNumber(raw)) unreadable = true;
            else terms.push(raw);
          }
          if (unreadable) {
            result.unreadable++;
            continue;
          }
          if (terms.length < 2) continue;
          const storedPlaces = places(storedCell.text)!;
          const p = Math.max(storedPlaces, ...terms.map((t) => places(t)!));
          const sum = terms.reduce((s, t) => s + scaled(t, p)!, 0n);
          const stored = scaled(storedCell.text, storedPlaces)!;
          checked.add(tableKey(doc.path, table.index));
          if (roundToPlaces(sum, p, storedPlaces) === stored) continue;
          if (pricedTotal(above, c, stored, storedPlaces)) continue;
          const computed = decimal(roundToPlaces(sum, p, storedPlaces), storedPlaces);
          const old = doc.text.slice(storedCell.from, storedCell.to);
          result.findings.push({
            rule: "total-row",
            cell: {
              kind: "table",
              table: table.index,
              column: table.header[c]!.text,
              row: keys[r]!,
            },
            path: doc.path,
            lines: [table.headerLine, row.line],
            confidence: "confirmed",
            stored: storedCell.text,
            computed,
            message: `the table says ${storedCell.text}; the rows add up to ${decimal(sum, p)} (exact); off by ${decimal(roundToPlaces(stored, storedPlaces, p) - sum, p)}`,
            evidence: excerpt(doc.text, table.headerLine, row.line),
            fix: [
              { from: storedCell.from, to: storedCell.to, old, new: rewriteNumber(old, computed) },
            ],
          });
        }
      });
    }
    result.checked = [...checked];
    return result;
  },
};

/** True when some other column, used as a quantity, makes column `c` add up to the total. */
function pricedTotal(
  above: { cells: { text: string }[] }[],
  c: number,
  stored: bigint,
  storedPlaces: number,
): boolean {
  const width = Math.max(0, ...above.flatMap((a) => a.cells.length));
  for (let q = 1; q < width; q++) {
    if (q === c) continue;
    if (!above.some((a) => cellNumber(a.cells[q]?.text ?? ""))) continue;
    // every term at a common width: price places + quantity places
    const pp = Math.max(0, ...above.map((a) => places(a.cells[c]?.text ?? "") ?? 0));
    const qp = Math.max(0, ...above.map((a) => places(a.cells[q]?.text ?? "") ?? 0));
    let total = 0n;
    for (const a of above) {
      const price = scaled(a.cells[c]?.text ?? "", pp);
      if (price === null) continue;
      const qty = scaled(a.cells[q]?.text ?? "", qp);
      total += qty === null ? price * 10n ** BigInt(qp) : price * qty;
    }
    if (roundToPlaces(total, pp + qp, storedPlaces) === stored) return true;
  }
  return false;
}
