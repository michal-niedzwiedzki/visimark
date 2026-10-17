import type { CellRef } from "./types.js";

/**
 * A finding's id names the cell by content, never a line number or a rule,
 * so the same wrong total keeps its id when lines move above it, and two
 * rules that find it merge into one finding (spec §3.5).
 */
export function cellKey(path: string, ref: CellRef): string {
  switch (ref.kind) {
    case "table":
      return `${path}#t${ref.table}/${part(ref.column)}/${part(ref.row)}`;
    case "named":
      return `${path}#${part(ref.sheetId)}/${part(ref.name)}`;
    case "other":
      return `${path}#${ref.code}/${part(ref.name ?? "-")}`;
  }
}

/** A `/` inside a header or a label would split the id wrongly, so it is escaped (with `%`). */
const part = (s: string): string => s.replace(/%/g, "%25").replace(/\//g, "%2F");
export const unpart = (s: string): string => s.replace(/%2F/g, "/").replace(/%25/g, "%");

const CODES = new Set([
  "STALE",
  "DATE",
  "UNIT",
  "UNDEF",
  "DUP",
  "VECTOR",
  "CYCLE",
  "TYPE",
  "SHEET",
  "ANCHOR",
  "ASSERT",
  "PRECISION",
  "DOMAIN",
  "ARTIFACT",
  "IMPORT",
  "COVERAGE",
]);

/** How a finding names its cell to a reader: `Cost / Total`, `lunch.Total`, `UNDEF Rate`. */
export function cellLabel(id: string): string {
  const parts = id.slice(id.indexOf("#") + 1).split("/");
  if (/^t\d+$/.test(parts[0]!) && parts.length === 3)
    return `${unpart(parts[1]!)} / ${unpart(parts[2]!)}`;
  if (CODES.has(parts[0]!))
    return parts[1] === "-" ? parts[0]! : `${parts[0]} ${unpart(parts[1]!)}`;
  return `${unpart(parts[0]!)}.${unpart(parts[1] ?? "")}`;
}
