import { check } from "visimark";
import { hasVmarkBlock, mightHaveBlock } from "./gate.js";
import { reportFor, type NoteReport } from "./report.js";
import { readNote, type VaultRead } from "./snapshot.js";

/**
 * The vault sweep — v1 row 8 of #176, and the one feature the VS Code
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
  /** every Markdown note in the vault, in whatever order it keeps them */
  paths(): readonly string[];
  /** the note's text, or `null` if it cannot be read */
  read: VaultRead;
}

export interface SweptNote {
  path: string;
  /** how many rows the findings view would put under "Needs attention" */
  problems: number;
  /** how many under "Advice" */
  advice: number;
  report: NoteReport;
}

export interface SweepResult {
  /** every note looked at, including the ones the prefilter skipped */
  scanned: number;
  /** notes the prefilter let through — candidates for a real check */
  candidates: number;
  /** notes that actually contain a block, whether or not they disagree */
  checked: number;
  /** the ones that disagree with themselves, in vault order */
  notes: SweptNote[];
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

export async function sweep(source: SweepSource, options: SweepOptions = {}): Promise<SweepResult> {
  const chunk = options.chunk ?? 50;
  const pause = options.pause ?? (() => Promise.resolve());
  const paths = source.paths();

  const result: SweepResult = {
    scanned: 0,
    candidates: 0,
    checked: 0,
    notes: [],
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
      const { model, snapshot } = await readNote(text, path, source.read);
      const doc = { path: snapshot.path, reader: snapshot.reader };
      const report = reportFor(model, check(model, { doc }), doc);
      // review row 8: advice never changes a note's state (`status.ts`'s own
      // rule for the status bar), so the sweep must not list a note whose
      // only findings are advice — `isClean` would, since it means "no
      // problems *and* no advice"
      if (report.problems.length === 0) continue;
      result.notes.push({
        path,
        problems: report.problems.length,
        advice: report.advice.length,
        report,
      });
    } catch {
      // §3.1: never a clean verdict for a note that could not be checked
      result.unreadable.push(path);
    }
  }

  options.onProgress?.(result.scanned, paths.length);
  return result;
}
