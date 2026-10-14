import type { EditorView } from "@codemirror/view";
import {
  build,
  check,
  evalValues,
  formatCheck,
  isProblem,
  locate,
  type CheckResult,
  type DocModel,
  type Finding,
} from "visimark";
import { hasVmarkBlock } from "codemirror-visimark/gate.js";
import type { Text } from "@codemirror/state";
import { nameAt } from "visimark-editor-shared/at-cursor.js";
import { explainBinding } from "visimark-editor-shared/explain.js";
import { describePreview, isEmpty, previewInfer } from "visimark-editor-shared/infer-plan.js";
import { planRepairs } from "visimark-editor-shared/repairs.js";
import { safeTemplateInsertion } from "visimark-editor-shared/template-insert.js";
import { TEMPLATES } from "visimark-editor-shared/templates.js";
import { valueRows } from "visimark-editor-shared/values.js";
import { importScope } from "./imports.js";
import type {
  ApplyArgs,
  ApplyReply,
  CheckArgs,
  CheckReply,
  EvaluateReply,
  ExplainReply,
  FormatArgs,
  FormatReply,
  InferPreviewReply,
  InsertTemplateArgs,
  InsertTemplateReply,
} from "./protocol.js";

/**
 * The editor commands the CodeMirror content script registers (#384 spec
 * §2.3). All the engine work for Check, Format, Evaluate and Explain happens
 * here, over the live document: the engine is already in this bundle, and the
 * main script only routes and shows. Each reads the document once, and Format
 * writes it back as one transaction, so one undo reverts it.
 *
 * There is no reader — a Joplin note has no path — so whatever depends on an
 * import is dropped (`imports.ts`), and each reply says whether that happened.
 */

interface Analysis {
  readonly model: DocModel;
  readonly result: CheckResult;
}

export interface EditorCommandsOptions {
  /** the engine pass; a test replaces it to make it throw */
  readonly analyse?: (source: string) => Analysis;
}

function analyse(source: string): Analysis {
  const model = build(locate(source));
  return { model, result: check(model) };
}

/**
 * How many problems, counted as the CLI's footer counts them: the collapsed
 * anchor group stands for every anchor in it. So the number agrees with the
 * text it travels with.
 */
function problemCount(findings: readonly Finding[]): number {
  let n = 0;
  for (const f of findings) {
    if (!isProblem(f)) continue;
    n += f.code === "STALE" && f.anchorGroup ? (f.suppressedCount ?? 0) : 1;
  }
  return n;
}

