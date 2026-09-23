/**
 * The reader port: everything the engine needs from a filesystem, stated as an
 * interface so that the *absence* of a filesystem is a shape and not a
 * convention.
 *
 * **Why this module has no imports at all.** `check` reaches three phases that
 * used to call `node:fs` directly — the path gate (`fs/gate.ts`), artifact
 * staleness (`artifact/stale.ts`) and import resolution (`import/resolve.ts`).
 * All three are also in the browser playground's module graph, because whether
 * they *run* is a runtime condition the bundler cannot see. Before this port
 * they were compiled into `docs/vendor/visimark-browser.js` with their
 * `node:fs` calls resolved by `bun build --target browser` to `(()=>({}))`,
 * and nothing threw only because every caller happened to pass no document
 * path. That invariant was held by comments. Reading `constants.O_NOFOLLOW`
 * off one of those stubs at module scope is what took the public playground
 * down for 74 minutes (PR #93, shipped into the committed bundle by #95);
 * see `docs/reviews/2026-09-16.md` §2.
 *
 * So the phases now take a `ReaderPort` instead of importing one (PR #99).
 * The Node implementation lives in `fs/node-reader.ts`, which the browser
 * entry never imports — so `node:fs` and `node:crypto` are not in the
 * browser bundle at all, and the old "no document path" checks become "no
 * reader was supplied", which is the same condition stated structurally.
 * `test/playground/browser-graph.test.ts` is the guard that keeps
 * `node:fs`/`node:crypto` out of the browser graph at all;
 * `scripts/cross-host-check.ts` is the guard on the companion property, that
 * the two hosts *agree* once a reader is or isn't there — the graph test
 * alone would have stayed green through the #93 regression, since it only
 * checks which builtins are reachable, never what either host answers.
 *
 * ## Why hashing is on this port and not a sibling
 *
 * SHA-256 is not filesystem access, and `node:crypto` is a separate builtin.
 * It still belongs here, and specifically **on the read result** rather than
 * as its own `hash(bytes)` method, for two reasons:
 *
 * 1. The digest has to describe *the bytes that were actually read*, not bytes
 *    that were handed back across the boundary and hashed separately. A
 *    `hash()` sibling would re-open, in the caller, exactly the gap
 *    `readSealed` exists to close.
 * 2. Handing raw bytes out would put a `Buffer`/`Uint8Array` at the seam, and
 *    `Buffer` is another Node global the browser build must not acquire. Text
 *    and a hex digest cross the boundary; bytes never do.
 *
 * ## TOCTOU: does injecting a reader weaken PR #93's guarantee?
 *
 * PR #93 established that a path gate's verdict is about a *name*, is carried
 * a long way, and so must be re-proved at the point of use: open once, refuse
 * a symlink at that open, and read **through that descriptor** rather than
 * resolving the path a second time. A port could destroy that, by exposing
 * `open(path) -> fd` and `read(fd)` as separate operations (a substituted
 * reader could ignore the fd and re-resolve the path), or worse by exposing a
 * plain `read(path)` for the gated case.
 *
 * `readSealed` is therefore a **single indivisible operation**: open without
 * following, read through that descriptor, close, hash — one call, one
 * resolution of the name, and no descriptor ever escapes the port. There is
 * no way for an implementation of this interface to re-resolve a path between
 * the gate's verdict and the bytes it returns, because it is never given the
 * opportunity to: it is handed one name and must return the content of
 * whatever that name opened to, once. The guarantee is unchanged.
 *
 * `readText` carries no such guarantee and is not claimed to: it is the
 * ordinary `readFileSync` that `artifact/stale.ts` has always used to decide
 * staleness, and staleness is a hint that `artifact/write.ts` re-proves
 * against the descriptor it writes through. Keeping the two reads as two
 * differently-named methods is deliberate — one name per guarantee, so a call
 * site cannot silently acquire or lose one.
 */

/** the result of a sealed read: the file's content, and what it hashed to */
export interface SealedRead {
  /** the bytes decoded as UTF-8 */
  readonly text: string;
  /** lowercase hex SHA-256 **of the bytes**, not of `text` */
  readonly sha256: string;
}

export interface ReaderPort {
  /** `existsSync` — used by the path gate before it asks for a real path */
  exists(path: string): boolean;
  /**
   * `realpathSync`, falling back to the input for a path that does not exist
   * yet. Only a filesystem error may take that fallback: see
   * `fs/node-reader.ts`.
   */
  realpath(path: string): string;
  /**
   * The file's content as UTF-8, or `null` if it cannot be read for any
   * reason. No symlink refusal — see the module note above.
   */
  readText(path: string): string | null;
  /**
   * Open `path` refusing a symlink at the final component, read through that
   * descriptor, close it, and hash what was read. `null` if any step fails.
   * The single-call shape is load-bearing; see the TOCTOU note above.
   */
  readSealed(path: string): SealedRead | null;
}

/**
 * A document that exists on some filesystem: where it is, and how to reach the
 * files around it. The two travel together because neither is any use alone —
 * a path with no reader is the invariant-by-convention this port replaced, and
 * a reader with no path has nothing to resolve relative paths against.
 *
 * `undefined` wherever this is optional means "this document is not on a
 * filesystem" — the browser playground's situation, and the condition the
 * chart and import phases branch on.
 */
export interface DocumentFile {
  readonly path: string;
  readonly reader: ReaderPort;
}
