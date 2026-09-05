import { MarkupKind, type Hover, type Position } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { dependencies, refText, type Binding } from "visimark";
import type { Analysis } from "./analysis.js";

export function hoverAt(doc: TextDocument, analysis: Analysis, position: Position): Hover | null {
  if (!analysis.applicable) return null;
  const { model, result } = analysis;
  const off = doc.offsetAt(position);

  const md = (value: string): Hover => ({
    contents: { kind: MarkupKind.Markdown, value },
  });

  const formula = (b: Binding): string =>
    `${b.name} = ${model.source.slice(b.expr.start, b.expr.end)}`;

  const deps = (b: Binding): string => {
    const info = dependencies(model, b);
    const names = [...new Set(info.refs.map((r) => refText(r.ref)))];
    return names.length > 0 ? `\n\ndepends on: ${names.join(", ")}` : "";
  };

  const allBindings: Binding[] = [
    ...model.docScope.values(),
    ...[...model.sheets.values()].flatMap((s) => [...s.columns.values(), ...s.scalars.values()]),
  ];

  // 1. inside a vmark block, on a binding line
  for (const b of allBindings) {
    if (off < b.span.start || off > b.span.end) continue;
    const v = result.values.get(b.id);
    const shown = v
      ? `\n\n= \`${v.t === "num" ? v.d.toString() : v.t === "date" ? v.iso : String(v.t === "bool" ? v.b : v.s)}\``
      : "";
    return md("```vmark\n" + formula(b) + "\n```" + shown + deps(b));
  }

  // 2. a table cell in a computed column
  for (const sheet of model.sheets.values()) {
    const table = sheet.table;
    if (!table) continue;
    for (const [name, binding] of sheet.columns) {
      const idx = sheet.columnIndex.get(name)!;
      for (let r = 0; r < table.rows.length; r++) {
        const cell = table.rows[r]!.cells[idx];
        if (!cell || off < cell.start || off > cell.end) continue;
        const stale = result.findings.find(
          (f) => f.code === "STALE" && f.span?.start === cell.start && f.span?.end === cell.end,
        );
        const body =
          "```vmark\n" +
          formula(binding) +
          "\n```" +
          (stale ? `\n\ncomputed \`${stale.computed}\` — the cell says \`${stale.stored}\`` : "");
        return md(body + deps(binding));
      }
    }
  }

  // 3. an anchored value in prose
  for (const a of model.anchors) {
    if (!a.value) continue;
    if (off < a.value.start || off > a.value.end) continue;
    const id = `${a.sheetId}.${a.name}`;
    const b = allBindings.find((x) => x.id === id);
    if (!b) continue;
    return md("```vmark\n" + formula(b) + "\n```" + deps(b));
  }

  return null;
}
