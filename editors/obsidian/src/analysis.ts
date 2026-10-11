import {
  analyseWithSnapshot as analyseCore,
  type SnapshotAnalysis as CoreSnapshotAnalysis,
} from "codemirror-visimark/analysis.js";
import { reportFor, type NoteReport } from "./report.js";
import type { VaultRead } from "./snapshot.js";

export { analyse, locatedFor, type Analysis } from "codemirror-visimark/analysis.js";

/** The package's snapshot analysis plus the findings view's report, computed once per fetch. */
export interface SnapshotAnalysis extends CoreSnapshotAnalysis {
  readonly report: NoteReport;
}

/**
 * Keyed on the package's own promise: concurrent callers for one
 * `(path, source, read)` already share that promise (every section of one
 * reading-mode render), so they share one `reportFor` too. A `WeakMap` lets
 * the entry go when the package drops the promise.
 */
const withReport = new WeakMap<Promise<CoreSnapshotAnalysis>, Promise<SnapshotAnalysis>>();

export function analyseWithSnapshot(
  source: string,
  path: string,
  read: VaultRead,
): Promise<SnapshotAnalysis> {
  const core = analyseCore(source, path, read);
  let out = withReport.get(core);
  if (out === undefined) {
    out = core.then((c) => ({ ...c, report: reportFor(c.model, c.result, c.doc) }));
    withReport.set(core, out);
  }
  return out;
}
