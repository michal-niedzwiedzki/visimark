import {
  applyScenario,
  build,
  check,
  closest,
  describeFunction,
  explainJson,
  explainView,
  fmt,
  functionNames,
  infer,
  inferSummary,
  listParams,
  locate,
  parseScenarioJson,
  planFmt,
  publicAssertions,
  publicCharts,
  publicFnEntry,
  publicProposal,
  resolveScenario,
  ScenarioError,
  evalValues,
  type DocModel,
  type ParamInfo,
} from "visimark";
import { fault, type Fault } from "../errors.js";
import {
  CONTENT_SOURCE,
  envelope,
  findingSummary,
  findings,
  okEnvelope,
  skipped,
  type Status,
} from "../envelope.js";
import {
  DOC_FIELDS,
  SCENARIO_FIELDS,
  asArgs,
  resolveInput,
  resolveOptionalInput,
  type Resolved,
} from "../input.js";
import { engineVersion } from "../version.js";
import { READ_ONLY, docInputSchema, type Outcome, type ToolDef } from "./types.js";

/**
 * The six read tools. Every one of them is `readOnlyHint: true`,
 * `destructiveHint: false` — `fmt` and `infer` included, because planning is
 * not writing. They return the edits they would make and never touch disk;
 * the apply half is task 6's, behind the gate.
 *
 * **No tool description carries a count.** `docs/function-reference.md` is
 * generated from `lang/reference.ts` and CI regenerates it; a hand-written
 * description here is not in that loop, and "all fifteen builtins" was already
 * wrong when #169 was filed (spec §2.2).
 */

/** What `fmt` repairs, stated once. Bounded, and the bound is the reassurance. */
const FMT_BLAST_RADIUS =
  "It repairs stale computed values, anchors and generated artifacts, and nothing else — " +
  "never prose, never a column with no rule, never any other finding class.";

/** What `content` mode cannot see, stated once. */
const CONTENT_CAVEAT =
  "A document given as `content` has no directory, so imports and generated artifacts " +
  "cannot be verified; `skipped` names the ones that were not checked.";

function isFault(v: Resolved | Fault): v is Fault {
  return "code" in v;
}

function run(args: unknown, body: (r: Resolved) => Outcome): Outcome {
  const r = resolveInput(args, DOC_FIELDS);
  return isFault(r) ? { fault: r } : body(r);
}

// --- visimark_ref ------------------------------------------------------------
// First, deliberately: it reads no file at all, which makes it trivially safe
// and a clean shakedown of the whole result path.

const ref: ToolDef = {
  name: "visimark_ref",
  title: "VisiMark function reference",
  description:
    "Look up VisiMark's builtin functions: signature, arity, precision, errors and examples. " +
    "Give `name` to look it up, or omit `name` for the whole reference. Reads no file.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "A builtin's name, e.g. `SUM`. Omit for the whole reference.",
      },
    },
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  run(args) {
    const name = asArgs(args)["name"];
    if (name === undefined) {
      const all = functionNames().map((n) => describeFunction(n)!);
      return { ok: okEnvelope("ref", { functions: all.map(publicFnEntry) }) };
    }
    if (typeof name !== "string")
      return { fault: fault("USAGE", "visimark: name must be a string") };
    const entry = describeFunction(name);
    if (!entry) {
      // The CLI's wording and its did-you-mean, from the same `closest` call,
      // so a misspelling reads the same way on both surfaces.
      const guess = closest(name, functionNames(), 3);
      return {
        fault: fault(
          "USAGE",
          `visimark: unknown function \`${name}\`` + (guess ? ` — did you mean \`${guess}\`?` : ""),
        ),
      };
    }
    return { ok: okEnvelope("ref", { function: publicFnEntry(entry) }) };
  },
};

// --- visimark_check ----------------------------------------------------------

const checkTool: ToolDef = {
  name: "visimark_check",
  title: "Check a VisiMark document",
  description:
    "Verify that every computed number in a Markdown document still agrees with the formula " +
    "that produced it, and report what does not. Findings are a successful result, not an " +
    "error. " +
    CONTENT_CAVEAT,
  inputSchema: docInputSchema(),
  annotations: READ_ONLY,
  run: (args) =>
    run(args, (r) => {
      const result = check(build(locate(r.source)), { doc: r.doc });
      return {
        ok: envelope(
          "check",
          {
            file: r.file ?? CONTENT_SOURCE,
            findings: findings(r.file, result),
            summary: findingSummary(result.findings),
            skipped: skipped(result),
          },
          result.findings,
        ),
      };
    }),
};

// --- visimark_explain --------------------------------------------------------

