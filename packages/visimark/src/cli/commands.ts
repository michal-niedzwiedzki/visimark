import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { check } from "../eval/check.js";
import { topoOrder } from "../eval/graph.js";
import type { Value } from "../eval/value.js";
import { build } from "../model/build.js";
import type { DocModel } from "../model/types.js";
import { locate, NO_FORMULAS_MARKER } from "../parse/document.js";
import { infer } from "../infer/propose.js";
import { planInfer } from "../infer/write.js";
import { formatCheck } from "../report/format.js";
import { formatInfer } from "../report/infer.js";
import {
  emitJson,
  errorEnvelope,
  evalValues,
  findingSummary,
  inferSummary,
  publicAssertions,
  publicCharts,
  publicFinding,
  publicProposal,
  statusFromExit,
} from "../report/json.js";
import { readVersion } from "./version.js";
import { fmt } from "../write/fmt.js";
import { applyEdits } from "../write/splice.js";

interface Parsed {
  files: string[];
  flags: Set<string>;
  options: Map<string, string>;
  sheets: string[]; // #sheet arguments
}

function parseArgs(args: string[]): Parsed {
  const files: string[] = [];
  const flags = new Set<string>();
  const options = new Map<string, string>();
  const sheets: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--get") {
      options.set("get", args[++i] ?? "");
    } else if (a.startsWith("--")) {
      flags.add(a.slice(2));
    } else if (a.startsWith("#")) {
      sheets.push(a.slice(1));
    } else {
      files.push(a);
    }
  }
  return { files, flags, options, sheets };
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function showValue(v: Value): string {
  if (v.t === "num") return v.d.toString();
  if (v.t === "date") return v.iso;
  if (v.t === "bool") return String(v.b);
  return v.s;
}

export function cmdCheck(args: string[], out: Writer, err: Writer): number {
  const { files, flags } = parseArgs(args);
  const json = flags.has("json");
  if (files.length === 0) {
    const msg = "usage: visimark check FILE...";
    err(msg);
    if (json) emitJson(out, errorEnvelope("check", "USAGE", msg));
    return 2;
  }
  const fileEntries: object[] = [];
  let exit: 0 | 1 | 2 = 0;
  let problems = 0;
  let stale = 0;
  let errors = 0;
  for (const path of files) {
    let source: string;
    try {
      source = read(path);
    } catch {
      const msg = `visimark: cannot read ${path}`;
      err(msg);
      if (json) fileEntries.push({ path, error: { code: "READ", message: msg } });
      exit = 2;
      continue;
    }
    const result = check(build(locate(source)), { docPath: path });
    if (!json) out(formatCheck(path, result.findings));
    else {
      const summary = findingSummary(result.findings);
      fileEntries.push({
        path,
        findings: result.findings.map((f) => publicFinding(path, f)),
        summary,
      });
      problems += summary.problems;
      stale += summary.stale;
      errors += summary.errors;
    }
    if (result.exitCode === 1 && exit === 0) exit = 1;
  }
  if (json) {
    emitJson(out, {
      command: "check",
      visimark: readVersion(),
      status: statusFromExit(exit),
      files: fileEntries,
      summary: { files: files.length, problems, stale, errors },
    });
  }
  return exit;
}

