import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  applyEdits,
  build,
  check,
  infer,
  locate,
  nodeReader,
  onDisk,
  planInfer,
  writeArtifact,
  type Proposal,
} from "visimark";
import { okEnvelope } from "../envelope.js";
import { fault, type Fault } from "../errors.js";
import { asArgs } from "../input.js";
import { permits, type Gate } from "../gate.js";
import { DESTRUCTIVE, type Outcome, type ToolDef } from "./types.js";

/**
 * The apply half of the plan/apply split. Everything here is behind the gate,
 * and the gate is checked before a byte is read.
 *
 * The apply tools are **listed in `tools/list` even when writes are disabled**
 * and return a tool error when called, rather than being hidden: the error
 * text tells the human operator exactly what to do, and a tool that vanishes
 * tells them nothing. `destructiveHint: true` is on them in **both** states,
 * because the annotation describes the tool and not the session.
 */

const STALE_PLAN = "the document changed since this plan was computed — re-run visimark_fmt";
const STALE_INFER_PLAN =
  "the document changed since this plan was computed — re-run visimark_infer";

const planSchema = (what: string): Record<string, unknown> => ({
  type: "object",
  properties: {
    path: {
      type: "string",
      description: "The document to write. There is nothing to apply to a string.",
    },
    plan: {
      type: "object",
      description: `The result of ${what}, unedited apart from dropping entries you rejected.`,
    },
  },
  required: ["path", "plan"],
  additionalProperties: false,
});

interface Opened {
  readonly path: string;
  readonly source: string;
  readonly plan: Record<string, unknown>;
}

/**
 * Gate, then arguments, then the staleness guard — in that order, so a request
 * that was never allowed is refused before the filesystem is touched at all.
 *
 * The digest comes from `ReaderPort.readSealed`: a single indivisible
 * open-read-close-hash, built for exactly this class of problem. `fs/reader.ts`
 * documents why it must stay one call — anything that re-resolves the name
 * between the hash and the write reopens the gap the guard exists to close.
 */
function open(gate: Gate, args: unknown, staleMessage: string): Opened | Fault {
  const a = asArgs(args);
  const path = a["path"];
  if (typeof path !== "string") return fault("USAGE", "visimark: give path");
  const plan = a["plan"];
  if (typeof plan !== "object" || plan === null) return fault("USAGE", "visimark: give plan");

  const refusal = permits(gate, path);
  if (refusal) return refusal;

  const expected = (plan as Record<string, unknown>)["sha256"];
  if (typeof expected !== "string") {
    return fault("USAGE", "visimark: plan carries no sha256 — pass the plan you were given");
  }

  const sealed = nodeReader.readSealed(path);
  if (!sealed) return fault("READ", `visimark: cannot read ${path}`);
  if (sealed.sha256 !== expected) return fault("WRITE", staleMessage);

  return { path, source: sealed.text, plan: plan as Record<string, unknown> };
}

function isFault(v: Opened | Fault): v is Fault {
  return "code" in v;
}

// --- visimark_fmt_apply ------------------------------------------------------

const fmtApply: ToolDef = {
  name: "visimark_fmt_apply",
  title: "Apply a VisiMark repair",
  description:
    "Land the plan `visimark_fmt` returned: splice the document's computed cells and anchors, " +
    "and write the generated artifacts it named. Refused if the document changed since the " +
    "plan was computed, and refused entirely unless the operator started the server with " +
    "`--allow-write` and the host declared a root.",
  inputSchema: planSchema("`visimark_fmt`"),
  annotations: DESTRUCTIVE,
  run: () => ({ fault: fault("WRITE", "visimark: gate not bound") }),
};

