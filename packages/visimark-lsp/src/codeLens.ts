import type { CodeLens } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Analysis } from "./analysis.js";

const plural = (n: number, one: string): string =>
  `${n} ${one}${n === 1 ? "" : "s"}`;

export function codeLensesFor(
  doc: TextDocument,
  analysis: Analysis,
): CodeLens[] {
  if (!analysis.applicable) return [];
  const { model, result } = analysis;
  const out: CodeLens[] = [];

  for (const [sheetId, block] of model.blockOfSheet) {
    const sheet = model.sheets.get(sheetId);
    if (!sheet) continue;
    const formulas = sheet.columns.size + sheet.scalars.size;
    const stale = result.findings.filter(
      (f) => f.code === "STALE" && !f.anchorGroup && f.sheetId === sheetId,
    ).length;

    const start = doc.positionAt(block.span.start);
    const range = { start, end: start };
    const title =
      stale > 0
        ? `${plural(formulas, "formula")} · ${stale} stale`
        : `${plural(formulas, "formula")} · ok`;

    out.push({
      range,
      command: {
        title,
        command: "visimark.fixSheet",
        arguments: [doc.uri, sheetId],
      },
    });
    out.push({
      range,
      command: {
        title: "Explain",
        command: "visimark.explainSheet",
        arguments: [doc.uri, sheetId],
      },
    });
  }

  return out;
}
