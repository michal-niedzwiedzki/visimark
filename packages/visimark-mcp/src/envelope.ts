import { findingSummary, isProblem, publicFinding, type CheckResult, type Finding } from "visimark";
import type { Fault } from "./errors.js";
import { engineVersion } from "./version.js";

/**
 * The wire format is the `--json` envelope specified in
 * `docs/design/structured-output-json-spec.md`, **not a reshaped one**, so
 * there is a single consumed contract rather than two that can drift
 * (spec §3.2). Field order is `command`, `visimark`, `status`, `error`, then
 * the command body — JSON.stringify preserves insertion order, so the spread
 * below is the order.
 *
 * Document values stay decimal **strings**; a JSON number here is the §7
 * violation the envelope spec exists to prevent. Nothing in this module
 * converts one.
 */
export type Status = "ok" | "problems" | "error";

/**
 * `status` tracks the exit code the CLI would have produced. Advisory findings
 * (`WARN`, `NOTE`) never turn `ok` into `problems` — that split is
 * `isProblem()` in the engine, reused rather than reimplemented.
 */
export function statusOf(findings: readonly Finding[]): Status {
  return findings.some(isProblem) ? "problems" : "ok";
}

/** A successful tool result: `1`-class findings included, and still a success. */
export function envelope(command: string, body: object, findings: readonly Finding[]): object {
  return { command, visimark: engineVersion(), status: statusOf(findings), ...body };
}

/** A result with no findings of its own — `ref`, and the apply tools. */
export function okEnvelope(command: string, body: object): object {
  return { command, visimark: engineVersion(), status: "ok" as const, ...body };
}

/**
 * The `2` class. This is the body of an MCP tool error, not a successful
 * result (spec §3.1): `check` returning `1` is a successful call reporting
 * problems, and only "your request did not make sense" lands here.
 */
export function errorEnvelopeOf(command: string, f: Fault): object {
  return {
    command,
    visimark: engineVersion(),
    status: "error" as const,
    error: { code: f.code, message: f.message },
  };
}

/** The public findings of a run, keyed to the file they came from. */
export function findings(file: string | undefined, result: CheckResult): object[] {
  return result.findings.map((f) => publicFinding(file ?? CONTENT_SOURCE, f));
}

/** `location.file` for a document that arrived as a string and has no path. */
export const CONTENT_SOURCE = "<content>";

export { findingSummary };

/**
 * Imports and charts the run could not verify because there was no reader
 * (spec §2.5). `content` mode has no base directory, so a declared `import`
 * and a `chart` target cannot resolve; the engine's answer is neither an error
 * nor silence — both phases record `state: "skipped"`.
 *
 * Surfaced explicitly, because an agent that gets an `IMPORT` finding under
 * `path` and not under `content` will otherwise read the difference as a bug.
 *
 * The `skipped` key is always present, and is `{}` when nothing was skipped —
 * spec §2.5 and the behaviour-table row for `visimark_check { content }`. An
 * empty arm is omitted rather than carried as `[]`, so `skipped.charts` means
 * "these could not be checked" and never "none were".
 */
export interface Skipped {
  imports?: string[];
  charts?: string[];
}

export function skipped(result: CheckResult): Skipped {
  const imports: string[] = [];
  for (const [sheetId, status] of result.imports) {
    if (status.state === "skipped") imports.push(sheetId);
  }
  const charts = result.charts
    .filter((c) => c.state === "skipped")
    .map((c) => `${c.sheetId}.${c.name}`);
  return { ...(imports.length ? { imports } : {}), ...(charts.length ? { charts } : {}) };
}
