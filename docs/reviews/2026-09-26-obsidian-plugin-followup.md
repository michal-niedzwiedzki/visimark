# VisiMark — code review: the Obsidian plugin, follow-up

**Date:** 2026-09-26 · **Commits compared:** `869a819` → `723a4f1`
(`obsidian-integration`) · **Scope:** the 25 findings and 8 work prompts of
[`2026-09-25-obsidian-plugin.md`](2026-09-25-obsidian-plugin.md), re-checked
against the current branch. 20 `obsidian`-scoped commits landed in between;
three more (a vault health index, chart regeneration through a write port,
and their own CodeRabbit rounds) landed in the same window but answer none of
the 25 findings and are out of scope here.

Fresh baseline on `723a4f1`: `bun test editors/obsidian` — **234 pass, 0
fail** (up from 154 pass at the prior review), 1114 `expect()` calls.
`bun run typecheck` clean across all seven workspaces. `bun run lint
--max-warnings 0` clean. `bun run format:check` clean. `main.js` builds to
**301,642 bytes** (up from 286,018; the 10%-margin ceiling recorded
2026-09-23 is a moving one, and this build is still under it). The repo-root
`bun test` reports **1863 pass, 4 fail** — the same four, out-of-scope
failures as the prior review (`editors/vscode` needs a built `dist/`, the MCP
spawn test needs Node on `PATH`); nothing new broke.

Three reproductions from the prior review were re-run against this code,
not just re-read: the gate benchmark, the disagreeing-import benchmark, and
the sweep/status-bar fixture. All three now come out the way the fix commits
claim. Findings below are marked **reproduced** where I ran something and
**read** where I traced the code and tests without a fresh repro.

---

## 1. Results

