import type { CellRef } from "./types.js";

/**
 * A finding's id names the cell by content, never a line number or a rule,
 * so the same wrong total keeps its id when lines move above it, and two
 * rules that find it merge into one finding (spec §3.5).
 */
export function cellKey(path: string, ref: CellRef): string {
  switch (ref.kind) {
    case "table":
      return `${path}#t${ref.table}/${ref.column}/${ref.row}`;
    case "named":
      return `${path}#${ref.sheetId}/${ref.name}`;
    case "other":
      return `${path}#${ref.code}/${ref.name ?? "-"}`;
  }
}
