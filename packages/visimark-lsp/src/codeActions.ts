import { CodeActionKind, type CodeAction, type Range } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { planFmt } from "visimark";
import type { Analysis } from "./analysis.js";
import { rangeOf } from "./diagnostics.js";
import { formatEdits } from "./formatting.js";
import type { Settings } from "./settings.js";

export const FIX_ALL = `${CodeActionKind.SourceFixAll}.visimark`;

export function codeActionsFor(
  doc: TextDocument,
  analysis: Analysis,
  range: Range,
  only: string[] | undefined,
  settings: Settings,
): CodeAction[] {
  if (!analysis.applicable) return [];
  const wants = (kind: string): boolean =>
    !only || only.some((k) => kind === k || kind.startsWith(`${k}.`));

  const out: CodeAction[] = [];
  const lo = doc.offsetAt(range.start);
  const hi = doc.offsetAt(range.end);
  const opts = { fixDates: true }; // a per-finding date fix is always offered

  if (wants(FIX_ALL)) {
    const edits = formatEdits(doc, analysis, {
      fixDates: settings.format.fixDates,
    });
    if (edits.length > 0) {
      out.push({
        title: "VisiMark: fix all stale values",
        kind: FIX_ALL,
        edit: { changes: { [doc.uri]: edits } },
      });
    }
  }

  if (!wants(CodeActionKind.QuickFix)) return out;

  // One quick fix per planned edit that overlaps the requested range.
  for (const e of planFmt(analysis.model, analysis.result, opts)) {
    if (e.end <= lo || e.start >= hi) continue;
    const f = e.finding;
    const title =
      f.code === "DATE" ? `VisiMark: rewrite to ${e.text}` : `VisiMark: update to ${e.text}`;
    out.push({
      title,
      kind: CodeActionKind.QuickFix,
      isPreferred: f.code === "STALE",
      edit: {
        changes: {
          [doc.uri]: [
            {
              range: rangeOf(doc, { start: e.start, end: e.end }),
              newText: e.text,
            },
          ],
        },
      },
    });
  }

  // Findings with no planned edit but an obvious textual repair.
  for (const f of analysis.result.findings) {
    if (!f.span || f.span.end <= lo || f.span.start >= hi) continue;
    if (f.code === "UNDEF" && f.suggestion) {
      out.push({
        title: `VisiMark: change to ${f.suggestion}`,
        kind: CodeActionKind.QuickFix,
        edit: {
          changes: {
            [doc.uri]: [{ range: rangeOf(doc, f.span), newText: f.suggestion }],
          },
        },
      });
    }
    if (f.code === "VECTOR" && f.raw) {
      out.push({
        title: `VisiMark: wrap in SUM(${f.raw})`,
        kind: CodeActionKind.QuickFix,
        edit: {
          changes: {
            [doc.uri]: [{ range: rangeOf(doc, f.span), newText: `SUM(${f.raw})` }],
          },
        },
      });
    }
  }

  return out;
}
