import type * as VM from "visimark";
import type { Posture } from "./posture.js";
import type { Skipped } from "./policy.js";
import type { Table } from "./tables.js";

/**
 * The engine, injected. The CLI passes the engine's browser-safe entry point
 * and the widget passes `window.VisiMark`; both satisfy this, and the core
 * never imports a value from `visimark` (test/purity.test.ts).
 */
export type Engine = Pick<
  typeof VM,
  "locate" | "build" | "check" | "infer" | "isProblem" | "memoryReader" | "describeFinding"
>;

export type ReaderPort = VM.ReaderPort;

/** A text edit against the file at the scanned commit; `old` is what it replaces. */
export interface Edit {
  from: number;
  to: number;
  old: string;
  new: string;
}

export interface Finding {
  /** the cell, by content (spec §3.5) */
  id: string;
  path: string;
  /** 1-based: the table's header line (or the finding's own line) to the finding's line */
  lines: [number, number];
  permalink: string | null;
  confidence: "confirmed" | "lead";
  /** every rule that found it, in registry order */
  rules: string[];
  stored: string;
  computed: string;
  message: string;
  evidence: string[];
  /** omitted when no rule proposes one; never [] */
  fix?: Edit[];
}

export interface Report {
  version: 1;
  engine: string;
  repo: { label: string; host: string | null; commit: string };
  clonePath: string | null;
  files: { markdown: number; read: number; skipped: Skipped[] };
  accuracy: {
    verdict: "confirmed" | "leads" | "clean" | "nothing-checkable";
    confirmed: number;
    leads: number;
    tablesRead: number;
    tablesChecked: number;
    unreadable: number;
  };
  adoption: {
    withoutRules: number;
    withArithmetic: number;
    inferable: number;
    inferableAfterFix: number;
  };
  posture: Posture;
  findings: Finding[];
  ruleErrors: { path: string; rule: string; message: string }[];
}

/** Where a finding sits, before it has an id. */
export type CellRef =
  | { kind: "table"; table: number; column: string; row: string }
  | { kind: "named"; sheetId: string; name: string }
  | { kind: "other"; code: string; name: string | null };

export interface RawFinding extends Omit<Finding, "id" | "permalink" | "rules"> {
  rule: string;
  cell: CellRef;
}

export interface DocInput {
  path: string;
  text: string;
  masked: string;
  tables: Table[];
}

export interface RuleContext {
  engine: Engine;
  texts: Map<string, string>;
  reader: ReaderPort;
}

export interface RuleResult {
  findings: RawFinding[];
  /** table keys (`<path>#t<N>`) the rule verified a relation in */
  checked: string[];
  /** total-row columns that could not be summed */
  unreadable: number;
  /** tables `infer` proposes a rule for (engine-infer only) */
  proposals: { table: number }[];
  /** COVERAGE findings (engine-check only) */
  coverage: number;
  /** table keys a `vmark` sheet already rules (engine-check only) */
  ruled: string[];
}

export interface Rule {
  id: string;
  label: string;
  scope: "file" | "repo";
  run(doc: DocInput, ctx: RuleContext): RuleResult;
}

export const emptyResult = (): RuleResult => ({
  findings: [],
  checked: [],
  unreadable: 0,
  proposals: [],
  coverage: 0,
  ruled: [],
});

export const tableKey = (path: string, index: number): string => `${path}#t${index}`;
