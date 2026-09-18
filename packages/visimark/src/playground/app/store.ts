/**
 * The file store, and the ReaderPort the engine sees through it.
 *
 * The store owns four things: the catalogue the FILES panel renders, the text
 * of each document that has actually arrived, which document is current, and —
 * since review §2.7 — which of them the visitor has changed.
 *
 * **The catalogue is not the set of loaded files** (review §2.5). Boot used to
 * fetch all twenty documents (~124 KB, 21 round trips) before the editor could
 * initialise, in order to display one. Now `names()` comes from the static
 * FILE_SOURCES map, so the FILES panel is complete from the first paint, and
 * `ensure()` fetches a document the moment something needs its text: opening
 * it, or running BUILD over everything. Nothing about what the visitor sees
 * is lazy; only the bytes are.
 *
 * The file being edited lives in the CodeMirror buffer rather than in
 * `contents` — it is only flushed back on a file switch — so every read goes
 * through `text()`, which prefers the live buffer for the current file.
 */

import type { BrowserCheckOptions, VisiMarkApi } from "../browser-entry.js";
import type { BufferStore } from "./buffers.js";
import type { FailedFile } from "./sources.js";
import { DATA_DEPENDENCIES, FILE_SOURCES, loadFiles } from "./sources.js";

/**
 * VisiMark's three filesystem-touching phases (the path gate, artifact
 * staleness, CSV imports) take an injected ReaderPort rather than importing
 * node:fs — see ../../fs/reader.ts and docs/design/browser-fs-port-plan.md.
 * READER_FS is the browser's mapping from a synthetic absolute path to a file
 * in the store, so 13-imports.md's declared CSV import resolves for real here:
 * the header is asserted, the SHA-256 stamp is verified against a digest
 * computed from the bytes the store is holding *right now* (VM.sha256Hex, a
 * synchronous SHA-256 — crypto.subtle is async and the port is not), and
 * grand_total = SUM(Total) actually runs.
 *
 * The paths are absolute and share one directory because that is what
 * ../../fs/gate.ts's containment rules are written against: it resolves the
 * import against dirname(document path) and refuses anything that escapes it.
 *
 * **Only the files listed here get a reader, and that is deliberate.** A
 * document handed a ReaderPort also gets its chart artifacts checked against
 * the filesystem — and this store has no SVGs in it, because the playground
 * never writes any (`fmt --write` does not run here). So handing 12-charts.md
 * a reader would replace the `skipped` chart it correctly reports today with
 * `artifact missing at ...`: a second spurious failure, in the chapter review
 * §4.3 names as the reference behaviour. A file the store cannot fully serve
 * is better off with no reader at all, which is precisely the
 * `doc === undefined` case the engine already handles by staying quiet.
 *
 * Because the reader is synchronous, a file it may be asked for has to be in
 * the store *before* the engine runs — see DATA_DEPENDENCIES in ./sources.ts,
 * which `ensure()` below resolves on the way in.
 */
const READER_FS: Record<string, string> = {
  "/tutorial/13-imports.md": "13-imports.md",
  "/tutorial/13-imports.csv": "13-imports.csv",
};

