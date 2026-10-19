import type { CheckResult, DocModel, DocumentFile, Edit, Finding, Span } from "visimark";
import { planRepairs } from "visimark-editor-shared/repairs.js";
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

export interface ReportOptions {
  /**
   * Mirrors the CLI's `fmt --fix-dates` (v1.1 row 17): include the edit for
   * a `DATE` finding whose ISO form is decidable. Off by default, same as
   * the CLI flag it mirrors. **Only `allRepairs` sees it** — `actionFor`
   * (`findings.ts`) still restricts the per-row repair button to `STALE`,
   * so a decidable date never grows a row of its own; it is picked up
   * whole-note by Format, the same way the CLI flag is whole-run rather
   * than per-finding.
   */
  fixDates?: boolean;
}

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
export function reportFor(
  model: DocModel,
  result: CheckResult,
  doc?: DocumentFile,
  opts: ReportOptions = {},
): NoteReport {
  // the plan, including the anchor-group adoption, is shared with the Joplin
  // plugin (#384) so both apply the bytes `fmt` would
  const { byFinding, all } = planRepairs(model, result, {
    fixDates: opts.fixDates ?? false,
    ...(doc ? { doc } : {}),
  });

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
    allRepairs: all,
  };
}
