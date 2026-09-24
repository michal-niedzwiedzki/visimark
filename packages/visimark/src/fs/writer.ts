/**
 * The writer port: the write-side counterpart to `fs/reader.ts`, stated for
 * the same reason — so that a host with no filesystem, or one whose
 * filesystem is not `node:fs`, is a shape rather than a convention a caller
 * has to remember.
 *
 * **Why this is smaller than `ReaderPort`.** Nothing in `check` or `fmt`
 * writes mid-evaluation: `planFmt`/`fmt` are pure, and hand back the new
 * document text and the artifact set entirely in memory
 * (`write/fmt.ts`, `write/splice.ts`). The only I/O is the caller landing
 * that already-computed text somewhere — one operation, not four. This port
 * exists so that operation has a name a non-Node host can implement, not
 * because the engine needs to inject one anywhere.
 *
 * **Why this module has no imports at all.** Same discipline as
 * `fs/reader.ts`: an interface file that imports nothing cannot pull
 * `node:fs` into a module graph that does not expect it. The Node
 * implementation lives in `fs/node-writer.ts`, which the browser entry must
 * never import — `test/playground/browser-graph.test.ts` checks this the same
 * way it already checks `fs/node-reader.ts`.
 *
 * **What this port does not attempt.** `artifact/write.ts`'s `writeArtifact`
 * already exists for generated charts and carries its own symlink-refusal and
 * ownership-marker re-proof, tied to raw file descriptors — a threat model
 * that assumes a local, single-writer filesystem. A vault has neither `open`
 * nor a file descriptor, and Obsidian's own path resolution is what stands in
 * for containment there. This port is only the document-body write CLI `fmt`
 * and `infer --write` already perform with a bare `writeFileSync`; giving
 * artifacts a vault-safe write of their own is a later, separate decision
 * (v1.1 row 14 of `docs/WIP/OBSIDIAN-FEATURES.md`), not a generalisation of
 * this one.
 */

export interface WriteOk {
  readonly ok: true;
}

export interface WriteErr {
  readonly err: string;
}

export interface WriterPort {
  /**
   * Replace `path`'s content with `content`, in full. `WriteErr#err` is a
   * human-readable reason, not a code — the two call sites that use it today
   * (`cmdFmt`, `cmdInfer`) both just prefix it onto `visimark: ` and print it,
   * exactly as they did the bare exception each replaced.
   */
  writeText(path: string, content: string): WriteOk | WriteErr;
}
