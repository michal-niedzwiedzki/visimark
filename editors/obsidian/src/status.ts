import { isClean, type NoteReport } from "./report.js";

/**
 * What the status bar says — v1 row 12 of #176, and its justification is that
 * it is "what makes rows 2 and 6 findable at all". A findings view nobody
 * knows is there is a findings view nobody opens.
 *
 * **It is a sentence fragment, not a tally.** v1 constraint 6 forbids the
 * report's vocabulary — no red, no `STALE`, no "1 problem (1 stale, 0
 * errors)". A count is not forbidden and is the useful part; what is
 * forbidden is the shape that means nothing to someone who has never seen a
 * build log. "3 need attention" is a count. "3 problems (3 stale, 0 errors)"
 * is a report.
 *
 * **Advice never changes the state.** The engine's own `isProblem` splits
 * them, and a note whose only finding is "defined but never used" is a note
 * that agrees with itself. Saying otherwise would train a reader to ignore
 * the status bar, which is the one failure it cannot recover from.
 */

export interface Status {
  /** what the status bar reads */
  readonly text: string;
  /** the fuller sentence, for a screen reader and for a pointer at rest */
  readonly detail: string;
  /**
   * The same four states, named rather than parsed out of `text` — for
   * `main.ts`'s mobile witness (#232), which has an icon to pick and no
   * string to render one from.
   */
  readonly kind: "hidden" | "clean" | "problems" | "unknown";
}

/** The note has no ```vmark block: the plugin shows nothing at all (§2.3). */
export const HIDDEN: Status = { text: "", detail: "", kind: "hidden" };

export function statusFor(report: NoteReport): Status {
  const problems = report.problems.length;
  const advice = report.advice.length;

  if (problems === 0) {
    const detail = isClean(report)
      ? "Everything in this note agrees with its formulas."
      : `Everything in this note agrees with its formulas. ${advice} ${advice === 1 ? "note is" : "notes are"} worth knowing about.`;
    return { text: "VisiMark ✓", detail, kind: "clean" };
  }

  return {
    text: `VisiMark · ${problems} to look at`,
    detail:
      `${problems} ${problems === 1 ? "thing needs" : "things need"} attention in this note.` +
      (advice > 0 ? ` ${advice} more ${advice === 1 ? "is" : "are"} worth knowing.` : ""),
    kind: "problems",
  };
}

/** The note could not be checked — §3.1: never a clean verdict for one that failed. */
export const UNKNOWN: Status = {
  text: "VisiMark · ?",
  detail: "This note could not be checked, so nothing here is a verdict about it.",
  kind: "unknown",
};
