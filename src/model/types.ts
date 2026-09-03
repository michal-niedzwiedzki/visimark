import type { Expr } from "../lang/ast.js";
import type { LangError } from "../lang/token.js";
import type {
  LocatedDoc,
  RawAnchor,
  RawBlock,
  RawTable,
} from "../parse/document.js";

export type FindingCode =
  | "STALE"
  | "DATE"
  | "UNDEF"
  | "VECTOR"
  | "CYCLE"
  | "TYPE"
  | "SHEET"
  | "ANCHOR"
  | "WARN"
  | "NOTE";

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
