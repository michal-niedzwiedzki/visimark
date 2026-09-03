import {
  InlayHintKind,
  type InlayHint,
  type Range,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Analysis } from "./analysis.js";

/**
 * The non-destructive twin of format-on-save: show the computed value beside
 * a value the document disagrees with, and change nothing. A correct value
 * gets no hint — the right number is already in the text — so a hint is pure
 * disagreement signal.
 */
export function inlayHintsFor(
  doc: TextDocument,
  analysis: Analysis,
  range: Range,
): InlayHint[] {
  if (!analysis.applicable) return [];
  const lo = doc.offsetAt(range.start);
  const hi = doc.offsetAt(range.end);

  const out: InlayHint[] = [];
  for (const f of analysis.result.findings) {
    if (f.code !== "STALE" || f.anchorGroup) continue;
    if (!f.span || f.computed === undefined) continue;
    if (f.span.end <= lo || f.span.start >= hi) continue;
    out.push({
      position: doc.positionAt(f.span.end),
      label: `‹${f.computed}›`,
      kind: InlayHintKind.Type,
      paddingLeft: true,
    });
  }
  return out;
}
