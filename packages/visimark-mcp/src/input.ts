import { readFileSync } from "node:fs";
import { onDisk, type DocumentFile } from "visimark";
import { fault, type Fault } from "./errors.js";

/**
 * The one place this surface deliberately does not mirror the CLI (spec §2.3):
 * every read tool takes **either** a `path` **or** a `content` string. An agent
 * frequently has no file path — it has a table it is drafting in context — and
 * a path-only surface forces a temp file to ask "do these numbers add up?",
 * the single most common thing it will want to ask.
 *
 * The engine already states the condition structurally: a caller with a
 * document on disk passes `onDisk(path)` as `CheckOptions.doc`; a caller
 * without one passes nothing and the filesystem phases stand down
 * (`fs/reader.ts`). So `content` mode is `doc: undefined`, not a stub reader.
 *
 * Both given, or neither, is a `USAGE` fault — **never** a silent preference
 * for one. An agent that passes both has two different documents in mind, and
 * picking either on its behalf hides the bug.
 */
export interface Resolved {
  /** the document text, however it arrived */
  readonly source: string;
  /** `onDisk(path)` for a path; `undefined` for content — the phases stand down */
  readonly doc: DocumentFile | undefined;
  /** the path, or `undefined` in content mode */
  readonly file: string | undefined;
}

/** How the pair of fields is spelled for the document and for a scenario. */
export interface InputFields {
  readonly path: string;
  readonly content: string;
}

export const DOC_FIELDS: InputFields = { path: "path", content: "content" };
export const SCENARIO_FIELDS: InputFields = { path: "scenarioPath", content: "scenarioContent" };

export function asArgs(args: unknown): Record<string, unknown> {
  return typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {};
}

function stringField(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

/**
 * Turn a tool's arguments into an engine call, or refuse. Reads the file for
 * `path`; an unreadable path is `READ`, not `USAGE` — the request made sense
 * and the filesystem did not cooperate, and those are different problems for
 * the agent that has to react to them. The wording matches the CLI's
 * `visimark: …` idiom so the same situation reads the same way on both
 * surfaces.
 */
export function resolveInput(args: unknown, fields: InputFields = DOC_FIELDS): Resolved | Fault {
  const a = asArgs(args);
  const path = stringField(a, fields.path);
  const content = stringField(a, fields.content);

  if (path !== undefined && content !== undefined) {
    return fault("USAGE", `visimark: give ${fields.path} or ${fields.content}, not both`);
  }
  if (content !== undefined) return { source: content, doc: undefined, file: undefined };
  if (path === undefined) {
    return fault("USAGE", `visimark: give ${fields.path} or ${fields.content}`);
  }

  try {
    return { source: readFileSync(path, "utf8"), doc: onDisk(path), file: path };
  } catch {
    return fault("READ", `visimark: cannot read ${path}`);
  }
}

/**
 * The scenario half of `visimark_eval`, which mirrors the same rule so that an
 * agent can evaluate a draft document against a draft scenario without
 * touching disk. Absent entirely is not a fault here — a scenario is optional —
 * but half-given still is.
 */
export function resolveOptionalInput(
  args: unknown,
  fields: InputFields,
): Resolved | Fault | undefined {
  const a = asArgs(args);
  const given = a[fields.path] !== undefined || a[fields.content] !== undefined;
  return given ? resolveInput(args, fields) : undefined;
}
