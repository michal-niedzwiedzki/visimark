# VisiMark — editor plugins design

This document tracks the intended shape of the editor plugins and is kept
current.

Builds on [`visimark-design.md`](visimark-design.md) (the
engine) and its two normative worked examples,
[`example-invoice.md`](example-invoice.md) and
[`example-invoice-drift.md`](example-invoice-drift.md).

## 1. Purpose and scope

The CLI proves a VisiMark document in CI. This project puts the same proof in
front of a person while they type: stale values squiggled in place, the
computed truth shown inline without touching the bytes, and a one-key repair
that goes through exactly the same `fmt` path the CLI uses.

**One engine, one language server, thin clients.** The VisiMark checker is
already pure — `check(build(locate(source)))`, string in, findings out, no
filesystem, no `vscode` import. That is an LSP server almost by construction.
v1 ships that server plus a VS Code client. Other editors (Neovim, Zed, Helix)
become a client each, later, with no server work.

**In scope for v1**

- Monorepo restructuring into workspaces.
- A small editor-facing API on the engine, plus source spans on every finding.
- The `visimark-lsp` server: diagnostics, document formatting, quick fixes and
  fix-all, inlay hints, CodeLens, hover, and a status notification.
- The `editors/vscode` client, bundling the server.
- CI: test/typecheck/build on every push; tag-triggered release that publishes
  the engine to npm and the extension to the VS Code Marketplace and Open VSX.

**Out of scope for v1** — section 12.

**Sequencing.** Two engine amendments in the engine design — `DUP` for
duplicate bindings and `UNIT` for column unit decorations (engine design §6,
§7, §10) — land first, on their own plan. They add finding codes and want
source spans anyway, so the "spans on every finding" work in section 4.1
batches with them rather than being done twice.

## 2. The two policies

VisiMark has two operations and they map onto the two things editors already
know how to do.

| Engine op | Nature | Editor analogue | Trigger |
|-----------|--------|-----------------|---------|
| `check` | read-only, produces findings | linter / diagnostics | continuous: on open, on change (debounced), on save |
| `fmt` | rewrites computed cells and anchors only | formatter / Prettier | on an explicit save by default (`format.fixOnSave`), "Format Document", explicit command, fix-all |

`check` runs constantly and never writes. `fmt` writes, and it writes at one
moment the person chose: an explicit save. `visimark.format.fixOnSave` is on by
default (section 13), so saving brings the document's computed cells and
anchored values up to date.

Silent recomputation on idle or on keystroke stays rejected, and the line is
drawn at deliberateness rather than at writing as such. A keystroke is not a
decision — it happens mid-thought, and rewriting then moves text out from under
the cursor and erases staleness the author has not yet looked at. An explicit
save is a decision, and it is the moment the edit that caused the drift is
finished. An autosave, which is a timer wearing a save's clothes, is treated as
a keystroke and never triggers `fmt`. Between edits the computed truth is
visible without any write at all, through the inlay hint (section 6.5).

## 3. Repository restructuring

Move to Bun workspaces. The move is mechanical and happens first, as one
commit, with the 88 existing tests green on both sides of it.

```
packages/
  visimark/          current src/, test/, bin/, README-as-published — the engine + CLI
  visimark-lsp/       the language server; depends on visimark
editors/
  vscode/            the VS Code client; bundles the server at build time
package.json          workspace root: { "workspaces": ["packages/*", "editors/*"] }
tsconfig.base.json    shared compiler options; each package extends it
docs/                 unchanged, repo-level: specs, worked examples, plans
```

- `git mv src packages/visimark/src`, likewise `test`, `bin`. `dist/` stays
  ignored; each package builds its own.
- The current root `package.json` becomes `packages/visimark/package.json`
  essentially unchanged (name stays `visimark`, the published engine).
- New root `package.json` is the workspace root: private, no `main`, scripts
  that fan out (`bun test` already walks workspaces; add `typecheck`, `build`,
  `package`).
- `packages/visimark-lsp` and `editors/vscode` depend on the engine as
  `"visimark": "workspace:*"`.
- One shared version number across all three packages, bumped together. A
  `vX.Y.Z` tag releases the set (section 10).

## 4. Engine changes

Two additive changes to `packages/visimark`. Both are covered by the existing
acceptance suite staying byte-for-byte identical, because neither touches
`report/format.ts`.

### 4.1 Source spans on findings

`Finding` today carries a location only sometimes (`sourceOffset` on `UNDEF`,
`VECTOR`, `ANCHOR`). The server needs a range for every diagnostic it shows.

Add one optional field:

