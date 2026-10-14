import {
  sweep as sweepNotes,
  type SweepOptions,
  type SweepResult as SharedSweepResult,
  type SweepSource,
  type SweptNote as SharedSweptNote,
} from "visimark-editor-shared/sweep.js";
import { noteChecker } from "./note-check.js";
import type { NoteReport } from "./report.js";

/**
 * The vault sweep — v1 row 8 of #176. The loop, the prefilter and the verdict
 * rules live in `visimark-editor-shared/sweep.ts` since #384, where the Joplin
 * plugin's notebook sweep uses them too; this binds them to the vault and to
 * the findings view's report, so each listed note's `detail` is that report.
 */

export type { SweepOptions, SweepSource };
export type SweptNote = SharedSweptNote<NoteReport>;
export type SweepResult = SharedSweepResult<NoteReport>;

export function sweep(source: SweepSource, options: SweepOptions = {}): Promise<SweepResult> {
  return sweepNotes(source, noteChecker(source.read), options);
}
