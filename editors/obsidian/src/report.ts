import {
  planFmt,
  type CheckResult,
  type DocModel,
  type DocumentFile,
  type Edit,
  type Finding,
  type Span,
} from "visimark";
import { forReader, type ReaderFinding } from "./findings.js";

/**
 * What the findings view shows, computed without any reference to Obsidian.
 *
 * **Why this is a separate module from the view.** Everything interesting
 * about the findings view is a question about a document — which findings are
 * rows, which of them the reader can act on, and what acting does to the bytes
 * — and none of it is a question about a pane. Split this way, the answers are
 * testable against the CLI, and what is left in `findings-view.ts` is DOM.
 *
 * **The repair is per-finding, and that is the whole reason this is not just
 * a list.** `planFmt` returns `PlannedEdit`s that each carry the `Finding`
 * they came from, so a row can offer exactly the edits that fix *it* and
 * nothing else. `report.test.ts` pins the property that makes that trustworthy:
 * applying every row's repair together produces the same bytes as running
 * `fmt` over the whole document.
 */

export interface FindingRow {
  /** the finding in audience-B words — `findings.ts`, spec §3.2 */
  reader: ReaderFinding;
  /**
   * The engine's own finding, for the detail popover and for anything that
   * needs to identify a row across an edit: `name` and `rowLabel` survive a
   * repair, and `span` does not — every offset after an edit moves.
   *
   * §3.2 is what keeps this from leaking: the code and the engine's wording
   * belong in the popover for someone who goes looking, and never in a row.
   */
  finding: Finding;
  /** where in the note it is, for a click that jumps there */
  span: Span | null;
  /** the edits that repair exactly this one, or `null` when nothing can */
  repair: Edit[] | null;
}

export interface NoteReport {
  /** things to fix, in document order */
  problems: FindingRow[];
  /** advice — reported, never counted, never the reason anything failed */
  advice: FindingRow[];
  /**
   * Every edit `fmt` would make to this note, artifacts declined.
   *
   * Not the concatenation of the rows' repairs: `planFmt` can produce an edit
   * whose finding is not in `result.findings` at all, and that edit still has
   * to be in a fix-all. Row 7's business; kept here because it is the same
   * plan, computed once.
   */
  allRepairs: Edit[];
}

/** `true` when there is nothing to show — the status bar's "checked" state. */
export function isClean(report: NoteReport): boolean {
  return report.problems.length === 0 && report.advice.length === 0;
}

const start = (f: FindingRow): number => f.span?.start ?? Number.MAX_SAFE_INTEGER;

/**
 * Build the view's model.
 *
 * `doc` is the snapshot from `snapshot.ts` when the note reads anything, and
 * absent when it does not. It is passed to `planFmt` for the same reason
 * `check` gets it — the artifact phase needs to know where the document lives
 * — and **`noArtifacts` is always on**: v1 has no vault-backed write port, so
 * the plugin never writes a chart. Declining the write does not silence the
 * finding, which is the shipped `--no-artifacts` contract (spec §2.5, §8), and
 * it is why a stale chart still gets a row here with no repair on it.
 */
export function reportFor(model: DocModel, result: CheckResult, doc?: DocumentFile): NoteReport {
  const planned = planFmt(model, result, { noArtifacts: true, ...(doc ? { doc } : {}) });

  const bare = (e: Edit): Edit => ({ start: e.start, end: e.end, text: e.text });

  /**
   * **Not every planned edit belongs to a finding the view shows.**
   * `planFmt` looks its finding up by span, and the engine collapses every
   * drifted prose anchor into one finding *with no span* — there is no single
   * place to point at. Those edits come back carrying a synthetic
   * `{ code: "STALE" }` that is in no result, so identity matching drops them,
   * and a reader who pressed every button in the list would be left with a
   * note the CLI still calls stale.
   *
   * They belong to the collapsed anchor row, which is the one spanless `STALE`
   * in the result. Found rather than assumed: if there is not exactly one,
   * the edits stay in `allRepairs` and no row claims them, because a repair
   * button that fixes something the row does not name is worse than a missing
   * button.
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

  const problems: FindingRow[] = [];
  const advice: FindingRow[] = [];

  for (const finding of result.findings) {
    const reader = forReader(finding);
    if (reader === null) continue; // NOTE is not a row
    const edits = reader.action?.kind === "repair" ? (byFinding.get(finding) ?? null) : null;
    const row: FindingRow = {
      reader,
      finding,
      span: finding.span ?? null,
      repair: edits !== null && edits.length > 0 ? edits : null,
    };
    (reader.severity === "problem" ? problems : advice).push(row);
  }

  problems.sort((a, b) => start(a) - start(b));
  advice.sort((a, b) => start(a) - start(b));

  return {
    problems,
    advice,
    allRepairs: planned.map(bare),
  };
}
