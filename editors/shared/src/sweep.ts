import { hasVmarkBlock, mightHaveBlock } from "codemirror-visimark/gate.js";
import type { ReadImport } from "codemirror-visimark/snapshot.js";

/**
 * The sweep — v1 row 8 of #176, shared with the Joplin plugin's notebook sweep
 * since #384. The host supplies the notes (`SweepSource`) and what checking
 * one means (`CheckNote`); this module owns the walk, the prefilter, the
 * yields and the verdict rules, so the two hosts cannot disagree about which
 * notes disagree with themselves.
 *
 * What follows is the Obsidian vault sweep's original argument, and the one feature the VS Code
 * extension cannot have. Daily-note people copy numbers between files; this is
 * what catches the copy that stopped being true.
 *
 * **The cost is the parse, not the read, and that decides the design.**
 * Measured on the worked-example corpus: `locate()` on an ordinary note is
 * **1.9 ms**, a full `locate + build + check` is **2.8 ms**, and
 * `text.includes("vmark")` is below the resolution of `performance.now()`.
 * Parsing every note in a 5,000-note vault is therefore ~9.5 s of work, and
 * skipping the parse for notes that cannot possibly contain a block is ~0.09 s.
 *
 * So there is a prefilter, and it is a substring scan. **It cannot produce a
 * false negative**: a `vmark` block's opening fence carries the info string
 * `vmark`, whatever the fence is made of — the engine accepts ``` and ~~~, any
 * length of either, indented or not — so every document `locate` would find a
 * block in contains the literal text. It produces false positives freely, and
 * `hasVmarkBlock` rejects them; `sweep.test.ts` asserts both halves over the
 * corpus rather than trusting the argument.
 *
 * **It yields, because a phone has one thread.** Total time is not the risk —
 * the risk is a scan that holds the UI while it runs. `chunk` notes are
 * processed, then the caller's `pause` is awaited; the plugin passes a real
 * one, the tests pass a counter.
 */

/** Where the notes come from. An adapter, so the tests need no vault. */
export interface SweepSource {
  /**
   * every Markdown note, in whatever order the host keeps them — a promise
   * where the host lists them asynchronously (Joplin's `joplin.data`)
   */
  paths(): readonly string[] | Promise<readonly string[]>;
  /** the note's text, or `null` if it cannot be read */
  read: ReadImport;
}

/** What checking one note found. */
export interface NoteCheck<T> {
  /** findings that need attention */
  problems: number;
  /** advice — never the reason a note is listed */
  advice: number;
  /** whatever the host wants to keep about the note */
  detail: T;
}

/**
 * Check one note that has a block. Throw for a note that cannot be checked:
 * it lands in `unreadable`, never in a clean verdict.
 */
export type CheckNote<T> = (text: string, path: string) => Promise<NoteCheck<T>>;

export interface SweptNote<T> {
  path: string;
  /** how many findings need attention */
  problems: number;
  /** how many are advice */
  advice: number;
  detail: T;
}

export interface SweepResult<T> {
  /** every note looked at, including the ones the prefilter skipped */
  scanned: number;
  /** notes the prefilter let through — candidates for a real check */
  candidates: number;
  /** notes that actually contain a block, whether or not they disagree */
  checked: number;
  /** the ones that disagree with themselves, in vault order */
  notes: SweptNote<T>[];
  /**
   * A checked note whose only findings are advice (`WARN`/`NOTE`) — agrees
   * with itself by row 8's own rule, so it is never in `notes`, but "never
   * listed" should not mean "never counted anywhere" either. §2.3 of the
   * 2026-09-25 review asked whether the maintainer wants advice surfaced
   * vault-wide at all; this is that count, in vault order, for a caller that
   * does.
   */
  adviceOnly: string[];
  /** a note that could not be read or checked; reported, never silently clean */
  unreadable: string[];
  cancelled: boolean;
}

export interface SweepOptions {
  /** how many notes to look at before handing the thread back */
  chunk?: number;
  /** what to await between chunks — `setTimeout(0)` in the plugin */
  pause?: () => Promise<void>;
  /** called after each chunk, so a pane can show progress */
  onProgress?: (done: number, total: number) => void;
  /** stop early; the partial result comes back with `cancelled: true` */
  signal?: { aborted: boolean };
}

export async function sweep<T>(
  source: SweepSource,
  checkNote: CheckNote<T>,
  options: SweepOptions = {},
): Promise<SweepResult<T>> {
  const chunk = options.chunk ?? 50;
  const pause = options.pause ?? (() => Promise.resolve());
  const paths = await source.paths();

  const result: SweepResult<T> = {
    scanned: 0,
    candidates: 0,
    checked: 0,
    notes: [],
    adviceOnly: [],
    unreadable: [],
    cancelled: false,
  };

  for (const path of paths) {
    if (options.signal?.aborted === true) {
      result.cancelled = true;
      break;
    }

    result.scanned++;
    if (result.scanned % chunk === 0) {
      options.onProgress?.(result.scanned, paths.length);
      await pause();
    }

    const text = await source.read(path);
    if (text === null) {
      result.unreadable.push(path);
      continue;
    }
    if (!mightHaveBlock(text)) continue;
    result.candidates++;
    if (!hasVmarkBlock(text)) continue;
    result.checked++;

    try {
      const { problems, advice, detail } = await checkNote(text, path);
      // review row 8: advice never changes a note's state (`status.ts`'s own
      // rule for the status bar), so the sweep must not list a note whose
      // only findings are advice
      if (problems === 0) {
        if (advice > 0) result.adviceOnly.push(path);
        continue;
      }
      result.notes.push({ path, problems, advice, detail });
    } catch {
      // §3.1: never a clean verdict for a note that could not be checked
      result.unreadable.push(path);
    }
  }

  options.onProgress?.(result.scanned, paths.length);
  return result;
}