```ts
interface Finding {
  // …existing…
  /** absolute source span of the text this finding is about */
  span?: Span;   // { start: number; end: number }
}
```

Populate it at each `emit()` in `eval/check.ts` from data already in hand:

| Finding | `span` source |
|---------|---------------|
| `STALE` column cell | `table.rows[r].cells[idx]` |
| `STALE` scalar | the bound anchor's `value` span, else `binding.span` |
| `STALE` anchor-group (collapsed summary) | none — not surfaced as a diagnostic |
| `DATE` | the offending input cell |
| `UNIT` | the offending cell, or the column's first deviating cell |
| `UNDEF`, `VECTOR` | `{ start: ref.start, end: ref.end }` |
| `DUP` | `span` is the duplicate binding; `relatedSpan` is the first one, rendered as LSP `relatedInformation` |
| `TYPE` | the cell for a column, else `binding.span` |
| `CYCLE` | first binding in the cycle, `binding.span` |
| `SHEET` | the `vmark` block span (already available where these are emitted in `model/build.ts`) |
| `ANCHOR` | `commentSpan` |
| `WARN` | `binding.span` |
| `NOTE` | none — not surfaced as a diagnostic |

`DUP` and `UNIT` are engine additions specified in the engine design (§6, §7,
§10). They land before this work — see section 1.

`report/format.ts` ignores `span`. The console output does not change.

### 4.2 Finding-linked edit plan

`planFmt` returns `Edit[]`. Thread the finding each edit resolves:

```ts
interface PlannedEdit extends Edit { finding: Finding }
function planFmt(model, result, opts): PlannedEdit[]
```

The CLI `fmt` path is unaffected (it reads `.start/.end/.text`). The server
gets finding↔edit linkage for free: a quick fix is the one `PlannedEdit` whose
`finding.span` overlaps the cursor; fix-all is all of them.

### 4.3 Editor-facing API

Widen `packages/visimark/src/index.ts` from the single `runCli` re-export to a
small, deliberate surface:

```ts
export { locate } from "./parse/document.js";
export { build } from "./model/build.js";
export { check, type CheckResult } from "./eval/check.js";
export { fmt, planFmt, type FmtResult, type FmtOptions, type PlannedEdit } from "./write/fmt.js";
export { applyEdits, type Edit } from "./write/splice.js";
export { topoOrder, dependencies, resolve } from "./eval/graph.js";
export type { DocModel, Finding, FindingCode, Sheet, Binding } from "./model/types.js";
export type { Span, RawTable, RawAnchor, RawBlock, LocatedDoc } from "./parse/document.js";
export { runCli } from "./cli/main.js";

/** convenience: parse + model + check in one call */
export function analyze(source: string): { model: DocModel; result: CheckResult };
```

This is the contract the server (and every future client author) codes
against. It is a thin re-export layer; keeping it stable is a versioning
discipline, not a maintenance burden.

## 5. The language server — lifecycle

`packages/visimark-lsp`, TypeScript, `vscode-languageserver/node`, one Node
process spawned over IPC by the client. It depends only on `visimark` and the
LSP libraries — no `vscode`.

- **Documents**: `TextDocuments(TextDocument)` from
  `vscode-languageserver-textdocument`. The server holds the full text; every
  offset from the engine is a UTF-16 code-unit index into that exact string,
  which is also what `TextDocument.positionAt` / `offsetAt` use — so
  offset↔position is a direct call with no conversion table of our own.
- **Activation / selector**: the client registers for
  `{ language: "markdown", scheme: "file" | "untitled" }`. The extension
  contributes no language; it augments Markdown.
