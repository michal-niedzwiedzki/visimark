// Browser bundle entry for the web playground (docs/playground.html).
// Exposes VisiMark's pure parse/model/eval/write pipeline — no node:fs, no CLI
// argv/file plumbing. `pgEval` and `pgExplain` are the browser-safe
// equivalents of `cmdEval`/`cmdExplain` in ../cli/commands.ts, operating on an
// in-memory source string instead of a file path.
//
// playground.html loads the built bundle as a classic `<script>`, not a
// module: the playground is meant to be opened straight from disk
// (`file://`), and `file://` blocks ES module imports via CORS. `bun build
// --format iife` has no notion of a UMD-style global export, so this file
// assigns itself to `window.VisiMark` as its last statement (see bottom).
import { applyEdits } from "../write/splice.js";
import { check } from "../eval/check.js";
import { topoOrder } from "../eval/graph.js";
import type { Value } from "../eval/value.js";
import { infer } from "../infer/propose.js";
import { planInfer } from "../infer/write.js";
import { build } from "../model/build.js";
import type { DocModel } from "../model/types.js";
import { locate } from "../parse/document.js";
import { formatCheck } from "../report/format.js";
import { formatInfer } from "../report/infer.js";
import { fmt } from "../write/fmt.js";

function showValue(v: Value): string {
  if (v.t === "num") return v.d.toString();
  if (v.t === "date") return v.iso;
  if (v.t === "bool") return String(v.b);
  return v.s;
}

/** Mirrors `cmdEval FILE --json` — the JSON object `visimark eval --json` prints. */
function pgEval(source: string): unknown {
  const model = build(locate(source));
  const result = check(model);

  const all = new Map<string, string>();
  for (const [k, v] of result.values) all.set(k, showValue(v));
  for (const [k, col] of result.cells) {
    all.set(k, col.map((v) => (v ? showValue(v) : "?")).join(", "));
  }

  return {
    ...Object.fromEntries(all),
    assertions: result.assertions,
    charts: result.charts,
  };
}

function slice(model: DocModel, b: { expr: { start: number; end: number } }): string {
  return model.source.slice(b.expr.start, b.expr.end);
}

/** Mirrors `cmdExplain FILE` — the text `visimark explain` prints, as lines. */
function pgExplain(source: string): string[] {
  const out: string[] = [];
  const model = build(locate(source));
  const { order, assertionIds, chartIds } = topoOrder(model);

  if (model.docScope.size > 0) {
    out.push("document scope");
    for (const b of model.docScope.values()) out.push(`  ${b.name} = ${slice(model, b)}`);
    out.push("");
  }

  const chartState = new Map(check(model).charts.map((c) => [`${c.sheetId}.${c.name}`, c]));

  for (const sid of model.sheets.keys()) {
    const sheet = model.sheets.get(sid)!;
    out.push(`#${sid}${sheet.table ? "" : "  (no table)"}`);
    if (sheet.inputColumns.size > 0) {
      out.push(`  inputs:  ${[...sheet.inputColumns].join(", ")}`);
    }
    if (sheet.columns.size > 0) {
      out.push("  rules:");
      for (const b of sheet.columns.values()) out.push(`    ${b.name} = ${slice(model, b)}`);
    }
    if (sheet.scalars.size > 0) {
      out.push("  scalars:");
      for (const b of sheet.scalars.values()) out.push(`    ${b.name} = ${slice(model, b)}`);
    }
    const localOrder = order
      .filter((b) => b.sheetId === sid && !assertionIds.has(b.id) && !chartIds.has(b.id))
      .map((b) => b.name);
    if (localOrder.length > 0) out.push(`  order:   ${localOrder.join(" → ")}`);
    if (sheet.assertions.length > 0) {
      out.push("  assertions:");
      for (const a of sheet.assertions) out.push(`    ${a.source.replace(/^assert\s+/, "")}`);
    }
    if (sheet.charts.length > 0) {
      out.push("  charts:");
      for (const c of sheet.charts) {
        const r = chartState.get(`${c.sheetId}.${c.name}`);
        const where = r?.path ? ` → ${r.path}` : "";
        const state = r ? `  [${r.state}]` : "";
        out.push(
          `    ${c.name} = ${c.engine} of ${c.series.join(", ")} labelled ${c.labels}${where}${state}`,
        );
      }
    }
    out.push("");
  }
  return out;
}

const api = {
  locate,
  build,
  check,
  fmt,
  infer,
  planInfer,
  applyEdits,
  topoOrder,
  formatCheck,
  formatInfer,
  pgEval,
  pgExplain,
};

declare global {
  interface Window {
    VisiMark: typeof api;
  }
}
(globalThis as { VisiMark?: typeof api }).VisiMark = api;