export interface FileStore {
  /** Every filename in FILES-panel order — bundled documents plus anything
   *  the visitor has created, whether or not the text has arrived yet. */
  names(): string[];
  /** The file currently open in the editor. */
  current(): string;
  /** Whether `name`'s text is in memory. */
  loaded(name: string): boolean;
  /**
   * The text of `name` — the live editor buffer when it is the current file,
   * and undefined for a catalogue entry that has not been fetched.
   *
   * **Not what you want when you are about to put text *into* the editor.**
   * For the current file this returns what CodeMirror is showing, so
   * `cm.setValue(store.text(store.current()))` is a no-op that looks like a
   * load. Use `stored()`, or `switchTo()`'s return value, for that direction.
   */
  text(name: string): string | undefined;
  /** `name`'s text as the store holds it, ignoring the editor buffer — the
   *  direction that loads the editor rather than reading from it. */
  stored(name: string): string | undefined;
  /** Flushes the editor buffer back into the store, and saves it. */
  flush(): void;
  /** Replaces a file's stored text, in memory only. */
  setText(name: string, text: string): void;
  /**
   * Writes `name`'s current text through to localStorage (review §2.7).
   *
   * Separate from `setText` because `setText` runs on every keystroke and
   * this does not: it is called from the same 500 ms typing-settle that
   * re-runs `fmt` and the preview, and on every file switch. Saving per
   * keystroke would serialise the whole document a few dozen times a second
   * for no benefit the visitor can perceive.
   */
  persist(name: string): void;
  has(name: string): boolean;
  /** Appends a new file and returns false if the name is taken. */
  add(name: string, text: string): boolean;
  /**
   * Fetches `name` and anything its reader will need, unless already held.
   * Resolves to the documents that did not arrive, so a caller can say which.
   */
  ensure(name: string): Promise<FailedFile[]>;
  /** Fetches everything in the catalogue that is not held yet. */
  ensureAll(): Promise<FailedFile[]>;
  /**
   * Makes `name` current: flushes and saves the outgoing buffer, then puts
   * the incoming text into the editor.
   *
   * **The store writes the editor here, rather than handing the text back for
   * the caller to write.** Asking for it afterwards is a trap: by then `name`
   * *is* the current file, so `text(name)` reads the editor — which still
   * holds the outgoing document, making `cm.setValue(store.text(name))` a
   * no-op that looks like a file switch. That mistake shipped (see
   * docs/design/playground-file-lifecycle-plan.md): the FILES panel changed
   * the filename label and left the previous document on screen. The same
   * hazard applies to `revert` and `revertAll`, so all three write through
   * and the invariant is one sentence: the editor holds the current file.
   */
  switchTo(name: string): void;
  /** `{ doc }` for VM.check/VM.fmt/pgEval — `{}` when there is no reader. */
  optsFor(name: string): BrowserCheckOptions;
  /** Whether `name` differs from the document that shipped with the page.
   *  False for a file the visitor created — it is all their own work, so
   *  there is no "changed" to report. */
  isDirty(name: string): boolean;
  /** Puts `name` back to the bundled text and returns it, refreshing the
   *  editor when it is the open file. Undefined for a file the visitor
   *  created, which has nothing to go back to. */
  revert(name: string): string | undefined;
  /** Reverts every changed bundled document; returns how many. Files the
   *  visitor created are left alone — see ./files.ts for why. */
  revertAll(): number;
}

/**
 * `initial` is already loaded by the time boot gets here — it is the one
 * document boot refuses to start without — so it is passed in rather than
 * fetched a second time.
 */