export function cmdFmt(args: string[], out: Writer, err: Writer): number {
  const { files, flags } = parseArgs(args);
  const json = flags.has("json");
  if (files.length === 0) {
    const msg = "usage: visimark fmt FILE... [--fix-dates]";
    err(msg);
    if (json) emitJson(out, errorEnvelope("fmt", "USAGE", msg));
    return 2;
  }
  const fixDates = flags.has("fix-dates");
  const fileEntries: object[] = [];
  let exit: 0 | 1 | 2 = 0;
  let filesChanged = 0;
  let cellsUpdated = 0;
  let anchorsUpdated = 0;
  let datesFixed = 0;
  let artifactCount = 0;
  let problems = 0;
  let stale = 0;
  let errors = 0;
  for (const path of files) {
    let source: string;
    try {
      source = read(path);
    } catch {
      const msg = `visimark: cannot read ${path}`;
      err(msg);
      if (json) fileEntries.push({ path, error: { code: "READ", message: msg } });
      exit = 2;
      continue;
    }
    const r = fmt(source, { fixDates, docPath: path });
    // a generated artifact is written whole; the document itself is spliced
    for (const a of r.artifacts) {
      mkdirSync(dirname(a.target), { recursive: true });
      writeFileSync(a.target, a.svg);
    }
    if (r.changed) writeFileSync(path, r.output);
    if (!json) {
      if (r.changed || r.artifacts.length > 0) {
        const bits = [
          r.cellsUpdated ? `${r.cellsUpdated} cell${r.cellsUpdated === 1 ? "" : "s"}` : "",
          r.anchorsUpdated ? `${r.anchorsUpdated} anchor${r.anchorsUpdated === 1 ? "" : "s"}` : "",
          r.datesFixed ? `${r.datesFixed} date${r.datesFixed === 1 ? "" : "s"}` : "",
          r.artifacts.length
            ? `${r.artifacts.length} artifact${r.artifacts.length === 1 ? "" : "s"}`
            : "",
        ].filter(Boolean);
        out(`${path}: updated ${bits.join(", ")}`);
      } else {
        out(`${path}: unchanged`);
      }
      if (r.unfixable.length > 0) {
        out(formatCheck(path, r.unfixable));
        if (exit === 0) exit = 1;
      }
    } else {
      const summary = findingSummary(r.unfixable);
      fileEntries.push({
        path,
        changed: r.changed,
        cellsUpdated: r.cellsUpdated,
        anchorsUpdated: r.anchorsUpdated,
        datesFixed: r.datesFixed,
        artifacts: r.artifacts.map((a) => ({ path: a.path })),
        findings: r.unfixable.map((f) => publicFinding(path, f)),
      });
      if (r.changed) filesChanged++;
      cellsUpdated += r.cellsUpdated;
      anchorsUpdated += r.anchorsUpdated;
      datesFixed += r.datesFixed;
      artifactCount += r.artifacts.length;
      problems += summary.problems;
      stale += summary.stale;
      errors += summary.errors;
      if (r.unfixable.length > 0 && exit === 0) exit = 1;
    }
  }
  if (json) {
    emitJson(out, {
      command: "fmt",
      visimark: readVersion(),
      status: statusFromExit(exit),
      files: fileEntries,
      summary: {
        files: files.length,
        filesChanged,
        cellsUpdated,
        anchorsUpdated,
        datesFixed,
        artifacts: artifactCount,
        problems,
        stale,
        errors,
      },
    });
  }
  return exit;
}

/**
 * `infer` is advisory. It exits `0` whatever it finds and `2` only on usage or
 * a read failure — never `1`. A document with no inferable rules is not a
 * failure, it is a document, and all CI pressure stays in `check`.
 */
export function cmdInfer(args: string[], out: Writer, err: Writer): number {
  const { files, flags } = parseArgs(args);
  const json = flags.has("json");
  const write = flags.has("write");
  if (files.length === 0) {
    const msg = "usage: visimark infer FILE... [--write]";
    err(msg);
    if (json) emitJson(out, errorEnvelope("infer", "USAGE", msg));
    return 2;
  }
  const fileEntries: object[] = [];
  let exit: 0 | 1 | 2 = 0;
  let rules = 0;
  let scalars = 0;
  let anchors = 0;
  for (const path of files) {
    let source: string;
    try {
      source = read(path);
    } catch {
      const msg = `visimark: cannot read ${path}`;
      err(msg);
      if (json) fileEntries.push({ path, error: { code: "READ", message: msg } });
      exit = 2;
      continue;
    }
    const proposals = infer(source);
    const counts = inferSummary(proposals);
    rules += counts.rules;
    scalars += counts.scalars;
    anchors += counts.anchors;
    if (!json) out(formatInfer(path, source, proposals));
    let written: { blocks: number; anchors: number; marker: boolean } | undefined;
    if (write) {
      const edits = planInfer(source, proposals);
      if (edits.length === 0) {
        if (!json) out(`${path}: nothing to write`);
        written = { blocks: 0, anchors: 0, marker: false };
      } else {
        writeFileSync(path, applyEdits(source, edits));
        const marker = edits.some((e) => e.kind === "marker");
        const blocks = edits.filter((e) => e.kind === "block").length;
        const nAnchors = edits.filter((e) => e.kind === "anchor").length;
        written = { blocks, anchors: nAnchors, marker };
        if (!json) {
          if (marker) {
            out(`${path}: nothing to derive — marked \`${NO_FORMULAS_MARKER}\``);
          } else {
            const bits = [
              blocks ? `${blocks} block${blocks === 1 ? "" : "s"}` : "",
              nAnchors ? `${nAnchors} anchor${nAnchors === 1 ? "" : "s"}` : "",
            ].filter(Boolean);
            out(`${path}: wrote ${bits.join(", ")}`);
          }
        }
      }
    }
    if (json) {
      const entry: Record<string, unknown> = {
        path,
        proposals: proposals.map(publicProposal),
      };
      if (written) entry.written = written;
      fileEntries.push(entry);
    }
  }
  if (json) {
    emitJson(out, {
      command: "infer",
      visimark: readVersion(),
      status: statusFromExit(exit),
      files: fileEntries,
      summary: { files: files.length, rules, scalars, anchors },
    });
  }
  return exit;
}

