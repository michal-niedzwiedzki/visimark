import { readFileSync, writeFileSync } from "node:fs";
import { check } from "../eval/check.js";
import { topoOrder } from "../eval/graph.js";
import type { Value } from "../eval/value.js";
import { build } from "../model/build.js";
import type { DocModel } from "../model/types.js";
import { locate } from "../parse/document.js";
import { infer } from "../infer/propose.js";
import { planInfer } from "../infer/write.js";
import { formatCheck } from "../report/format.js";
import { formatInfer } from "../report/infer.js";
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
  const { files } = parseArgs(args);
  if (files.length === 0) {
    err("usage: visimark check FILE...");
    return 2;
  }
  let exit = 0;
  for (const path of files) {
    let source: string;
    try {
      source = read(path);
    } catch {
      err(`visimark: cannot read ${path}`);
      exit = 2;
      continue;
    }
    const result = check(build(locate(source)));
    out(formatCheck(path, result.findings));
    if (result.findings.length > 0 && exit === 0) exit = 1;
  }
  return exit;
}

export function cmdFmt(args: string[], out: Writer, err: Writer): number {
  const { files, flags } = parseArgs(args);
  if (files.length === 0) {
    err("usage: visimark fmt FILE... [--fix-dates]");
    return 2;
  }
  const fixDates = flags.has("fix-dates");
  let exit = 0;
  for (const path of files) {
    let source: string;
    try {
      source = read(path);
    } catch {
      err(`visimark: cannot read ${path}`);
      exit = 2;
      continue;
    }
    const r = fmt(source, { fixDates });
    if (r.changed) {
      writeFileSync(path, r.output);
      const bits = [
        r.cellsUpdated ? `${r.cellsUpdated} cell${r.cellsUpdated === 1 ? "" : "s"}` : "",
        r.anchorsUpdated
          ? `${r.anchorsUpdated} anchor${r.anchorsUpdated === 1 ? "" : "s"}`
          : "",
        r.datesFixed ? `${r.datesFixed} date${r.datesFixed === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      out(`${path}: updated ${bits.join(", ")}`);
    } else {
      out(`${path}: unchanged`);
    }
    if (r.unfixable.length > 0) {
      out(formatCheck(path, r.unfixable));
      if (exit === 0) exit = 1;
    }
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
  if (files.length === 0) {
    err("usage: visimark infer FILE... [--write]");
    return 2;
  }
  let exit = 0;
  for (const path of files) {
    let source: string;
    try {
      source = read(path);
    } catch {
      err(`visimark: cannot read ${path}`);
      exit = 2;
      continue;
    }
    const proposals = infer(source);
    out(formatInfer(path, source, proposals));
    if (!flags.has("write")) continue;

    const edits = planInfer(source, proposals);
    if (edits.length === 0) {
      out(`${path}: nothing to write`);
      continue;
    }
    writeFileSync(path, applyEdits(source, edits));
    const blocks = edits.filter((e) => e.kind === "block").length;
    const anchors = edits.filter((e) => e.kind === "anchor").length;
    const bits = [
      blocks ? `${blocks} block${blocks === 1 ? "" : "s"}` : "",
      anchors ? `${anchors} anchor${anchors === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    out(`${path}: wrote ${bits.join(", ")}`);
  }
  return exit;
}

export function cmdEval(args: string[], out: Writer, err: Writer): number {
  const { files, flags, options } = parseArgs(args);
  const path = files[0];
  if (!path) {
    err("usage: visimark eval FILE [--get NAME] [--json]");
    return 2;
  }
  let source: string;
  try {
    source = read(path);
  } catch {
    err(`visimark: cannot read ${path}`);
    return 2;
  }
  const model = build(locate(source));
  const result = check(model);

  const all = new Map<string, string>();
  for (const [k, v] of result.values) all.set(k, showValue(v));
  for (const [k, col] of result.cells) {
    all.set(k, col.map((v) => (v ? showValue(v) : "?")).join(", "));
  }

  const get = options.get("get");
  if (get !== undefined) {
    const v = all.get(get) ?? all.get(bareToQualified(model, get));
    if (v === undefined) {
      err(`visimark: no value named ${get}`);
      return 2;
    }
    out(flags.has("json") ? JSON.stringify({ [get]: v }) : v);
    return 0;
  }

  if (flags.has("json")) {
    out(JSON.stringify(Object.fromEntries(all), null, 2));
  } else {
    const width = Math.max(...[...all.keys()].map((k) => k.length), 0);
    for (const [k, v] of all) out(`${k.padEnd(width)}  ${v}`);
  }
  return 0;
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
  const { files, sheets } = parseArgs(args);
  const path = files[0];
  if (!path) {
    err("usage: visimark explain FILE [#sheet]");
    return 2;
  }
  let source: string;
  try {
    source = read(path);
  } catch {
    err(`visimark: cannot read ${path}`);
    return 2;
  }
  const model = build(locate(source));
  const { order } = topoOrder(model);

  if (model.docScope.size > 0) {
    out("document scope");
    for (const b of model.docScope.values()) {
      out(`  ${b.name} = ${slice(model, b)}`);
    }
    out("");
  }

  const wanted = sheets.length > 0 ? sheets : [...model.sheets.keys()];
  for (const sid of wanted) {
    const sheet = model.sheets.get(sid);
    if (!sheet) {
      err(`visimark: no sheet #${sid}`);
      return 2;
    }
    out(`#${sid}${sheet.table ? "" : "  (no table)"}`);
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
      .filter((b) => b.sheetId === sid)
      .map((b) => b.name);
    if (localOrder.length > 0) out(`  order:   ${localOrder.join(" → ")}`);
    out("");
  }
  return 0;
}

function slice(model: DocModel, b: { expr: { start: number; end: number } }): string {
  return model.source.slice(b.expr.start, b.expr.end);
}

export type Writer = (line: string) => void;