function runFmtApply(gate: Gate, args: unknown): Outcome {
  const opened = open(gate, args, STALE_PLAN);
  if (isFault(opened)) return { fault: opened };
  const { path, source, plan } = opened;

  const result = check(build(locate(source)), { doc: onDisk(path) });

  // The plan is what gets applied: the document's edits are spliced from the
  // plan the agent reviewed, not from a fresh one. Re-planning cannot go stale
  // by construction — the digest already proved the source is byte-identical —
  // but it would mean the reviewed plan is not what lands, which undercuts the
  // entire point of the split.
  const edits = planEdits(plan);
  if (edits === undefined) {
    return {
      fault: fault("USAGE", "visimark: plan carries no edits — pass the plan you were given"),
    };
  }

  // Artifacts cannot travel in the plan — their bytes are the rendered SVG —
  // so they are re-derived from the same unchanged source, and the set of
  // paths is checked against the set the caller was shown. Nothing is written
  // that the caller did not see named first (§3.4).
  const artifacts = collectArtifacts(result);
  const named = new Set(asStrings(plan["artifactsWouldWrite"]));
  const willWrite = new Set(artifacts.map((a) => a.path ?? a.target));
  for (const p of willWrite) {
    if (!named.has(p)) {
      return { fault: fault("WRITE", `visimark: ${p} was not in the plan — re-run visimark_fmt`) };
    }
  }
  // And the other direction, which is the one that bites. A target the plan
  // named but this run will no longer write has changed since the plan was
  // computed — someone put a file there, or it stopped being ours. Without
  // this check it is dropped in silence and the call reports success, leaving
  // a document whose numbers moved and whose chart did not.
  for (const p of named) {
    if (!willWrite.has(p)) {
      return {
        fault: fault(
          "WRITE",
          `visimark: ${p} was in the plan but can no longer be written${reasonFor(result, p)}` +
            " — re-run visimark_fmt",
        ),
      };
    }
  }

  // Every refusal that can be decided before a byte moves is decided above, so
  // a rejected target does not leave half the charts written. Then the
  // artifacts, and the document only if every one of them landed: on a refused
  // artifact the document is left **unspliced**, because a partly-applied
  // `fmt` is worse than none. This is the order the CLI already uses.
  for (const a of artifacts) {
    const outside = permits(gate, a.target);
    if (outside) return { fault: outside };
  }

  let artifactsWritten = 0;
  for (const a of artifacts) {
    mkdirSync(dirname(a.target), { recursive: true });
    const w = writeArtifact(a);
    if ("err" in w) return { fault: fault("WRITE", `visimark: ${w.err}`) };
    artifactsWritten++;
  }

  const output = applyEdits(source, edits);
  const changed = output !== source;
  if (changed) writeFileSync(path, output);

  return {
    ok: okEnvelope("fmt", {
      file: path,
      applied: true,
      changed,
      cellsUpdated: countIn(plan, "cellsUpdated"),
      anchorsUpdated: countIn(plan, "anchorsUpdated"),
      artifactsWritten,
    }),
  };
}

/**
 * The artifacts a `fmt` would write. `check` renders each chart's SVG as it
 * goes, so this reads the run that already happened rather than planning a
 * second one — the same list `write/fmt.ts` builds, by the same rule: a chart
 * carrying an ARTIFACT error is not written at all.
 */
function collectArtifacts(result: ReturnType<typeof check>) {
  const out: {
    target: string;
    svg: string;
    path: string | null;
    state: "missing" | "stale";
    sheetId: string;
    chart: string;
  }[] = [];
  for (const c of result.charts) {
    if ((c.state === "missing" || c.state === "stale") && c.target && c.svg) {
      out.push({
        target: c.target,
        svg: c.svg,
        path: c.path,
        state: c.state,
        sheetId: c.sheetId,
        chart: c.name,
      });
    }
  }
  return out;
}

function planEdits(
  plan: Record<string, unknown>,
): { start: number; end: number; text: string }[] | undefined {
  const raw = plan["edits"];
  if (!Array.isArray(raw)) return undefined;
  const edits: { start: number; end: number; text: string }[] = [];
  for (const e of raw) {
    if (
      typeof e !== "object" ||
      e === null ||
      typeof (e as Record<string, unknown>)["start"] !== "number" ||
      typeof (e as Record<string, unknown>)["end"] !== "number" ||
      typeof (e as Record<string, unknown>)["text"] !== "string"
    ) {
      return undefined;
    }
    const r = e as Record<string, unknown>;
    edits.push({ start: r["start"] as number, end: r["end"] as number, text: r["text"] as string });
  }
  return edits;
}

/**
 * The counts come out of the plan, not out of a fresh run: they are what the
 * caller was shown, and the digest already proved the source they describe did
 * not move. Re-deriving them here would be a second arithmetic that can
 * disagree with the one the agent read.
 */
function countIn(plan: Record<string, unknown>, key: string): number {
  const v = plan[key];
  return typeof v === "number" ? v : 0;
}