export function editorCommands(view: EditorView, options: EditorCommandsOptions = {}) {
  const run = options.analyse ?? analyse;

  /**
   * The last Infer preview and the document it read. CodeMirror's `Text` is
   * immutable, so the document is unchanged exactly when it is the same
   * object — `apply` needs no edit counter to know its offsets still hold.
   */
  let previewed: { version: number; doc: Text } | null = null;
  let previews = 0;

  /** The gate and the analysis, or the reply that stops the command. */
  const note = (): ({ kind: "ok" } & Analysis) | { kind: "no-block" | "failed" } => {
    const source = view.state.doc.toString();
    if (!hasVmarkBlock(source)) return { kind: "no-block" };
    try {
      return { kind: "ok", ...run(source) };
    } catch {
      return { kind: "failed" };
    }
  };

  return {
    check({ title }: CheckArgs): CheckReply {
      const n = note();
      if (n.kind !== "ok") return { kind: n.kind };
      try {
        const imports = importScope(n.model, n.result.findings);
        const findings = [...imports.kept];
        return {
          kind: "checked",
          text: formatCheck(title, findings),
          problems: problemCount(findings),
          importsDropped: imports.dropped,
        };
      } catch {
        return { kind: "failed" };
      }
    },

    format({ fixDates }: FormatArgs): FormatReply {
      const n = note();
      if (n.kind !== "ok") return { kind: n.kind };
      let edits;
      let importsDropped;
      try {
        const imports = importScope(n.model, n.result.findings);
        edits = planRepairs(n.model, n.result, { fixDates }).all.filter((e) => !imports.edit(e));
        importsDropped = imports.dropped;
      } catch {
        return { kind: "failed" };
      }
      if (edits.length === 0) return { kind: "clean", importsDropped };
      // planned from the document as it is now: this runs synchronously
      // inside one editor command, so nothing can move in between
      try {
        view.dispatch({
          changes: edits.map((e) => ({ from: e.start, to: e.end, insert: e.text })),
          // not a joinable event, so history keeps Format as its own undo step
          // even right after typing beside the value it repairs
          userEvent: "input.format",
        });
      } catch {
        return { kind: "failed" };
      }
      return { kind: "applied", repairs: edits.length, importsDropped };
    },

    evaluate(): EvaluateReply {
      const n = note();
      if (n.kind !== "ok") return { kind: n.kind };
      try {
        const imports = importScope(n.model, n.result.findings);
        const values = Object.fromEntries(
          Object.entries(evalValues(n.result)).filter(([name]) => !imports.name(name)),
        );
        return { kind: "values", rows: valueRows(values), importsDropped: imports.dropped };
      } catch {
        return { kind: "failed" };
      }
    },

    explain(): ExplainReply {
      const n = note();
      if (n.kind !== "ok") return { kind: n.kind };
      try {
        const at = nameAt(n.model, n.result, view.state.selection.main.head);
        if (at === null) return { kind: "not-on-value" };
        if (importScope(n.model, n.result.findings).name(at.name)) {
          return { kind: "not-on-value", importsDropped: true };
        }
        const explanation = explainBinding(n.model, n.result, at.name);
        if (explanation === null) return { kind: "not-on-value" };
        return at.row === undefined
          ? { kind: "explained", explanation }
          : { kind: "explained", explanation, row: at.row };
      } catch {
        return { kind: "failed" };
      }
    },

    /** Infer, scoped to the selection when there is one. Not gated on a block. */
    inferPreview(): InferPreviewReply {
      try {
        const { from, to } = view.state.selection.main;
        const doc = view.state.doc;
        const preview = previewInfer(
          doc.toString(),
          from < to ? { start: from, end: to } : undefined,
        );
        previewed = { version: ++previews, doc };
        return {
          kind: "preview",
          version: previewed.version,
          description: describePreview(preview),
          empty: isEmpty(preview),
          removesMarker: preview.removesMarker,
          edits: preview.inserts.map((e) => ({ start: e.start, end: e.end, text: e.text })),
        };
      } catch {
        return { kind: "failed" };
      }
    },

    apply({ version, edits }: ApplyArgs): ApplyReply {
      if (previewed === null || previewed.version !== version || previewed.doc !== view.state.doc) {
        return { kind: "changed" };
      }
      previewed = null;
      try {
        view.dispatch({
          changes: edits.map((e) => ({ from: e.start, to: e.end, insert: e.text })),
          userEvent: "input.infer",
        });
      } catch {
        return { kind: "failed" };
      }
      return { kind: "applied" };
    },

    /** A starter template at the cursor, refused when the note has a block. */
    insertTemplate({ id }: InsertTemplateArgs): InsertTemplateReply {
      const template = TEMPLATES.find((t) => t.id === id);
      if (template === undefined) return { kind: "failed" };
      const source = view.state.doc.toString();
      // a second block would declare every name the template declares again
      if (hasVmarkBlock(source)) return { kind: "has-block" };
      const placed = safeTemplateInsertion(source, view.state.selection.main.head, template.body);
      if (placed === null) return { kind: "no-place" };
      try {
        view.dispatch({
          changes: { from: placed.at, insert: placed.text },
          userEvent: "input.template",
        });
      } catch {
        return { kind: "failed" };
      }
      return { kind: "inserted" };
    },
  };
}
