import type { ChartResult, CheckResult } from "../eval/check.js";
import { topoOrder } from "../eval/graph.js";
import type { Binding, DocModel, ImportStatus } from "../model/types.js";
import { readVersion } from "../cli/version.js";
import { nonParams, paramLines, params } from "./params.js";

/**
 * The model slice both renderings read. Deriving it once matters: the text and
 * `--json` forms present the same facts and must agree, and the only way to
 * guarantee that is to have them read the same object rather than each recompute
 * the topological order and the per-sheet state maps.
 */
export interface ExplainView {
  readonly model: DocModel;
  readonly order: readonly Binding[];
  readonly assertionIds: ReadonlySet<string>;
  readonly chartIds: ReadonlySet<string>;
  /** chart outcome keyed `sheet.name`, as `ChartResult` carries the pair split */
  readonly chartState: ReadonlyMap<string, ChartResult>;
  readonly importState: ReadonlyMap<string, ImportStatus>;
  /** the requested scope, in request order; the caller has already validated it */
  readonly sheets: readonly string[];
  /** write precision per column id and per binding id, as `check` settled it */
  readonly columnPrecision: ReadonlyMap<string, number>;
  readonly scalarPrecision: ReadonlyMap<string, number>;
}

/** the same two facts `precisionOf` renders, for `--json` */
function precisionJson(
  view: ExplainView,
  b: Binding,
  colId: string,
): { precision?: number; precisionFrom?: "declared" | "derived" } {
  const p = b.kind === "column" ? view.columnPrecision.get(colId) : view.scalarPrecision.get(b.id);
  if (p === undefined) return {};
  return { precision: p, precisionFrom: b.precision === undefined ? "derived" : "declared" };
}

export function explainView(model: DocModel, result: CheckResult, sheets: string[]): ExplainView {
  const { order, assertionIds, chartIds } = topoOrder(model);
  return {
    model,
    order,
    assertionIds,
    chartIds,
    chartState: new Map(result.charts.map((c) => [`${c.sheetId}.${c.name}`, c])),
    importState: result.imports,
    sheets: sheets.length > 0 ? sheets : [...model.sheets.keys()],
    columnPrecision: result.columnPrecision,
    scalarPrecision: result.scalarPrecision,
  };
}

function slice(model: DocModel, b: { expr: { start: number; end: number } }): string {
  return model.source.slice(b.expr.start, b.expr.end);
}

/**
 * How wide this binding writes, and where that came from. The result only — a
 * derivation chain is deliberately not shown (declared-precision-spec.md §9).
 */
function precisionOf(view: ExplainView, b: Binding, colId: string): string | undefined {
  const p = b.kind === "column" ? view.columnPrecision.get(colId) : view.scalarPrecision.get(b.id);
  if (p === undefined) return undefined;
  return `precision ${p} (${b.precision === undefined ? "derived" : "declared"})`;
}

/** `name = expr` lines with their precision aligned into one column */
function bindingLines(view: ExplainView, sheetId: string, bs: Binding[]): string[] {
  const rows = bs.map((b) => ({
    text: `${b.name} = ${slice(view.model, b)}`,
    prec: precisionOf(view, b, `${sheetId}.${b.name}`),
  }));
  const w = Math.max(0, ...rows.filter((r) => r.prec).map((r) => r.text.length));
  return rows.map((r) => `    ${r.prec ? `${r.text.padEnd(w)}   ${r.prec}` : r.text}`);
}

/** the JSON form of one `param` */
function paramJson(b: Binding): { name: string; precision: number | null; default: string } {
  return { name: b.name, precision: b.precision ?? null, default: b.param!.text };
}

/** the bindings of one sheet in evaluation order, with assertions and charts dropped */
function localOrder(view: ExplainView, sid: string): string[] {
  return view.order
    .filter((b) => b.sheetId === sid && !view.assertionIds.has(b.id) && !view.chartIds.has(b.id))
    .map((b) => b.name);
}

