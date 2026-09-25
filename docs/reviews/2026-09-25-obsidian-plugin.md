# VisiMark — code review: the Obsidian plugin

**Date:** 2026-09-25 · **Commit:** `869a819` (`obsidian-integration`) ·
**Scope:** `editors/obsidian/` and the changes on `obsidian-integration` that
exist for it — the engine's browser entry point (#201), the envelope split
(#204), per-anchor `STALE` (#235), the plugin spec and manual test, and the
vendored Obsidian skills.

Reviewed: 3,408 lines of plugin source in 29 modules, 2,131 lines of plugin
tests (154 passing, 940 assertions, 2.4s), the 752-line spec, the manual test
script, and 45 commits over merge-base `4a1c9da`. On the branch head:
`typecheck` clean across all seven workspaces, `lint --max-warnings 0` clean,
`format:check` clean, and `main.js` builds to 286,018 bytes (under the
307,292-byte ceiling) with exactly three `require`s: `obsidian`,
`@codemirror/state`, `@codemirror/view`. The full `bun test` run in a fresh
worktree reports 1,778 pass and 4 fail. All four failures are outside this
scope: `editors/vscode` needs a built `dist/`, and the MCP spawn test needs
Node on PATH.

Several findings below were **reproduced** during the review with throwaway
tests and a benchmark against the branch. Each one is marked as reproduced.
Findings that depend on Obsidian runtime behaviour that can't be run here are
marked **plausible**.

**Overall: B.** The parts of this plugin that don't touch Obsidian are as good
as anything in the repository. The engine boundary is enforced from both ends,
the vault reader asks the engine instead of re-deriving it, and every write is
guarded against stale offsets and applied as one undo step. The audience-B
vocabulary is checked for completeness at compile time. The problems sit in
the ~1,800 lines of Obsidian glue, which has no automated test at all and has
never run in a real vault (README, "What is built so far"). Seven of the
branch's fix commits landed in that layer. The two most serious findings are
also there. The activation gate makes *ordinary* notes pay for a full Markdown
parse, per keystroke in Live Preview and per rendered section in reading mode.
And a value derived from an imported CSV is marked as agreeing with its
formula when it does not.

---

## 1. Findings

| # | Area | What the code actually does | Rating | Suggestion |
|---|---|---|---|---|
| 1 | **Pure core / DOM split** | Every decision about a document lives in a module that imports nothing from `obsidian`: [report.ts](../../editors/obsidian/src/report.ts) (rows, repairs, fix-all), [decorations.ts](../../editors/obsidian/src/decorations.ts) (what is marked and where), [findings.ts](../../editors/obsidian/src/findings.ts), [infer-plan.ts](../../editors/obsidian/src/infer-plan.ts), [status.ts](../../editors/obsidian/src/status.ts), [sweep.ts](../../editors/obsidian/src/sweep.ts), [api.ts](../../editors/obsidian/src/api.ts) (with `read`/`resolve` injected). The view files are left with DOM and gestures. | **A** | Keep. This is what makes rows 13–14 possible, and it's why the defects below are all in the glue. |
| 2 | **Engine boundary** | [browser.ts](../../packages/visimark/src/browser.ts) is a tested *subset* of `index.ts` (`entry-graph.test.ts`). #204 moves the two version-stamping builders into [envelope.ts](../../packages/visimark/src/report/envelope.ts) so the rest of `report/` bundles for a browser, and `version-reach.test.ts` stops a third module from reaching `node:module`. [bundle.test.ts](../../editors/obsidian/test/bundle.test.ts) checks for zero `node:` specifiers from both ends (source walk + emitted bytes), bans dynamic `import()`, and builds from the exported esbuild `options`, so the guard can't drift from the build. `node:path` is replaced by [browser-path.ts](../../editors/obsidian/src/browser-path.ts), which is pinned against `path.posix`. | **A+** | Keep. Three resolvers (`tsc` paths, `bun test`, esbuild alias) are made to agree, and a test ties them together. That's the right level of paranoia for a bundle that has to load on a phone. |
| 3 | **Vault reader by discovery** | [snapshot.ts](../../editors/obsidian/src/snapshot.ts) runs `check` against a recording reader, fetches what it asked for, and repeats to a fixed point. `MAX_ROUNDS` turns the spec's "path requests are syntactic" into an assertion that throws. It reuses the engine's own `memoryReader`/`sha256Hex`. The symlink limitation (#233) is written up honestly, with the reason it can't be closed without Node. | **A** | Keep. Asking the engine which paths it reads can't drift from the engine. The cost is one extra `check` per note, and it's documented. |
| 4 | **Activation gate costs a full parse on ordinary notes** | [gate.ts:25](../../editors/obsidian/src/gate.ts#L25) is `locate(source).blocks.length > 0`, a remark+GFM parse of the whole note, with no prefilter. It runs **undebounced on every keystroke** in every Live Preview editor ([live-preview.ts:55](../../editors/obsidian/src/live-preview.ts#L55), whose comment says this "must cost a substring scan"). It also runs **once per rendered section** in reading mode ([reading-mode.ts:54](../../editors/obsidian/src/reading-mode.ts#L54), where `info.text` is the whole note), and on every leaf change in `main.ts` and the findings view. **Reproduced:** on a 19 KB ordinary note, `hasVmarkBlock` takes 12.7 ms against 0.001 ms for `includes("vmark")`. The note has 87 top-level blocks, and 87 gate calls (one reading-mode render, before virtualisation) take ~1.05 s. The false-negative-free prefilter already exists as `mightHaveBlock` in [sweep.ts:83](../../editors/obsidian/src/sweep.ts#L83) and is asserted over the corpus, but only the sweep uses it. | **C−** | Move the prefilter into the gate. After that change, an ordinary note costs a substring scan on every surface. Constraint 4 ("indistinguishable from a vault without the plugin") covers latency as much as it covers pixels. See [§2.1](#21-make-the-gate-cheap-and-analyse-each-source-once-rows-4-5). |
| 5 | **Per-section re-analysis in reading mode** | For a note that *does* have a block, [decorateSection](../../editors/obsidian/src/reading-mode.ts#L50-L65) runs gate + `locate` + `build` + `check` + `decorationsFor` over the whole note **for each section**, then keeps only the decorations inside that section. **Reproduced:** 6.9 ms per section on `example-invoice.md`. With ~34 sections, that's ~235 ms of identical work per render. `at-cursor.ts:31` re-`locate`s a model that already carries `located`. | **C** | Memoise one analysis per source string, shared by the gate, both renderers and `nameAt`. It's the same fix as row 4. See [§2.1](#21-make-the-gate-cheap-and-analyse-each-source-once-rows-4-5). |
| 6 | **Marks ignore imports and can show a disagreeing value as agreeing** | Both renderers call `check(model)` with no reader ([reading-mode.ts:60](../../editors/obsidian/src/reading-mode.ts#L60), [live-preview.ts:70](../../editors/obsidian/src/live-preview.ts#L70)). **Reproduced:** in `benchmark.md` with an anchor `**1.00**<!--vmark=benchmark.Mean-->`, where the true value is 12.47, the snapshot-backed check reports `STALE=12.47` and the mark is `disagrees`. The reader-less check the renderers use reports **no findings at all** and marks it `computed`. The Live Preview header's argument that it "produce[s] `IMPORT`, not `STALE`, so a value is never *wrongly* called disagreeing" doesn't hold: no `IMPORT` is emitted, and the error goes the other way. The status bar says "1 to look at" while the value on screen looks fine. | **C** | Decorate from the same snapshot-backed analysis the status bar uses: async post-processor in reading mode, and a `StateEffect` in Live Preview once the snapshot resolves. Until it resolves, don't claim `computed` for a value whose inputs are unread. See [§2.2](#22-decorate-from-the-snapshot-and-re-render-when-the-verdict-changes-rows-6-7). |
| 7 | **Reading-mode marks and tooltips go stale (plausible)** | Obsidian re-runs post-processors only for sections whose text changed. A table whose cells become stale because an input in *another* section changed keeps its old marks. Separately, `data-vmark-hovered` ([main.ts:256](../../editors/obsidian/src/main.ts#L256)) caches the first tooltip for as long as the element exists. | **B−** | Re-render reading views of a VisiMark note when its verdict changes (`previewMode.rerender(true)`, debounced), and drop the permanent hover cache or key it on the source's identity. See [§2.2](#22-decorate-from-the-snapshot-and-re-render-when-the-verdict-changes-rows-6-7). |
| 8 | **Sweep and status bar disagree about advice** | [status.ts:15-18](../../editors/obsidian/src/status.ts#L15-L18): "a note whose only finding is 'defined but never used' is a note that agrees with itself. Saying otherwise would train a reader to ignore the status bar." [sweep.ts:127](../../editors/obsidian/src/sweep.ts#L127) skips a note only if `isClean`, which means no problems *and* no advice. **Reproduced:** a note whose only finding is `WARN` is listed by the sweep, and the summary reads "1 note disagrees with itself" while the status bar for that note reads `VisiMark ✓`. | **C+** | List a note only if `problems > 0`. Advice-only notes can be a separate, quieter count if they're wanted at all. See [§2.3](#23-make-the-sweep-agree-with-the-status-bar-row-8). |
| 9 | **Pop-out windows get no hover, tap or keyboard explain** | The `pointerover`/`click`/`keydown` listeners ([main.ts:244-278](../../editors/obsidian/src/main.ts#L244-L278)) are registered on the main `document` only, and `target()` ([main.ts:688-695](../../editors/obsidian/src/main.ts#L688-L695)) tests `instanceof HTMLElement`, which fails across realms. Commit `869a819` fixed exactly this for the format-on-save listener (`listenForSaveIn` + structural `nodeType` check) but not for these three. | **B−** | Reuse `listenForSaveIn`'s per-window registration for all document listeners, and make `target()` structural. See [§2.4](#24-harden-the-glue-pop-outs-errors-teardown-rows-9-11). |
| 10 | **Commands swallow failures** | `refreshState` and the findings view catch and show "could not be checked" (§3.1). But `format`, `evaluate` and `explain` go through `noteFor` → `readNote` with no `catch` ([main.ts:441-523](../../editors/obsidian/src/main.ts#L441-L523)), so a `MAX_ROUNDS` throw or an engine error becomes an unhandled rejection. The user gets no notice, and the palette command appears to do nothing. | **B** | One `try` in `noteFor` and a notice in the existing vocabulary. See [§2.4](#24-harden-the-glue-pop-outs-errors-teardown-rows-9-11). |
| 11 | **`actionFor` never forgets a closed view** | The `Map<MarkdownView, …>` ([main.ts:113](../../editors/obsidian/src/main.ts#L113)) is pruned only when a view's state goes `hidden` or on unload. A closed leaf's view and its header element stay reachable for the whole session. | **B+** | Prune on `layout-change` (drop views whose leaf is no longer attached). The unload iteration that justified a `Map` over a `WeakMap` still works. See [§2.4](#24-harden-the-glue-pop-outs-errors-teardown-rows-9-11). |
| 12 | **The glue is untested** | [main.ts](../../editors/obsidian/src/main.ts), the two views, both renderers, the modals, settings and `vault.ts` add up to **1,822 lines with no runtime test**. [main.test.ts](../../editors/obsidian/test/main.test.ts) is a regex over the source and says why: "there is no `bun test` harness that can load the real `obsidian` module and call `onload`." Commits `c463d3e`, `25682e9`, `b55f7b9`, `01b2eb3`, `c5af574`, `608ca50` and `869a819` all fixed defects in this layer, and rows 4, 6, 8, 9 and 10 are there too. The README says nothing has run in a real vault. | **C+** | Add a small `obsidian` stub via `mock.module` plus a DOM, enough to call `onload` and drive `refresh`, `format`, the post-processor and the listeners. See [§2.5](#25-a-test-harness-for-the-obsidian-glue-row-12). |
| 13 | **Tests of the pure core** | 154 tests. `report.test.ts` proves that applying every row's repair converges on `fmt`. `infer-plan.test.ts` proves no-rewrite by reconstruction. `sweep.test.ts` checks the prefilter over the corpus in both directions. `templates.test.ts` checks the generated module byte-for-byte against its Markdown sources, and each template passes `check` with zero findings. `api.test.ts` compares every name against `eval --get`. | **A** | Keep. Properties are tested against the CLI instead of against hand-written expectations. |
| 14 | **Audience-B vocabulary** | `TEXT: Record<FindingCode, …>` ([findings.ts:67](../../editors/obsidian/src/findings.ts#L67)) turns a new engine code into a compile error until it has words. Codes appear only in `aria-label`. `COVERAGE`'s two opposite cases are told apart. The `ADVICE` set ([findings.ts:147](../../editors/obsidian/src/findings.ts#L147)) is a second list, even though the comment says it "agrees … by construction rather than by keeping a second list". `isProblem` is exported from `browser.ts`. | **A−** | Replace `ADVICE.has(code)` with `!isProblem(f)`. Then the comment is true. |
| 15 | **Write discipline** | Every write goes through `editor.transaction` as one undo step: Format, per-row repair, and Infer (which honours both endpoints for the marker deletion). Stale offsets are refused (`renderedSource` in the findings view, a `getValue()` re-compare in `format`). `noArtifacts` is always on, so a stale chart keeps its row without a button. The generation counters (`renderId`) mean only the newest refresh paints. | **A** | Keep. Constraint 3 is enforced in the structure of the code, not just asserted in comments. |
| 16 | **Format on explicit save** | Listens for Ctrl/Cmd+S (unmodified, from inside the active editor, in every window). The first press saves the pre-repair bytes and autosave lands the repair. The palette's "Save file" is not covered. All of this is stated in the settings text and the changelog. | **B** | Acceptable as shipped, and honestly documented. Don't hook `editor:save-file` by patching `app.commands`: it's private API and a registry-review flag. Revisit if Obsidian adds a save event. |
| 17 | **Live Preview extension** | Rebuilds the full pipeline synchronously on every `docChanged` (~7 ms per keystroke on the invoice on desktop; mobile will be several times that). It also runs in Source mode, though the setting is named "in Live Preview". Toggling the setting takes effect only on the next edit ([live-preview.ts:90-93](../../editors/obsidian/src/live-preview.ts#L90-L93)). | **B−** | Map existing decorations through `tr.changes` on each keystroke and recompute on a debounce. Check `editorLivePreviewField`. Push a `StateEffect` when the setting flips. See [§2.6](#26-live-preview-map-then-debounce-row-17). |
| 18 | **Explain can't answer for a table cell** | [at-cursor.ts](../../editors/obsidian/src/at-cursor.ts) returns `null` inside a cell because the row "cannot be [identified] cheaply". But `decorationsFor` already computes every computed cell's span together with its `row` and `name`. A tap on a cell opens a row-scoped Explain, while the Explain command with the caret on the same cell says "put the cursor on a value". | **B** | Resolve the caret against `decorationsFor`'s cell spans and pass `row` to `ExplainModal`. See [§2.7](#27-explain-a-table-cell-from-the-caret-row-18). |
| 19 | **Public API** | Values are strings, `apiVersion` is frozen, and `explainBinding` is shared with the Explain command so the buffer and saved paths use one implementation. Every call does a fresh read + discovery `check` + final `check` + `evalValues` (twice for `explain`). An agent calling `get` for each of 20 names pays for 20 full analyses. The API answers from the saved copy (`cachedRead`), while Live Preview marks come from the buffer, so a hover over a just-typed value can answer `null` or describe the previous text. | **B+** | Memoise `analyse` on `(path, file.stat.mtime)` in a small LRU. Document "answers from the last saved state" in the `VisiMarkApi` doc comment, since that's the contract a second plugin needs to know. "Semver'd" on a literal `1` is really "an integer that only ever goes up", so say that. |
| 20 | **Distribution and version claims** | [manifest.json](../../editors/obsidian/manifest.json) says `minAppVersion: 1.8.7` (raised in `869a819` for `displayTooltip`), but [README §minAppVersion](../../editors/obsidian/README.md) and spec §2.2 still say `1.0.0`, and "every API … predates the floor". The `obsidian` typings are `^1.8.7` and resolve to **1.13.1**, so `tsc` can't catch an API newer than the floor; `override settings` already uses a 1.13.0 declaration. The manifest isn't at the repo root, where the community registry reads it, there's no release workflow, and `release.yml` only fires on `v*` tags, while an Obsidian release tag must equal the manifest version. The manual test names a command "Look through the vault"; it ships as "Sweep the vault". | **C+** | Before the registry submission: fix the version prose, pin typings to the floor (or add an `@since` check), and decide the release mechanics. See [§2.8](#28-make-the-version-and-release-story-true-row-20). |
| 21 | **Template insertion** | `editor.replaceSelection(template.body)` ([main.ts:374](../../editors/obsidian/src/main.ts#L374)) inserts at the caret. Mid-line, the `# Invoice 001` heading and the opening fence land on a line that already has text, so the block isn't a block. Inserted into a note that already has a `vat` scalar or a `#lines` sheet, the template produces `DUP` findings. | **B** | Insert at the start of the next empty line, padded with blank lines. If the note already has a VisiMark block, either warn or open the template in a new note. The spec's "a template passes `check` with zero findings" is only true in an empty note. |
| 22 | **Sweep pane behaviour** | `drawProgress` empties and rebuilds the whole pane every 50 notes, so the **Stop** button is replaced each chunk and keyboard focus is lost. `onOpen` awaits the entire sweep. Obsidian awaits `onOpen` inside `setViewState`, so `openSweep`'s `revealLeaf` probably runs only after the scan finishes (plausible). A cancelled sweep is reported with the same words as a finished one plus a prefix. | **B** | Build the progress line once and update its text. Start the scan without awaiting it in `onOpen`. |
| 23 | **Comments** | Rationale-first and dense, in keeping with the house style. Some comments are now **false**: the Live Preview gate "substring scan" (row 4), "`IMPORT`, not `STALE`" (row 6), "agrees … by construction" (row 14), and `vault.ts:39-42`, which says a CSV "is not a `TFile`" (every vault file is a `TFile`; it's harmless, because `cachedRead` works on any file). In `main.ts`, the #232 rationale appears twice (class doc and `actionFor` doc). | **B+** | Fix the four false comments along with the rows above. In a codebase where comments carry design weight, a wrong one does more damage than a missing one. |
| 24 | **Per-anchor `STALE` (#235)** | The engine change the plugin needed: every drifted anchor of a scalar now gets its own spanned finding, so a span-matched mark can't call a second drifted site "computed". Docs and counts were updated (26 → 27), and the browser bundle was rebuilt. | **A** | Keep. It's a consumer-driven engine fix with the reason stated in the code. |
| 25 | **Vendored Obsidian skills** | ~4,500 lines from `kepano/obsidian-skills` and `gapmiss/obsidian-plugin-skill`, left unedited, pinned by content hash in `skills-lock.json`, shimmed per the `AGENTS.md` layout, with provenance and licence recorded in [.agents/skills/README.md](../../.agents/skills/README.md). | **A−** | Fine. `gapmiss` is labelled "a reference, not an authority", which is the right label for it. |

### Priority order

1. **[§2.1](#21-make-the-gate-cheap-and-analyse-each-source-once-rows-4-5).** Every ordinary note in every vault pays for it, which breaks the plugin's central promise. It's also the cheapest fix here: the prefilter already exists and already has its test.
2. **[§2.2](#22-decorate-from-the-snapshot-and-re-render-when-the-verdict-changes-rows-6-7).** The plugin's main visual feature can show a disagreeing value as agreeing.
3. **[§2.3](#23-make-the-sweep-agree-with-the-status-bar-row-8).** Two surfaces give contradicting verdicts about the same note. It's a one-line fix.
4. **[§2.5](#25-a-test-harness-for-the-obsidian-glue-row-12).** This is the layer where the branch's defects have landed, and the one Part 2 of the manual test leans on a person to cover.
5. Then [§2.4](#24-harden-the-glue-pop-outs-errors-teardown-rows-9-11), [§2.8](#28-make-the-version-and-release-story-true-row-20) (**before** the registry submission), [§2.6](#26-live-preview-map-then-debounce-row-17) and [§2.7](#27-explain-a-table-cell-from-the-caret-row-18).

Rows 14, 19, 21, 22 and 23 are small enough to fold into whichever prompt touches the same file.

---

## 2. Work prompts

Each subsection below is a self-contained brief for an agent picking up that
item with no prior context. They are independent unless a prompt says
otherwise; §2.2 and §2.6 both touch `live-preview.ts` and are best done after
§2.1.

### Shared context for every prompt

VisiMark gives Markdown spreadsheet mechanics: a ` ```vmark ` fenced block
declares column rules over a GFM table, and `visimark check` proves the numbers
in the document still agree with the formulas that produced them.
`editors/obsidian` is the Obsidian client. It embeds the engine through
`packages/visimark/src/browser.ts`, runs on desktop *and mobile*, and is
written for readers who have never run a CLI ("audience B").

The design is `docs/design/obsidian-plugin-spec.md`. The acceptance script is
`docs/design/obsidian-manual-test.md` Part 2. The v1 rows are on issue #176.

Repository conventions you must follow:

- **Runtime is Bun.** Test with `bun test editors/obsidian` (and `bun test`
  for everything). Typecheck with `bun run typecheck`, lint with `bun run lint`
  (`--max-warnings 0`), format with `bun run format`. Build the plugin with
  `bun run --filter visimark-obsidian build`. Never use `bunx visimark`: it runs
  the last published build instead of your working tree.
- **`visimark` means `packages/visimark/src/browser.ts` here**, in three
  resolvers at once (`tsconfig.json` paths, `bun test`, the esbuild alias).
  Don't import engine paths directly.
- **Zero `node:` specifiers may reach `main.js`.** `test/bundle.test.ts`
  enforces this from both ends and bans dynamic `import()`. The bundle also has
  a size ceiling in that file. If you move it, record the date and the reason
  where the file asks you to.
- **v1 constraints from #176 that are load-bearing in review:**
  constraint 3, *nothing is written except on an explicit act*;
  constraint 4, *a vault of ordinary notes is indistinguishable from one without
  the plugin*; constraint 6, *no finding codes, no red, no "1 problem" in the
  UI*. Every user-visible string goes through the vocabulary in
  `src/findings.ts` / `src/status.ts`.
- **`strict` + `noUncheckedIndexedAccess`, zero `any`, zero `as any`, zero
  `@ts-ignore`.** `as unknown as` is used exactly once (the duplicate
  `@codemirror/state` workaround in `live-preview.ts`) and has a comment
  explaining it. Don't add a second.
- **Comments explain *why*.** Match the density and voice. If your change makes
  an existing comment false, fix the comment in the same commit.
- **User-visible change** gets an entry under *Unreleased* in
  `editors/obsidian/CHANGELOG.md`.
- **Attribution.** The maintainer stays the Git author. Credit the AI only with
  one `Co-Authored-By` trailer naming the model actually running the session.
  See `.agents/rules/ai-attribution.md`. Conventional commits
  (`fix(obsidian):`, `perf(obsidian):`, `test(obsidian):`, `docs(obsidian):`).
- **There is no Obsidian runtime in the test suite** (see §2.5). A change to
  the glue that isn't covered by a test must say, in its PR, which manual-test
  section a person has to re-run.

---

### 2.1 Make the gate cheap, and analyse each source once (rows 4, 5)

**Rating: C− / C. The highest-priority item: it breaks constraint 4 for every ordinary note.**

**Status: OPEN**

#### The problem, reproduced

`hasVmarkBlock` in `editors/obsidian/src/gate.ts` is
`locate(source).blocks.length > 0`, a full remark + GFM parse. On a 19 KB
note with no block, it measured **12.7 ms**, against **0.001 ms** for
`source.includes("vmark")`.

It is called:

- in `live-preview.ts` `marksFor`, **on every keystroke, undebounced**, in
  every editor, including editors on ordinary notes. The comment above that
  call says "an ordinary note must cost a substring scan", which is untrue
  today;
- in `reading-mode.ts` `decorateSection`, **once per rendered section**, and
  each call parses the *whole* note (`info.text`). That note has 87 top-level
  blocks; 87 gate calls took ~1.05 s. Obsidian virtualises long notes, so the
  real figure is the number of visible sections, but even 20 sections is a
  quarter of a second on desktop just to decide *not* to do anything;
- in `main.ts` `refresh` / `noteFor` / `openFindings` and in
  `findings-view.ts` `refresh`, on every leaf change.

For a note that has a block, `decorateSection` goes on to run `locate` again,
then `build`, `check` and `decorationsFor`, **per section**, and filters down
to that section's decorations: 6.9 ms × ~34 sections on
`docs/example-invoice.md`. `at-cursor.ts` calls `locate(model.source)` even
though `model.located` exists.

A prefilter with **no false negatives** already exists: `mightHaveBlock` in
`sweep.ts`. It relies on the fence info string being `vmark` (the engine
compares `node.lang === "vmark"` case-sensitively in
`packages/visimark/src/parse/document.ts`). `sweep.test.ts` already asserts it
over the corpus in both directions.

#### What to do

1. **Move `mightHaveBlock` into `gate.ts`** and make `hasVmarkBlock` return
   `false` straight away when it fails. `sweep.ts` imports it from there. Keep
   the sweep test's corpus assertions and point them at the gate. The gate's
   doc comment should state both halves: the substring scan answers "cannot
   be", and the parse answers "is".
2. **Add a one-entry analysis memo** (a new `src/analysis.ts`):
   `analyse(source) → { located, model, result, decorations }`, keyed on the
   source string (compare by `===`; one entry is enough, because every caller
   in a render or keystroke passes the same text). The gate, both renderers
   and `nameAt` read from it. In reading mode, every section of one render
   then shares one analysis.
3. Fix the false Live Preview comment and the reading-mode comment to describe
   the new costs.

#### Constraints

- **No false negatives, ever.** A note the CLI checks must never be gated shut.
  Keep the corpus assertion. Add one for `~~~vmark` and for an indented fence
  if they aren't already covered.
- The memo must never hand one note's analysis to another. Keying on the exact
  source string guarantees that. Don't key on path.
- Row 6 (§2.2) will need a *snapshot-backed* analysis for decorations. Leave a
  seam: the memo computes the reader-less analysis, and §2.2 adds the
  snapshot. Don't build §2.2 here.
- Verify with a benchmark in the PR description (before/after for an ordinary
  note and for `example-invoice.md`), not only with tests. Don't add a timing
  assertion to the suite; it will be flaky.

---

### 2.2 Decorate from the snapshot, and re-render when the verdict changes (rows 6, 7)

**Rating: C. The primary visual feature can show a disagreeing value as agreeing.**

**Status: OPEN**

#### The problem, reproduced

Both renderers decorate from `check(model)` **with no reader**
(`reading-mode.ts:60`, `live-preview.ts:70`). Take
`packages/visimark/test/fixtures/import/benchmark.md`, make `Mean` precision 2,
and append `The mean is **1.00**<!--vmark=benchmark.Mean-->.` (the true mean
is 12.47):

| Check | Findings | Mark on `1.00` |
|---|---|---|
| no reader (what the renderers do) | *none* | `computed` |
| `readNote` snapshot (what the status bar does) | `STALE` (12.47), `STALE` group | `disagrees` |

So the status bar says "1 to look at" and the value shows a single hairline,
which reads as "worked out and fine". The Live Preview header's argument that
an unresolved import "produces `IMPORT`, not `STALE`, so a value is never
*wrongly* called disagreeing" is wrong in both halves: without a reader no
`IMPORT` is emitted, and the error is a disagreeing value marked as agreeing.
`docs/design/obsidian-manual-test.md` §2.2 ("Try a note whose CSV import is
missing") repeats the same assumption.

A second, related issue can't be reproduced without Obsidian and is
**plausible**. Obsidian re-runs post-processors only for sections whose text
changed, so a table whose cells turned stale because a scalar in another
section changed keeps its old marks in reading mode. The hover cache
(`data-vmark-hovered`, `main.ts:256`) likewise keeps the first answer for as
long as the element lives.

#### What to do

1. **One snapshot-backed analysis per note.** Extend §2.1's memo with an async
   `analyseWithSnapshot(source, path)` that goes through `readNote` +
   `vaultSweepRead` and caches on `(path, source)`. `main.ts`'s `refreshState`
   already does this; share it so the status bar and the marks can't differ.
2. **Reading mode:** a `MarkdownPostProcessor` may return a `Promise`. Await
   the snapshot analysis, then decorate. If the element has been detached by
   the time it resolves (`!el.isConnected`), do nothing.
3. **Live Preview:** decorate synchronously from the reader-less analysis
   *only for values whose inputs are all local*. For a note with any
   `from … .csv` sheet, show no mark on import-dependent values until the
   snapshot resolves, then dispatch a `StateEffect` carrying the new
   `DecorationSet` if the document is unchanged. `dependencies()` already says
   which bindings read an `input-column` of an imported sheet.
4. **Re-render on verdict change:** when a debounced `refresh` for a path
   produces a different set of `disagrees` spans than last time, call
   `view.previewMode.rerender(true)` on reading views showing that file.
   Clear `data-vmark-hovered` in the same pass, or key it on the analysis
   identity.
5. Correct the Live Preview header comment and manual test §2.2's
   missing-import bullet to describe the new behaviour.

#### Constraints

- Constraint 3: none of this writes. A re-render isn't a write. A
  `StateEffect` changes decorations, not the document.
- `decorations.ts` stays pure. Add a test there proving the mark is
  `disagrees` when given the snapshot result for the case above. That's the
  regression test for this row.
- Don't make `ReaderPort` async. `snapshot.ts`'s header explains why that
  would spend the design's main architectural result.
- Mobile: keep the async work off the keystroke path. The debounce in `main.ts`
  is 400 ms; reuse it rather than adding a second timer.

---

### 2.3 Make the sweep agree with the status bar (row 8)

**Rating: C+. Two surfaces give opposite verdicts on one note. One-line fix.**

**Status: OPEN**

#### The problem, reproduced

`status.ts` states the rule plainly: advice never changes a note's state, and
saying otherwise "would train a reader to ignore the status bar". `sweep.ts:127`
skips a note only when `isClean(report)`, which is false whenever there is any
advice. A note whose only finding is `WARN` ("defined but never used") is
listed by the sweep. The sweep's summary says "1 note disagrees with itself",
and the status bar for the same note says `VisiMark ✓`.

#### What to do

- In `sweep()`, skip a note when `report.problems.length === 0`. Keep
  `SweptNote.advice` so a listed note can still say "2 worth knowing".
- Add a `sweep.test.ts` case: an advice-only note is `checked` but not in
  `notes`. The fixture from the review is enough:
  a `#t` sheet with `Twice = Qty * 2`, an unused `bonus = 5`, and an anchored
  `total`.
- If the maintainer wants advice surfaced vault-wide, make it a separate
  count in the summary line, never an entry in the "disagrees" list. **Ask
  before adding that.**

#### Constraints

- Manual test §2.8's fixture ("exactly the three disagreeing notes are listed")
  must still hold. Check whether `example-invoice.md` has advice. If it does,
  this fix is what makes §2.8 pass.

---

### 2.4 Harden the glue: pop-outs, errors, teardown (rows 9, 10, 11)

**Rating: B− / B / B+.**

**Status: OPEN**

#### The problems

- **Pop-out windows.** `main.ts:244-278` registers `pointerover`, `click` and
  `keydown` on the main `document` only, and `target()` (`main.ts:688`) uses
  `node instanceof HTMLElement`. A pop-out is a separate realm with its own
  constructors. Commit `869a819` solved exactly this for format-on-save
  (`listenForSaveIn`, `window-open`, a structural `nodeType` check), but the
  hover/tap/keyboard listeners weren't moved onto it.
- **Unhandled rejections.** `format`, `evaluate` and `explain` await `noteFor`
  → `readNote`, which can throw (`MAX_ROUNDS` in `snapshot.ts`, or an engine
  error). Nothing catches it: no notice, and the command appears to do
  nothing. `refreshState` and `FindingsView.refresh` already follow §3.1
  ("never a clean verdict for a note that failed to check") and show a state.
- **`actionFor` growth.** The `Map<MarkdownView, …>` is pruned only when a
  view goes `hidden` or on unload, so closed views stay reachable.

#### What to do

1. Generalise `listenForSaveIn` into `listenInEveryWindow(type, handler)` and
   register all four document listeners through it. Make `target()`
   structural: `nodeType === 1` for an element, `nodeType === 3` →
   `parentElement`, then `closest`.
2. Wrap `noteFor`'s body in `try`/`catch`. On failure, show one notice (unless
   `silent`) in the existing voice, such as "This note could not be checked,
   so nothing was changed.", and return `null`.
3. On `layout-change`, delete `actionFor` entries whose view's leaf is no
   longer in the workspace (`iterateAllLeaves` to collect the live set).
4. While in `main.ts`, fold in row 21: template insertion goes to the start of
   a fresh line with blank-line padding, and if the note already has a block,
   say so rather than inserting a template that will `DUP`.

#### Constraints

- `event.preventDefault()` on Enter/Space must still fire only when the event
  is on a marked value. Don't widen it.
- Keep the `Map` (not `WeakMap`): the unload iteration is why it's a `Map`.
- After §2.5 exists, each of these gets a test there. Before that, each PR
  names the manual-test section to re-run (§2.3 for pop-outs, §2.4 for
  commands).

---

### 2.5 A test harness for the Obsidian glue (row 12)

**Rating: C+. The layer where the branch's defects have landed.**

**Status: OPEN**

#### The problem

1,822 lines (`main.ts`, `findings-view.ts`, `sweep-view.ts`,
`reading-mode.ts`, `live-preview.ts`, the modals, `settings-tab.ts`,
`vault.ts`) have no runtime test. `test/main.test.ts` is a regex over the
source, and its comment says why: nothing can load `obsidian` under
`bun test`. Seven fix commits on this branch (`c463d3e`, `25682e9`, `b55f7b9`,
`01b2eb3`, `c5af574`, `608ca50`, `869a819`) repaired defects in that layer.
They include wrong-note hovers, the findings pane losing its note, the
clipboard of the wrong window, and a double `registerView` that disabled the
whole plugin. Rows 4, 6, 8, 9 and 10 of this review are also there.

#### What to do

Build a **minimal, honest stub**. It isn't meant to be a full Obsidian.

- `test/harness/obsidian.ts`: the subset the plugin imports (`Plugin`,
  `ItemView`, `Modal`, `Notice`, `MarkdownView`, `TFile`, `Platform`,
  `debounce`, `setIcon`, `setTooltip`, `displayTooltip`, `normalizePath`,
  `editorInfoField`, `PluginSettingTab`, `Setting`). Each method records
  calls, and `Notice` pushes onto an array the test can read. `Vault` is backed
  by a `Map`, and `Workspace` has one or two leaves the test controls.
- Register it with `mock.module("obsidian", …)` in a `bun test` preload for
  `editors/obsidian` only. Get a DOM from `happy-dom`
  (`@happy-dom/global-registrator`) as a dev dependency of the workspace.
  **Ask the maintainer before adding the dependency**, and argue it from the
  seven commits above.
- First tests, one per past defect, so each would have failed before its fix:
  `onload` succeeds and registers each view once (replacing the regex);
  `refresh` shows `HIDDEN` for an ordinary note and `✓` for
  `example-invoice.md`; a hover on a mark with `data-vmark-path` explains that
  note, not the active one; `format` with a keystroke in the gap refuses;
  `noteFor` failure shows a notice (§2.4); the sweep lists only notes with
  problems (§2.3).

#### Constraints

- The stub must not grow behaviour the real API doesn't have. For every
  method, the stub's doc comment cites the `obsidian.d.ts` declaration it
  mirrors. Where the real behaviour is unknown, the stub throws
  `"not modelled"` instead of guessing.
- `bundle.test.ts` still builds against the *real* externals. The stub is a
  test-only module and must never reach `esbuild.config.mjs`.
- Update the manual test's "Asserted by a machine" column for every section
  the harness now covers. The column exists so a person knows what's left.

---

### 2.6 Live Preview: map, then debounce (row 17)

**Rating: B−. Do after §2.1.**

**Status: OPEN**

#### The problem

`livePreviewMarks` rebuilds `locate` + `build` + `check` synchronously on every
`docChanged`. The file's own measurement is ~9 ms per keystroke on a
note-sized document on desktop, and mobile will be several times that. The
header rejects mapping because "a mapped range would drift off the value it is
about". That's true of mapping *forever*, not of mapping for 300 ms. The
extension also runs in Source mode, even though the setting is "Show provenance
in Live Preview". A setting change applies only after the next edit.

#### What to do

- In `update`, when `docChanged`: `this.decorations =
  this.decorations.map(update.changes)` right away, then schedule a debounced
  recompute that dispatches a `StateEffect` with the fresh set. Drop the effect
  if the document changed again in between.
- Return `EMPTY` unless `view.state.field(editorLivePreviewField)` is true, and
  recompute when that field changes (switching modes).
- In `settings-tab.ts`, after toggling, dispatch the same effect to every open
  `MarkdownView`'s CodeMirror instance (`iterateAllLeaves`).

#### Constraints

- A mapped mark may sit slightly off for the debounce window. It must never
  *change* between `computed` and `disagrees` until the recompute: mapping
  moves, the recompute decides.
- The `as unknown as` for `editorInfoField` stays the only one. Reuse its
  pattern for `editorLivePreviewField` with the same comment reference.

---

### 2.7 Explain a table cell from the caret (row 18)

**Rating: B. A feature gap, not a defect.**

**Status: OPEN**

#### The problem

`nameAt` returns `null` inside a table cell. Its header explains that "the
row cannot be [identified] cheaply". But `decorationsFor` (`decorations.ts`)
already computes, for every cell of every computed column, the cell's exact
source span together with `name` and `row`. A tap on a marked cell opens a
row-scoped Explain, while the Explain *command*, with the caret in the same
cell, tells the reader to move the caret.

#### What to do

- In `nameAt`, after anchors and binding lines, look for a `kind: "cell"`
  decoration whose span contains the offset, and return `{ name, row }`.
  Change the return type to carry `row`, update `main.ts` `explain` to pass it
  to `ExplainModal`, and update `at-cursor.test.ts`.
- Rewrite the header comment: the cell case is now answered, from the same
  source spans the marks use.

#### Constraints

- Only computed cells answer. An input cell still returns `null`, for the same
  reason as before: showing the wrong name confidently is worse than asking.

---

### 2.8 Make the version and release story true (row 20)

**Rating: C+. Must land before the community-registry submission.**

**Status: OPEN**

#### The problems

- `manifest.json` says `minAppVersion: "1.8.7"` (commit `869a819`, for
  `displayTooltip`, which is `@since 1.8.7`). `README.md` §`minAppVersion`
  still says `1.0.0` and argues that every API predates it. So does spec §2.2.
- `package.json` has `"obsidian": "^1.8.7"`, which resolves to **1.13.1**.
  `tsc` checks against 1.13 typings, so an API newer than the floor typechecks.
  `override settings` in `main.ts` already relies on a declaration marked
  `@since 1.13.0`. It's harmless at runtime (it's a plain field), but nothing
  would catch a real one.
- The community registry reads `manifest.json` from the **repository root**,
  and the release tag must equal the manifest version exactly (no `v`). Here
  the manifest is at `editors/obsidian/manifest.json`, no workflow builds or
  attaches `main.js`/`manifest.json`/`styles.css`, and `release.yml` fires on
  `v*` only. Confirm BRAT's current lookup rules before relying on it as the
  interim channel.
- `docs/design/obsidian-manual-test.md` §2.8 says "VisiMark: Look through the
  vault". The command is "Sweep the vault".

#### What to do

1. Fix the README and spec prose to `1.8.7`, with the reason (`displayTooltip`).
2. Add a test that walks `obsidian.d.ts` for every symbol `src/` imports from
   `obsidian`, reads its `@since` tag, and fails if any exceeds
   `manifest.minAppVersion`. That's the check the README promises happens
   "before submission", done once and kept. Alternatively, pin the typings to
   the floor. **Ask the maintainer which.**
3. Write the release decision down in the spec before building it: a root
   `manifest.json` (a copy checked against `editors/obsidian/manifest.json`
   by a test), a tag scheme that can't collide with `v*` (the registry
   requires the bare version), and a workflow that attaches the three assets.
   **This is a maintainer decision.** Draft the options with their trade-offs
   and stop.
4. Fix the command name in the manual test.

#### Constraints

- Don't make the plugin's version follow the npm set. Spec §2.2 decided that
  on purpose.
- `scripts/check-changelog-entries.ts` already requires a dated
  `CHANGELOG.md` entry for the manifest version. Keep that the single version
  source.

<!--vmark:no-formulas-->
