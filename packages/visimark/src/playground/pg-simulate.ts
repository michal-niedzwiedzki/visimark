// The playground's `visimark simulate FILE`: `cmdSimulate` (../cli/commands.ts)
// for one in-memory document. Like `pgEval` it returns what the CLI would
// print rather than printing it, so the SIMULATION tab gets stdout and TERMINAL
// gets stderr, as a shell would give them. No progress line: a pass is
// synchronous, so nothing could paint between questions.
import { simulate } from "../eval/simulate.js";
import type { CheckOptions } from "../eval/check.js";
import { describeFinding } from "../report/format.js";
import { elapsedText, renderBlocked, renderSheet } from "../report/simulate.js";

export interface PgSimulateOptions extends Pick<CheckOptions, "doc"> {
  /** a monotonic millisecond clock, for the elapsed time on the summary line */
  now?: () => number;
}

export interface PgSimulateResult {
  /** what the CLI writes to stdout: the readings, line by line */
  stdout: string[];
  /** what it writes to stderr; `fault` marks a sheet that could not start */
  stderr: { text: string; fault?: true }[];
}

export function pgSimulate(
  source: string,
  label: string,
  opts: PgSimulateOptions = {},
): PgSimulateResult {
  const now = opts.now ?? (() => performance.now());
  const stdout: string[] = [];
  const stderr: PgSimulateResult["stderr"] = [];
  const started = now();
  const sim = simulate(source, {
    ...(opts.doc ? { doc: opts.doc } : {}),
    onPlan: (plan) => {
      const n = plan.gridBuilt ? plan.gridSize + 1 : 0;
      stderr.push({
        text: `simulate: ${label}: ${n} questions (${plan.latticeCount} lattice params)`,
      });
    },
  });
  if (sim.reportSheets.length === 0) {
    stderr.push({ text: `simulate: ${label}: no report statement` });
    return { stdout, stderr };
  }
  stdout.push(`==> ${label} <==`);
  const blocked = new Map(sim.blocked.map((b) => [b.sheetId, b]));
  for (const sheetId of sim.reportSheets) {
    stdout.push(...(blocked.has(sheetId) ? renderBlocked(sheetId) : renderSheet(sim, sheetId)));
  }
  for (const b of sim.blocked) {
    const f = b.first;
    const where = f.name === undefined ? "" : ` ${f.sheetId ? `${f.sheetId}.${f.name}` : f.name}`;
    const more = b.more > 0 ? ` (and ${b.more} more; run visimark check ${label})` : "";
    stderr.push({
      text: `simulate: ${label}: #${b.sheetId} cannot start: ${f.code}${where}: ${describeFinding(f)}${more}`,
      fault: true,
    });
  }
  const ran = sim.reportSheets.length - sim.blocked.length;
  stderr.push({
    text: `simulate: ${label}: ${ran} of ${sim.reportSheets.length} sheets ran in ${elapsedText(now() - started)}`,
  });
  return { stdout, stderr };
}