export function explainText(view: ExplainView): string {
  const { model } = view;
  const lines: string[] = [];

  if (model.docScope.size > 0) {
    lines.push("document scope");
    for (const b of nonParams(model.docScope.values())) {
      lines.push(`  ${b.name} = ${slice(model, b)}`);
    }
    const docParams = params(model.docScope.values());
    if (docParams.length > 0) {
      lines.push("  params:");
      lines.push(...paramLines(docParams, "    "));
    }
    lines.push("");
  }

  for (const sid of view.sheets) {
    const sheet = model.sheets.get(sid)!;
    lines.push(`#${sid}${sheet.table ? "" : "  (no table)"}`);
    if (sheet.imported) {
      const st = view.importState.get(sid);
      const delim =
        sheet.imported.delimiter !== "," ? ` delimited ${sheet.imported.delimiter}` : "";
      const labelKeyword = sheet.imported.labelsMode ?? "labelled";
      const labels = sheet.imported.labels
        ? ` ${labelKeyword} ${sheet.imported.labels.join(", ")}`
        : "";
      lines.push(`  import:  ${sheet.imported.path}${delim}${labels}  [${st?.state ?? "unknown"}]`);
    }
    if (sheet.inputColumns.size > 0) {
      lines.push(`  inputs:  ${[...sheet.inputColumns].join(", ")}`);
    }
    if (sheet.aliases.size > 0) {
      lines.push("  aliases:");
      for (const [symbol, entry] of sheet.aliases) lines.push(`    ${symbol} → "${entry.header}"`);
    }
    if (sheet.columns.size > 0) {
      lines.push("  rules:");
      lines.push(...bindingLines(view, sid, [...sheet.columns.values()]));
    }
    const scalars = nonParams(sheet.scalars.values());
    if (scalars.length > 0) {
      lines.push("  scalars:");
      lines.push(...bindingLines(view, sid, scalars));
    }
    const sheetParams = params(sheet.scalars.values());
    if (sheetParams.length > 0) {
      lines.push("  params:");
      lines.push(...paramLines(sheetParams, "    "));
    }
    const order = localOrder(view, sid);
    if (order.length > 0) lines.push(`  order:   ${order.join(" → ")}`);
    if (sheet.assertions.length > 0) {
      lines.push("  assertions:");
      for (const a of sheet.assertions) lines.push(`    ${a.source.replace(/^assert\s+/, "")}`);
    }
    if (sheet.charts.length > 0) {
      lines.push("  charts:");
      for (const c of sheet.charts) {
        const r = view.chartState.get(`${c.sheetId}.${c.name}`);
        const where = r?.path ? ` → ${r.path}` : "";
        const state = r ? `  [${r.state}]` : "";
        lines.push(
          `    ${c.name} = ${c.engine} of ${c.series.join(", ")} labelled ${c.labels}${where}${state}`,
        );
      }
    }
    lines.push("");
  }

  // Each sheet block is closed by its own blank, so the joined string ends in a
  // newline and the caller's single `out()` supplies the second — byte-identical
  // to the per-line writes this replaced.
  return lines.join("\n");
}

/**
 * Key order here is the wire format — `JSON.stringify` emits insertion order, so
 * the conditional `import` spread has to stay between `hasTable` and `inputs`.
 * This owns its whole envelope, matching `errorEnvelope` in json.ts.
 */
export function explainJson(view: ExplainView, file: string): object {
  const { model } = view;
  return {
    command: "explain",
    visimark: readVersion(),
    status: "ok",
    file,
    documentScope: nonParams(model.docScope.values()).map((b) => ({
      name: b.name,
      rule: slice(model, b),
    })),
    ...(params(model.docScope.values()).length > 0
      ? { documentScopeParams: params(model.docScope.values()).map(paramJson) }
      : {}),
    sheets: view.sheets.map((sid) => {
      const sheet = model.sheets.get(sid)!;
      const importSt = view.importState.get(sid);
      return {
        id: sid,
        hasTable: Boolean(sheet.table),
        ...(sheet.imported
          ? {
              import: {
                path: sheet.imported.path,
                delimiter: sheet.imported.delimiter,
                labels: sheet.imported.labels,
                mode: sheet.imported.labelsMode,
                stamp: sheet.imported.stampDigest ? `sha256:${sheet.imported.stampDigest}` : null,
                stampStatus: importSt?.state ?? null,
              },
            }
          : {}),
        inputs: [...sheet.inputColumns],
        aliases: [...sheet.aliases].map(([symbol, entry]) => ({ symbol, header: entry.header })),
        rules: [...sheet.columns.values()].map((b) => ({
          name: b.name,
          rule: slice(model, b),
          ...precisionJson(view, b, `${sid}.${b.name}`),
        })),
        scalars: nonParams(sheet.scalars.values()).map((b) => ({
          name: b.name,
          rule: slice(model, b),
          ...precisionJson(view, b, `${sid}.${b.name}`),
        })),
        ...(params(sheet.scalars.values()).length > 0
          ? { params: params(sheet.scalars.values()).map(paramJson) }
          : {}),
        order: localOrder(view, sid),
        assertions: sheet.assertions.map((a) => a.source.replace(/^assert\s+/, "")),
        charts: sheet.charts.map((c) => {
          const r = view.chartState.get(`${c.sheetId}.${c.name}`);
          return {
            name: c.name,
            engine: c.engine,
            series: c.series,
            labels: c.labels,
            path: r?.path ?? null,
            state: r?.state ?? null,
          };
        }),
      };
    }),
  };
}
