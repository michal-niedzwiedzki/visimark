/**
 * GFM pipe tables, read out of a masked file (`mask.ts`). Every offset is an
 * index into the original text — masking keeps lengths — so a rule can quote
 * or rewrite the original cell from what it found here.
 *
 * A table is a line starting with `|`, then a delimiter row, then every
 * following line that starts with `|`. A table without leading pipes is not
 * read; the heuristic detectors this replaces never read one either.
 */

export interface Cell {
  /** trimmed, with the `*`, `_` and `` ` `` runs that wrap it removed */
  text: string;
  /** the raw cell content without its surrounding spaces */
  from: number;
  to: number;
}

export interface TableRow {
  /** 1-based */
  line: number;
  /** the first cell's `text` */
  label: string;
  cells: Cell[];
}

export interface Table {
  /** 1-based position among the tables in this file */
  index: number;
  headerLine: number;
  from: number;
  to: number;
  header: Cell[];
  rows: TableRow[];
}

const ROW = /^\s*\|/;
// One character class, so a long run of spaces cannot backtrack polynomially.
const DELIMITER = /^\s*\|[\s:|-]+$/;

/** A cell's text without the emphasis or code markers around it; an inner `_` (`premium_hours`) stays. */
export const plainCell = (raw: string): string =>
  raw
    .trim()
    .replace(/^[*_`]+|[*_`]+$/g, "")
    .trim();

function cellsOf(text: string, lineFrom: number, lineText: string): Cell[] {
  // Split on unescaped pipes; drop the empty edges a leading/trailing `|` makes.
  const bounds: number[] = [];
  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === "|" && lineText[i - 1] !== "\\") bounds.push(i);
  }
  const cells: Cell[] = [];
  const first = lineText.search(/\S/);
  const last = lineText.trimEnd().length - 1;
  const edges = [...bounds];
  if (edges[0] !== first) edges.unshift(first - 1);
  if (edges.at(-1) !== last) edges.push(last + 1);
  for (let k = 0; k + 1 < edges.length; k++) {
    let a = edges[k]! + 1;
    let b = edges[k + 1]!;
    while (a < b && /\s/.test(lineText[a]!)) a++;
    while (b > a && /\s/.test(lineText[b - 1]!)) b--;
    cells.push({
      text: plainCell(text.slice(lineFrom + a, lineFrom + b)),
      from: lineFrom + a,
      to: lineFrom + b,
    });
  }
  return cells;
}

export function readTables(masked: string): Table[] {
  const lines: { from: number; text: string }[] = [];
  let start = 0;
  for (let i = 0; i <= masked.length; i++) {
    if (i === masked.length || masked[i] === "\n") {
      lines.push({ from: start, text: masked.slice(start, i).replace(/\r$/, "") });
      start = i + 1;
    }
  }
  const tables: Table[] = [];
  let i = 0;
  while (i < lines.length) {
    const head = lines[i]!;
    if (!ROW.test(head.text) || !DELIMITER.test(lines[i + 1]?.text ?? "")) {
      i++;
      continue;
    }
    const rows: TableRow[] = [];
    let j = i + 2;
    while (j < lines.length && ROW.test(lines[j]!.text)) {
      const cells = cellsOf(masked, lines[j]!.from, lines[j]!.text);
      rows.push({ line: j + 1, label: cells[0]?.text ?? "", cells });
      j++;
    }
    const lastLine = lines[j - 1]!;
    tables.push({
      index: tables.length + 1,
      headerLine: i + 1,
      from: head.from,
      to: lastLine.from + lastLine.text.length,
      header: cellsOf(masked, head.from, head.text),
      rows,
    });
    i = j;
  }
  return tables;
}

/** Row labels as finding ids use them: a repeated label gains `~2`, `~3` (spec §3.5). */
export function rowKeys(table: Table): string[] {
  const seen = new Map<string, number>();
  return table.rows.map((r) => {
    const n = (seen.get(r.label) ?? 0) + 1;
    seen.set(r.label, n);
    return n === 1 ? r.label : `${r.label}~${n}`;
  });
}

/** The table, row and column whose cell contains `offset`, if any. */
export function cellAt(
  tables: Table[],
  offset: number,
): { table: Table; row: number; column: number } | null {
  for (const table of tables) {
    if (offset < table.from || offset > table.to) continue;
    for (let r = 0; r < table.rows.length; r++) {
      const cells = table.rows[r]!.cells;
      for (let c = 0; c < cells.length; c++) {
        if (offset >= cells[c]!.from && offset <= cells[c]!.to) return { table, row: r, column: c };
      }
    }
  }
  return null;
}

/** The table whose source range contains `offset`, if any. */
export function tableAt(tables: Table[], offset: number): Table | null {
  return tables.find((t) => offset >= t.from && offset <= t.to) ?? null;
}
