import type { Explanation } from "visimark-editor-shared/explain.js";
import type { ValueRow } from "visimark-editor-shared/values.js";

/**
 * What the CodeMirror content script's editor commands take and return
 * (#384 spec §2.3). Plain JSON both ways: the main script reaches them through
 * `editor.execCommand`, across Joplin's process boundary. Types only, so the
 * main script's bundle gains no engine by importing them.
 */

export const EDITOR_COMMANDS = {
  check: "visimark.cm.check",
  format: "visimark.cm.format",
  evaluate: "visimark.cm.evaluate",
  explain: "visimark.cm.explain",
  inferPreview: "visimark.cm.inferPreview",
  apply: "visimark.cm.apply",
  insertTemplate: "visimark.cm.insertTemplate",
  setMarks: "visimark.cm.setMarks",
  reveal: "visimark.cm.reveal",
} as const;

export interface CheckArgs {
  /** the note's title, which `formatCheck` prints where the CLI prints a path */
  readonly title: string;
}

export interface FormatArgs {
  readonly fixDates: boolean;
}

export type NoBlock = { readonly kind: "no-block" };
export type Failed = { readonly kind: "failed" };

export type CheckReply =
  | NoBlock
  | Failed
  | {
      readonly kind: "checked";
      readonly text: string;
      readonly problems: number;
      readonly importsDropped: boolean;
    };

export type FormatReply =
  | NoBlock
  | Failed
  | { readonly kind: "clean"; readonly importsDropped: boolean }
  | { readonly kind: "applied"; readonly repairs: number; readonly importsDropped: boolean };

export type EvaluateReply =
  | NoBlock
  | Failed
  | { readonly kind: "values"; readonly rows: ValueRow[]; readonly importsDropped: boolean };

export type ExplainReply =
  | NoBlock
  | Failed
  | { readonly kind: "not-on-value"; readonly importsDropped?: boolean }
  | { readonly kind: "explained"; readonly explanation: Explanation; readonly row?: number };

/** a plain text edit over the document the preview read */
export interface PlainEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export type InferPreviewReply =
  | Failed
  | {
      readonly kind: "preview";
      /** names this preview; `apply` refuses once the document has moved */
      readonly version: number;
      readonly description: string;
      readonly empty: boolean;
      /** Apply deletes a `<!--vmark:no-formulas-->` comment the table has outgrown */
      readonly removesMarker: boolean;
      readonly edits: PlainEdit[];
    };

export interface ApplyArgs {
  readonly version: number;
  readonly edits: readonly PlainEdit[];
}

export type ApplyReply = Failed | { readonly kind: "applied" } | { readonly kind: "changed" };

export interface InsertTemplateArgs {
  readonly id: string;
}

export type InsertTemplateReply =
  | Failed
  | { readonly kind: "has-block" }
  | { readonly kind: "no-place" }
  | { readonly kind: "inserted" };

export interface RevealArgs {
  readonly start: number;
  readonly end: number;
}
