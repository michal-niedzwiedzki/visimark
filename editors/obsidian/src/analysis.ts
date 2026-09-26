import { build, check, locate, type CheckResult, type DocModel, type LocatedDoc } from "visimark";
import { decorationsFor, type Decoration } from "./decorations.js";
import { reportFor, type NoteReport } from "./report.js";
import { readNote, type VaultRead } from "./snapshot.js";

/**
 * One reader-less analysis of a note's source, shared by every caller that
 * would otherwise redo it.
 *
 * **Row 5 of the 2026-09-25 review:** reading mode ran `locate` + `build` +
 * `check` + `decorationsFor` over the whole note **for every rendered
 * section**, because each section's post-processor call only had the note's
 * text to go on. Every one of those calls, across every section of one
 * render, is the same source string — so a one-entry memo keyed on that
 * string turns "once per section" into "once per render" without either
 * caller having to know about the other.
 *
 * **One entry is enough.** Every caller in a single keystroke or a single
 * render passes the same source text, and a second, different note evicts the
 * first before it is ever read again — there is no cross-note benefit to
 * keeping more than one. Keying on the source string itself, compared with
 * `===`, is what keeps this from ever handing one note's analysis to another;
 * keying on a path would not, because a path and its text can go out of sync
 * (an unsaved edit, a stale callback).
 *
 * **This is the reader-less half only.** `check` here runs with no
 * `ReaderPort`, the same limitation `live-preview.ts` already documented, so
 * a value that depends on an import or a chart can read `computed` here even
 * when the snapshot-backed check (`analyseWithSnapshot`, below) would call it
 * `disagrees`. That variant is added beside `analyse`, not folded into it, so
 * the gate and the parts of Live Preview that don't need a reader keep
 * working from this cheap half.
 *
 * **`locate` itself is memoised one step below `analyse`,** and `gate.ts`
 * reads from that step directly. Every caller that finds a block calls
 * `hasVmarkBlock(source)` and then, immediately, `analyse(source)` on the
 * same string — without sharing the parse, that pattern would still cost a
 * whole-note `locate` twice for the first section of every render (CodeRabbit
 * review of PR #264). `locatedFor` is the one place that memo lives, so the
 * two callers can't drift apart.
 */
export interface Analysis {
  readonly source: string;
  readonly located: LocatedDoc;
  readonly model: DocModel;
  readonly result: CheckResult;
  readonly decorations: readonly Decoration[];
}

interface LocateEntry {
  readonly source: string;
  readonly located: LocatedDoc;
}

let locateCache: LocateEntry | null = null;
let cached: Analysis | null = null;

/** `locate(source)`, computed once per distinct source string. */
export function locatedFor(source: string): LocatedDoc {
  if (locateCache !== null && locateCache.source === source) return locateCache.located;
  const located = locate(source);
  locateCache = { source, located };
  return located;
}

/** The reader-less analysis of `source`, computed once per distinct source string. */
export function analyse(source: string): Analysis {
  if (cached !== null && cached.source === source) return cached;
  const located = locatedFor(source);
  const model = build(located);
  const result = check(model);
  const decorations = decorationsFor(model, result);
  cached = { source, located, model, result, decorations };
  return cached;
}

export interface SnapshotAnalysis {
  readonly source: string;
  readonly path: string;
  readonly model: DocModel;
  readonly result: CheckResult;
  readonly decorations: readonly Decoration[];
  readonly report: NoteReport;
}

interface SnapshotEntry {
  readonly key: string;
  readonly read: VaultRead;
  readonly promise: Promise<SnapshotAnalysis>;
}

let snapshotCache: SnapshotEntry | null = null;

/**
 * The snapshot-backed analysis — row 6 of the review. `main.ts`'s
 * `refreshState` and both renderers all want the same answer to "what does
 * this note's own imports make of it", and a status bar that says `disagrees`
 * while a mark next to it says `computed` is exactly the bug this closes: two
 * callers reading the reader-less `analyse` and the vault-backed `check`
 * independently could never promise otherwise.
 *
 * **Cached on `(path, source)`, not `source` alone.** Two different notes can
 * share identical bytes (two copies of the same invoice) and still resolve a
 * relative `from` import to two different files, so the path is part of the
 * key. `\u0000` cannot appear in either half — a vault path and a note's text
 * are both ordinary strings, but neither one is a path separator — so it is a
 * safe join.
 *
 * **The promise itself is the cache entry**, not just its resolved value:
 * every section of one reading-mode render calls this before the first
 * `readNote` round-trip lands, and they must all await the same fetch rather
 * than starting one each. It is cleared again the moment it settles, success
 * or failure alike (CodeRabbit review of PR #265) — this memo is for
 * concurrent callers of one fetch, not a standing cache of the answer. A
 * later call with the same `(path, source)` reads the CSV again, which is
 * what lets a change to the imported file, not just to the note's own text,
 * ever be seen; a rejection surviving past this call would otherwise wedge
 * every future call to the same note behind it.
 *
 * **Keyed on `read` too, not just `(path, source)`.** CodeRabbit review of
 * PR #275: `path` and `source` alone would let two callers with *different*
 * readers — different vaults, or one production reader and one test double —
 * share a cache entry keyed on identical note text, so the second caller
 * could get back an analysis built from the first caller's imported files.
 * The plugin itself only ever builds one `VaultRead` per running instance,
 * but `api.ts` takes its reader as a parameter precisely so it can be
 * exercised against a `Map` in tests, and this module has no way to know a
 * caller won't do that with two. Comparing `read` by reference is cheap and
 * exact: the same closure is the same reader, and a different one is a
 * different reader, with no risk of two distinct readers reading as equal.
 */
export function analyseWithSnapshot(
  source: string,
  path: string,
  read: VaultRead,
): Promise<SnapshotAnalysis> {
  const key = `${path}\u0000${source}`;
  if (snapshotCache !== null && snapshotCache.key === key && snapshotCache.read === read) {
    return snapshotCache.promise;
  }

  const promise = (async (): Promise<SnapshotAnalysis> => {
    const { model, snapshot } = await readNote(source, path, read);
    const doc = { path: snapshot.path, reader: snapshot.reader };
    const result = check(model, { doc });
    const decorations = decorationsFor(model, result);
    const report = reportFor(model, result, doc);
    return { source, path, model, result, decorations, report };
  })();

  snapshotCache = { key, read, promise };
  const clear = (): void => {
    if (snapshotCache?.promise === promise) snapshotCache = null;
  };
  promise.then(clear, clear);
  return promise;
}
