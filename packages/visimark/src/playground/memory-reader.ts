import type { ReaderPort } from "../fs/reader.js";
import { sha256Hex } from "./sha256.js";

/**
 * A `ReaderPort` over an in-memory set of files — what `docs/playground.html`
 * hands `check`/`fmt` so that a declared CSV import resolves in a browser with
 * no filesystem. Review §4.3; `fs/reader.ts` is the port itself and
 * `docs/design/browser-fs-port-plan.md` §5 is the sketch this is grown from.
 *
 * `lookup` is a **function**, not a snapshot object, on purpose: the playground's
 * store is live — the file the visitor is editing lives in the CodeMirror
 * buffer, not in `contents` — and a reader that had been handed a copy at
 * startup would keep reporting the original bytes, so editing `13-imports.csv`
 * would never produce the `STALE` finding that is the whole point of the
 * chapter's third quest step. It is called on every read.
 *
 * It lives in the engine rather than inline in `playground.html` so that
 * `test/playground/imports-chapter.test.ts` can check the real thing: the test
 * that proves chapter 13 reports zero problems has to exercise the code the
 * page actually runs, or it is proving something else.
 *
 * ## What an in-memory filesystem can and cannot honestly answer
 *
 * - `exists` is membership. Directories are not members, so `exists("/tutorial")`
 *   is `false`. That is correct rather than a limitation: `fs/gate.ts` only asks
 *   in order to decide whether to run a *symlink* containment check, and a
 *   string-keyed map has no symlinks to resolve through.
 * - `realpath` returns its input. It is the only honest answer a map can give,
 *   and it is the right one: no aliasing means every name is already real.
 * - `readSealed` carries the same guarantee it does on disk, trivially. There
 *   is one lookup, no descriptor, and nothing between the name and the bytes
 *   that could re-resolve it — the TOCTOU window `fs/reader.ts` describes
 *   cannot open here because there is no second resolution to open it.
 *
 * The digest is computed from the bytes held **now**, with the synchronous
 * SHA-256 in `./sha256.ts` — never precomputed, or the stamp check would be
 * theatre.
 */
export function memoryReader(lookup: (path: string) => string | null | undefined): ReaderPort {
  const text = (path: string): string | null => lookup(path) ?? null;
  return {
    exists: (path) => text(path) !== null,
    realpath: (path) => path,
    readText: text,
    readSealed: (path) => {
      const t = text(path);
      return t === null ? null : { text: t, sha256: sha256Hex(t) };
    },
  };
}
