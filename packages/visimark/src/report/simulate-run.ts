// `visimark simulate` for one document, as the lines it prints. The CLI
// (`cmdSimulate`), the playground (`pgSimulate`) and `visimark_simulate` in
// visimark-mcp each used to assemble these from `simulate()` and the
// renderers; they now call this, so the three cannot drift apart.
import { simulate } from "../eval/simulate.js";
import type { CheckOptions } from "../eval/check.js";
import { describeFinding } from "./format.js";
import { renderBlocked, renderSheet } from "./simulate.js";

export interface SimulateRunOptions extends Pick<CheckOptions, "doc"> {
  /** called once the grid is planned, before any question runs; it may throw to stop the run */
  onPlan?: (plan: { questions: number; latticeParams: number }) => void;
  /** called with the plan's stderr line as soon as it is known, for a caller that streams */
  onPlanLine?: (line: string) => void;
  /** called after each question, 1-based */
  onQuestion?: (i: number, n: number) => void;
  /** the elapsed time for the summary line; omit it and the line carries none */
  elapsed?: () => string;
}

export interface SimulateRun {
  /** what the CLI writes to stdout: the readings, line by line */
  stdout: string[];
  /** what it writes to stderr; `fault` marks a sheet that could not start */
  stderr: { text: string; fault?: true }[];
  /** the document has no `report` statement, so nothing was evaluated */
  noReport: boolean;
  /** sheets with a `report`, and how many of them could not start */
  sheets: number;
  blocked: number;
}

export function simulateRun(
  source: string,
  label: string,
  opts: SimulateRunOptions = {},
): SimulateRun {
  const stdout: string[] = [];
  const stderr: SimulateRun["stderr"] = [];
  const sim = simulate(source, {
    ...(opts.doc ? { doc: opts.doc } : {}),
    onPlan: (plan) => {
      const questions = plan.gridBuilt ? plan.gridSize + 1 : 0;
      opts.onPlan?.({ questions, latticeParams: plan.latticeCount });
      const line = `simulate: ${label}: ${questions} questions (${plan.latticeCount} lattice params)`;
      stderr.push({ text: line });
      opts.onPlanLine?.(line);
    },
    ...(opts.onQuestion ? { onQuestion: opts.onQuestion } : {}),
  });
  if (sim.reportSheets.length === 0) {
    stderr.push({ text: `simulate: ${label}: no report statement` });
    return { stdout, stderr, noReport: true, sheets: 0, blocked: 0 };
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
  const took = opts.elapsed ? ` in ${opts.elapsed()}` : "";
  stderr.push({
    text: `simulate: ${label}: ${ran} of ${sim.reportSheets.length} sheets ran${took}`,
  });
  return {
    stdout,
    stderr,
    noReport: false,
    sheets: sim.reportSheets.length,
    blocked: sim.blocked.length,
  };
}
