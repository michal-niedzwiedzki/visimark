import { MarkupKind, type Hover, type Position } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { dependencies, describeFunction, refText, type Binding, type Expr } from "visimark";
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

  // 1. a function name, hovered inside a vmark block. `Call` spans cover the
  // whole call including its arguments, so hovering `Net` in `SUM(Net)` would
  // match `SUM` too; narrow to the name token, innermost call first.
  const called = innermostCallNameAt(allBindings, off);
  if (called) {
    const e = describeFunction(called);
    if (e) {
      const params = e.params.map((p) => `- \`${p.name}\` (${p.type}) — ${p.note}`).join("\n");
      const errors = e.errors.map((x) => `- ${x.when} → \`${x.code}\``).join("\n");
      const summary = `${e.summary[0]!.toUpperCase()}${e.summary.slice(1)}`;
      return md(
        "```vmark\n" +
          `${e.name}(${e.params.map((p) => p.name).join(", ")})\n` +
          "```\n\n" +
          `${summary}.\n\n${params}\n\nreturns: ${e.returns}` +
          (errors ? `\n\nerrors:\n${errors}` : ""),
      );
    }
  }

  // 2. inside a vmark block, on a binding line
  for (const b of allBindings) {
    if (off < b.span.start || off > b.span.end) continue;
    const v = result.values.get(b.id);
    const shown = v
      ? `\n\n= \`${v.t === "num" ? v.d.toString() : v.t === "date" ? v.iso : String(v.t === "bool" ? v.b : v.s)}\``
      : "";
    return md("```vmark\n" + formula(b) + "\n```" + shown + deps(b));
  }

  // 3. a table cell in a computed column
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

  // 4. an anchored value in prose
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

/** The name of the innermost call whose *name token* covers `off`, if any. */
function innermostCallNameAt(bindings: Binding[], off: number): string | null {
  const hits: { name: string; width: number }[] = [];
  const visit = (e: Expr): void => {
    if (e.type === "call") {
      if (off >= e.start && off < e.start + e.name.length) {
        hits.push({ name: e.name, width: e.end - e.start });
      }
      for (const a of e.args) visit(a);
    } else if (e.type === "binary") {
      visit(e.left);
      visit(e.right);
    } else if (e.type === "unary") {
      visit(e.operand);
    }
  };
  for (const b of bindings) visit(b.expr);
  if (hits.length === 0) return null;
  return hits.reduce((a, b) => (b.width < a.width ? b : a)).name;
}
