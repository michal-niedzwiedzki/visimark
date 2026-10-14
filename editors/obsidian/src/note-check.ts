import { check } from "visimark";
import type { CheckNote } from "visimark-editor-shared/sweep.js";
import { reportFor, type NoteReport } from "./report.js";
import { readNote, type VaultRead } from "./snapshot.js";

/**
 * What checking one vault note means to this plugin: read its declared
 * imports through the vault, check it, and build the findings view's report.
 * The sweep (`sweep.ts`) and the health index (`vault-index.ts`) both use
 * this one function, so the badge and the sweep cannot disagree about a note.
 *
 * Problems and advice are the report's rows, so a note's count is the number
 * of rows its findings view shows.
 */
export function noteChecker(read: VaultRead): CheckNote<NoteReport> {
  return async (text, path) => {
    const { model, snapshot } = await readNote(text, path, read);
    const doc = { path: snapshot.path, reader: snapshot.reader };
    const report = reportFor(model, check(model, { doc }), doc);
    return { problems: report.problems.length, advice: report.advice.length, detail: report };
  };
}