export function cmdEval(args: string[], out: Writer, err: Writer): number {
  const { files, flags, options } = parseArgs(args);
  const json = flags.has("json");
  const path = files[0];
  if (!path) {
    const msg = "usage: visimark eval FILE [--get NAME] [--json]";
    err(msg);
    if (json) emitJson(out, errorEnvelope("eval", "USAGE", msg));
    return 2;
  }
  let source: string;
  try {
    source = read(path);
  } catch {
    const msg = `visimark: cannot read ${path}`;
    err(msg);
    if (json) emitJson(out, errorEnvelope("eval", "READ", msg));
    return 2;
  }
  const model = build(locate(source));
  const result = check(model);

  const all = new Map<string, string>();
  for (const [k, v] of result.values) all.set(k, showValue(v));
  for (const [k, col] of result.cells) {
    all.set(k, col.map((v) => (v ? showValue(v) : "?")).join(", "));
  }
  const values = evalValues(result);

  // A false assertion means the document's stated invariants do not hold; `eval`
  // will not hand back values as if it were sound. It prints the failure to
  // stderr and exits 1 — after the requested value, so a pipeline still gets it.
  const failed = result.assertions.filter((a) => a.holds === false);
  const assertExit: 0 | 1 = failed.length > 0 ? 1 : 0;
  const reportFailures = (): void => {
    for (const a of failed) {
      err(`  ASSERT  #${a.sheetId}   ${a.source.replace(/^assert\s+/, "")}`);
      err(`          ${a.substituted}   is false`);
    }
  };

  const emitEval = (selected: typeof values): void => {
    emitJson(out, {
      command: "eval",
      visimark: readVersion(),
      status: statusFromExit(assertExit),
      file: path,
      values: selected,
      assertions: publicAssertions(result.assertions),
      charts: publicCharts(result.charts),
    });
  };

  const get = options.get("get");
  if (get !== undefined) {
    const qualified = all.has(get) || values[get] !== undefined ? get : bareToQualified(model, get);
    const text = all.get(get) ?? all.get(qualified);
    const jsonVal = values[get] ?? values[qualified];
    if (text === undefined && jsonVal === undefined) {
      const msg = `visimark: no value named ${get}`;
      err(msg);
      if (json) emitJson(out, errorEnvelope("eval", "USAGE", msg));
      return 2;
    }
    if (json) emitEval({ [get]: jsonVal! });
    else out(text!);
    if (!json) reportFailures();
    return assertExit;
  }

  if (json) emitEval(values);
  else {
    const width = Math.max(...[...all.keys()].map((k) => k.length), 0);
    for (const [k, v] of all) out(`${k.padEnd(width)}  ${v}`);
    reportFailures();
  }
  return assertExit;
}

function bareToQualified(model: DocModel, name: string): string {
  for (const sheet of model.sheets.values()) {
    if (sheet.scalars.has(name) || sheet.columns.has(name)) {
      return `${sheet.id}.${name}`;
    }
  }
  return name;
}

