import { createHash } from "node:crypto";
import { closeSync, existsSync, readFileSync, realpathSync } from "node:fs";
import { openForRead } from "./open.js";
import type { DocumentFile, ReaderPort, SealedRead } from "./reader.js";

/**
 * The `node:fs` implementation of the reader port — the only implementation
 * the CLI ever uses, and the only module in the engine that still reaches
 * `node:fs`/`node:crypto` on the read side.
 *
 * **Nothing in the browser's module graph may import this file.** That is the
 * whole point of the port; `test/playground/browser-graph.test.ts` enforces
 * it. Everything here is the code that used to sit inline in `fs/gate.ts`,
 * `artifact/stale.ts` and `import/resolve.ts`, moved rather than rewritten, so
 * CLI behaviour is unchanged.
 */

export const nodeReader: ReaderPort = {
  exists(path: string): boolean {
    return existsSync(path);
  },

  realpath(path: string): string {
    return realpathOr(path, realpathSync);
  },

  /**
   * `artifact/stale.ts`'s read. It used to test `existsSync` first and treat a
   * throwing `readFileSync` as `missing` too; both arrive here as `null`, so
   * the two branches that produced `{ state: "missing" }` still do.
   */
  readText(path: string): string | null {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  },

  /**
   * `import/resolve.ts`'s read, unchanged in substance: open refusing a
   * symlink at the final component, read **through that descriptor** rather
   * than resolving the gated path a second time, close it, and hash the bytes
   * that came back. A link swapped in after the gate would otherwise put an
   * out-of-tree file's bytes into the model. The caller could not tell
   * `openForRead` failing from `readFileSync` failing before either — both
   * produced the same `imported file not found` — so folding them into one
   * `null` is not a behaviour change.
   *
   * The descriptor does not leave this function. See `fs/reader.ts` on why
   * that is the property the port exists to keep.
   */
  readSealed(path: string): SealedRead | null {
    const opened = openForRead(path);
    if ("err" in opened) return null;
    let raw: Buffer;
    try {
      raw = readFileSync(opened.ok);
    } catch {
      return null;
    } finally {
      closeSync(opened.ok);
    }
    return { text: raw.toString("utf8"), sha256: createHash("sha256").update(raw).digest("hex") };
  },
};

/** the document at `path`, read through `node:fs` — what the CLI passes. */
export function onDisk(path: string): DocumentFile {
  return { path, reader: nodeReader };
}

/**
 * `realpath` on a path that may not exist yet falls back to the input — but
 * **only** for a filesystem error.
 *
 * The bare `catch { return p }` this replaces also swallowed
 * `realpathSync is not a function`, which is what a bundled `node:fs` stub
 * looks like: a broken build reported as "the path isn't there yet", silently,
 * forever (`docs/reviews/2026-09-16.md` §4.2). A Node errno error carries a
 * string `code`; a `TypeError` does not, and must propagate. Every errno is
 * still handled exactly as before, so no CLI behaviour moves.
 *
 * `resolveReal` is a parameter only so `test/fs/node-reader.test.ts` can prove
 * the narrowing without mocking `node:fs` out from under the whole suite.
 */
export function realpathOr(p: string, resolveReal: (path: string) => string): string {
  try {
    return resolveReal(p);
  } catch (e) {
    if (typeof (e as NodeJS.ErrnoException | null)?.code !== "string") throw e;
    return p;
  }
}
