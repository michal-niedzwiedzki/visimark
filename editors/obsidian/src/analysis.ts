import { build, check, locate, type CheckResult, type DocModel, type LocatedDoc } from "visimark";
import { decorationsFor, type Decoration } from "./decorations.js";

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
 * when the snapshot-backed check (§2.2 of the review, not yet built) would
 * call it `disagrees`. The seam for that is this module: a snapshot-backed
 * variant is added beside `analyse`, not folded into it, so the gate and the
 * synchronous renderers keep working from the cheap half.
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