- **Applicability gate**: on every analysis, if `locate(text).blocks` is empty
  (no ```` ```vmark ```` block), the server clears diagnostics for that URI and
  returns nothing for hints, lenses and hover. A plain Markdown file costs one
  parse and is then invisible.
- **Reparse**: full, every time. No incremental reparse — VisiMark documents
  are invoices and memos, and `analyze` on the drift example is sub-millisecond.
  "Incremental reparse" stays deferred, as in the engine design.
- **Capabilities advertised**: `textDocumentSync.incremental`,
  `documentFormattingProvider`, `documentRangeFormattingProvider`,
  `codeActionProvider` (`quickfix`, `source.fixAll.visimark`),
  `inlayHintProvider`, `codeLensProvider`, `hoverProvider`,
  `executeCommandProvider` for the CodeLens/status commands.

## 6. The language server — features

### 6.1 Diagnostics (`check`)

- **Triggers**: `onDidOpen`; `onDidChangeContent` debounced by
  `visimark.check.debounce` (default 300 ms); `onDidSave` immediately.
- Run `analyze(text)`. Map each finding through section 7 to a
  `Diagnostic`. `publishDiagnostics`.
- Findings with no `span` (`NOTE`, the collapsed `STALE` anchor-group) are not
  published — they are CLI-transcript devices, and their content is already
  carried by the per-item findings.
- After each run, send the custom notification `visimark/status`
  `{ uri, stale, errors }` for the status bar (section 9).
- The server never writes a file. Not on save, not ever.

### 6.2 Formatting (`fmt`)

- `provideDocumentFormattingEdits`: run
  `planFmt(model, result, { fixDates: config })`, return each `PlannedEdit` as
  a `TextEdit` over `[positionAt(start), positionAt(end)]`. Minimal per-cell
  edits, not a whole-document replace — cursor, folds and undo granularity are
  preserved.
- `provideDocumentRangeFormattingEdits`: the same edit set, filtered to those
  intersecting the requested range. "Format Selection" over a table thus
  repairs only that table.
- `visimark.format.fixDates` (default `false`): when true, `fmt` additionally
  rewrites *decidable* non-ISO dates (`15.10.2026` → `2026-10-15`), matching
  the CLI's `--fix-dates`. Ambiguous dates are never touched.
- `visimark.format.fixOnSave` (default `true`): an explicit save applies the
  stale-value edits before the file is written. It hooks `onWillSave`, so the
  edits are folded into the content being written and the document lands on
  disk clean rather than dirty again. A save with reason `AfterDelay` — an
  autosave — is declined however the setting is left.
- This is the only write path. It fires from that save, from "Format Document",
  from `editor.formatOnSave` if the user has set it for Markdown, and from the
  fix-all command and code action below — never from typing or idle.

### 6.3 Quick fixes and fix-all

- `CodeActionKind.QuickFix`, one per finding that has a linked `PlannedEdit`:
  - `STALE` → "VisiMark: update to `<computed>`", `isPreferred`, carries the
    originating diagnostic so the lightbulb and "fix" gutter work.
  - `DATE` with a decidable `isoFix` → "VisiMark: rewrite to `<iso>`".
  - `UNDEF` with a `suggestion` → "VisiMark: change to `<suggestion>`".
  - `VECTOR` → "VisiMark: wrap in `SUM(<ref>)`".
- `CodeActionKind.SourceFixAll.append("visimark")` → every stale-value edit
  (plus decidable dates when `fixDates` is on). Runs on save when the user
  opts in via `editor.codeActionsOnSave`.
- Command `visimark.fixAllStale` (palette + CodeLens) → same edit set, applied
  via a workspace edit.

### 6.4 Inlay hints — stale values only

- `provideInlayHints(range)`: run `analyze`, and for each `STALE` finding whose
  `span` falls in `range`, emit one hint at `span.end`:
  - column cell: ` ‹<computed>›`
  - anchored scalar: ` ‹<computed>›`
- Correct computed values get no hint — the right number is already in the
  text. The hint is pure disagreement signal, the non-destructive twin of
  format-on-save.
- `PaddingLeft`, `kind = Type`. `visimark.inlayHints.enable`, default `true`.

### 6.5 CodeLens on `vmark` blocks

- `provideCodeLenses`: for each `RawBlock` with a `span`, a lens on the fence's
  first line:
  - title: `N formula(s) · M stale` (or `N formulas · ok`), M counted from
    findings in that sheet.
  - `visimark.fixSheet` (uri, sheetId) → apply that sheet's stale-value edits.
  - `visimark.explainSheet` (uri, sheetId) → open a read-only virtual document
    (`visimark-explain:` scheme) with the `explain` output for `#sheet` —
    inputs, rules, scalars, evaluation order.
- `visimark.codeLens.enable`, default `true`.

### 6.6 Hover

- `provideHover(position)`: offset → what is under the cursor:
  - a name or ref inside a `vmark` block → `` `name = <expr>` ``, the computed
    value, `depends on: <refs>` from `dependencies()`, and the sheet-local
    evaluation position.
  - a computed table cell → the column rule, its computed value, and
    `stale: stored <x>` when it disagrees.
  - an anchored value → the scalar rule and its computed value.
- Returns Markdown. Read-only; no effect on the buffer.

## 7. Finding → diagnostic mapping

`Range` is `[positionAt(span.start), positionAt(span.end)]`. `source` is
`"visimark"`. `code` is the `FindingCode`.

| Code | Severity | Message (shape) | Quick fix |
|------|----------|-----------------|-----------|
| `STALE` | Warning | ``stored `10.00`, formula gives `12.00` (Net = Price * Qty)`` | update to computed |
| `DATE` decidable | Error | `dates must be ISO 8601 (YYYY-MM-DD); "15.10.2026" is unambiguous` | rewrite to ISO |
| `DATE` ambiguous | Error | `"11/12/2026" is ambiguous: 2026-11-12 or 2026-12-11, 29 days apart — fix by hand` | none |
| `UNIT` | Error | ``column `Price` mixes units: `$` and `€``` (or `decorated on both sides`) | none |
| `UNDEF` | Error | ``unknown name `Nett` `` (+ "did you mean `Net`?") | change to suggestion |
| `DUP` | Error | ``` `Net` is already defined in this sheet ``` , related information on the first binding | none |
| `VECTOR` | Error | ``` `Net` is a column, not a value ``` | wrap in `SUM(...)` |
| `CYCLE` | Error | `circular dependency: a → b → a` | none |
| `TYPE` | Error | the evaluator message | none |
| `SHEET` | Error | the structural message | none |
| `ANCHOR` | Warning | `no value to rewrite in front of this anchor` | none (v1) |
| `WARN` | Hint | `defined and never read` (+ suggestion) | none (v1) |

Ordering and the CLI's section grouping are a `report/format.ts` concern and
do not apply here — the editor sorts by position.

## 8. Configuration

Contributed under `visimark.*`:

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| `visimark.enable` | boolean | `true` | master switch; `false` stops the server |
| `visimark.check.debounce` | number (ms) | `300` | delay after a keystroke before re-checking |
| `visimark.format.fixDates` | boolean | `false` | `fmt` also rewrites decidable non-ISO dates |
| `visimark.inlayHints.enable` | boolean | `true` | show the stale-value inlay hints |
| `visimark.codeLens.enable` | boolean | `true` | show the per-block lens |
| `visimark.statusBar.enable` | boolean | `true` | show the status bar item |
| `visimark.trace.server` | off/messages/verbose | `off` | standard LSP trace |
| `visimark.server.path` | string | `""` | dev: path to a server entry to run instead of the bundled one |

`visimark.format.fixOnSave` (default `true`) decides whether an explicit save
brings stale values up to date. It is a VisiMark setting rather than a
deferral to `editor.formatOnSave` because the two answer different questions:
`editor.formatOnSave` picks the document's formatter, which for most people
writing Markdown is Prettier, and turning it on to get VisiMark's repairs would
also reflow their prose. `editor.formatOnSave` and `editor.codeActionsOnSave`
continue to work for anyone who prefers to drive it that way.

## 9. The VS Code client

`editors/vscode`, thin. Responsibilities:

- Start `LanguageClient` (`vscode-languageclient/node`, `TransportKind.ipc`),
  module = the bundled server, or `visimark.server.path` when set.
- `documentSelector`: Markdown, `file` and `untitled`.
- Push `visimark.*` configuration; restart-free `didChangeConfiguration`.
- **Status bar item**: subscribe to `visimark/status`; for the active editor
  show `✓ VisiMark` or `⚠ VisiMark: 3 stale, 2 errors`; click runs
  `visimark.showReport` — a virtual document with the full `check` output for
  the file (the CLI transcript, reused verbatim via `formatCheck`).
- Register commands: `visimark.fixAllStale`, `visimark.fixSheet`,
  `visimark.explainSheet`, `visimark.showReport`, `visimark.restartServer`.
- Virtual document providers for `visimark-explain:` and `visimark-report:`.
- Bundle with esbuild: `editors/vscode/dist/extension.js` and
  `.../server.js`, both including the engine. No `node_modules` in the VSIX.
- `engines.vscode`: `^1.85.0`.

No syntax highlighting, no snippets, no language contribution in v1.

## 10. Distribution and CI

One version across `packages/visimark`, `packages/visimark-lsp`,
`editors/vscode`, bumped together.

- **`.github/workflows/ci.yml`** — on push and PR: `bun install`; `bun test`
  (all workspaces, the engine suite plus the new server tests); `bun run
  typecheck`; `bun run build`; `vsce package` in `editors/vscode`; upload the
  `.vsix` as a build artifact.
- **`.github/workflows/release.yml`** — on tag `v*`:
  1. build + full test + typecheck (gate).
  2. `npm publish` `packages/visimark` (`NPM_TOKEN`).
  3. `vsce publish` the extension (`VSCE_PAT`).
  4. `ovsx publish` the same `.vsix` to Open VSX (`OVSX_PAT`).
  5. GitHub Release with the `.vsix` attached and notes from `CHANGELOG.md`.
- A tag whose version already exists on a registry is a no-op for that step,
  not a failure (re-runnable release).
- Marketplace metadata (`editors/vscode`): icon, categories
  `["Linters", "Formatters"]`, `displayName` "VisiMark", repository link, a
  listing README derived from the top-level README.

## 11. Testing

- **Engine, after the move**: the whole existing suite passes unchanged. The
  acceptance suite (`check` on the drift invoice byte-for-byte, `fmt`
  idempotent) is the proof that the span and `PlannedEdit` additions broke
  nothing.
- **Engine, new**: `span` is populated for every finding code, including `DUP`
  and `UNIT`, with the span landing on the expected cell/ref/anchor/line;
  `planFmt` returns `PlannedEdit`s whose `finding` matches the edited span.
- **Server (the weight of the suite)**: headless, driving the server over an
  in-memory stream with `vscode-languageserver` test helpers.
  - `didOpen` the drift invoice → assert the published diagnostics: count,
    each range, severity and code, as a normative fixture checked into the
    repo (the LSP mirror of the CLI's fenced-transcript test).
  - `textDocument/formatting` → the returned edits, applied, equal
    `fmt(source)`.
  - `textDocument/rangeFormatting` over one table → only that table's cells
    change.
  - `codeAction` at a stale cell → the "update to" fix; `source.fixAll` →
    every stale edit.
  - `inlayHint` over the whole doc → one hint per stale value, none on correct
    values.
  - `codeLens` → one lens per `vmark` block with the right counts.
  - `hover` on a rule name, a computed cell, an anchor → the expected Markdown.
  - `didOpen` a plain Markdown file → no diagnostics, no hints, no lenses.
- **Client**: one `@vscode/test-electron` smoke test — activate on
  `example-invoice-drift.md`, assert diagnostics appear, run "Format Document",
  assert the stale values are repaired and the file otherwise unchanged. Kept
  deliberately small; the server tests carry correctness.

## 12. Deferred

- Other editor clients (Neovim, Zed, Helix). The server is built for them; each
  is a later, small PR.
- Incremental reparse.
- Completion — column names, function names, refs inside a `vmark` block.
- Semantic tokens / highlighting for the expression grammar.
- Rename: propagating a column-name change across sheets that reference it.
- Workspace-wide check (all VisiMark files at once, a project diagnostic).
- `ANCHOR` and `WARN` quick fixes (insert a placeholder value; remove or rename
  an unused scalar).
- Watching the file on disk for out-of-editor changes beyond what
  `TextDocuments` already gives.

## 13. Known tensions

**Fix-on-save mutates the document, and staleness is the signal.** This was
first resolved the other way — no VisiMark default, drift left visible until
the person acted — and the default was reversed deliberately. Both readings of
"staleness is the signal" are defensible, and the deciding argument is *who is
being signalled to*.

Drift matters at review time, when a reader has to know whether a number was
recomputed or merely left behind. It does not need to persist on the author's
own disk to do that job: the author already saw it, live, as a squiggle and an
inlay hint, in the seconds after making the edit that caused it. Keeping it on
disk past that point does not inform the author again — it just ships a
document whose numbers are wrong to everyone downstream, and makes committing
drift the path of least resistance. Repairing at save keeps the invariant
where it pays: what leaves your machine agrees with its formulas.

The cost is real and is accepted: a save now changes bytes the author did not
type. Three things bound it. `fmt` writes only what VisiMark owns — computed
cells and anchored values — so prose, headings and input columns are never
touched. The edits are exactly the ones the inlay hints had already displayed,
so nothing appears that the author had not been shown. And it is one setting
away from off, which is a stronger guarantee than it sounds: the CLI is the
normative checker, and `visimark check` in CI catches drift regardless of what
any editor was configured to do.

**The engine gains a public API surface.** Every symbol in section 4.3 is now a
contract. Mitigated by keeping it a thin re-export with no logic, and by
versioning all three packages together so a breaking engine change and the
clients that depend on it ship in the same tag.

**Byte offsets are UTF-16 code units.** mdast's `position.offset`,
`String.prototype.slice`, and `TextDocument.positionAt` all agree on this, so
an emoji in prose stays consistent end to end. Noted so a future contributor
does not "fix" it toward byte offsets.

**Full reparse per keystroke (debounced).** Fine at invoice and memo sizes,
which is all VisiMark targets. If a pathological document ever makes this
sting, the debounce is user-configurable and incremental reparse is the
deferred escape hatch.

<!--vmark:no-formulas-->