const explain: ToolDef = {
  name: "visimark_explain",
  title: "Explain a VisiMark document's structure",
  description:
    "Describe what a document declares: its sheets, input columns, computed rules, anchored " +
    "scalars, derived precision and imports. Give `sheet` to narrow it.",
  inputSchema: docInputSchema({
    sheet: { type: "string", description: "A sheet id, without the leading `#`." },
  }),
  annotations: READ_ONLY,
  run: (args) =>
    run(args, (r) => {
      const sheetArg = asArgs(args)["sheet"];
      if (sheetArg !== undefined && typeof sheetArg !== "string") {
        return { fault: fault("USAGE", "visimark: sheet must be a string") };
      }
      const sheets = sheetArg === undefined ? [] : [sheetArg];
      const model = build(locate(r.source));
      for (const sid of sheets) {
        if (!model.sheets.get(sid)) {
          return { fault: fault("USAGE", `visimark: no sheet #${sid}`) };
        }
      }
      const result = check(model, { doc: r.doc });
      // `explainJson` already produces the whole envelope, command/version/
      // status included. Reused rather than re-derived; `skipped` is the one
      // addition this surface makes (§3.2).
      return {
        ok: {
          ...explainJson(explainView(model, result, sheets), r.file ?? CONTENT_SOURCE),
          skipped: skipped(result),
        },
      };
    }),
};

// --- visimark_eval -----------------------------------------------------------

const evalTool: ToolDef = {
  name: "visimark_eval",
  title: "Evaluate a VisiMark document",
  description:
    "Evaluate a document and return its values, its assertions and its charts. Give `get` to " +
    "select a single named value. Give `scenarioPath` or `scenarioContent` to substitute parameters and " +
    "see what moves — a draft scenario against a draft document, with no temp file. " +
    "A false assertion is a successful result reporting problems.",
  inputSchema: docInputSchema({
    get: { type: "string", description: "One value's qualified name, e.g. `lines.gross_total`." },
    scenarioPath: { type: "string", description: "Path to a scenario JSON file." },
    scenarioContent: { type: "string", description: "A scenario as JSON text." },
  }),
  annotations: READ_ONLY,
  run: (args) =>
    run(args, (r) => {
      const a = asArgs(args);
      const model = build(locate(r.source));

      const scenarioIn = resolveOptionalInput(args, SCENARIO_FIELDS);
      if (scenarioIn !== undefined && isFault(scenarioIn)) return { fault: scenarioIn };

      // A scenario is checked in full before anything is evaluated: a fault is
      // an error and no values come back (scenario-params-spec.md §4.2).
      let scenario: { file: string; params: ParamInfo[]; supplied: Set<string> } | null = null;
      if (scenarioIn !== undefined) {
        const label = scenarioIn.file ?? "<scenarioContent>";
        try {
          const resolved = resolveScenario(model, parseScenarioJson(scenarioIn.source, label));
          const params = listParams(model);
          applyScenario(model, resolved);
          scenario = { file: label, params, supplied: new Set(resolved.keys()) };
        } catch (e) {
          if (!(e instanceof ScenarioError)) throw e;
          return { fault: fault("SCENARIO", e.message) };
        }
      }

      const result = check(model);
      const values = evalValues(result);

      const get = a["get"];
      let selected = values;
      if (get !== undefined) {
        if (typeof get !== "string") {
          return { fault: fault("USAGE", "visimark: get must be a string") };
        }
        const qualified = values[get] !== undefined ? get : bareToQualified(model, get);
        const picked = values[get] ?? values[qualified];
        if (picked === undefined) {
          return { fault: fault("USAGE", `visimark: no value named ${get}`) };
        }
        selected = { [get]: picked };
      }

      // Under a scenario, each failed assertion also says how it fares on the
      // defaults — "these assumptions break it" vs "it was already broken".
      let onDefaults: (("pass" | "fail" | "unverified") | undefined)[] | undefined;
      if (scenario && result.assertions.some((x) => x.holds === false)) {
        const base = check(build(locate(r.source)));
        onDefaults = result.assertions.map((x, i) => {
          if (x.holds !== false) return undefined;
          const d = base.assertions[i]?.holds;
          return d === true ? "pass" : d === false ? "fail" : "unverified";
        });
      }

      // `eval`'s status is its assertions, not its findings: the CLI exits 1
      // when a stated invariant is false and 0 otherwise.
      const status: Status = result.assertions.some((x) => x.holds === false) ? "problems" : "ok";
      return {
        ok: {
          command: "eval",
          visimark: engineVersion(),
          status,
          file: r.file ?? CONTENT_SOURCE,
          ...(scenario ? { scenario: scenarioJson(scenario, values) } : {}),
          values: selected,
          assertions: publicAssertions(result.assertions, onDefaults),
          charts: publicCharts(result.charts, scenario === null),
          skipped: skipped(result),
        },
      };
    }),
};

