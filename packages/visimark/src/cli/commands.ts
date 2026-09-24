import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { writeArtifact } from "../artifact/write.js";
import { onDisk } from "../fs/node-reader.js";
import { check } from "../eval/check.js";
import type { Value } from "../eval/value.js";
import { build } from "../model/build.js";
import type { DocModel } from "../model/types.js";
import { locate, NO_FORMULAS_MARKER } from "../parse/document.js";
import { infer } from "../infer/propose.js";
import { planInfer } from "../infer/write.js";
import { formatCheck } from "../report/format.js";
import { explainText, explainView } from "../report/explain.js";
import { errorEnvelope, explainJson } from "../report/envelope.js";
import { formatInfer } from "../report/infer.js";
import { describeFunction, functionNames, precisionPhrase } from "../lang/reference.js";
import { closest } from "../report/levenshtein.js";
import {
  emitJson,
  evalValues,
  findingSummary,
  inferSummary,
  publicAssertions,
  publicCharts,
  publicFinding,
  publicFnEntry,
  publicProposal,
  signature,
  statusFromExit,
  type CommandName,
  type OnDefaults,
} from "../report/json.js";
import {
  applyScenario,
  listParams,
  parseScenarioJson,
  resolveScenario,
  ScenarioError,
  type ParamInfo,
} from "../eval/scenario.js";
import { parseArgs, usageLine, type Refusal } from "./args.js";
import { readVersion } from "./version.js";
import { fmt } from "../write/fmt.js";
import { applyEdits } from "../write/splice.js";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function refuse(command: CommandName, r: Refusal, out: Writer, err: Writer): 2 {
  err(r.message);
  if (r.usage) err(r.usage);
  if (r.json) emitJson(out, errorEnvelope(command, "USAGE", r.message));
  return 2;
}

function showValue(v: Value): string {
  if (v.t === "num") return v.d.toString();
  if (v.t === "date") return v.iso;
  if (v.t === "bool") return String(v.b);
  return v.s;
}

