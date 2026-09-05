import type { Expr } from "../lang/ast.js";
import type { LangError } from "../lang/token.js";
import type { LocatedDoc, RawAnchor, RawBlock, RawTable, Span } from "../parse/document.js";

export type FindingCode =
  | "STALE"
  | "DATE"
  | "UNIT"
  | "UNDEF"
  | "DUP"
  | "VECTOR"
  | "CYCLE"
  | "TYPE"
  | "SHEET"
  | "ANCHOR"
  | "WARN"
  | "NOTE"
  | "COVERAGE";

/**
 * The codes that count as an error in the report's total and fail a run.
 * `STALE` counts too, tallied separately because the report shows it
 * separately. Everything else — `WARN`, `NOTE` — is advice: reported, never
 * counted, never the reason an exit code is non-zero. One definition, so the
 * printed count and the exit code cannot drift apart.
 */
export const ERROR_CODES: ReadonlySet<FindingCode> = new Set<FindingCode>([
  "DATE",
  "UNIT",
  "UNDEF",
  "DUP",
  "VECTOR",
  "CYCLE",
  "TYPE",
  "SHEET",
  "ANCHOR",
  "COVERAGE",
]);

/** whether a finding is a problem — something to fix — rather than advice */
export function isProblem(f: Finding): boolean {
  return f.code === "STALE" || ERROR_CODES.has(f.code);
}

export interface Finding {
  code: FindingCode;
  sheetId?: string;
  name?: string;
  /** first-column label of the offending table row */
  rowLabel?: string;
  stored?: string;
  computed?: string;
  formula?: string;
  message?: string;
  suggestion?: string;
  /** count for NOTE ("N rows not verified") and the collapsed anchor STALE line */
  suppressedCount?: number;
  anchorGroup?: boolean;
  cyclePath?: string[];
  sourceOffset?: number;
  /** absolute source span of the text this finding is about. Absent only on
   *  NOTE and on the collapsed anchor-group STALE, which have no single site. */
  span?: Span;
  /** a second, related site — the first binding of a DUP pair. */
  relatedSpan?: Span;
  /** the offending literal (e.g. a non-ISO date) */
  raw?: string;
  isoFix?: string;
  altA?: string;
  altB?: string;
  daysApart?: number;
}

export const DOC_SCOPE = "";

export interface Binding {
  /** `"sheet.name"`, or just `"name"` for a document-scope binding */
  id: string;
  sheetId: string;
  name: string;
  expr: Expr;
  kind: "column" | "scalar";
  /** absolute source span of the binding line */
  span: { start: number; end: number };
  parseError?: LangError;
}

export interface Sheet {
  id: string;
  table: RawTable | null;
  /** column rules, in block-declaration order */
  columns: Map<string, Binding>;
  /** scalars, in block-declaration order */
  scalars: Map<string, Binding>;
  /** header index for each column name (rule or input) */
  columnIndex: Map<string, number>;
  /** header names with no rule — human-owned inputs */
  inputColumns: Set<string>;
}

export interface DocModel {
  sheets: Map<string, Sheet>;
  docScope: Map<string, Binding>;
  anchors: RawAnchor[];
  findings: Finding[];
  source: string;
  located: LocatedDoc;
  blockOfSheet: Map<string, RawBlock>;
}