export function createStore(
  VM: VisiMarkApi,
  cm: CodeMirrorEditor,
  buffers: BufferStore,
  loaded: Record<string, string>,
  initial: string,
): FileStore {
  /** The bundled text of every document that has arrived, before the visitor
   *  touched it — the baseline `isDirty`, `revert` and the freshness check in
   *  ./buffers.ts are all measured against. */
  const originals: Record<string, string> = { ...loaded };
  const contents: Record<string, string> = { ...loaded };

  // A file the visitor created in an earlier session has no entry in
  // FILE_SOURCES, so it would vanish from the catalogue the moment it stopped
  // being restored by accident. Its saved text *is* its text.
  const created: string[] = [];
  for (const name of buffers.createdNames()) {
    const text = buffers.restore(name, null);
    if (text === undefined) continue;
    created.push(name);
    contents[name] = text;
  }

  let current = initial;

  const text = (name: string): string | undefined =>
    name === current ? cm.getValue() : contents[name];

  // The reader has to see the buffer, or editing 13-imports.csv would never
  // move the digest and the STALE demonstration would be fake.
  const reader = VM.memoryReader((path: string) => {
    const name = READER_FS[path];
    return name === undefined ? null : text(name);
  });

  /** The `doc` option for a file the store can serve, else undefined. */
  const docFor = (name: string) => {
    for (const path of Object.keys(READER_FS)) {
      if (READER_FS[path] === name) return { path, reader };
    }
    return undefined;
  };

  const setText = (name: string, value: string): void => {
    contents[name] = value;
  };

  // A file the visitor created has no bundled original, which is exactly what
  // `null` means to ./buffers.ts: nothing to drift from, always restored.
  const persist = (name: string): void => {
    const value = text(name);
    if (value === undefined) return;
    buffers.save(name, value, originals[name] ?? null);
  };

  /** Records a freshly fetched document, restoring the visitor's copy of it
   *  when one survives the freshness check in ./buffers.ts. */
  const receive = (name: string, bundled: string): void => {
    originals[name] = bundled;
    contents[name] = buffers.restore(name, bundled) ?? bundled;
  };

  for (const name of Object.keys(loaded)) receive(name, loaded[name]!);
  if (contents[initial] !== undefined) cm.setValue(contents[initial]);

  async function fetchMissing(names: string[]): Promise<FailedFile[]> {
    const wanted = names.filter((name) => contents[name] === undefined);
    if (wanted.length === 0) return [];
    const { files, failed } = await loadFiles(wanted);
    for (const name of Object.keys(files)) receive(name, files[name]!);
    return failed;
  }

  function isDirty(name: string): boolean {
    // A file the visitor created is all their own work: there is no bundled
    // version of it, so there is nothing for a mark to mean and nothing for
    // the Revert control to do.
    if (created.includes(name)) return false;
    const original = originals[name];
    // Not fetched yet, but a saved copy is waiting for it: the FILES panel
    // still has to mark it, or a document edited in a previous session looks
    // untouched until the moment you open it (review §2.5 made "in the
    // catalogue" and "in memory" different things, and this is one of the
    // places that has to know the difference).
    if (original === undefined) return buffers.has(name);
    return (text(name) ?? original) !== original;
  }

  return {
    names: () => [...Object.keys(FILE_SOURCES), ...created],
    current: () => current,
    loaded: (name) => contents[name] !== undefined,
    text,
    flush() {
      setText(current, cm.getValue());
      persist(current);
    },
    setText,
    persist,
    has: (name) => Object.prototype.hasOwnProperty.call(contents, name),
    add(name, value) {
      if (Object.prototype.hasOwnProperty.call(contents, name)) return false;
      if (Object.prototype.hasOwnProperty.call(FILE_SOURCES, name)) return false;
      created.push(name);
      setText(name, value);
      persist(name);
      return true;
    },
    ensure: (name) => fetchMissing([name, ...(DATA_DEPENDENCIES[name] ?? [])]),
    ensureAll: () => fetchMissing(Object.keys(FILE_SOURCES)),
    stored: (name) => contents[name],
    switchTo(name) {
      setText(current, cm.getValue());
      persist(current);
      current = name;
      cm.setValue(contents[name] ?? "");
    },
    optsFor(name) {
      const doc = docFor(name);
      return doc ? { doc } : {};
    },
    isDirty,
    revert(name) {
      const original = originals[name];
      if (original === undefined) return undefined;
      contents[name] = original;
      buffers.forget(name);
      if (name === current) cm.setValue(original);
      return original;
    },
    revertAll() {
      let reverted = 0;
      for (const name of Object.keys(originals)) {
        if (!isDirty(name)) continue;
        contents[name] = originals[name]!;
        buffers.forget(name);
        if (name === current) cm.setValue(originals[name]!);
        reverted++;
      }
      // A document saved in an earlier session but not opened in this one is
      // still shadowing the bundled copy the visitor has not seen yet, so
      // "reset all" has to reach it too — otherwise the reset that was meant
      // to explain a surprise leaves the surprise in place.
      for (const name of Object.keys(FILE_SOURCES)) {
        if (originals[name] === undefined && buffers.has(name)) {
          buffers.forget(name);
          reverted++;
        }
      }
      return reverted;
    },
  };
}
