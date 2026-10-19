// The playground's `visimark simulate FILE`: `cmdSimulate` (../cli/commands.ts)
// for one in-memory document. Like `pgEval` it returns what the CLI would
// print rather than printing it, so the SIMULATION tab gets stdout and TERMINAL
// gets stderr, as a shell would give them. No progress line: a pass is
// synchronous, so nothing could paint between questions.
import type { CheckOptions } from "../eval/check.js";
import { elapsedText } from "../report/simulate.js";
import { simulateRun, type SimulateRun } from "../report/simulate-run.js";

export interface PgSimulateOptions extends Pick<CheckOptions, "doc"> {
  /** a monotonic millisecond clock, for the elapsed time on the summary line */
  now?: () => number;
}

export type PgSimulateResult = Pick<SimulateRun, "stdout" | "stderr">;

export function pgSimulate(
  source: string,
  label: string,
  opts: PgSimulateOptions = {},
): PgSimulateResult {
  const now = opts.now ?? (() => performance.now());
  const started = now();
  const { stdout, stderr } = simulateRun(source, label, {
    ...(opts.doc ? { doc: opts.doc } : {}),
    elapsed: () => elapsedText(now() - started),
  });
  return { stdout, stderr };
}
