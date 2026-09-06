import type { Range, TextEdit } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { planFmt, type FmtOptions } from "visimark";
import type { Analysis } from "./analysis.js";
import { rangeOf } from "./diagnostics.js";

/**
 * The only write path. Returns minimal per-cell edits so the cursor, folds
 * and undo granularity survive; never a whole-document replacement.
 */
export function formatEdits(
  doc: TextDocument,
  analysis: Analysis,
  opts: FmtOptions,
  within?: Range,
): TextEdit[] {
  if (!analysis.applicable) return [];
  const planned = planFmt(analysis.model, analysis.result, opts);
  const lo = within ? doc.offsetAt(within.start) : 0;
  const hi = within ? doc.offsetAt(within.end) : Number.MAX_SAFE_INTEGER;

  return planned
    .filter((e) => e.end > lo && e.start < hi)
    .map((e) => ({
      range: rangeOf(doc, { start: e.start, end: e.end }),
      newText: e.text,
    }));
}
