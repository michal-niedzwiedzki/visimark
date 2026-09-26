# Changelog

The plugin's version is its own. It is not the version of the `visimark` npm
packages and does not move with them: an Obsidian release goes through a human
registry review, and coupling an engine patch to that latency would either
stall the engine or ship plugin versions nobody changed
([`obsidian-plugin-spec.md`](../../docs/design/obsidian-plugin-spec.md) §2.2).
Each entry says which engine version the bundle carries.

## Unreleased

- **The Explain command now answers for a caret in a computed table cell**
  (2026-09-25 code review, row 18). A tap on a marked cell already opened a
  row-scoped Explain; the palette command, with the caret in the same cell,
  answered "put the cursor on a value". `nameAt` now resolves the caret
  against `decorationsFor`'s cell spans, the same source spans the marks
  already use, and reports which row so the modal shows that cell's value
  rather than the whole column's. A cell of an input column (no column rule)
  still answers nothing, for the same reason as before: a table needs a
  column of known provenance before "which row" is answerable at all.

- **`README.md` and the spec now say `minAppVersion` is `1.8.7`, not `1.0.0`**
  (2026-09-25 code review, row 20). `manifest.json` and `versions.json` were
  already right — `869a819` raised the floor for `displayTooltip`
  (`@since 1.8.7`) — but the prose installers and reviewers read still argued
  every API predated `1.0.0` (it doesn't quite: `setTooltip` is `@since
  1.4.4`, still under the floor, but not "before 1.0" either — both documents
  now say so). A new test, `test/since-drift.test.ts`, walks every symbol
  `src/` imports from `obsidian` back to its declaration in the installed
  `obsidian.d.ts` and fails if any `@since` tag exceeds the floor, so the next
  API that moves it can't go unnoticed the way this one did. It also walks
  every `this.app.<member>(...)` and `this.app.<prop>.<member>(...)` call
  reached without an import (e.g. a method straight off `App`, like
  `isDarkMode`), since those can drift the same way a top-level import can.
  The manual test's §2.8 also named the wrong command ("Look through the
  vault" instead of "Sweep the vault"); fixed. The release mechanics the same
  row raised — where the registry reads `manifest.json` from, and what tags
  and builds a release — are written up as options in
  [`docs/design/obsidian-release-plan.md`](../../docs/design/obsidian-release-plan.md),
  not decided or built here.

- **Live Preview maps its decorations through an edit instead of recomputing
  synchronously on every keystroke** (2026-09-25 code review, row 17). The old
  code reran `locate` + `build` + `check` on the whole document on every
  `docChanged`, measured at ~9ms per keystroke on a note-sized document (more
  on mobile); now a keystroke maps the existing decorations through
  CodeMirror's own `ChangeSet` (a cheap, synchronous position update that
  cannot change a mark's verdict — it only moves it) and schedules the real
  recompute on the same 400ms debounce `analyseWithSnapshot` already used, via
  a `StateEffect` a further edit before it fires supersedes. The extension
  also now returns nothing unless `editorLivePreviewField` says Live Preview,
  not Source mode, is active, and recomputes immediately (not on the
  debounce) when that field changes or when "Show provenance in Live Preview"
  is toggled — `settings-tab.ts` dispatches straight to every open editor's
  CodeMirror instance, instead of leaving the old marks in place until the
  next keystroke.

- **Both renderers decorate from the same snapshot-backed check the status
  bar uses**, closing a bug where a value that actually disagreed with an
  import could render as `computed` while the status bar said something was
  wrong (2026-09-25 code review, rows 6–7). Reading mode's post-processor now
  awaits `analyseWithSnapshot` before drawing a mark; Live Preview decorates
  local values synchronously as before but withholds a mark on any value that
  reads an imported sheet (`src/import-deps.ts`) until a debounced snapshot
  resolves, then dispatches it as a `CodeMirror` `StateEffect`. `refreshState`
  also rerenders every reading view of a note whose disagreeing set changed —
  Obsidian's post-processor only re-runs a section whose own text changed,
  so a table reading a scalar edited in another section previously kept its
  stale marks — and clears the per-element hover-tooltip cache in the same
  pass. No user-visible behaviour changes for a note with no imports.

- **Three glue-layer hardening fixes** (2026-09-25 code review, rows 10, 11,
  21):
  - Format, Evaluate and Explain now show "This note could not be checked,
    so nothing was changed." instead of leaving an unhandled rejection and
    a palette command that appears to do nothing, if the vault read or
    check throws (row 10).
  - `actionFor`'s per-view mobile action is now pruned on `layout-change`,
    not only when a view's state goes hidden or on unload — a closed leaf's
    view and its header element no longer stay reachable for the rest of
    the session (row 11).
  - The four **Insert … template** commands insert on a fresh, blank-line-
    padded line instead of at the literal caret, so the template's heading
    and opening fence can no longer land mid-sentence and fail to be a
    block; inserting into a note that already has a VisiMark block now
    shows a notice instead of producing a second block that would `DUP`
    every name the first one already declares (row 21).

- **The sweep no longer lists a note whose only findings are advice**
  (2026-09-25 code review, row 8). `status.ts`'s rule for the status bar was
  already "advice never changes a note's state — a note whose only finding
  is 'defined but never used' is a note that agrees with itself." The sweep
  skipped a note only when it had no problems *and* no advice, so an
  advice-only note was listed under "disagrees with itself" while that same
  note's status bar read `VisiMark ✓`. The sweep now skips a note whenever it
  has no problems; a listed note's advice count is still reported.

- **A `bun test` harness for the Obsidian glue** (2026-09-25 code review, row
  12). Seven fix commits on `obsidian-integration` repaired defects in
  `main.ts`, the views and the renderers, and none of them had a runtime test
  to catch them, because nothing could load the real `obsidian` module under
  `bun test`. `test/harness/obsidian.ts` is a minimal, honest stub of the
  subset this plugin actually imports — each export's doc comment cites the
  `obsidian.d.ts` declaration it mirrors, and it throws `"not modelled"`
  rather than guessing where real behaviour isn't known — registered through
  `mock.module` in a `bun test` preload (root `bunfig.toml`; a per-workspace
  one is not resolved when `bun test` runs from the repo root, which is how
  every other test in this monorepo is invoked). `test/harness/app.ts` is a
  fake `App`, and `@happy-dom/global-registrator` (new dev dependency) is
  the DOM neither one has on its own. `onload.test.ts` is the first payoff:
  it loads the real plugin class, calls the real `onload`, and drives
  `refresh`, a hover and `format` end to end, replacing a regex-based guard
  in `main.test.ts` that could only check the source text of the exact
  defect (#214, a pasted duplicate `registerView`) it was written after.

- **The activation gate no longer parses an ordinary note**, and reading mode
  no longer re-analyses a note once per rendered section (2026-09-25 code
  review, rows 4–5). `mightHaveBlock`, the no-false-negative substring scan
  the vault sweep already relied on, now runs inside `hasVmarkBlock` itself,
  so an ordinary note costs a scan instead of a `remark`+GFM parse on every
  keystroke in Live Preview, every rendered section in reading mode, and every
  leaf change. A new one-entry memo (`src/analysis.ts`) shares one
  `locate`+`build`+`check`+`decorationsFor` per source string across the gate,
  both renderers and Explain's `nameAt`, so a note that does have a block is
  analysed once per render rather than once per section. No user-visible
  behaviour changes; see
  [`docs/reviews/2026-09-25-obsidian-plugin.md`](../../docs/reviews/2026-09-25-obsidian-plugin.md)
  §2.1.

- **Format can fix unambiguous dates** (v1.1 row 17 of
  [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176)), behind
  a new setting, **Fix unambiguous dates**, off by default — mirrors the
  CLI's `fmt --fix-dates` exactly, including its default. On, Format rewrites
  a `DATE` finding whose ISO form is decidable (`15.10.2026` → `2026-10-15`);
  an ambiguous date (`11/12/2026`) is untouched either way, the same
  distinction the CLI flag draws. Whole-note only, the same shape as the CLI
  flag — no finding grows a per-row repair button for this, in the findings
  view or anywhere else.

- **CSV import stamping through the vault, proven rather than built** (v1.1
  row 16 of [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176)).
  The roadmap recorded this row as blocked on the write port; it was not — an
  import's `at="sha256:…"` stamp is an edit to the note's own bytes, which
  `format()` has applied unconditionally since v1 row 7. What was unverified
  was the read half: `editors/obsidian/test/csv-import.test.ts` proves a
  `from <path>` declaration relative to the importing note's own vault
  folder resolves and repairs end to end, stamp and re-stamp alike. No
  production code changed; see #254.

- **Format can regenerate a stale or missing chart** (v1.1 row 14 of
  [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176)), behind
  a new setting, **Write chart artifacts**, off by default. On, Format (the
  command or format-on-save) writes every stale/missing chart's SVG through
  the vault write port (`writeCharts`, `chart.ts`) before applying its text
  repairs, stopping at the first chart write that fails or fails its
  immediately-pre-write ownership recheck — no cell is repaired in that
  case, though an earlier chart in the same run may already have written
  cleanly, matching the CLI's own `fmt`: neither undoes an artifact already
  written before a later one refuses. Off, nothing changes: v1's behaviour
  (repair the cells, decline every chart write, `check` still reports the
  stale chart) is exactly
  reproduced, notice text included. Per-finding "regenerate this chart" in
  the findings view is deliberately not part of this row — see #252.

- **An incremental vault health index, and a live badge on the ribbon icon**
  (v1.1 row 13 of [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176)).
  Turning on "Sweep the vault on open" now also seeds a `LiveVaultIndex` from
  that scan and keeps it current with `vault.on("modify"/"create"/"delete"/
  "rename")` for the rest of the session — the ribbon icon carries a numeric
  badge of how many notes currently disagree with themselves, kept live with
  no command, and the sweep pane draws from the same index instantly instead
  of re-scanning on every open. Off unless that setting is on, at startup or
  turned on mid-session from the settings tab; nothing changes for anyone who
  leaves it off. "Look again" in the sweep pane still runs a real full scan
  and reseeds the index from it — the self-heal path for anything an
  incremental update could miss, such as a vault change no Obsidian event
  fires for (accepted as a limitation, not hidden — see `vault-index.ts`).

- **A vault write primitive, not yet wired to any command** — `vault.ts`'s
  `vaultWriter`, the plugin's first call to `vault.modify`/`vault.create`.
  Prerequisite for v1.1 rows 14 (chart artifacts) and 16 (CSV import stamps)
  of [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176);
  nothing in the plugin calls it yet, so there is no user-visible change and
  no new manual-test step. Built on the engine's new `WriterPort`
  (`packages/visimark`'s `fs/writer.ts`) in the sense that both exist for the
  same reason, not by implementing it — `WriterPort` is synchronous and a
  vault write cannot be, the same asymmetry `snapshot.ts` already documents
  for the read side.

- **Format on explicit save now fires on a real Ctrl/Cmd+S keystroke**
  (issue #243). The listener was bound on each window's `Document` at the
  default bubble phase; Obsidian's own keymap binds `keydown` on `Window` at
  capture and, on a matched hotkey such as "Save file", calls
  `preventDefault()` and `stopPropagation()` before the event ever reached
  it. Rebinding on `Window` with `{ capture: true }` runs the listener ahead
  of Obsidian's own handling, without pre-empting it — Obsidian's save still
  fires unblocked. The command and the per-finding repair, which never went
  through this listener, were unaffected.

- **Activation has a witness on mobile, not only on desktop** (issue #232).
  `addStatusBarItem()` is desktop-only — Obsidian's own typings say so — and
  it was the plugin's only sign that a note had activated, so a vault on a
  phone showed an activated note exactly like an ordinary one. A view-header
  icon now carries the same four states (checked, N to look at, could not be
  checked, hidden) and the same click-through to the findings view, on every
  platform; the status bar is unchanged on desktop.

- **A settings tab, and format on explicit save** — off by default. Applies
  the same repair plan Format and the per-row repair already do, on
  Ctrl/Cmd+S with a VisiMark note focused. An autosave never triggers this;
  neither does the command palette's "Save file" — Obsidian has no event for
  an explicit save distinct from autosave, so this listens for the keystroke
  specifically. Two settings that were previously fixed are real toggles now
  too: show provenance in Live Preview (on by default) and sweep the vault
  on open (off by default).

- **A marked value answers when you ask it** — hover on the desktop, tap
  anywhere — with the formula the reader wrote, what it comes to and what it
  reads. A cell says what *that* cell comes to rather than what its column
  does.

- **Computed values are marked, in reading mode and in Live Preview** — a
  hairline under a value VisiMark works out, doubled when it no longer matches
  its formula. Not a colour: a red number says *error* to someone trained by
  build logs and something worse to someone who has not been. Nothing is
  written: the mark is a class on rendered output, and a note copied out of the
  vault is byte-identical.

- **The status bar says what state the note is in** — `VisiMark ✓` when
  everything agrees with its formulas, `VisiMark · 3 to look at` when it does
  not — and pressing it opens the findings view. A ribbon icon opens the vault
  sweep. Advice alone never changes the state: a note whose only finding is
  "defined but never used" agrees with itself.

- **Copy the values as JSON**, from the Evaluate dialog. It is the `values`
  object out of `visimark eval --json`, exactly — not a reshaping of it — so
  what you paste into a script or a model prompt is the contract the CLI
  already specifies.

- **The five commands**, each scoped to the note in front of you: **Check this
  note**, **Format this note**, **Infer the formulas**, **Evaluate this note**
  and **Explain this value**. Format applies every repair at once and writes no
  chart; Explain answers about the value the caret is on, and says to move the
  caret rather than explaining something nearby.

- **A public API other plugins and agents can call**, at
  `app.plugins.plugins["visimark"].api`: `check`, `evaluate`, `get` and
  `explain`, with `apiVersion` semver'd from the first release. `get` and
  `evaluate` return the CLI's own `evalValues` — a string for a scalar, an
  array of strings-or-null for a column (null where the cell is blank) —
  never a number. Only a scalar's string is byte-identical to what
  `visimark eval --get` prints: that command joins a column's rows with
  `", "` for a terminal, and this API leaves the join to the caller.

- **Infer, with a preview** — the on-ramp. One command reads a plain Markdown
  table, works out the formulas behind its numbers, and shows the
  ```` ```vmark ```` block it would add *before* adding anything. Accepting it
  rewrites no existing byte: `planInfer` only inserts, and the test deletes the
  inserted ranges back out of the result to prove the note survives inside it.
  Selecting a table narrows it to that table.

- **A vault sweep** — the one feature the VS Code extension cannot have. One
  command looks through every note in the vault and lists the ones that
  disagree with themselves. It never refuses on size: a substring prefilter
  that cannot produce a false negative removes the parse for every note that
  could not contain a block, so the cost is proportional to the number of
  VisiMark notes rather than to the size of the vault, and the scan hands the
  thread back every fifty notes so a phone keeps answering taps. A count that
  moves and a **Stop** button, at every size.

- **A findings view**, and it is not a Problems panel. One row per finding, in
  a sentence — no red, no codes, no "1 problem" — under **Needs attention** or
  **Advice**, where the split is the engine's own and not a second list.
  Clicking a row puts the cursor on what it is about; a stale value offers a
  **Repair** button that rewrites exactly that one. A stale *chart* keeps its
  row and gets no button, because v1 has no vault-backed write port and
  declining the write never silences the finding.

- **Four templates** — invoice, monthly budget, team capacity and experiment
  log — with a command each to insert one at the cursor. Every one passes
  `visimark check` with zero findings before it is edited, contains no syntax
  that means anything only inside Obsidian, and ends with a short "How to use
  this" section. These commands are deliberately **not** gated on the note
  already containing a block: their job is to create the first one.

- The audience-B finding vocabulary (`src/findings.ts`) — one translation of
  the engine's seventeen-code taxonomy into sentences, so that the findings
  view, the popover, the sweep and the status bar cannot come to say different
  things. No red, no codes, no "1 problem". No surface uses it yet.

- The vault-backed reader (`src/snapshot.ts`) — what lets a note's declared
  CSV imports and generated chart artifacts resolve out of an Obsidian vault,
  whose API is asynchronous, through a `ReaderPort` that is synchronous. No
  surface uses it yet; the rows that call `check` will.

## 0.1.0 - 2026-09-23

First build. Not published to the community registry — see the README for
side-loading, and `docs/design/obsidian-plugin-spec.md` §2.2 for why the
registry waits until v1 is complete.

- The plugin builds as a single `main.js` with **no `node:` specifier in it**,
  so it loads on Obsidian mobile as well as desktop.
- Activation is opt-in per note: nothing appears anywhere unless the active
  note contains a ```` ```vmark ```` block. A vault of ordinary notes is
  indistinguishable from one without the plugin installed.
- The only surface is a status bar item reading `VisiMark` while the gate is
  open. Decorations, the popover, the commands, the findings view and the
  ribbon are each their own v1 row and are not here.

Bundles engine 0.1.7.
