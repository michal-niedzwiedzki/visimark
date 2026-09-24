import { check } from "visimark";
import { hasVmarkBlock } from "./gate.js";
import { isClean, reportFor, type NoteReport } from "./report.js";
import { readNote, type VaultRead } from "./snapshot.js";
import { mightHaveBlock, type SweepResult, type SweptNote } from "./sweep.js";

/**
 * The incremental vault health index — v1.1 row 13 of #176.
 *
 * **What v1's sweep (`sweep.ts`, row 8) is a command; this makes ambient.**
 * The sweep answers "what in this vault disagrees with itself" the moment you
 * ask. This answers it *before* you ask, by keeping a running answer updated
 * as notes change, so a badge next to the ribbon icon is simply true at all
 * times rather than a snapshot from whenever the sweep last ran.
 *
 * **Why this was deferred out of v1, and what that constrains here.** #176's
 * v1.1 row justifies the deferral as "a wrong cache is worse than no cache,
 * and the on-demand sweep proves the feature first" — so this index is built
 * to fail toward *no claim* rather than a *wrong* one:
 *
 * - It never seeds itself. `seed()` takes a real `SweepResult` — the same
 *   type `sweep()` already returns and the same object `sweep-view.ts`
 *   already draws — so the index's contents are never anything a full scan
 *   did not itself produce. There is no code path that invents an entry.
 * - Every incremental update re-derives its verdict from a fresh read and a
 *   fresh `check()`, exactly the way `sweep()` would for that one note. It is
 *   never patched or inferred from the previous entry, so "a burst of edits
 *   made this note wrong three times in a row" cannot leave a wrong entry
 *   behind — the last recheck to finish always wins, and it always computed
 *   its own answer.
 * - Anything the index cannot positively confirm still disagrees with
 *   itself — no block, a clean note, or a note that fails to read or check —
 *   is removed rather than guessed at. A false "clean" is the wrong kind of
 *   wrong for a findings badge; an entry quietly missing after an unreadable
 *   note is the same honest gap `sweep()`'s own `unreadable` list already
 *   accepts (§3.1) hidden inside vault-events' background rather than
 *   pointed at, which is why row 8's manual "Look again" stays the one path
 *   that reports unreadable notes as such rather than as silence.
 * - **What this index does not defend against**: a vault change that fires no
 *   Obsidian vault event at all — a sync client writing through the OS
 *   filesystem while the app is backgrounded, say. That gap is not closed
 *   here; it is what the sweep's own "Look again" is for, and it is an
 *   accepted limitation in the same sense #233 accepted symlink containment
 *   as one — named rather than silently patched over.
 *
 * **Debounced, per path.** `scheduleRecheck` coalesces a burst of `modify`
 * events for one note into a single recheck, the way autosave or a fast
 * typist would otherwise produce; a rename cancels a pending recheck of the
 * new path's own before-content and re-derives from what is actually there
 * now.
 */
export interface VaultIndex {
  /** every note currently known to disagree with itself, vault order */
  notes(): readonly SweptNote[];
  /** `notes().length` — the number a badge draws */
  count(): number;
  /**
   * Has `seed()` run at least once? `count() === 0` is ambiguous on its own —
   * a genuinely clean vault and an index nothing has seeded yet look
   * identical — so `sweep-view.ts` uses this, not `count()`, to decide
   * whether it may draw from the index instead of running a real sweep.
   */
  isSeeded(): boolean;
  /** called after every change to `notes()`/`count()`; returns an unsubscribe */
  onChange(listener: () => void): () => void;
}

/** how long a note is given to stop changing before it is rechecked */
const DEBOUNCE_MS = 750;

export class LiveVaultIndex implements VaultIndex {
  private entries = new Map<string, SweptNote>();
  private listeners = new Set<() => void>();
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  private seededOnce = false;

  constructor(
    private read: VaultRead,
    private scheduleTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = (
      fn,
      ms,
    ) => setTimeout(fn, ms),
    private cancelScheduled: (id: ReturnType<typeof setTimeout>) => void = clearTimeout,
  ) {}

  notes(): readonly SweptNote[] {
    return [...this.entries.values()];
  }

  count(): number {
    return this.entries.size;
  }

  isSeeded(): boolean {
    return this.seededOnce;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Replace the whole index with a real sweep's result — the only way in. */
  seed(result: SweepResult): void {
    this.entries.clear();
    for (const note of result.notes) this.entries.set(note.path, note);
    this.seededOnce = true;
    this.notify();
  }

  /** A note left the vault, or a rename's old path — drop it, no recheck. */
  remove(path: string): void {
    this.cancelPending(path);
    if (this.entries.delete(path)) this.notify();
  }

  /** A rename: the old path's entry is gone, the new path gets its own recheck. */
  rename(oldPath: string, newPath: string): void {
    this.remove(oldPath);
    this.scheduleRecheck(newPath);
  }

  /** A note was created or modified — recheck it after `DEBOUNCE_MS` of quiet. */
  scheduleRecheck(path: string, delayMs = DEBOUNCE_MS): void {
    this.cancelPending(path);
    this.pending.set(
      path,
      this.scheduleTimeout(() => {
        this.pending.delete(path);
        void this.recheck(path);
      }, delayMs),
    );
  }

  private cancelPending(path: string): void {
    const id = this.pending.get(path);
    if (id === undefined) return;
    this.cancelScheduled(id);
    this.pending.delete(path);
  }

  /**
   * Re-derive one note's verdict from scratch — the same steps `sweep()`
   * takes for a single note, composed here rather than shared with it, so a
   * change to the sweep's chunking or progress reporting cannot alter what an
   * incremental recheck does. See `report.ts`/`snapshot.ts` for what each
   * step means; this function only sequences them.
   */
  async recheck(path: string): Promise<void> {
    const text = await this.read(path);
    const next = text === null ? null : await this.verdictFor(path, text);
    if (next === null) {
      if (this.entries.delete(path)) this.notify();
    } else {
      this.entries.set(path, next);
      this.notify();
    }
  }

  private async verdictFor(path: string, text: string): Promise<SweptNote | null> {
    if (!mightHaveBlock(text) || !hasVmarkBlock(text)) return null;
    try {
      const { model, snapshot } = await readNote(text, path, this.read);
      const doc = { path: snapshot.path, reader: snapshot.reader };
      const report: NoteReport = reportFor(model, check(model, { doc }), doc);
      if (isClean(report)) return null;
      return { path, problems: report.problems.length, advice: report.advice.length, report };
    } catch {
      // never a wrong "clean" for a note that could not be checked — see the
      // module note on what this index does and does not claim
      return null;
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
