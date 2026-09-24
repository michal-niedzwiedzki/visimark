# Changelog

The plugin's version is its own. It is not the version of the `visimark` npm
packages and does not move with them: an Obsidian release goes through a human
registry review, and coupling an engine patch to that latency would either
stall the engine or ship plugin versions nobody changed
([`obsidian-plugin-spec.md`](../../docs/design/obsidian-plugin-spec.md) §2.2).
Each entry says which engine version the bundle carries.

## Unreleased

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
  `explain`, with `apiVersion` semver'd from the first release. Values are
  strings, never numbers, and `get` returns the same answer
  `visimark eval --get` prints because it goes through the same function.

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
