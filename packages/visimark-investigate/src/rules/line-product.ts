import { cellNumber, decimal, places, rewriteNumber, roundToPlaces, scaled } from "../decimal.js";
import { excerpt } from "../excerpt.js";
import { rowKeys } from "../tables.js";
import { emptyResult, tableKey, type Rule } from "../types.js";

/**
 * A line total against quantity × price: in a table where the relation holds
 * exactly on at least two rows and fails on exactly one, that one row
 * (spec §4.1). The product column sits to the right of both factors and has a
 * total-like header, so two unrelated numeric columns that happen to agree
 * are not reported.
 */
const PRODUCT_HEADER = /total|amount|cost|price|sum|line|value/i;
const TOTAL_ROW = /^(?:grand\s+)?(?:sub\s*)?total/i;

export const lineProduct: Rule = {
  id: "line-product",
  label: "line check",
  scope: "file",
  run(doc) {
    const result = emptyResult();
    const checked = new Set<string>();
    const seenCells = new Set<string>();
    for (const table of doc.tables) {
      const keys = rowKeys(table);
      const items = table.rows
        .map((row, r) => ({ row, key: keys[r]! }))
        .filter((x) => !TOTAL_ROW.test(x.row.label));
      const header = table.header.map((h) => h.text);
      for (let c = 0; c < header.length; c++) {
        if (!PRODUCT_HEADER.test(header[c]!)) continue;
        for (let a = 0; a < c; a++) {
          for (let b = a + 1; b < c; b++) {
            const rows = items.flatMap((item) => {
              const [x, y, z] = [a, b, c].map((k) => item.row.cells[k]?.text ?? "");
              return cellNumber(x!) && cellNumber(y!) && cellNumber(z!)
                ? [{ ...item, x: x!, y: y!, z: z! }]
                : [];
            });
            const product = (s: (typeof rows)[number]) => {
              const xp = places(s.x)!;
              const yp = places(s.y)!;
              return roundToPlaces(scaled(s.x, xp)! * scaled(s.y, yp)!, xp + yp, places(s.z)!);
            };
            const bad = rows.filter((s) => product(s) !== scaled(s.z, places(s.z)!));
            if (rows.length < 3 || bad.length > 1) continue;
            checked.add(tableKey(doc.path, table.index));
            if (bad.length === 0) continue;
            const s = bad[0]!;
            const id = `${table.index}/${header[c]}/${s.key}`;
            if (seenCells.has(id)) continue;
            seenCells.add(id);
            const cell = s.row.cells[c]!;
            const computed = decimal(product(s), places(s.z)!);
            const old = doc.text.slice(cell.from, cell.to);
            const first = items[0]!.row.line;
            const last = items.at(-1)!.row.line;
            result.findings.push({
              rule: "line-product",
              cell: { kind: "table", table: table.index, column: header[c]!, row: s.key },
              path: doc.path,
              lines: [table.headerLine, s.row.line],
              confidence: "confirmed",
              stored: s.z,
              computed,
              message: `the table says ${s.z}; ${header[a]} × ${header[b]} is ${computed}; the other ${rows.length - 1} rows agree`,
              evidence: excerpt(
                doc.text,
                Math.max(first, s.row.line - 1),
                Math.min(last, s.row.line + 1),
              ),
              fix: [{ from: cell.from, to: cell.to, old, new: rewriteNumber(old, computed) }],
            });
          }
        }
      }
    }
    result.checked = [...checked];
    return result;
  },
};