| # | Area | Follow-up status | Evidence |
|---|---|---|---|
| 1 | Pure core / DOM split | **Fixed (spot-check, no regression)** | `report.test.ts`, `decorations.test.ts` still pass; [`analysis.ts`](../../editors/obsidian/src/analysis.ts) (new) keeps the same discipline — it imports only `visimark`, `decorations.ts`, `report.ts`, `snapshot.ts`. |
| 2 | Engine boundary | **Fixed (spot-check, no regression)** | `bundle.test.ts` still passes (58/58 in the subset run); no new `node:` specifier or dynamic `import()` introduced by the fix commits. |
| 3 | Vault reader by discovery | **Fixed (spot-check, no regression)** | [`ReaderPort`](../../packages/visimark/src/fs/reader.ts#L79) is still fully synchronous — §2.2's constraint against making it async held. `snapshot.ts` itself is untouched in `869a819..723a4f1`. |
| 4 | Activation gate costs a full parse | **Fixed, reproduced** | [`gate.ts`](../../editors/obsidian/src/gate.ts) now checks `mightHaveBlock` before `locatedFor(source).blocks.length > 0`. Re-run of the review's own benchmark on a 19 KB ordinary note: **0.0062 ms/call** for `hasVmarkBlock` (was 12.7 ms), against 0.0011 ms for a bare `includes`. `example-invoice.md` (has a block): 0.0006 ms, because `locatedFor` is memoized and the corpus was already warm. |
| 5 | Per-section re-analysis in reading mode | **Fixed, reproduced** | `analysis.ts`'s `analyse`/`analyseWithSnapshot` memoize on the exact source string; [`reading-mode.ts`](../../editors/obsidian/src/reading-mode.ts)'s `decorateSection` calls `analyseWithSnapshot(source, ctx.sourcePath, read)` where `source = info.text` (the whole note) — every section of one render shares the one in-flight fetch (proven by `analysis-snapshot.test.ts`'s "concurrent calls... share one fetch" case, which passes). `at-cursor.ts` no longer re-`locate`s; `nameAt` takes an already-built `model`/`result`. |
| 6 | Marks ignore imports, can show disagreeing as agreeing | **Fixed, reproduced** | Re-ran the exact review fixture (`benchmark.md`-style CSV import, precision-2 anchor, true mean 12.47) against `analyse` vs `analyseWithSnapshot`: `analyse` still reports `computed`/no findings (documented as the expected reader-less limitation); `analyseWithSnapshot` now reports `STALE` and marks it `disagrees`. This exact case is pinned as [`analysis-snapshot.test.ts`](../../editors/obsidian/test/analysis-snapshot.test.ts)'s first two tests, both passing. Both renderers (`reading-mode.ts:80`, [`live-preview.ts`](../../editors/obsidian/src/live-preview.ts)'s `scheduleSnapshot`) now decorate import-dependent values only from the snapshot-backed path; Live Preview withholds the mark on any import-dependent name ([`import-deps.ts`](../../editors/obsidian/src/import-deps.ts)) until it resolves, rather than asserting the reader-less answer. |
| 7 | Reading-mode marks/tooltips go stale | **Fixed** | [`main.ts`](../../editors/obsidian/src/main.ts)'s `freshenReadingViews` calls `previewMode.rerender(true)` when the disagreeing-span set actually changed, and clears every `data-vmark-hovered` attribute on **every** fresh result, not only when the verdict moved (a CodeRabbit-flagged sharpening: a value can stay `disagrees` at the same span while its underlying number changes). Plausible in the original review; now implemented and reasoned through at `main.ts:933-949`. |
| 8 | Sweep and status bar disagree about advice | **Fixed, reproduced** | [`sweep.ts:118`](../../editors/obsidian/src/sweep.ts#L118): `if (report.problems.length === 0) continue;` (was `isClean`). `sweep.test.ts`'s "a note whose only finding is advice is checked, but not listed" case uses the exact fixture the review proposed (`#t` sheet, unused `bonus`, an anchored `total`) and passes. `advice` count is retained per-note and surfaced only for notes that are already listed (`sweep-view.ts:261`, `"... worth knowing"`) — no separate vault-wide advice listing was added, so the maintainer-ask in §2.3 was correctly *not* acted on unilaterally. |
| 9 | Pop-out windows get no hover/tap/keyboard | **Fixed, predates this branch's fix set** | Already closed by commit `77d8bab` ("marked-value listeners now reach pop-out windows too"), which landed on `obsidian-integration` after the reviewed `869a819` but before the 20-commit window this follow-up covers. `main.ts`'s `listenForMarksAndSaveIn` registers all four listeners per window; `target()` (`main.ts:1044`) is structural (`nodeType === 1` / `parentElement`). |
| 10 | Commands swallow failures | **Fixed** | [`noteFor`](../../editors/obsidian/src/main.ts#L773) now wraps its body in try/catch and shows `"This note could not be checked, so nothing was changed."` (`main.ts:798`) on any thrown error, including a `MAX_ROUNDS` throw. |
| 11 | `actionFor` never forgets a closed view | **Fixed** | `main.ts:480` registers a `layout-change` handler that calls `pruneClosedActions`, using `iterateAllLeaves` to compute the live set; still a `Map`, per the constraint. |
| 12 | The glue is untested | **Fixed** | A [`test/harness/`](../../editors/obsidian/test/harness/) (`obsidian.ts`, `app.ts`, `cm-state.ts`, `preload.ts`, 798 lines) stubs the subset of `obsidian` the plugin imports, loaded via `mock.module` in a root `bunfig.toml` preload — confirmed this is scoped correctly: the repo-root `bun test` run shows the same four pre-existing failures with or without the harness, and `bundle.test.ts` still builds against the real esbuild externals. [`onload.test.ts`](../../editors/obsidian/test/onload.test.ts) drives the real plugin class through `onload`, `refresh`, a hover and `format` end to end, chosen (per its own commit message) to reproduce past defects (#214's double `registerView`, wrong-note hover, a stale-buffer `format`). Every stub export cites the `obsidian.d.ts` declaration it mirrors, and three "not modelled" throws remain for the unhandled cases — the constraint against growing invented behaviour held. |
| 13 | Tests of the pure core | **Fixed (spot-check, no regression)** | `report.test.ts`, `api.test.ts`, `templates.test.ts` all still pass; unchanged in the commit window. |
| 14 | Audience-B vocabulary | **Still open** | [`findings.ts:164`](../../editors/obsidian/src/findings.ts#L164) still keeps `const ADVICE: ReadonlySet<FindingCode> = new Set([...])` as a second list, and the doc comment two lines above it (`findings.ts:160`) still claims it "agrees with it by construction rather than by keeping a second list" — which was exactly the false half of row 23 that touches this file, and it is still false. Not touched anywhere in `869a819..723a4f1`. |
| 15 | Write discipline | **Fixed (spot-check, no regression)** | Unchanged; `report.test.ts`'s repair-convergence tests still pass. |
| 16 | Format on explicit save | **Fixed (spot-check, no regression)** | Unchanged in this window. |
| 17 | Live Preview extension | **Fixed, reproduced (via test)** | `live-preview.ts` now maps existing decorations through `update.changes` synchronously on every `docChanged`, then schedules a 400 ms debounced recompute (`b70b449`). Gated on `editorLivePreviewField`, not just the setting (`isLivePreview`). [`settings-tab.ts`](../../editors/obsidian/src/settings-tab.ts) dispatches `forceLivePreviewRecompute` to every open editor's `EditorView` on toggle. A follow-up CodeRabbit round (`723a4f1`) fixed a real regression the perf commit introduced: `scheduleRecompute`'s staleness guard was calling `view.state.doc.toString()` on every keystroke to compare against a captured string — an O(document length) cost sitting on exactly the hot path row 17 exists to keep cold. It now compares `view.state.doc` by reference (a `Text` instance, new only when the document changes), which is correct and O(1). [`live-preview.test.ts`](../../editors/obsidian/test/live-preview.test.ts)'s 8 cases (mapping vs. recompute, mode-switch behaviour, the forced-recompute path) all pass. |
| 18 | Explain can't answer for a table cell | **Fixed, reproduced (via test)** | [`at-cursor.ts`](../../editors/obsidian/src/at-cursor.ts)'s `nameAt` now falls through to `decorationsFor`'s `cell` decorations after anchors and binding lines, returning `{ name, row }`; an input cell (no column rule) still answers `null`, per the stated constraint. `at-cursor.test.ts` covers it (part of the passing suite). |
| 19 | Public API | **Still open** | [`api.ts`](../../editors/obsidian/src/api.ts) has no memoization; `grep` for `LRU`/`memo` in the file finds nothing, and its own commit history (`git log --oneline -- src/api.ts`) shows no touch in the reviewed window. Every `get` still pays for a fresh read + discovery `check` + final `check`. |
| 20 | Distribution and version claims | **Partially fixed** | README and spec now correctly say `1.8.7` with the `displayTooltip` rationale (`573c3a9`), through two further CodeRabbit rounds that corrected `setTooltip`'s own pre-1.0 claim and a dangling doc link (`66f82ae`). [`test/since-drift.test.ts`](../../editors/obsidian/test/since-drift.test.ts) (298 lines) walks every symbol imported from `obsidian`, plus `this.app.<member>` and `this.app.<prop>.<member>` call shapes (closing a real coverage gap CodeRabbit found in `e404bb0`, where the *property's own* `@since` wasn't checked, only its methods'), and fails if any exceeds `manifest.minAppVersion`; it passes, including a pinned "displayTooltip is 1.8.7" regression case. **Pinning the typings vs. adding this test** was an actual, recorded maintainer decision ("Maintainer chose this over pinning the obsidian dependency to the exact floor version" — `f2c0a83`'s commit message). The manual test's wrong command name is fixed. **The release-mechanics question (root manifest, tag scheme, asset workflow) is drafted, not decided** — see §3 below; that's the one piece of row 20 still open, and it is open on purpose. |
| 21 | Template insertion | **Fixed** | New [`template-insert.ts`](../../editors/obsidian/src/template-insert.ts) inserts on a fresh, blank-line-padded line rather than at the literal caret, and returns a signal for `main.ts` to show a notice instead of inserting a second block when the note already has one (avoiding the `DUP` outcome the review flagged). `template-insert.test.ts` (56 lines) covers it. |
| 22 | Sweep pane behaviour | **Still open** | [`sweep-view.ts`](../../editors/obsidian/src/sweep-view.ts)'s `drawProgress` (line 171) still calls `this.container()`, which empties and rebuilds the whole pane, on every progress callback (every 50 notes) — the **Stop** button is still replaced each chunk. Not touched by any commit in the reviewed window; the file's other changes in that window (`vault-index.ts`-backed `drawFromIndex`) are new v1.1 feature work, not a fix for this row, and mean the sweep pane's live-index path now often skips the scan (and this bug) entirely — but a cold "Look again" still hits it. |
| 23 | Comments | **Partially fixed** | The three false comments the review named in `live-preview.ts` and `reading-mode.ts` ("must cost a substring scan", "`IMPORT`, not `STALE`") were replaced along with the code they described — confirmed by reading both files' current headers, which now describe the map-then-debounce and snapshot-backed behaviour accurately. **Two of the four are still false**: [`vault.ts:39-42`](../../editors/obsidian/src/vault.ts#L39-L42)'s "is not a `TFile`" claim about a CSV import is byte-for-byte unchanged since `869a819` (`git show 869a819:editors/obsidian/src/vault.ts` diffed against the working tree — identical), and `findings.ts`'s "agrees … by construction" claim (row 14, above) is also unchanged. |
| 24 | Per-anchor `STALE` (#235) | **Fixed (spot-check, no regression)** | Unaffected by the reviewed commits; still what the browser bundle ships. |
| 25 | Vendored Obsidian skills | **Fixed (spot-check, no regression)** | Untouched. |

**Row count:** 18 of 25 fixed (11 with an independent repro or a passing
regression test that reproduces the original failure mode), 1 partially
fixed structurally with one open sub-item (20), 1 partially fixed (23, two
of four comments), 3 still open (14, 19, 22), 1 confirmed as already fixed
by a commit outside the reviewed set (9), 1 unaffected by design and
confirmed so (3).

---

## 2. What's newly surfaced

**Nothing regressed.** The full `bun test` count went from 154→234 passing
in-scope tests with zero new failures anywhere in the monorepo, `typecheck`/
`lint`/`format:check` are all clean, and the four out-of-scope failures are
identical to the ones the prior review already excluded.

**One real defect was introduced and caught before this review, by
CodeRabbit rather than by this follow-up:** the first cut of row 17's
map-then-debounce fix (`b70b449`) added an O(document-length) `toString()`
comparison on every keystroke — exactly the kind of cost row 17 exists to
eliminate, reintroduced by the fix meant to remove it. It was caught on
review of PR #273 and corrected in `723a4f1` to an O(1) identity comparison.
This is worth flagging rather than waving through: it shows the "seven fix
commits landed defects in this layer" pattern the original review warned
about (row 12) is still live even with the harness in place — the harness
didn't catch this one, a human/CodeRabbit review pass did, because it is a
performance regression, not a behavioural one, and the suite has no timing
assertions (correctly, per §2.1's own constraint against flaky timing
tests).

**Three commits in the 20-commit window are unrelated to any of the 25
findings** — `cf19649`, `a67c2b9`, `79f98bb` — and are worth naming because
they are exactly the failure mode row 12 predicted, caught by manual/live
testing rather than by the (at-the-time nonexistent) harness:

- `cf19649` fixed two bugs in the findings-view "peek/select" DOM
  highlighting: a qualified-vs-unqualified name mismatch that meant
  `markedElements()` could never match any sheeted binding, and a
  highlight-then-`jumpTo()` ordering bug where CodeMirror's own redraw
  silently stripped a class the code had just added.
- `a67c2b9` cached the view a sweep/findings row was drawn against
  (`activeView`) instead of re-deriving "the most recent leaf" at click time,
  closing a race window between a click and Obsidian's own focus-tracking.
- `79f98bb` stopped trying to pin a DOM highlight class in a live editor at
  all, once it was confirmed (via real CDP-dispatched clicks against a
  running Obsidian, not synthetic `dispatchEvent`s) that CodeMirror's
  periodic re-sync of its own decoration state reclaims it regardless of
  scroll distance.

None of these touch the 25 findings' files in a way that changes their
status above, and all three commit messages are explicit about what was
confirmed against a live app versus reasoned by inspection — the same
rigor discipline the original review asked for. They are new evidence for
row 12's core argument (glue code breaks in ways only a real Obsidian catches)
rather than new problems with the fixes reviewed here.

**Two v1.1 feature commits landed in the same window** (a vault health
index, `#249`; chart regeneration through a write port, `#247`/`#252`) with
their own CodeRabbit-fix follow-ups. They touch `sweep-view.ts`, `vault.ts`
and `api.ts` — files this review also inspects for rows 19 and 22 — but add
new behaviour rather than fix reviewed findings, and I did not review them;
they're out of scope for a follow-up on the 25 findings, and a reviewer
picking this file up next should treat them as unreviewed.

---

## 3. Maintainer decisions: asked vs. assumed

The original review flagged three places where a fix commit shouldn't just
build the maintainer's preferred option without asking.

- **§2.3's advice-count question** ("If the maintainer wants advice surfaced
  vault-wide... **ask before adding that**"). **Not surfaced vault-wide, and
  not asked either** — the fix commit (`4d14513`) implemented the minimal,
  clearly-correct half (skip advice-only notes) and left the vault-wide
  count out entirely, which is the safe default but isn't a recorded
  decision. Still open as a question, if the maintainer wants it at all.
- **§2.5's happy-dom dependency ask** ("**Ask the maintainer before adding
  the dependency**, and argue it from the seven commits above"). **Added
  without a recorded ask** — `628f95d`'s commit message argues the case
  thoroughly (the seven commits, the `bunfig.toml` resolution-scope
  verification, the confirmed-harmless full-suite run) but there is no
  artifact in this repository of the maintainer being asked and answering;
  it reads as a decision made and documented, not a decision requested and
  granted. Given the argument is sound and the dependency is dev-only and
  narrowly scoped, this is a low-stakes overstep, but it is an overstep
  against what the review explicitly asked for.
- **§2.8's typings-pin-vs-`@since`-test question** ("**Ask the maintainer
  which**"). **Actually asked and decided** — `f2c0a83`'s commit message
  states the outcome as a maintainer choice ("Maintainer chose this over
  pinning the obsidian dependency to the exact floor version"), which is the
  one of the three that followed the review's process as written.
- **§2.8's release-mechanics decision** ("**This is a maintainer
  decision.** Draft the options with their trade-offs and stop"). **Followed
  exactly.** [`docs/design/obsidian-release-plan.md`](../design/obsidian-release-plan.md)
  opens with "Status: not decided," lays out three concrete options
  (mirror-and-check, submission-time manual copy, path-scoped disambiguation)
  with trade-offs for each, touches no workflow file, and is linked from the
  CHANGELOG entry as unresolved. This is still open, correctly.

---

## 4. Overall grade: **B+** (up from B)

The two most serious findings from the prior review — the gate parsing every
keystroke, and a disagreeing value rendering as agreeing — are both fixed
and both re-verified here with the review's own reproduction cases, not
just trusted from a commit subject. The sweep/status-bar contradiction is
closed with the exact fixture the review proposed. The untested glue now has
234 tests behind it, including end-to-end `onload` coverage chosen
specifically to catch the class of defect that kept landing in this layer.
Every constraint the review set for these fixes — don't make `ReaderPort`
async, don't build §2.2 inside §2.1, keep the stub honest, don't widen
`preventDefault`, keep the `Map` — held. The one process miss (a real
performance regression introduced by the row-17 fix itself, caught by
CodeRabbit rather than the new harness) and one procedural gap (happy-dom
added without the requested ask) keep this from an A-range grade, alongside
three findings that are simply still open.

### What's left (much shorter than the original)

1. **Row 22 — sweep pane rebuild.** `drawProgress` still empties and rebuilds
   the whole pane every 50 notes on a cold scan; the **Stop** button and
   keyboard focus still reset each chunk. Cheap, same fix as before: build the
   progress line once and update its text.
2. **Row 14/23 — the `ADVICE` list and its false comment.** Replace
   `ADVICE.has(f.code)` with `!isProblem(f)` in `findings.ts`, which also
   makes the comment two lines above it true again.
3. **Row 23 — `vault.ts`'s CSV/`TFile` comment.** Still says a CSV "is not a
   `TFile`"; every vault file is one. Harmless at runtime, still wrong on the
   page.
4. **Row 19 — API memoization.** No LRU yet; an agent calling `get` for 20
   names still pays for 20 full analyses. Lowest urgency of the four — it's
   a cost, not a correctness bug.
5. **Two open maintainer questions**, neither blocking: whether advice
   deserves a vault-wide count at all, and which of the three release-plan
   options to build before the community-registry submission.

<!--vmark:no-formulas-->
