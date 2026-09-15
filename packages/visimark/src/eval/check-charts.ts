import { Decimal } from "decimal.js";
import type { Ref } from "../lang/ast.js";
import type { Binding, Chart, DocModel } from "../model/types.js";
import { buildArtifact, hasEngine, type Series, suggestEngine } from "../artifact/index.js";
import { resolveArtifactPath } from "../artifact/path.js";
import { classify } from "../artifact/stale.js";
import type { ChartResult, CheckState } from "./check-state.js";
import { lookupVector } from "./check-lookup.js";
import { canonicalName, chartNode } from "./graph.js";
import type { Value } from "./value.js";
import { decimalPlaces } from "./units.js";

/**
 * What the chart pass can reach. A chart's operands are already resolved and
 * shape-checked by the binding loop, so this pass reads values and writes
 * nothing back into evaluation — `dateErrorRows` and `emit` are here only
 * because reading an input column through `lookupVector` can still surface the
 * first bad date in it.
 */
type ChartState = Pick<
  CheckState,
  | "model"
  | "opts"
  | "cells"
  | "columnUnits"
  | "columnPrecision"
  | "dateErrorRows"
  | "buildableCharts"
  | "emit"
>;

/**
 * Validates every `chart` declaration and compares it against the file on
 * disk: data validation the engine cannot see, the path gate, and a byte
 * comparison. Returns one `ChartResult` per declaration, in document order.
 *
 * It emits findings, so it must keep its position in the phase sequence —
 * `orderFindings` sorts on emit order.
 */
export function checkCharts(st: ChartState): ChartResult[] {
  const charts: ChartResult[] = [];
  const claimedPaths = new Map<string, string>();

  for (const sheet of st.model.sheets.values()) {
    let skipped = 0;
    for (const c of sheet.charts) {
      const label = `${c.sheetId}.${c.name}`;
      const artifactFinding = (message: string, suggestion?: string) =>
        st.emit(
          {
            code: "ARTIFACT",
            sheetId: c.sheetId,
            name: c.name,
            message,
            ...(suggestion ? { suggestion } : {}),
            sourceOffset: c.span.start,
            span: c.span,
          },
          { sheetId: c.sheetId },
        );

      if (!st.buildableCharts.has(c.id)) {
        // an upstream error stopped its series being computed; one note per
        // sheet, never one per chart
        skipped++;
        charts.push({ ...base(c), path: null, state: "skipped" });
        continue;
      }

      if (!hasEngine(c.engine)) {
        artifactFinding(
          "unknown chart type `" + c.engine + "`",
          suggestEngine(c.engine) ?? undefined,
        );
        charts.push({ ...base(c), path: null, state: "error" });
        continue;
      }

      // series
      const node = chartNode(c);
      const built: Series[] = [];
      let failure: string | null = null;
      for (const name of c.series) {
        const vals = readColumn(st, node, name);
        if (typeof vals === "string") {
          failure = vals;
          break;
        }
        if (vals.length === 0) {
          failure = "`" + name + "` has no rows";
          break;
        }
        if (vals.some((v) => v.t !== "num")) {
          failure = "`" + name + "` needs numbers";
          break;
        }
        // the unit and precision maps are keyed by canonical header text, so a
        // series named through an alias must be translated before either lookup
        const written = name.includes(".") ? name.slice(name.indexOf(".") + 1) : name;
        const plain = canonicalName(sheet, written);
        const colId = `${c.sheetId}.${plain}`;
        built.push({
          name,
          values: vals.map((v) => (v as { t: "num"; d: Decimal }).d),
          unit: st.columnUnits.get(colId) ?? null,
          precision: st.columnPrecision.get(colId) ?? inputPrecision(st.model, c.sheetId, plain),
        });
      }
      if (failure) {
        artifactFinding(failure);
        charts.push({ ...base(c), path: null, state: "error" });
        continue;
      }

      // a chart whose series disagree about their decoration is the §7 unit
      // rule one level up
      const units = built.map((b) => (b.unit ? `${b.unit.side}:${b.unit.text}` : ""));
      if (new Set(units).size > 1) {
        st.emit(
          {
            code: "UNIT",
            sheetId: c.sheetId,
            name: c.name,
            message: "a chart's series must agree about their unit",
            sourceOffset: c.span.start,
            span: c.span,
          },
          { sheetId: c.sheetId },
        );
        charts.push({ ...base(c), path: null, state: "error" });
        continue;
      }

      // Labels are the cell text as the document writes it, never a coerced
      // value: `Under 25` is a label, not the number 25 wearing a `Under`
      // decoration, and a reader must find every rendered string on the page.
      const labelVals = readLabels(st.model, c.sheetId, c.labels);
      if (typeof labelVals === "string") {
        artifactFinding(labelVals);
        charts.push({ ...base(c), path: null, state: "error" });
        continue;
      }
      const labels = labelVals;

      // the document states the path, in an image line carrying the anchor
      const anchor = st.model.anchors.find(
        (a) => a.sheetId === c.sheetId && a.name === c.name && a.imageUrl !== undefined,
      );
      if (!anchor?.imageUrl) {
        artifactFinding(
          "no image reference for this chart — add `![...](path)<!--vmark=" + label + "-->`",
        );
        charts.push({ ...base(c), path: null, state: "error" });
        continue;
      }
      const url = anchor.imageUrl;

      const claimant = claimedPaths.get(url);
      if (claimant && claimant !== label) {
        artifactFinding("two charts write to `" + url + "`");
        charts.push({ ...base(c), path: url, state: "error" });
        continue;
      }
      claimedPaths.set(url, label);

      const rendered = buildArtifact(
        c.engine,
        { series: built, labels, aspect: c.aspect ?? { w: 16, h: 10 } },
        { sheetId: c.sheetId, chart: c.name },
      );
      if ("err" in rendered) {
        artifactFinding(rendered.err);
        charts.push({ ...base(c), path: url, state: "error" });
        continue;
      }

      const doc = st.opts.doc;
      if (doc === undefined) {
        // no reader, so no file to compare against — the chart is valid,
        // staleness unknown. The condition is the absence of the port itself
        // rather than of a path string, so there is no filesystem reachable
        // from here even in a build that has none; see `fs/reader.ts`.
        charts.push({ ...base(c), path: url, state: "skipped", svg: rendered.svg });
        continue;
      }
      const gated = resolveArtifactPath(doc, url);
      if ("err" in gated) {
        artifactFinding(gated.err);
        charts.push({ ...base(c), path: url, state: "error" });
        continue;
      }

      const disk = classify(doc.reader, gated.ok, rendered.svg, c.sheetId, c.name);
      if (disk.state === "unowned") {
        artifactFinding("`" + url + "` exists and was not generated by visimark");
        charts.push({ ...base(c), path: url, state: "error", target: gated.ok });
        continue;
      }
      if (disk.state === "foreign") {
        artifactFinding("`" + url + "` belongs to chart `" + disk.sheet + "." + disk.chart + "`");
        charts.push({ ...base(c), path: url, state: "error", target: gated.ok });
        continue;
      }
      if (disk.state !== "current") {
        st.emit(
          {
            code: "STALE",
            sheetId: c.sheetId,
            name: c.name,
            artifact: url,
            message:
              disk.state === "missing"
                ? "artifact missing at `" + url + "`"
                : "artifact is out of date — run `visimark fmt`",
            sourceOffset: c.span.start,
            span: c.span,
          },
          { sheetId: c.sheetId },
        );
      }
      charts.push({
        ...base(c),
        path: url,
        state: disk.state === "current" ? "current" : disk.state,
        target: gated.ok,
        svg: rendered.svg,
      });
    }
    if (skipped > 0) {
      st.emit(
        {
          code: "NOTE",
          sheetId: sheet.id,
          message: `${skipped} chart${skipped === 1 ? "" : "s"} not built (upstream errors)`,
        },
        { sheetId: sheet.id },
      );
    }
  }
  return charts;
}