/** What `check` now says about a chart the plan named, for the refusal line. */
function reasonFor(result: ReturnType<typeof check>, path: string): string {
  const chart = result.charts.find((c) => c.path === path || c.target === path);
  if (!chart) return "";
  const finding = result.findings.find((f) => f.artifact === path && f.message);
  if (finding?.message) return ` (${finding.message})`;
  return ` (${chart.state})`;
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// --- visimark_infer_apply ----------------------------------------------------

const inferApply: ToolDef = {
  name: "visimark_infer_apply",
  title: "Apply proposed VisiMark rules",
  description:
    "Insert the `vmark` rules `visimark_infer` proposed. Pass the plan you were given, with " +
    "any proposal you rejected removed. Refused if the document changed since the plan was " +
    "computed, and refused entirely unless the operator started the server with " +
    "`--allow-write` and the host declared a root.",
  inputSchema: planSchema("`visimark_infer`"),
  annotations: DESTRUCTIVE,
  run: () => ({ fault: fault("WRITE", "visimark: gate not bound") }),
};

function runInferApply(gate: Gate, args: unknown): Outcome {
  const opened = open(gate, args, STALE_INFER_PLAN);
  if (isFault(opened)) return { fault: opened };
  const { path, source, plan } = opened;

  // A proposal's internal shape does not survive the envelope, so the accepted
  // set is matched back by `(kind, sheet, name)` against a fresh `infer` over
  // the same bytes. Deterministic, because the digest already proved the
  // source did not move — and it is still the agent's reviewed list that
  // lands, because anything it dropped is dropped here too.
  const accepted = acceptedKeys(plan);
  if (accepted === undefined) {
    return {
      fault: fault("USAGE", "visimark: plan carries no proposals — pass the plan you were given"),
    };
  }
  const all = infer(source);
  const proposals = all.filter((p) => accepted.has(keyOf(p)));

  // `planInfer` with nothing to insert writes the `no-formulas` marker, which
  // is the right answer for a document that has nothing to derive and the
  // wrong one for a document whose proposals the agent read and declined. Only
  // the first of those reaches it.
  if (proposals.length === 0 && all.length > 0) {
    return {
      ok: okEnvelope("infer", {
        file: path,
        applied: true,
        changed: false,
        blocks: 0,
        anchors: 0,
        marker: false,
      }),
    };
  }

  const edits = planInfer(source, proposals);
  if (edits.length === 0) {
    return {
      ok: okEnvelope("infer", {
        file: path,
        applied: true,
        changed: false,
        blocks: 0,
        anchors: 0,
        marker: false,
      }),
    };
  }
  writeFileSync(path, applyEdits(source, edits));
  return {
    ok: okEnvelope("infer", {
      file: path,
      applied: true,
      changed: true,
      blocks: edits.filter((e) => e.kind === "block").length,
      anchors: edits.filter((e) => e.kind === "anchor").length,
      marker: edits.some((e) => e.kind === "marker"),
    }),
  };
}

function keyOf(p: Pick<Proposal, "kind" | "sheetId" | "name">): string {
  return `${p.kind}\u0000${p.sheetId}\u0000${p.name}`;
}

function acceptedKeys(plan: Record<string, unknown>): Set<string> | undefined {
  const raw = plan["proposals"];
  if (!Array.isArray(raw)) return undefined;
  const keys = new Set<string>();
  for (const p of raw) {
    const r = p as Record<string, unknown>;
    if (typeof r["kind"] !== "string" || typeof r["name"] !== "string") return undefined;
    keys.add(
      `${r["kind"] as string}\u0000${(r["sheet"] as string) ?? ""}\u0000${r["name"] as string}`,
    );
  }
  return keys;
}

/**
 * The apply tools, bound to a gate. They are returned whatever the gate's
 * state — listed and erroring, never hidden — so that a host shows the
 * operator a tool whose refusal says what to do about it.
 */
export function writeTools(gate: Gate): readonly ToolDef[] {
  return [
    { ...fmtApply, run: (args: unknown) => runFmtApply(gate, args) },
    { ...inferApply, run: (args: unknown) => runInferApply(gate, args) },
  ];
}

export const WRITE_TOOL_NAMES = [fmtApply.name, inferApply.name] as const;