function scenarioJson(
  scenario: { file: string; params: ParamInfo[]; supplied: Set<string> },
  values: Record<string, unknown>,
): object {
  const params: Record<string, object> = {};
  for (const p of scenario.params) {
    params[p.id] = {
      value: typeof values[p.id] === "string" ? values[p.id] : null,
      default: p.defaultValue,
      source: scenario.supplied.has(p.id) ? "scenario" : "default",
    };
  }
  return { file: scenario.file, params };
}

function bareToQualified(model: DocModel, name: string): string {
  for (const sheet of model.sheets.values()) {
    if (sheet.scalars.has(name) || sheet.columns.has(name)) return `${sheet.id}.${name}`;
  }
  return name;
}

// --- visimark_infer ----------------------------------------------------------

const inferTool: ToolDef = {
  name: "visimark_infer",
  title: "Propose VisiMark rules for a plain table",
  description:
    "Derive the formulas an existing Markdown table already obeys, and propose them as `vmark` " +
    "rules. Run this before hand-authoring rules for a document that already has its numbers. " +
    "Returns proposals only and never writes; `visimark_infer_apply` writes them.",
  inputSchema: docInputSchema(),
  annotations: READ_ONLY,
  run: (args) =>
    run(args, (r) => {
      const proposals = infer(r.source);
      // No `written` key, in either state. `infer` here never writes, and a
      // key that is always `false` invites a reader to look for the case where
      // it is not.
      return {
        ok: okEnvelope("infer", {
          file: r.file ?? CONTENT_SOURCE,
          // The digest travels with the proposals for the same reason it
          // travels with `fmt`'s edits: `visimark_infer_apply` refuses a
          // document that moved since the agent read this list (§3.4).
          sha256: r.sha256,
          proposals: proposals.map(publicProposal),
          summary: inferSummary(proposals),
        }),
      };
    }),
};

// --- visimark_fmt ------------------------------------------------------------

const fmtTool: ToolDef = {
  name: "visimark_fmt",
  title: "Plan a VisiMark repair",
  description:
    "Plan the edits that would bring a document's stored numbers back into agreement with its " +
    "formulas, and name the generated artifacts it would write. Nothing is written: pass the " +
    "returned plan to `visimark_fmt_apply` to land it. " +
    FMT_BLAST_RADIUS +
    " " +
    CONTENT_CAVEAT,
  inputSchema: docInputSchema(),
  annotations: READ_ONLY,
  run: (args) =>
    run(args, (r) => {
      const model = build(locate(r.source));
      const result = check(model, { doc: r.doc });
      const edits = planFmt(model, result, { doc: r.doc });
      // `fmt` splits the same edits into cells, anchors, dates and import
      // stamps; that arithmetic is the engine's and is not re-derived here.
      // The counts travel with the plan so `visimark_fmt_apply` reports the
      // ones the caller reviewed rather than a second set of its own.
      const counts = fmt(r.source, { doc: r.doc });
      return {
        ok: envelope(
          "fmt",
          {
            file: r.file ?? CONTENT_SOURCE,
            sha256: r.sha256,
            edits: edits.map((e) => ({
              start: e.start,
              end: e.end,
              text: e.text,
              code: e.finding.code,
            })),
            cellsUpdated: counts.cellsUpdated,
            anchorsUpdated: counts.anchorsUpdated,
            stampsUpdated: counts.stampsUpdated,
            artifactsWouldWrite: artifactPaths(result),
            findings: findings(r.file, result),
            summary: findingSummary(result.findings),
            skipped: skipped(result),
            applied: false,
          },
          result.findings,
        ),
      };
    }),
};

/**
 * The artifact paths `fmt_apply` would create, as the document named them, so
 * nothing is written that the caller did not see named first (§3.4). A chart
 * that is `current` needs no write; one that was `skipped` could not be looked
 * at and is reported under `skipped` instead.
 */
function artifactPaths(result: ReturnType<typeof check>): string[] {
  const out: string[] = [];
  for (const c of result.charts) {
    if ((c.state === "missing" || c.state === "stale") && c.path) out.push(c.path);
  }
  return out;
}

export const READ_TOOLS: readonly ToolDef[] = [
  ref,
  checkTool,
  explain,
  evalTool,
  inferTool,
  fmtTool,
];
