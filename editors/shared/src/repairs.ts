import {
  planFmt,
  type CheckResult,
  type DocModel,
  type DocumentFile,
  type Edit,
  type Finding,
} from "visimark";

/**
 * Every edit `fmt` would make to a note, and which finding each one repairs —
 * split out of the Obsidian plugin's `report.ts` (#384) so the Joplin plugin
 * applies the same bytes. Both plugins' Format equals `visimark fmt` because
 * both are this one `planFmt` call.
 *
 * **The repair is per-finding.** `planFmt` returns `PlannedEdit`s that each
 * carry the `Finding` they came from, so a row or a quick fix can offer
 * exactly the edits that fix *it* and nothing else.
 */

export interface RepairOptions {
  /**
   * Mirrors the CLI's `fmt --fix-dates`: include the edit for a `DATE`
   * finding whose ISO form is decidable. Off by default, same as the flag.
   */
  fixDates?: boolean;
  /**
   * The note's snapshot when it reads anything, so the artifact phase knows
   * where the document lives. **`noArtifacts` is always on**: neither plugin
   * has a write port for a chart, and declining the write does not silence
   * the finding (the shipped `--no-artifacts` contract).
   */
  doc?: DocumentFile;
}

export interface Repairs {
  /** the edits that repair each finding, keyed by the result's own `Finding` */
  byFinding: Map<Finding, Edit[]>;
  /**
   * Every edit, artifacts declined. Not the concatenation of `byFinding`:
   * `planFmt` can produce an edit whose finding is not in `result.findings`
   * at all, and that edit still belongs in a fix-all.
   */
  all: Edit[];
}

export function planRepairs(
  model: DocModel,
  result: CheckResult,
  opts: RepairOptions = {},
): Repairs {
  const planned = planFmt(model, result, {
    noArtifacts: true,
    fixDates: opts.fixDates ?? false,
    ...(opts.doc ? { doc: opts.doc } : {}),
  });

  const bare = (e: Edit): Edit => ({ start: e.start, end: e.end, text: e.text });

  /**
   * **Not every planned edit belongs to a finding the result reports.**
   * `planFmt` looks its finding up by span, and the engine collapses every
   * drifted prose anchor into one finding *with no span* — there is no single
   * place to point at. Those edits come back carrying a synthetic
   * `{ code: "STALE" }` that is in no result, so identity matching drops them,
   * and a reader who pressed every button in the list would be left with a
   * note the CLI still calls stale.
   *
   * They belong to the collapsed anchor row, which is the one spanless `STALE`
   * in the result. Found rather than assumed: if there is not exactly one,
   * the edits stay in `all` and no finding claims them, because a repair
   * that fixes something its finding does not name is worse than none.
   */
  const anchorGroup = result.findings.filter((f) => f.code === "STALE" && f.span === undefined);
  const adopt = anchorGroup.length === 1 ? anchorGroup[0]! : null;
  const known = new Set<Finding>(result.findings);

  const byFinding = new Map<Finding, Edit[]>();
  for (const edit of planned) {
    const owner = known.has(edit.finding) ? edit.finding : adopt;
    if (owner === null) continue;
    const list = byFinding.get(owner);
    if (list) list.push(bare(edit));
    else byFinding.set(owner, [bare(edit)]);
  }

  return { byFinding, all: planned.map(bare) };
}
