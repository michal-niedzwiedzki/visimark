# Move the playground's application code under the quality gates — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.4 (row 4, High). Refactor
only — no paired spec, per the repo convention that refactors do not carry a
design doc. This one exists because §2.4's "done when" asks for the *choice* to
be recorded, not the behaviour.

**Goal:** the 1,535 lines of application logic inside `docs/playground.html`'s
`<script>` tag become ordinary TypeScript under `packages/visimark/src/`, so
that `bun run lint`, `bun run format:check`, `bun run typecheck` and `bun test`
all fail on a bad edit to it — with the page's behaviour unchanged, byte for
byte, in every panel.

---

## The decision §2.4 asked for

The review laid out three options. **(b) TypeScript through the existing
bundler** is what landed.

- **(a) a plain `docs/playground/app.js`** would have bought oxlint and oxfmt
  for free and kept the page a pure static asset. It buys no typechecking, and
  typechecking is what this code needed most: the bugs it has had are `null`
  DOM lookups, a `charts` array that may be absent, and two file-switch paths
  that drifted (row 11) — all of them shapes, not style.
- **(c) an HTML-aware linter** adds a toolchain dependency whose only consumer
  is one file, and still leaves `tsc` blind.
- **(b)** pays the artifact-commit tax the 2026-09-15 review already built CI
  machinery for. That tax is now genuinely marginal: the `playground-bundle`
  job diffs **`docs/vendor/` as a directory**, so a second committed bundle in
  it is covered by the job that already exists, with no new CI, no new pin and
  no new failure mode.

**The engine is not bundled twice.** The application reaches VisiMark through
`window.VisiMark`, the global `browser-entry.ts` already assigns, and imports
only `import type { VisiMarkApi }` from it — which compiles away to nothing.
The result is a 27 KB application bundle beside the 288 KB engine, rather than
576 KB of engine.

**ES5 style was an accident, not a constraint, and is fixed.** The old script
was `var`/`function` throughout with no optional chaining, for no reason the
page requires — it is served to the same browsers that run CodeMirror 5 and
`canvas-confetti`. The port is `const`/`let`, arrow functions, template
literals and `?.`. It is the one part of this change that is not mechanical,
which is why the verification below compares rendered output rather than
diffs.

## Why the browser UI gets its own TypeScript program

`tsconfig.base.json` sets `lib: ["ES2023"]` with no DOM, and that is
load-bearing: it is why the engine and the CLI *cannot* quietly reach for a
browser global, which is the same property `src/fs/reader.ts` exists to give
the filesystem. Adding DOM to the base config to satisfy one directory would
spend it.

So `packages/visimark/tsconfig.app.json` compiles `src/playground/app/` (and
its tests) with `lib: ["ES2023", "DOM", "DOM.Iterable"]`, and the two existing
configs exclude that directory — `tsconfig.json` because it has no DOM,
`tsconfig.build.json` because the browser UI is not part of the published
package. `typecheck` runs both programs.

## Module layout

One file per concern, wired in `main.ts`:

| module | what it owns |
|---|---|
| `sources.ts` | which documents exist and where they are fetched from |
| `store.ts` | the in-memory file store and the `ReaderPort` over it |
| `terminal.ts` | the TERMINAL transcript and its 400-line cap |
| `pipeline.ts` | `fmt` → terminal, eval/explain/preview, the 500 ms debounce |
| `checks.ts` | the quest vocabulary: what scenario data may ask to detect |
| `quest.ts` | scenario rendering, the quest engine, the completion sequence |
| `badges.ts` | badge artwork, `localStorage`, the social share handoff |
| `files.ts` | the FILES panel and the single `switchTo` |
| `builder.ts`, `infer.ts`, `knowledge.ts`, `reference.ts`, `tabs.ts`, `agents.ts`, `clipboard.ts`, `dom.ts` | one panel or one idiom each |

Two seams are worth naming:

1. **`checks.ts` splits `CHECKS` in two.** `column-added` needs a second field
   off the step; every other check does not. Keeping them in one map meant
   widening every predicate's signature to carry an argument only one of them
   uses. Two maps let `normalizeStep` *refuse* `{"kind":"eval","check":
   "column-added"}` with no `column`, which previously matched nothing, silently.
2. **`main.ts` has one forward reference.** The pipeline supplies the STALE
   check the quest engine reads, and the quest engine consumes the pipeline's
   eval results — a genuine cycle. It is resolved with one accessor
   (`quest()`), which throws rather than returning `undefined` if anything ever
   calls it before boot finishes, instead of with a mutable module-level
   binding that would fail as a `null` dereference somewhere else.

## Row 11 resolved along the way

§2.11 asked for the two file-switch paths to be collapsed and for the
`trimTerminal()` divergence to be settled deliberately rather than by accident.
`files.ts` has one `switchTo`, and it **does** trim — the stricter of the two
behaviours, and the one the 400-line cap exists for. The "+ New" path omitting
it was an oversight, not a decision.

## Verification

The four gates were the point, so they are the first check: `bun run lint`,
`bun run format:check`, `bun run typecheck` and `bun test` all now read this
code, and a typo in it fails `typecheck` where before it failed nothing.

Behaviour was verified by rendering, not by reading. Both pages — the committed
one at `HEAD` and the extracted one — were served and loaded in headless
Chromium at `?file=demo.md`, `01-tables.md`, `12-charts.md` and `13-imports.md`,
and the rendered text of TERMINAL, KNOWLEDGE and REASONING compared. All twelve
comparisons are identical, including `13-imports.md`'s resolved CSV import and
`12-charts.md`'s inlined SVG.

`test/playground/imports-chapter.test.ts`'s third test read `playground.html`
for the import wiring; its needles moved to `sources.ts`, `store.ts` and
`pipeline.ts`, and it additionally asserts the page loads the bundle at all.
`test/playground/app/quest-steps.test.ts` is new: the quest engine's data
contract — `normalizeStep` and every check predicate — is pure and was
previously untestable at any price.

## One incidental fix

`.oxfmtrc.json` now skips `docs/vendor/`, as `.oxlintrc.json` already did.
Without it oxfmt un-minifies a committed bundle and the next build re-minifies
it, which is a permanent diff that fails CI on every pull request. The existing
bundle escaped this only by being a single line long enough for the formatter
to leave alone.

## Not in scope

§2.1 (boot failure path), §2.2 (responsive layout) and §2.3 (tab/motion
semantics) all touch this code and all land next, on top of it — which is the
sequencing §3 of the review asks for, and the reason this one went first.
