// Browser bundle entry for the web playground (docs/playground.html).
// Exposes VisiMark's parse/model/eval/write pipeline — no CLI argv/file
// plumbing. `pgEval` and `pgExplain` are the browser-safe equivalents of
// `cmdEval`/`cmdExplain` in ../cli/commands.ts, operating on an in-memory
// source string instead of a file path.
//
// **No node:fs, and no node:crypto — structurally, not by convention.** The
// three phases that touch a filesystem (the path gate, artifact staleness,
// import resolution) are still in this graph, because whether they run is a
// runtime condition no bundler can see. They no longer *import* `node:fs`:
// they take a `ReaderPort` (../fs/reader.ts), whose only `node:fs`
// implementation lives in ../fs/node-reader.ts, which nothing reachable from
// this file imports. So `bun build --target browser` has no `node:fs` or
// `node:crypto` to stub, and the stubbed-call-site crash class that took the
// playground down for 74 minutes (PR #99) cannot recur here.
//
// That claim is a test, not a comment: ../../test/playground/browser-graph.test.ts
// walks this file's transitive imports and greps the committed bundle.
//
// The wrappers below are the other half. `check` and `fmt` both accept a
// `doc: { path, reader }`, and this build ships no reader — so the only way to
// reach the filesystem phases from `window.VisiMark` is for a caller to write
// a `ReaderPort` themselves, which in a browser means an in-memory one. There
// is no bare `docPath` string that silently means "use node:fs"; that option,
// and the crash it could reproduce, no longer exists. `memoryReader`
// (../playground/memory-reader.ts) is that browser-side reader, over
// playground.html's in-memory file store — review §4.3.
//
// playground.html loads the built bundle as a classic `<script>`, not a
// module: the playground is meant to be opened straight from disk
// (`file://`), and `file://` blocks ES module imports via CORS. `bun build
// --format iife` has no notion of a UMD-style global export, so this file
// assigns itself to `window.VisiMark` as its last statement (see bottom).
import { applyEdits } from "../write/splice.js";
import {
  check as checkDoc,
  type AssertionResult,
  type ChartResult,
  type CheckOptions,
} from "../eval/check.js";
import { topoOrder } from "../eval/graph.js";
import type { Value } from "../eval/value.js";
import { infer } from "../infer/propose.js";
import { planInfer } from "../infer/write.js";
import { build } from "../model/build.js";
import type { DocModel } from "../model/types.js";
import { describeFunction, functionNames, precisionPhrase } from "../lang/reference.js";
import { locate } from "../parse/document.js";
import { formatCheck } from "../report/format.js";
import { formatInfer } from "../report/infer.js";
import { fmt as fmtDoc, type FmtOptions, type FmtResult } from "../write/fmt.js";
import { memoryReader } from "./memory-reader.js";
import { sha256Hex } from "./sha256.js";

/**
 * The browser's `check`/`fmt`, with the Node-only half of their options gone.
 *
 * `FmtOptions.fixDates` is pure string work and is kept. `doc` is kept too,
 * but re-stated here so the reader of this file can see what it now costs to
 * use: a `ReaderPort` the caller implements. Nothing in this bundle can build
 * one out of a path, because nothing in this bundle can reach a filesystem.
 */
export type BrowserCheckOptions = Pick<CheckOptions, "doc">;
export type BrowserFmtOptions = Pick<FmtOptions, "fixDates" | "doc">;

function check(model: DocModel, opts: BrowserCheckOptions = {}) {
  return checkDoc(model, opts);
}

function fmt(source: string, opts: BrowserFmtOptions = {}): FmtResult {
  return fmtDoc(source, opts);
}

function showValue(v: Value): string {
  if (v.t === "num") return v.d.toString();
  if (v.t === "date") return v.iso;
  if (v.t === "bool") return String(v.b);
  return v.s;
}

export interface PgEvalResult {
  /** every value and cell column the document computed, keyed as
   *  `name` (document scope) or `sheetId.name`, rendered for display */
  [key: string]: unknown;
  assertions: AssertionResult[];
  charts: ChartResult[];
}

/**
 * Mirrors `cmdEval FILE --json` — the JSON object `visimark eval --json` prints.
 *
 * `opts` is the same `doc` the other entry points take. Without it a document
 * whose sheet is imported from a CSV evaluates with no table at all, so every
 * imported column reads `UNDEF` — which is exactly the spurious failure review
 * §4.3 is about. The KNOWLEDGE panel and the quest engine both read this, so
 * they need the reader as much as the check panel does.
 */
function pgEval(source: string, opts: BrowserCheckOptions = {}): PgEvalResult {
  const model = build(locate(source));
  const result = check(model, opts);

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
function pgExplain(source: string, opts: BrowserCheckOptions = {}): string[] {
  const out: string[] = [];
  const model = build(locate(source));
  const { order, assertionIds, chartIds } = topoOrder(model);

  if (model.docScope.size > 0) {
    out.push("document scope");
    for (const b of model.docScope.values()) out.push(`  ${b.name} = ${slice(model, b)}`);
    out.push("");
  }

  const chartState = new Map(check(model, opts).charts.map((c) => [`${c.sheetId}.${c.name}`, c]));

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
  memoryReader,
  sha256Hex,
  describeFunction,
  functionNames,
  precisionPhrase,
};

/**
 * The shape `window.VisiMark` carries.
 *
 * Exported so the playground *application* bundle (./app/, a second
 * `bun build` target) can type its calls against this one without importing
 * any of it: the app reaches the engine through the global this file assigns,
 * and a `import type` of this alias compiles away to nothing, so the engine is
 * not duplicated into the second bundle.
 */
export type VisiMarkApi = typeof api;

declare global {
  interface Window {
    VisiMark: VisiMarkApi;
  }
}
(globalThis as { VisiMark?: typeof api }).VisiMark = api;
