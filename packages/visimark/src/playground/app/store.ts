/**
 * The in-memory file store, and the ReaderPort the engine sees through it.
 *
 * The store owns three things that used to be three loose variables: the file
 * order the FILES panel renders, each file's text, and which file is current.
 * The file being edited lives in the CodeMirror buffer rather than in
 * `contents` — it is only flushed back on a file switch — so every read goes
 * through `text()`, which prefers the live buffer for the current file.
 */

import type { BrowserCheckOptions, VisiMarkApi } from "../browser-entry.js";

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
 */
const READER_FS: Record<string, string> = {
  "/tutorial/13-imports.md": "13-imports.md",
  "/tutorial/13-imports.csv": "13-imports.csv",
};

export interface FileStore {
  /** Filenames in FILES-panel order. */
  names(): string[];
  /** The file currently open in the editor. */
  current(): string;
  /** The text of `name` — the live editor buffer when it is the current file. */
  text(name: string): string | undefined;
  /** Flushes the editor buffer back into the store. */
  flush(): void;
  /** Replaces a file's stored text. */
  setText(name: string, text: string): void;
  has(name: string): boolean;
  /** Appends a new file and returns false if the name is taken. */
  add(name: string, text: string): boolean;
  /** Makes `name` current, flushing the outgoing buffer first. */
  switchTo(name: string): void;
  /** `{ doc }` for VM.check/VM.fmt/pgEval — `{}` when there is no reader. */
  optsFor(name: string): BrowserCheckOptions;
}

export function createStore(
  VM: VisiMarkApi,
  cm: CodeMirrorEditor,
  files: Record<string, string>,
  initial: string,
): FileStore {
  const order = Object.keys(files);
  const contents: Record<string, string> = { ...files };
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

  return {
    names: () => order,
    current: () => current,
    text,
    flush() {
      contents[current] = cm.getValue();
    },
    setText(name, value) {
      contents[name] = value;
    },
    has: (name) => Object.prototype.hasOwnProperty.call(contents, name),
    add(name, value) {
      if (Object.prototype.hasOwnProperty.call(contents, name)) return false;
      contents[name] = value;
      order.push(name);
      return true;
    },
    switchTo(name) {
      contents[current] = cm.getValue();
      current = name;
    },
    optsFor(name) {
      const doc = docFor(name);
      return doc ? { doc } : {};
    },
  };
}