export function cmdCheck(args: string[], out: Writer, err: Writer): number {
  const p = parseArgs("check", args);
  if (!p.ok) return refuse("check", p, out, err);
  const parsed = p.parsed;
  const { files, flags } = parsed;
  const json = flags.has("json");
  if (files.length === 0) {
    const msg = usageLine("check");
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
    const result = check(build(locate(source)), { doc: onDisk(path) });
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
  const p = parseArgs("fmt", args);
  if (!p.ok) return refuse("fmt", p, out, err);
  const parsed = p.parsed;
  const { files, flags } = parsed;
  const json = flags.has("json");
  if (files.length === 0) {
    const msg = usageLine("fmt");
    err(msg);
    if (json) emitJson(out, errorEnvelope("fmt", "USAGE", msg));
    return 2;
  }
  const fixDates = flags.has("fix-dates");
  const noArtifacts = flags.has("no-artifacts");
  const fileEntries: object[] = [];
  let exit: 0 | 1 | 2 = 0;
  let filesChanged = 0;
  let cellsUpdated = 0;
  let anchorsUpdated = 0;
  let datesFixed = 0;
  let artifactCount = 0;
  let artifactsSkipped = 0;
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
    const r = fmt(source, { fixDates, noArtifacts, doc: onDisk(path) });
    // a generated artifact is written whole; the document itself is spliced.
    // `mkdirSync` still resolves a path - it has to, since the artifact's
    // directory may not exist yet - but nothing is decided by it: the open
    // inside `writeArtifact` is what refuses a target that moved.
    let refused: string | undefined;
    for (const a of r.artifacts) {
      mkdirSync(dirname(a.target), { recursive: true });
      const w = writeArtifact(a);
      if ("err" in w) {
        refused = "visimark: " + w.err;
        break;
      }
    }
    if (refused !== undefined) {
      err(refused);
      if (json) fileEntries.push({ path, error: { code: "WRITE", message: refused } });
      exit = 2;
      continue;
    }
    if (r.changed) writeFileSync(path, r.output);
    // `--no-artifacts` declined a write the caller can still see the cost of:
    // the count is named so a run that touched nothing is distinguishable from
    // one that left five charts alone. It never implies the charts are fine —
    // `check` still reports every one of them.
    const skippedBit = r.artifactsSkipped
      ? `${r.artifactsSkipped} artifact${r.artifactsSkipped === 1 ? "" : "s"} skipped`
      : "";
    if (!json) {
      if (r.changed || r.artifacts.length > 0) {
        const bits = [
          r.cellsUpdated ? `${r.cellsUpdated} cell${r.cellsUpdated === 1 ? "" : "s"}` : "",
          r.anchorsUpdated ? `${r.anchorsUpdated} anchor${r.anchorsUpdated === 1 ? "" : "s"}` : "",
          r.datesFixed ? `${r.datesFixed} date${r.datesFixed === 1 ? "" : "s"}` : "",
          r.artifacts.length
            ? `${r.artifacts.length} artifact${r.artifacts.length === 1 ? "" : "s"}`
            : "",
          skippedBit,
        ].filter(Boolean);
        out(`${path}: updated ${bits.join(", ")}`);
      } else if (skippedBit) {
        out(`${path}: unchanged, ${skippedBit}`);
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
        artifactsSkipped: r.artifactsSkipped,
        findings: r.unfixable.map((f) => publicFinding(path, f)),
      });
      if (r.changed) filesChanged++;
      cellsUpdated += r.cellsUpdated;
      anchorsUpdated += r.anchorsUpdated;
      datesFixed += r.datesFixed;
      artifactCount += r.artifacts.length;
      artifactsSkipped += r.artifactsSkipped;
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
        artifactsSkipped,
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
  const p = parseArgs("infer", args);
  if (!p.ok) return refuse("infer", p, out, err);
  const parsed = p.parsed;
  const { files, flags } = parsed;
  const json = flags.has("json");
  const write = flags.has("write");
  if (files.length === 0) {
    const msg = usageLine("infer");
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
  const p = parseArgs("eval", args);
  if (!p.ok) return refuse("eval", p, out, err);
  const { files, flags, options } = p.parsed;
  const json = flags.has("json");
  const path = files[0];
  if (!path) {
    const msg = usageLine("eval");
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

  // A scenario is checked in full before anything is evaluated: a fault is a
  // usage error, and no values are printed (scenario-params-spec.md §4.2).
  const scenarioFile = options.get("scenario");
  let scenario: { file: string; params: ParamInfo[]; supplied: Set<string> } | null = null;
  if (scenarioFile !== undefined) {
    try {
      let text: string;
      try {
        text = scenarioFile === "-" ? readFileSync(0, "utf8") : read(scenarioFile);
      } catch {
        throw new ScenarioError(`visimark: cannot read scenario ${scenarioFile}`);
      }
      const resolved = resolveScenario(model, parseScenarioJson(text, scenarioFile));
      // listed before the values change, so each carries its default
      const params = listParams(model);
      applyScenario(model, resolved);
      scenario = { file: scenarioFile, params, supplied: new Set(resolved.keys()) };
    } catch (e) {
      if (!(e instanceof ScenarioError)) throw e;
      err(e.message);
      if (json) emitJson(out, errorEnvelope("eval", "SCENARIO", e.message));
      return 2;
    }
  }

  const result = check(model);

  const all = new Map<string, string>();
  for (const [k, v] of result.values) all.set(k, showValue(v));
  for (const [k, col] of result.cells) {
    all.set(k, col.map((v) => (v ? showValue(v) : "?")).join(", "));
  }
  const values = evalValues(result);

  // Under a scenario, each failed assertion also says how it fares on the
  // defaults — "these assumptions break it" vs "it was already broken". That
  // takes a second evaluation, of a fresh model, since `eval` does not assume
  // `check` passed. Assertions come back in document order from both.
  let onDefaults: (OnDefaults | undefined)[] | undefined;
  if (scenario && result.assertions.some((a) => a.holds === false)) {
    const base = check(build(locate(source)));
    onDefaults = result.assertions.map((a, i) => {
      if (a.holds !== false) return undefined;
      const d = base.assertions[i]?.holds;
      return d === true ? "pass" : d === false ? "fail" : "unverified";
    });
  }

  // A false assertion means the document's stated invariants do not hold; `eval`
  // will not hand back values as if it were sound. It prints the failure to
  // stderr and exits 1 — after the requested value, so a pipeline still gets it.
  const failed = result.assertions
    .map((a, i) => ({ a, onDefault: onDefaults?.[i] }))
    .filter(({ a }) => a.holds === false);
  const assertExit: 0 | 1 = failed.length > 0 ? 1 : 0;
  const reportFailures = (): void => {
    for (const { a, onDefault } of failed) {
      err(`  ASSERT  #${a.sheetId}   ${a.source.replace(/^assert\s+/, "")}`);
      err(`          ${a.substituted}   is false${onDefault ? ON_DEFAULTS_TEXT[onDefault] : ""}`);
    }
  };

  const scenarioJson = (): object => {
    const params: Record<string, object> = {};
    for (const p of scenario!.params) {
      params[p.id] = {
        value: typeof values[p.id] === "string" ? values[p.id] : null,
        default: p.defaultValue,
        source: scenario!.supplied.has(p.id) ? "scenario" : "default",
      };
    }
    return { file: scenario!.file, params };
  };

  const emitEval = (selected: typeof values): void => {
    emitJson(out, {
      command: "eval",
      visimark: readVersion(),
      status: statusFromExit(assertExit),
      file: path,
      ...(scenario ? { scenario: scenarioJson() } : {}),
      values: selected,
      assertions: publicAssertions(result.assertions, onDefaults),
      charts: publicCharts(result.charts, scenario === null),
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
    if (scenario) for (const line of scenarioText(scenario, all)) out(line);
    reportFailures();
  }
  return assertExit;
}

const ON_DEFAULTS_TEXT: Record<OnDefaults, string> = {
  pass: " under scenario (holds on defaults)",
  fail: " under scenario (also false on defaults)",
  unverified: " under scenario (unverified on defaults)",
};

/** the `scenario:` block that follows the value lines (spec §5.3) */
function scenarioText(
  scenario: { file: string; params: ParamInfo[]; supplied: Set<string> },
  all: Map<string, string>,
): string[] {
  const rows = scenario.params.map((p) => ({
    id: p.id,
    value: all.get(p.id) ?? "?",
    supplied: scenario.supplied.has(p.id),
    dflt: p.defaultValue,
  }));
  const idW = Math.max(0, ...rows.map((r) => r.id.length));
  const valW = Math.max(0, ...rows.map((r) => r.value.length));
  const lines = [`scenario: ${scenario.file}`];
  for (const r of rows) {
    const head = `  ${r.id.padEnd(idW)}  ${r.value.padEnd(valW)}  `;
    lines.push(r.supplied ? `${head}scenario  (default ${r.dflt})` : `${head}default`);
  }
  return lines;
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
  const p = parseArgs("explain", args);
  if (!p.ok) return refuse("explain", p, out, err);
  const parsed = p.parsed;
  const { files, flags, sheets } = parsed;
  const json = flags.has("json");
  const path = files[0];
  if (!path) {
    const msg = usageLine("explain");
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
  const checkResult = check(model, { doc: onDisk(path) });
  for (const sid of sheets.length > 0 ? sheets : model.sheets.keys()) {
    if (!model.sheets.get(sid)) {
      const msg = `visimark: no sheet #${sid}`;
      err(msg);
      if (json) emitJson(out, errorEnvelope("explain", "USAGE", msg));
      return 2;
    }
  }
  const view = explainView(model, checkResult, sheets);

  if (json) {
    emitJson(out, explainJson(view, path));
    return 0;
  }

  // A document with no scope bindings and no sheets renders to nothing at all —
  // guard the write, or the single `out()` would emit the blank line that the
  // per-line loop this replaced never reached.
  const text = explainText(view);
  if (text) out(text);
  return 0;
}

export type Writer = (line: string) => void;

/**
 * `ref` is the one command that reads no file: it answers about the language,
 * not about a document. Its whole body is formatting over `describeFunction`.
 */
export function cmdRef(args: string[], out: Writer, err: Writer): number {
  const p = parseArgs("ref", args);
  if (!p.ok) return refuse("ref", p, out, err);
  const parsed = p.parsed;
  const { files, flags } = parsed;
  const json = flags.has("json");
  const name = files[0];

  if (name === undefined) {
    const all = functionNames().map((n) => describeFunction(n)!);
    if (json) {
      emitJson(out, {
        command: "ref",
        visimark: readVersion(),
        status: statusFromExit(0),
        functions: all.map(publicFnEntry),
      });
    } else {
      const w = Math.max(...all.map((e) => signature(e).length));
      for (const e of all) out(`${signature(e).padEnd(w)}   ${e.kind}, ${plural(e.arity)}`);
    }
    return 0;
  }

  const entry = describeFunction(name);
  if (!entry) {
    const guess = closest(name, functionNames(), 3);
    const msg =
      `visimark: unknown function \`${name}\`` + (guess ? ` — did you mean \`${guess}\`?` : "");
    err(msg);
    if (json) emitJson(out, errorEnvelope("ref", "USAGE", msg));
    return 2;
  }

  if (json) {
    emitJson(out, {
      command: "ref",
      visimark: readVersion(),
      status: statusFromExit(0),
      function: publicFnEntry(entry),
    });
    return 0;
  }

  out(`${signature(entry)} — ${entry.kind}, ${plural(entry.arity)}`);
  out("");
  out(`  ${sentence(entry.summary)}.`);
  out("");
  const pad = Math.max(...entry.params.map((p) => p.name.length), 7);
  for (const p of entry.params) out(`  ${p.name.padEnd(pad)}  ${p.type.padEnd(7)}  ${p.note}`);
  out("");
  out(`  returns    ${entry.returns}`);
  out(`  precision  ${precisionPhrase(entry.precision)}`);
  if (entry.rounding) out(`  rounding   ${entry.rounding}`);
  if (entry.errors.length > 0) {
    out("");
    out("  errors");
    const w = Math.max(...entry.errors.map((e) => e.when.length));
    for (const e of entry.errors) out(`    ${e.when.padEnd(w)}   ${e.code}`);
  }
  out("");
  out("  examples");
  const exw = Math.max(...entry.examples.map((e) => e.expr.length));
  for (const e of entry.examples) out(`    ${e.expr.padEnd(exw)}  = ${e.is}`);
  if (entry.see && entry.see.length > 0) {
    out("");
    out(`  see also  ${entry.see.join(", ")}`);
  }
  return 0;
}

/** A summary is written lower-case for the design-doc table; here it opens a line. */
function sentence(s: string): string {
  return s.length > 0 ? `${s[0]!.toUpperCase()}${s.slice(1)}` : s;
}

function plural(n: number): string {
  return `${n} argument${n === 1 ? "" : "s"}`;
}
