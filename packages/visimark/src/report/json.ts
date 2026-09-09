import { readVersion } from "../cli/version.js";
import { ERROR_CODES, isProblem, type Finding } from "../model/types.js";

export type JsonWriter = (line: string) => void;
export type CommandName = "check" | "fmt" | "infer" | "eval" | "explain";

export function emitJson(out: JsonWriter, doc: object): void {
  out(JSON.stringify(doc, null, 2));
}

export function statusFromExit(code: 0 | 1 | 2): "ok" | "problems" | "error" {
  return code === 0 ? "ok" : code === 1 ? "problems" : "error";
}

export function errorEnvelope(
  command: CommandName,
  code: "USAGE" | "READ",
  message: string,
): object {
  return { command, visimark: readVersion(), status: "error", error: { code, message } };
}

export function findingSummary(findings: Finding[]): {
  problems: number;
  stale: number;
  errors: number;
} {
  let stale = 0;
  let errors = 0;
  for (const f of findings) {
    if (f.code === "STALE") stale += f.anchorGroup ? (f.suppressedCount ?? 0) : 1;
    else if (ERROR_CODES.has(f.code)) errors++;
  }
  return { problems: stale + errors, stale, errors };
}

export function publicFinding(file: string, f: Finding): object {
  const location: Record<string, string> = { file };
  if (f.sheetId) location.sheet = f.sheetId;
  if (f.name) location.name = f.name;
  if (f.rowLabel) location.row = f.rowLabel;
  const details: Record<string, unknown> = {};
  if (f.code === "STALE" && f.anchorGroup) {
    details.suppressedCount = f.suppressedCount ?? 0;
  } else if (f.code === "STALE" && f.artifact !== undefined) {
    details.artifact = f.artifact;
    if (f.message) details.message = f.message;
  } else if (f.code === "STALE") {
    if (f.stored !== undefined) details.stored = f.stored;
    if (f.computed !== undefined) details.computed = f.computed;
    if (f.formula !== undefined) details.formula = f.formula;
  } else if (f.code === "DATE") {
    if (f.raw !== undefined) details.raw = f.raw;
    if (f.isoFix !== undefined) details.isoFix = f.isoFix;
    if (f.altA !== undefined) details.altA = f.altA;
    if (f.altB !== undefined) details.altB = f.altB;
    if (f.daysApart !== undefined) details.daysApart = f.daysApart;
  } else if (f.code === "CYCLE") {
    details.cyclePath = f.cyclePath ?? [];
  } else if (f.code === "ASSERT") {
    if (f.source !== undefined) details.source = f.source;
    if (f.message !== undefined) details.substituted = f.message;
  } else if (f.code === "ARTIFACT") {
    if (f.artifact !== undefined) details.artifact = f.artifact;
    if (f.message) details.message = f.message;
  } else {
    if (f.message) details.message = f.message;
    if (f.suggestion) details.suggestion = f.suggestion;
    if (f.code === "NOTE" && f.suppressedCount !== undefined) {
      details.suppressedCount = f.suppressedCount;
    }
  }
  return {
    code: f.code,
    class: isProblem(f) ? "problem" : "advice",
    location,
    details,
  };
}