export function cmdExplain(args: string[], out: Writer, err: Writer): number {
  const { files, flags, sheets } = parseArgs(args);
  const json = flags.has("json");
  const path = files[0];
  if (!path) {
    const msg = "usage: visimark explain FILE [#sheet]";
    err(msg);
    if (json) emitJson(out, errorEnvelope("explain", "USAGE", msg));
    return 2;
  }
  let source: string;
  try {
    source = read(path);
  } catch {
    const msg = `visimark: cannot read ${path}`;
    err(msg);
    if (json) emitJson(out, errorEnvelope("explain", "READ", msg));
    return 2;
  }
  const model = build(locate(source));
  const checkResult = check(model, { docPath: path });
  const { order, assertionIds, chartIds } = topoOrder(model);
  const chartResults = checkResult.charts;
  const chartState = new Map(chartResults.map((c) => [`${c.sheetId}.${c.name}`, c]));
  const importState = checkResult.imports;

  const wanted = sheets.length > 0 ? sheets : [...model.sheets.keys()];
  for (const sid of wanted) {
    if (!model.sheets.get(sid)) {
      const msg = `visimark: no sheet #${sid}`;
      err(msg);
      if (json) emitJson(out, errorEnvelope("explain", "USAGE", msg));
      return 2;
    }
  }

  if (json) {
    emitJson(out, {
      command: "explain",
      visimark: readVersion(),
      status: "ok",
      file: path,
      documentScope: [...model.docScope.values()].map((b) => ({
        name: b.name,
        rule: slice(model, b),
      })),
      sheets: wanted.map((sid) => {
        const sheet = model.sheets.get(sid)!;
        const localOrder = order
          .filter((b) => b.sheetId === sid && !assertionIds.has(b.id) && !chartIds.has(b.id))
          .map((b) => b.name);
        const importSt = importState.get(sid);
        return {
          id: sid,
          hasTable: Boolean(sheet.table),
          ...(sheet.imported
            ? {
                import: {
                  path: sheet.imported.path,
                  delimiter: sheet.imported.delimiter,
                  labels: sheet.imported.labels,
                  stamp: sheet.imported.stampDigest ? `sha256:${sheet.imported.stampDigest}` : null,
                  stampStatus: importSt?.state ?? null,
                },
              }
            : {}),
          inputs: [...sheet.inputColumns],
          rules: [...sheet.columns.values()].map((b) => ({ name: b.name, rule: slice(model, b) })),
          scalars: [...sheet.scalars.values()].map((b) => ({
            name: b.name,
            rule: slice(model, b),
          })),
          order: localOrder,
          assertions: sheet.assertions.map((a) => a.source.replace(/^assert\s+/, "")),
          charts: sheet.charts.map((c) => {
            const r = chartState.get(`${c.sheetId}.${c.name}`);
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
    });
    return 0;
  }

  if (model.docScope.size > 0) {
    out("document scope");
    for (const b of model.docScope.values()) {
      out(`  ${b.name} = ${slice(model, b)}`);
    }
    out("");
  }

  for (const sid of wanted) {
    const sheet = model.sheets.get(sid)!;
    out(`#${sid}${sheet.table ? "" : "  (no table)"}`);
    if (sheet.imported) {
      const st = importState.get(sid);
      const delim =
        sheet.imported.delimiter !== "," ? ` delimited ${sheet.imported.delimiter}` : "";
      const labels = sheet.imported.labels ? ` labelled ${sheet.imported.labels.join(", ")}` : "";
      out(`  import:  ${sheet.imported.path}${delim}${labels}  [${st?.state ?? "unknown"}]`);
    }
    if (sheet.inputColumns.size > 0) {
      out(`  inputs:  ${[...sheet.inputColumns].join(", ")}`);
    }
    if (sheet.columns.size > 0) {
      out("  rules:");
      for (const b of sheet.columns.values()) out(`    ${b.name} = ${slice(model, b)}`);
    }
    if (sheet.scalars.size > 0) {
      out("  scalars:");
      for (const b of sheet.scalars.values()) out(`    ${b.name} = ${slice(model, b)}`);
    }
    const localOrder = order
      .filter((b) => b.sheetId === sid && !assertionIds.has(b.id) && !chartIds.has(b.id))
      .map((b) => b.name);
    if (localOrder.length > 0) out(`  order:   ${localOrder.join(" → ")}`);
    if (sheet.assertions.length > 0) {
      out("  assertions:");
      for (const a of sheet.assertions) out(`    ${a.source.replace(/^assert\s+/, "")}`);
    }
    if (sheet.charts.length > 0) {
      out("  charts:");
      for (const c of sheet.charts) {
        const r = chartState.get(`${c.sheetId}.${c.name}`);
        const where = r?.path ? ` → ${r.path}` : "";
        const state = r ? `  [${r.state}]` : "";
        out(
          `    ${c.name} = ${c.engine} of ${c.series.join(", ")} labelled ${c.labels}${where}${state}`,
        );
      }
    }
    out("");
  }
  return 0;
}

function slice(model: DocModel, b: { expr: { start: number; end: number } }): string {
  return model.source.slice(b.expr.start, b.expr.end);
}

export type Writer = (line: string) => void;