function base(c: Chart) {
  return {
    sheetId: c.sheetId,
    name: c.name,
    engine: c.engine,
    series: c.series,
    labels: c.labels,
  };
}

/** a column's values, or a message saying why it cannot be read */
function readColumn(st: ChartState, node: Binding, name: string): Value[] | string {
  const dot = name.indexOf(".");
  const ref: Ref =
    dot === -1
      ? { type: "ref", name, start: node.span.start, end: node.span.end }
      : {
          type: "ref",
          qualifier: name.slice(0, dot),
          name: name.slice(dot + 1),
          start: node.span.start,
          end: node.span.end,
        };
  try {
    return lookupVector(st, node, ref);
  } catch {
    return "`" + name + "` contains a blank cell";
  }
}

/** a label column's cells, verbatim */
function readLabels(model: DocModel, sheetId: string, name: string): string[] | string {
  const sheet = model.sheets.get(sheetId);
  // `columnIndex` is keyed by header text; `labelled` may name an alias
  const idx = sheet?.columnIndex.get(canonicalName(sheet, name));
  if (!sheet?.table || idx === undefined) {
    return "`" + name + "` is not a column of this sheet";
  }
  return sheet.table.rows.map((r) => (r.cells[idx]?.text ?? "").trim());
}

/** an input column carries no computed precision, so read it off its cells */
function inputPrecision(model: DocModel, sheetId: string, name: string): number {
  const sheet = model.sheets.get(sheetId);
  const idx = sheet?.columnIndex.get(name);
  if (sheet?.table && idx !== undefined) {
    for (const row of sheet.table.rows) {
      const t = (row.cells[idx]?.text ?? "").trim();
      if (t) return decimalPlaces(t, 2);
    }
  }
  return 2;
}
