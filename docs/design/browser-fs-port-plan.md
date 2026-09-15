# Keep `node:fs` out of the browser graph — implementation plan

**Goal:** Per [§4.2](../reviews/2026-09-16.md#42-keep-nodefs-out-of-the-browser-graph-row-3) of the 2026-09-16 review (row 3), take
**Option A — the injected reader port**. Give the three filesystem-touching phases an
injected reader interface, defaulting to the `node:fs` implementation and absent in the
browser build, so that `node:fs` and `node:crypto` leave the playground bundle's module
graph entirely and the `docPath === undefined` checks become "no reader was supplied" —
the same condition, stated structurally instead of by convention.

**Architecture:** One new interface (`fs/reader.ts`, zero imports) and one new
implementation (`fs/node-reader.ts`, the only read-side module that still touches
`node:fs`/`node:crypto`). `fs/gate.ts`, `artifact/stale.ts` and `import/resolve.ts` take
the port instead of importing a filesystem. `CheckOptions.docPath?: string` becomes
`CheckOptions.doc?: DocumentFile`, where `DocumentFile` is `{ path, reader }` — one field,
so "this document is not on a filesystem" is one condition rather than two that could
disagree. The CLI passes `onDisk(path)`; the browser passes nothing.

**Tech Stack:** TypeScript; Bun 1.4.2 (pinned — the `playground-bundle` CI job byte-compares);
engine package `packages/visimark`.

**Review item:** [§4.2](../reviews/2026-09-16.md#42-keep-nodefs-out-of-the-browser-graph-row-3) of [`docs/reviews/2026-09-16.md`](../reviews/2026-09-16.md)

## Global Constraints

- No behaviour change to the CLI. `check` / `fmt` / `explain` / `eval` output stays
  byte-identical across every `docs/example-*.md`, in text and `--json` form, including the
  files `fmt` writes.
- `bun test` at the repo root stays green. It was **771 pass / 0 fail** before (after
  `bun run build`, which the three `editors/vscode` smoke tests need) and is **782 / 0**
  after, the 11 new tests being this change's own guards.
- The bundle stays byte-deterministic under Bun 1.4.2; `docs/vendor/` is rebuilt and
  committed, and `git diff --exit-code -- docs/vendor/` is clean afterwards.
- `packages/visimark/test/playground.test.ts` — the PR #99 regression test — keeps passing
  unweakened.
- The `docPath === undefined` comments in `check-charts.ts` and `import/resolve.ts` record a
  real decision; the reasoning is carried across, not deleted.
- Every commit ends with the trailer named by
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the session
  that wrote it.

---

## 1. The port's shape, and why

```ts
interface ReaderPort {
  exists(path: string): boolean;                  // the path gate
  realpath(path: string): string;                 // the path gate
  readText(path: string): string | null;          // artifact staleness
  readSealed(path: string): SealedRead | null;    // declared imports
}
interface SealedRead { readonly text: string; readonly sha256: string }
interface DocumentFile { readonly path: string; readonly reader: ReaderPort }
```

Four methods, each with exactly one existing call site, each a straight move of code that
was already there. Nothing was generalised: the port is the shape of the engine's actual
appetite for a filesystem, which turns out to be small.

**Why hashing rides on the port rather than a sibling.** SHA-256 is not filesystem access,
and `node:crypto` is a separate builtin, so a `HashPort` would have been defensible. It is
on `SealedRead` instead, for two reasons. First, the digest must describe *the bytes that
were actually read through that descriptor*; a `hash(bytes)` sibling would push the bytes
back out across the boundary and let a caller hash something other than what was read —
re-opening in the caller precisely the gap the sealed read closes. Second, handing raw bytes
out would put `Buffer`/`Uint8Array` at the seam, and `Buffer` is one more Node global the
browser build must not acquire. Text and a hex digest cross; bytes never do.

## 2. TOCTOU: does the port weaken PR #93?

**No — but only because of how the interface is drawn, and it would have.**

[PR #93](close-toctou-path-gates-plan.md) established that a gate's verdict is about a
*name*, is carried a long way, and must be re-proved at the point of use: open once refusing
a symlink, and read **through that descriptor** rather than resolving the path again. An
injected reader can destroy that in two ways. A port exposing `open(path) -> fd` and
`read(fd) -> bytes` as separate operations lets a substituted reader ignore the fd and
re-resolve the name. A port exposing a plain `read(path)` for the gated case abandons the
guarantee outright.

So `readSealed` is a **single indivisible operation**: open without following, read through
that descriptor, close, hash — one call, one resolution of the name, and no descriptor ever
escapes the port. An implementation of this interface is never handed the opportunity to
re-resolve, because it is given one name and must answer with the content of whatever that
name opened to, once. The guarantee is unchanged.

`readText` deliberately carries no such guarantee and does not pretend to: it is the
ordinary `readFileSync` `artifact/stale.ts` has always used, and staleness is a hint that
`artifact/write.ts` re-proves against the descriptor it writes through. Two guarantees, two
method names, so a call site cannot silently acquire or lose one.

## 3. Tasks

- [x] **Task 1: the port.** `fs/reader.ts` (`ReaderPort`, `SealedRead`, `DocumentFile`), no
      imports at all, carrying the module note, the hashing rationale and the TOCTOU answer.
- [x] **Task 2: the Node implementation.** `fs/node-reader.ts` — `nodeReader`, `onDisk(path)`,
      and `realpathOr`. The code moves from `fs/gate.ts`, `artifact/stale.ts` and
      `import/resolve.ts` unrewritten.
- [x] **Task 3: narrow `realpathSyncSafe`'s catch.** The review's separate ask in [§4.2](../reviews/2026-09-16.md#42-keep-nodefs-out-of-the-browser-graph-row-3). `catch { return p }`
      also swallowed `realpathSync is not a function` — a stub failure absorbed by error
      handling aimed at a missing file. Now only an error carrying a string `code` (a Node
      errno) takes the fallback; anything else, a `TypeError` included, propagates. Every
      errno is handled exactly as before, so no CLI behaviour moves.
- [x] **Task 4: the phases.** `fs/gate.ts`, `artifact/path.ts`, `import/path.ts`,
      `artifact/stale.ts`, `import/resolve.ts`, `eval/check-charts.ts` take the port;
      `CheckOptions`/`FmtOptions` carry `doc?: DocumentFile`; `cli/commands.ts` passes
      `onDisk(path)`; `index.ts` re-exports the port and `onDisk` for library callers.
- [x] **Task 5: the browser entry.** Header rewritten so the "no node:fs" claim is true and
      structural; `check` and `fmt` wrapped so the only route to the filesystem phases is a
      `ReaderPort` the caller writes. There is no bare `docPath` string in the browser API
      any more, so PR #99's crash cannot be reproduced through `window.VisiMark`.
- [x] **Task 6: the guard, and its mutation test.** `test/playground/browser-graph.test.ts`
      checks the property from both ends — a source-level walk of the browser entry's
      transitive imports, and a grep of the committed bundle — because each end is blind
      where the other sees. Mutation-tested per [§3.1](../reviews/2026-09-16.md#31-findings) row 8.
- [x] **Task 7: rebuild and verify.** Bundle rebuilt and committed; example output diffed
      against the base commit; `bun test`, `lint`, `typecheck`, `format:check`.

## 4. What did not change

- `fs/open.ts` keeps `O_NOFOLLOW`/`O_EXCL` and its lazy `nofollow()` read. The port removed
  the module from the browser graph, so the stub that made the laziness necessary is gone —
  but laziness costs nothing and is the weaker precondition, so it stays, with the reason
  written down rather than the history deleted.
- `artifact/write.ts` is untouched. It is the write side, reachable only from the CLI, and
  gets no port: injecting a *writer* would be inventing a seam nothing needs.
- `fs/gate.ts` and `artifact/stale.ts` are still compiled into the browser bundle. Whether
  they run is a runtime condition no bundler can see, so they cannot be tree-shaken — but
  they now reach nothing that is absent there, which is the whole point.

## 5. Hand-off to [§4.3](../reviews/2026-09-16.md#43-stop-the-playground-failing-its-own-imports-chapter-row-4)

[§4.3](../reviews/2026-09-16.md#43-stop-the-playground-failing-its-own-imports-chapter-row-4) wants the playground to preload `docs/playground/tutorial/13-imports.csv` into the
in-memory file store `playground.html` already maintains and feed it to the engine. That is
now a browser-side `ReaderPort` and nothing else:

```js
var memoryReader = {
  exists: function (p) { return files[p] !== undefined; },
  realpath: function (p) { return p; },            // no symlinks in a Map
  readText: function (p) { return files[p] ?? null; },
  readSealed: function (p) {
    var text = files[p];
    if (text === undefined) return null;
    return { text: text, sha256: sha256Hex(text) };  // e.g. via window.crypto.subtle
  },
};
VM.check(model, { doc: { path: "/tutorial/13-imports.md", reader: memoryReader } });
VM.fmt(source, { doc: { path: "/tutorial/13-imports.md", reader: memoryReader } });
```

The paths are whatever keys that store uses; the gate's containment rules apply to them as
written, so keep the document and its CSV in the same synthetic directory. `readSealed`'s
`sha256` is what decides whether an import reads as `ok`, `stale` or `unstamped`, so it must
be a real SHA-256 of the same text the tutorial's stamp was computed over. `realpath`
returning its input is correct and is the only honest answer a `Map` can give.

Note that `window.crypto.subtle.digest` is asynchronous while `ReaderPort` is not; that work will
need a synchronous SHA-256 (a small implementation, or a digest precomputed at build time
alongside the preloaded CSV) rather than making the port async, which would turn `check`
async for the CLI too.
