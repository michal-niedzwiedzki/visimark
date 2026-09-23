# Record the browser bundle's size as a checked ceiling — feature spec

**Status:** approved (#191) · **Date:** 2026-09-23 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/191#issuecomment-5796346439

## 1. Purpose

`docs/vendor/visimark-browser.js` is a committed, minified build artifact —
today 299,700 bytes. `.github/workflows/ci.yml`'s `playground-bundle` job
rebuilds it with a pinned Bun and fails on any byte difference from the
committed copy, but that check is about *drift*, not *size*: a change that
doubles the bundle passes cleanly as long as the committed copy was rebuilt.
`packages/visimark/test/playground/browser-graph.test.ts` already asserts a
related but distinct property — no `node:` builtin reachable from the browser
entry — from a source walk and a grep over the shipped bytes; neither test
inspects byte length. So the bundle's size can grow without anything noticing,
and a minified single-line file's diff communicates nothing about whether it
grew by 2 KB or 200 KB.

This is the second of three follow-ups spiked in
[#176](https://github.com/michal-niedzwiedzki/visimark/issues/176)'s
architectural-spike check 4 ("record the bundle size — a plugin ships one
`main.js` and mobile is the entire reason fork B exists"); the first half of
that check — no `node:` builtin in the graph — already ships as the existing
tests in the same file.

No existing vocabulary or convention covers this: it is not a document
property, so nothing in the language or `check`/`fmt` touches it, and the only
existing machinery that reads `docs/vendor/visimark-browser.js` is the
byte-diff job (drift, not size) and the four existing `browser-graph.test.ts`
tests (import graph, not size).

## 2. The surface

Not a CLI or command-facing change — no option, flag, or published entry point
is added. The change is entirely internal: a new `bun:test` test in
`packages/visimark/test/playground/browser-graph.test.ts`, run by the existing
`build` job's `bun test` step (the same step that already runs every other
test in the repository; there is no dedicated `playground-bundle`-style job
for this, because unlike the byte-diff check this test needs no pinned Bun —
it only measures a file already present in the checkout).

### 2.1 The constants

Added directly above the new test, in the same file:

```ts
/**
 * The size of docs/vendor/visimark-browser.js the day this check was added
 * (2026-09-23), measured the same way the assertion below measures it —
 * statSync(...).size, matching `wc -c`, not a UTF-8 character count.
 *
 * Bump this only when the growth is real and reviewed. Record the date, the
 * new value, and why, directly above this constant — the way ALLOWED_BUILTINS
 * above records why node:path is the one builtin let through. A bump with no
 * reason is indistinguishable from a bundle nobody looked at.
 */
const BASELINE_BYTES = 299_700;

/** 10% over the baseline — a margin, not a byte-exact pin, so an unrelated
 * minifier version bump doesn't fail this check the way a byte-exact pin
 * would (the exact churn `playground-bundle` is pinned to Bun 1.4.2 to avoid). */
const MAX_BUNDLE_BYTES = Math.ceil(BASELINE_BYTES * 1.1); // 329,670
```

## 3. The machine contract

| Outcome | Exit code (`bun test`) | stdout | stderr |
|---|---|---|---|
| Bundle size ≤ `MAX_BUNDLE_BYTES` | `0` (this test passes; overall suite exit code depends on all tests) | normal `bun test` pass summary | — |
| Bundle size > `MAX_BUNDLE_BYTES` | `1` (this test fails, failing the `bun test` step and the `build` CI job) | normal `bun test` failure summary, including the message below | the assertion message (bun:test prints failure detail to stdout, matching every other assertion already in this file) |

No new exit code, no `--json` shape, no stream split beyond what `bun test`
already produces for any other assertion in this file — this is not a
published contract, it is an internal check, matching the issue's own "no
change to any published surface."

## 4. Behaviour table

| Case | `docs/vendor/visimark-browser.js` size | Result |
|---|---|---|
| Unchanged from today | 299,700 bytes | Passes — well under 329,670. |
| Grown, still under the ceiling | e.g. 310,000 bytes | Passes — no action needed. |
| Grown past the ceiling | e.g. 330,000 bytes | **Fails.** Message: `` `docs/vendor/visimark-browser.js` is 330000 bytes, over the 329670-byte ceiling (10% over the 299700-byte baseline recorded 2026-09-23). If this growth is real and reviewed, bump BASELINE_BYTES above with the date and reason and rebuild; if not, something new was pulled into src/playground/browser-entry.ts's import graph — the source-walk test above names the file. `` |
| Shrunk | e.g. 250,000 bytes | Passes. No floor is checked — a shrinking bundle is never a problem this check exists to catch. |

Acceptance is this table: the fixture is the committed bundle itself (no new
fixture file), and the literal message above is what the plan's implementation
must produce byte-for-byte (modulo the actual measured size in the failing
case).

## 5. Compatibility

- **`playground-bundle` job** (`.github/workflows/ci.yml`): unaffected. It
  still only compares the committed bundle against a fresh rebuild; this
  change adds a second, independent question ("is it too big") that runs in
  the ordinary `bun test` step of the `build` job, not in `playground-bundle`.
  A PR that grows the bundle without changing its rebuild-fidelity now fails
  in `build` where it previously passed everywhere — this is the intended new
  failure mode, not a regression, and it is the entire purpose of #191.
- **The composite Action** (`action.yml`) and every downstream consumer:
  untouched. Nothing about `visimark check`/`fmt`/the Action's invocation
  changes.
- **`docs/ci.md`**: not invalidated. As the pre-review found, this file is a
  user-facing tutorial for a downstream adopter's own CI and contains no
  reference to this repository's internal jobs; it does not claim to
  enumerate them and needs no edit.
- **No existing document in `docs/` is affected.** This check reads a build
  artifact, not a VisiMark document; `check`/`fmt`/`infer`/`explain`/`eval`
  behave identically for every document in the repository before and after.

## 6. Interaction with the rest of the tooling

- **The other three `browser-graph.test.ts` tests** are unaffected; the new
  test is a sibling assertion in the same file, with its own comment block
  (see §2.1) rather than a rewrite of the file's existing
  "**Why this file exists**" header, which stays scoped to the `node:`-builtin
  invariant it already describes accurately.
- **`--json`, the release workflow, the LSP/extension, the review workflow**:
  none interact with this check. It has no representation in any of them.
- **What does not change:** the bundle-generation command
  (`bun run --filter visimark build:playground`), the `playground-bundle` CI
  job, the committed bundle's own bytes (this is a read-only check), and every
  existing test in `browser-graph.test.ts`.

## 7. Documentation to update

None. The pre-review's correction stands: `docs/ci.md` does not enumerate this
repository's own CI jobs and needs no edit, and no other file in `docs/`
currently makes a claim this change would invalidate. The only text that
changes is the new in-file comment block described in §2.1, which is part of
the implementation itself, not a separate documentation artifact.

## 8. Non-goals

- **No byte-exact pin.** Explicitly rejected in the issue and here, for the
  reason `playground-bundle`'s own pinned-Bun comment already gives.
- **No gzip-size tracking.** Rejected in the issue: less stable across
  toolchains, and would need its own pinned compression settings.
- **No report-only logging.** Rejected in the issue, citing the repository's
  own precedent that an asserted-but-untested property was once false without
  anyone noticing.
- **No change to what triggers a bundle rebuild**, to `playground-bundle`
  itself, or to any published surface.

**Reversibility.** Fully reversible without a release: deleting the new test
and its two constants restores exactly today's behaviour. No migration, no
version bump, no consumer-visible effect either way.

## 9. Open questions

None.
