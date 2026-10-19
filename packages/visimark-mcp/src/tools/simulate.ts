import { build, check, locate, simulateRun } from "visimark";
import { fault } from "../errors.js";
import { CONTENT_SOURCE, skipped, type Status } from "../envelope.js";
import { DOC_FIELDS, asArgs, resolveInput } from "../input.js";
import { engineVersion } from "../version.js";
import { READ_ONLY, docInputSchema, type ToolDef } from "./types.js";

/**
 * `visimark_simulate`, the twin of `visimark simulate FILE` (#330). The result
 * is the envelope carrying the CLI's own lines as `stdout` and `stderr`: they
 * are for reading, not parsing. The elapsed time is left off the summary line,
 * so two calls on one text return one result.
 */

/** Thrown from the plan callback, before any question runs. */
class OverLimit extends Error {}

export interface SimulateLimits {
  /** `--max-questions`: absent means no cap */
  readonly maxQuestions: number | undefined;
}

export function simulateTool(limits: SimulateLimits): ToolDef {
  return {
    name: "visimark_simulate",
    title: "Simulate a VisiMark document's lattices",
    description:
      "Ask every question the document's `lattice` params declare, plus the base, and return " +
      "what its `report` statements ask for: the same lines `visimark simulate` prints, as " +
      "`stdout`, with its progress and fault lines as `stderr`. The lines are for reading, " +
      "not parsing, and carry no elapsed time. Give `failOnFault` to make a report sheet that " +
      "cannot start a `problems` result. A document with no `report` statement is `problems`. " +
      "The call runs the whole sweep before it returns. A document given as `content` has no " +
      "directory, so a sheet that reads an imported value cannot start; `skipped` names the " +
      "imports and charts that were not checked.",
    inputSchema: docInputSchema({
      failOnFault: {
        type: "boolean",
        description: "Report `problems` when a report sheet cannot start. Default false.",
      },
    }),
    annotations: READ_ONLY,
    run(args) {
      const r = resolveInput(args, DOC_FIELDS);
      if ("code" in r) return { fault: r };
      const failOnFault = asArgs(args)["failOnFault"];
      if (failOnFault !== undefined && typeof failOnFault !== "boolean") {
        return { fault: fault("USAGE", "visimark: failOnFault must be a boolean") };
      }
      const label = r.file ?? CONTENT_SOURCE;
      const cap = limits.maxQuestions;
      let run: ReturnType<typeof simulateRun>;
      try {
        run = simulateRun(r.source, label, {
          ...(r.doc ? { doc: r.doc } : {}),
          onPlan: ({ questions }) => {
            if (cap !== undefined && questions > cap) {
              throw new OverLimit(
                `visimark: ${label} has ${questions} questions, over this server's limit of ${cap} (--max-questions)`,
              );
            }
          },
        });
      } catch (e) {
        if (e instanceof OverLimit) return { fault: fault("LIMIT", e.message) };
        throw e;
      }
      const status: Status =
        run.noReport || (failOnFault === true && run.blocked > 0) ? "problems" : "ok";
      return {
        ok: {
          command: "simulate",
          visimark: engineVersion(),
          status,
          file: label,
          stdout: run.stdout,
          stderr: run.stderr.map((l) => l.text),
          skipped: skipped(check(build(locate(r.source)), r.doc ? { doc: r.doc } : {})),
        },
      };
    },
  };
}
