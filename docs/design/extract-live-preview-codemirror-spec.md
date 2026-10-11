# Published CodeMirror 6 extension (`codemirror-visimark`) — feature spec

**Status:** approved (#360) · **Date:** 2026-10-11 · **Decision:** [#360 comment](https://github.com/michal-niedzwiedzki/visimark/issues/360#issuecomment-6113324260)

## 1. Purpose

The Live Preview decorations — a mark on every computed value, and a stronger
mark on a value that disagrees with its formula — exist in exactly one place
today: inside the private Obsidian client, entangled with `obsidian` imports.

```console
$ head -7 editors/obsidian/src/live-preview.ts
import {
  debounce,
  editorInfoField,
  editorLivePreviewField,
  type Editor,
  type MarkdownFileInfo,
} from "obsidian";

$ grep '"private"' editors/obsidian/package.json
  "private": true,
```

This spec extracts that logic into a published, host-agnostic package,
`codemirror-visimark`, adds `@codemirror/lint` diagnostics over the same
finding set, and gives the package a second in-repo host on the same day: the
browser playground, moved from CodeMirror 5 to CodeMirror 6.

The two hosts are deliberately unalike. Obsidian has a vault, a Live Preview
mode, a settings toggle, and a contract that forbids red and finding codes in
its UI (v1 constraint 6 of #176,
[obsidian-plugin-spec §3.1](obsidian-plugin-spec.md#31-there-is-no-exit-code)).
The playground has none of those: no vault, no modes, and an audience that is
shown the CLI's own output in a terminal panel. A factory that serves both
without special cases is not shaped around either, and that is the point of
building the second host before the first publish. Lint ships because the
playground is its consumer; Obsidian never enables it.

No finding is added and no document changes meaning. Joplin is a possible
later host and not a justification; cross-note formulas stay rejected because
a document would then depend on something outside itself
([§2](../visimark-design.md#2-constraints-that-shaped-the-design)).

## 2. The surface

### 2.1 The package

| Field | Value |
|---|---|
| Directory | `packages/codemirror-visimark` |
| npm name | `codemirror-visimark` (the same as the directory; HTTP 404 on the registry on 2026-10-11 — re-checked before the first tag, per [`releasing.md`](../releasing.md#publishing-a-new-package-for-the-first-time)) |
| `version` | lockstep with the engine — every release tag publishes it at the engine's version |
| `type` | `module` |
| `exports` | `"."` → `./dist/index.js` + `./dist/index.d.ts`; `"./lint"` → `./dist/lint.js` + `./dist/lint.d.ts` |
| `files` | `dist`, `README.md`, `LICENSE` |
| `peerDependencies` | `@codemirror/state` `^6.5.2`, `@codemirror/view` `^6.36.2`, `@codemirror/lint` `^6.2.0` |
| `peerDependenciesMeta` | `@codemirror/lint`: `{ "optional": true }` |
| `dependencies` | none |
| `visimark` | **not named in `package.json` at all.** The engine is bundled from source; nothing resolves it at install time, so there is no pin to keep in lockstep |
| `bin` | none — under [runtime-parity](../../.agents/rules/runtime-parity.md) it gains no launcher |
| `engines.node` | the same `>=<current LTS major>` every published manifest carries |

**Peer floors.** `@codemirror/state` `6.5.2` and `@codemirror/view` `6.36.2`
are the floors `editors/obsidian/package.json` already declares; Obsidian's own
typings for its `minAppVersion` (1.8.7) say only `^6.0.0`, so the plugin's
floor is the tightest statement the repository has made. `@codemirror/lint`
`6.2.0` is the first release with `linter`'s `needsRefresh` option, which [§2.4](#24-what-visimarklint-does)
uses.

**The build** is a `Bun.build` script, `packages/codemirror-visimark/build.ts`:
ESM, `target: "browser"`, `splitting: true` (so `index.js` and `lint.js` share
one chunk holding the internal state field — two copies would be two
`StateField`s and lint would read neither), minified, with `@codemirror/*`
external. A resolve plugin maps `visimark` to
`packages/visimark/src/browser.ts` and `node:path` to
`packages/codemirror-visimark/src/browser-path.ts` — the same two
substitutions `editors/obsidian/esbuild.config.mjs` makes today. Declarations
come from `tsc -p tsconfig.build.json` and must not import `visimark` ([§4](#4-behaviour-table),
row B4).

### 2.2 The public API

```ts
// codemirror-visimark
import type { EditorState, Extension, StateEffectType } from "@codemirror/state";

/** Read one file a document declares as an import. Text, or null when unreadable. */
export type ReadImport = (path: string) => Promise<string | null>;

export interface VisimarkOptions {
  /** Whether to decorate this state at all. Default: always. */
  readonly active?: (state: EditorState) => boolean;
  /**
   * The document's path, relative to the root its imports resolve within
   * (`notes/q3.md`, `tutorial/13-imports.md`). The engine sees it as `/` + path.
   * null: this document gets no reader. Default: always null.
   */
  readonly path?: (state: EditorState) => string | null;
  /** How declared imports are read. Absent: no reader, whatever `path` says. */
  readonly readImport?: ReadImport;
  /** When marks are recomputed. Default: "debounced". */
  readonly recompute?: "debounced" | "on-refresh";
  /** Put tabindex="0" on every mark. Default: false. */
  readonly focusableMarks?: boolean;
}

export function visimark(options?: VisimarkOptions): Extension;

/** Dispatch `refresh.of(null)` to recompute now, whatever `recompute` says. */
export const refresh: StateEffectType<null>;
```

```ts
// codemirror-visimark/lint
import type { Extension } from "@codemirror/state";

/** Diagnostics over the findings `visimark()` computed for this editor. */
export function visimarkLint(): Extension;
```

That is the whole published surface. `analyse`, `analyseWithSnapshot`,
`hasVmarkBlock`, `decorationsFor`, `decorationsIn`, `importDependentNames` and
the snapshot are internal: no engine type appears in a published declaration.
The options interface is closed — a type test pins its five keys — and
`readImport` returns text and nothing else, so no option can carry an
evaluation hook
([§2](../visimark-design.md#2-constraints-that-shaped-the-design)
constraint 4, the closed extension point).

### 2.3 What `visimark()` does

| Aspect | Behaviour |
|---|---|
| **The gate** | `hasVmarkBlock(source)` first. A document with no `vmark` block gets no marks, no findings and no engine call beyond the gate's own parse. |
| **`active`** | Read on every recompute. False → no marks and an empty finding set. A change in `active(startState) !== active(state)` across a transaction recomputes immediately, in either `recompute` mode. |
| **A mark** | `Decoration.mark` over the value's source span. `class` is `visimark-computed`, or `visimark-computed visimark-disagrees`. Attributes: `data-vmark` (qualified name), `data-vmark-row` (only for a table cell), `data-vmark-path` (only when `path` returned non-null), `tabindex="0"` (only when `focusableMarks`). These classes and attributes are the documented styling contract; the package ships no theme. |
| **Local phase** | Synchronous: `locate` + `build` + `check` with no reader. A mark on a name `importDependentNames` reports is withheld rather than asserted. |
| **Snapshot phase** | Runs when the local phase withheld a mark **and** `path` is non-null **and** `readImport` is given. Fetches what the engine asks for to a fixed point (`snapshot.ts`, unchanged in substance), re-checks with the snapshot reader, and replaces the marks and findings — applied only if the view is alive, `active` is still true and the document is byte-identical to the one the phase started on. A failed read leaves the withheld marks withheld. |
| **`recompute: "debounced"`** | A document change maps existing marks through the change at once; the local phase reruns 400 ms after the last change; the snapshot phase is debounced at the same 400 ms. Today's Obsidian behaviour. |
| **`recompute: "on-refresh"`** | A document change only maps existing marks. Recompute happens at construction, on `refresh`, and on an `active` transition; the snapshot phase starts immediately after such a recompute, with no debounce. |
| **Findings** | Each recompute also stores the finding set it produced in an internal `StateField`, mapped through later changes, for `visimarkLint()` to read. One engine run feeds both. |
| **Nothing writes** | No transaction the extension dispatches changes the document. |

### 2.4 What `visimarkLint()` does

`linter(source, { delay: 0, needsRefresh })`, where `needsRefresh` is true on
any transaction that replaced the stored finding set, and `source` turns that
set into diagnostics:

- one diagnostic per finding with a `span`; a finding without one (`NOTE`, the
  collapsed anchor group) produces none;
- `from`/`to` from the span; `source: "visimark"`; `message` from the engine's
  `describeFinding(f)` — the CLI's own wording;
- `severity` from a table typed `Record<FindingCode, Severity>`, so a code
  added to the engine fails to compile here until it has a row:

| Severity | Codes |
|---|---|
| `error` | `DATE`, `UNIT`, `UNDEF`, `DUP`, `VECTOR`, `CYCLE`, `TYPE`, `SHEET`, `ASSERT`, `DOMAIN`, `ARTIFACT`, `IMPORT` — the LSP's table — plus `PRECISION` and `COVERAGE`, which fail `check` (`isProblem`) and which the LSP shows as `info` only because its table omits them |
| `warning` | `STALE`, `ANCHOR` — the LSP's table |
| `hint` | `WARN` — the LSP's table |
| `info` | `NOTE` (never reached: it has no span) |

**A document with an imported sheet** (any sheet whose `imported` is not null)
gets diagnostics **only** from a snapshot-backed check. Until one lands — and
for good when the host gives no `path` or no `readImport` — it gets none. A
reader-less check of such a document reports every imported column as `UNDEF`,
which would be a wrong error, not a missing one.

`visimarkLint()` without `visimark()` in the same editor yields no
diagnostics.

### 2.5 The Obsidian client

`editors/obsidian` keeps its host code and becomes a consumer:

| Moves to `packages/codemirror-visimark/src` | Stays in `editors/obsidian/src` |
|---|---|
| `decorations.ts`, `gate.ts`, `import-deps.ts`, `browser-path.ts` | `report.ts`, `findings.ts` (the audience-B vocabulary, [spec §3.2](obsidian-plugin-spec.md#32-the-finding-vocabulary-for-audience-b)) |
| `snapshot.ts` — `VaultRead` is renamed `ReadImport`; its Obsidian-specific symlink section stays as a short note in the Obsidian spec | `at-cursor.ts` (only `main.ts` uses it) |
| `analysis.ts` — `analyseWithSnapshot` no longer computes `report` | a thin `analysis.ts` wrapper that calls the package's `analyseWithSnapshot` and adds `reportFor(...)` |
| `live-preview.ts`'s ViewPlugin, with `debounce` replaced by an internal timer | `live-preview.ts` shrinks to host wiring: `fieldValue` (the one `as unknown as`), `pathFor`, `isLivePreview`, `editorViewOf`, and `livePreviewMarks(enabled, read)` |

`livePreviewMarks(enabled, read)` keeps its signature, so `main.ts` does not
change at that call site. It returns:

```ts
visimark({
  active: (state) => enabled() && isLivePreview(state),
  path: (state) => pathFor(state),
  readImport: read,
  recompute: "debounced",
  focusableMarks: true,
});
```

`forceLivePreviewRecompute` is replaced by the package's `refresh`;
`settings-tab.ts` dispatches `refresh.of(null)`.

The plugin reaches the package's internal modules (the analysis, the gate, the
decorations, the snapshot — reading mode, the findings view, the sweep and the
vault index all call them) through a **source alias**, never through `dist`:
`codemirror-visimark` and `codemirror-visimark/*` resolve to
`packages/codemirror-visimark/src/index.ts` and `src/*` in
`esbuild.config.mjs` and in `tsconfig.json` `paths`, the same way `visimark`
resolves to the engine's `browser.ts` today. `editors/obsidian/package.json`
gains `"codemirror-visimark": "workspace:*"`, which `obsidian-release.yml`'s
`bun install --frozen-lockfile` resolves inside the checkout with no registry
fetch. One bundle, so the engine and the analysis caches exist once in
`main.js`.

Obsidian never imports `codemirror-visimark/lint`. `bundle.test.ts` asserts
that `main.js` contains no `@codemirror/lint` specifier, so constraint 6 is a
test and not a convention.

### 2.6 The playground

**CodeMirror 6, bundled.** The five cdnjs CodeMirror `<script>` tags and its
stylesheet leave `docs/playground.html`. `@codemirror/state`, `view`,
`commands`, `language`, `lang-markdown`, `lint` and `search` become
devDependencies of `packages/visimark` — the playground's home; the published
engine's runtime is untouched. They are bundled into
`docs/vendor/visimark-playground.js`. Measured on 2026-10-11 with `bun build --target
browser --format iife --minify`, that set alone is 567 KB minified, against
171 KB for CodeMirror 5's core from cdnjs; row P6 records the real baseline.

**The build.** `build:playground`'s second `bun build` becomes a `Bun.build`
script, `packages/visimark/build-playground.ts`, with a resolve plugin that
maps:

- `codemirror-visimark` and `codemirror-visimark/*` → the package's `src`;
- `visimark` → `src/playground/app/engine-global.ts`, a module that re-exports
  from the `VisiMark` global `visimark-browser.js` already installs.

So the page keeps one engine copy. The global gains the one function the
package needs that it does not export today, `describeFinding`; a test asserts that every runtime import the package
makes from
`visimark` is exported by `engine-global.ts`. `packages/visimark/tsconfig.json`
gains the matching `paths`. The output is IIFE as today; the
`playground-bundle` job's byte-exact rebuild still covers it.

**The adapter.** `src/playground/app/editor.ts` creates the `EditorView` and
returns an object implementing the existing `CodeMirrorEditor` interface,
renamed `EditorPort` and moved out of `globals.d.ts` (whose CodeMirror half is
deleted). Store, pipeline, infer, files and simulate code call the same members
as today plus `refreshMarks()` and `setLabel()` below, and the fake editors in
`store.test.ts` and `persistence.test.ts` change only by those two no-ops.

| `EditorPort` member | CodeMirror 6 implementation |
|---|---|
| `getValue()` | `view.state.doc.toString()` |
| `setValue(text)` | one transaction replacing only the differing middle (longest common prefix and suffix), annotated as programmatic. `fmt` and infer write back through it unchanged: `FmtResult` carries no edits, and the other consumers that want edits (the LSP's formatting, Obsidian's repairs) already call `planFmt` on a model they hold, so adding `edits` to `FmtResult` would serve the playground alone. The cursor maps through the change; marks are recomputed at the end of the same pass (below) |
| `getCursor()` / `setCursor(pos)` | `{line, ch}` ↔ offset through `doc.line()`, clamped to the document |
| `on("change", fn)` | an update listener; `change.origin` is `"setValue"` for an annotated transaction, else `"+input"` |
| `on("scroll", fn)` | a `scroll` listener on `view.scrollDOM` |
| `getScrollInfo()` / `scrollTo(null, y)` | `scrollDOM.scrollTop`, `scrollHeight`, `clientHeight` |
| `getInputField()` | replaced by `setLabel(text)`, which sets `aria-label` on `view.contentDOM`; `files.ts`'s `setEditorName` calls it |

Extensions: `lineNumbers()`, `history()`, `search()`,
`keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap])`,
`EditorView.lineWrapping`, `markdown({ base: markdownLanguage })` — GFM, with
HTML blocks highlighted through the nested `lang-html` (and its JavaScript and
CSS), as CodeMirror 5's `xml` mode did; no `codeLanguages`, so fenced code,
`vmark` blocks included, is not language-highlighted — with
`syntaxHighlighting` over a highlight style in the editor's palette, a theme
reproducing today's dark editor colours
(the `.CodeMirror*` and `.cm-s-default` rules in `playground.html` become
`.cm-*` rules), then:

```ts
visimark({
  path: () => store.enginePath(store.current()),
  readImport: async (path) => store.readImport(path),
  recompute: "on-refresh",
}),
visimarkLint(),
```

`store.enginePath(name)` returns the `READER_FS` path without its leading `/`
for a file that map lists, and null otherwise — so exactly the documents that
get a reader today get one here, and `12-charts.md` still gets none.
`store.readImport(path)` returns `text(READER_FS["/" + path])`, or null.

**When the playground refreshes.** `EditorPort` gains one member,
`refreshMarks()`, which dispatches `refresh.of(null)` and then calls
`@codemirror/lint`'s `forceLinting(view)`; the test fakes gain a no-op.
`pipeline.refreshDerived()` ends by calling it. Every path that shows a
document runs `refreshDerived()` — the typing-settle pass, and `runNow()` for a
file switch, a revert and "Infer and write" — so opening a file (no `fmt`) is a
recompute too. The marks and diagnostics a visitor sees are always those of the
document after the pass — never a `disagrees` mark on a cell `fmt` is about to
overwrite.

**Marks styling** in the playground: `.visimark-computed` gets a subtle
underline in the editor's palette; `.visimark-disagrees` the page's red.

**Search.** CodeMirror 6 renders only the lines in view, so the browser's own
find can miss text off screen; `search()` and its keymap put CodeMirror's own
search panel on Ctrl/Cmd+F, which sees the whole document.

**CSP.** `script-src` keeps cdnjs (marked still loads from it). `style-src`
keeps `'unsafe-inline'`. The comment above the policy is rewritten: CodeMirror
6 injects its styles at run time, rather than CodeMirror 5's element styles;
whether a policy without `'unsafe-inline'` would still let them apply is not
tested here ([§8](#8-non-goals)).

**The preload** comment keeps both `vendor/` preloads; the cdnjs scripts it no
longer has to race are gone.

## 3. The machine contract

No CLI command, option, exit code, stream or `--json` shape changes. The
composite Action, `dogfood.yml` and every existing CI job's invocation behave
the same. The contract this spec adds is the package's:

| Surface | Contract |
|---|---|
| `exports` | exactly `"."` and `"./lint"`; a deep import is not supported |
| `index.d.ts`, `lint.d.ts` | [§2.2](#22-the-public-api) verbatim; no `visimark` import in any shipped declaration |
| Peers | [§2.1](#21-the-package); `@codemirror/lint` needed only by `./lint` |
| DOM contract | the classes and `data-*` attributes in [§2.3](#23-what-visimark-does) |
| Versioning | lockstep with the engine; the extension's behaviour can change only in a release that also publishes the engine |

## 4. Behaviour table

Package builds and artifact (`B`), editor behaviour (`E`, driven under
happy-dom in `packages/codemirror-visimark/test` — the package carries its own
`bunfig.toml` preload registering happy-dom, so `bun test` works from its
directory as well as from the root, whose preload already registers it),
Obsidian (`O`), playground (`P`), CI (`C`).

| # | Case | Session or assertion | Result |
|---|---|---|---|
| B1 | Build | `bun run --filter codemirror-visimark build` | exit 0; `dist/index.js`, `dist/lint.js`, one or more `dist/chunk-*.js`, `dist/index.d.ts`, `dist/lint.d.ts` |
| B2 | No Node builtin survives | `grep -c 'node:' packages/codemirror-visimark/dist/*.js` | `0` for every file (a bundle test, modelled on `editors/obsidian/test/bundle.test.ts`) |
| B3 | CodeMirror is not bundled | every `@codemirror/*` specifier in `dist/*.js` is an import, never inlined code; `dist` contains no `class StateField` definition | asserted by the bundle test |
| B4 | Declarations are engine-free | `grep -l 'visimark"' packages/codemirror-visimark/dist/*.d.ts` | no output |
| B5 | Pack | `(cd packages/codemirror-visimark && npm pack --pack-destination "$RUNNER_TEMP")` | `codemirror-visimark-<version>.tgz`; its `package.json` contains no `workspace:` and no `visimark` key |
| E1 | No block | an editor over `# notes\n\nplain text\n` | zero marks, zero findings |
| E2 | Computed and disagrees | an editor over `docs/example-invoice-drift.md` | a `visimark-computed` mark on every computed cell and anchor; `visimark-disagrees` on exactly the values `visimark check` reports `STALE` |
| E3 | `active` false | `active: () => false` | zero marks; flipping the predicate's answer in one transaction yields the E2 marks in that same update |
| E4 | Debounced | type one character in E2's document | marks shift with the edit at once; no recompute until 400 ms pass |
| E5 | On-refresh | same edit under `recompute: "on-refresh"` | marks shift; no recompute until `refresh.of(null)` is dispatched |
| E6 | Import, no reader | `docs/playground/tutorial/13-imports.md` with `path` null | every import-dependent mark withheld; other marks present |
| E7 | Import, reader | same with `path: () => "playground/tutorial/13-imports.md"` and a `readImport` over the repo's `docs/` files | after the snapshot phase, the same marks and `STALE` set the CLI gives for that file |
| E8 | Stale snapshot | edit the document while E7's snapshot is in flight | the snapshot's answer is dropped; the next recompute's applies |
| E9 | Focusable | `focusableMarks: true` | every mark carries `tabindex="0"`; with the default, none does |
| E10 | Lint | E2 plus `visimarkLint()` | one `warning` diagnostic per `STALE` finding with a span, message `describeFinding(f)`, source `visimark` |
| E11 | Lint, import without reader | E6 plus `visimarkLint()` | zero diagnostics |
| E12 | Lint alone | `visimarkLint()` without `visimark()` | zero diagnostics, no throw |
| E13 | Options are closed | a type test | `keyof VisimarkOptions` is exactly the five keys of [§2.2](#22-the-public-api) |
| O1 | Plugin tests | `bun test editors/obsidian` | pass, with the moved tests now under `packages/codemirror-visimark/test` and the host-wiring tests (field bridge, settings refresh) staying in `editors/obsidian/test` |
| O2 | No lint in Obsidian | `bundle.test.ts` | `main.js` contains no `@codemirror/lint` |
| O3 | One engine | `bundle.test.ts` | the engine's source graph appears once in `main.js` |
| P1 | Drift demo | open `example-invoice-drift.md` in the playground | the drifted values carry `visimark-disagrees` and a lint warning; the terminal and status are as today |
| P2 | Typing over a computed cell | change a computed cell, stop typing | after the pass, `fmt` has restored it, the cell is `visimark-computed`, no diagnostic on it, and the cursor stays where it was relative to the text around it |
| P3 | Imports chapter | open `13-imports.md`, then edit `13-imports.csv` in its tab and switch back | marks and diagnostics reflect the edited CSV's digest — the STALE stamp demonstration still works |
| P4 | No reader for charts | open `12-charts.md` | no reader is passed; no spurious `ARTIFACT` diagnostic |
| P5 | Accessible name | switch files | `contentDOM`'s `aria-label` reads `Editor: <name>` |
| P6 | Bundle size | `browser-graph.test.ts`'s size check, extended | `docs/vendor/visimark-playground.js` under a ceiling 10% above the baseline recorded when this lands; `visimark-browser.js`'s existing ceiling still holds |
| C1 | Pack job | `ci.yml` `pack` | packs `packages/codemirror-visimark`, uploads `${{ runner.temp }}/codemirror-visimark-*.tgz` with the other tarballs, and copies `scripts/codemirror-smoke.mjs` into the `mcp-handshake` artifact beside `plugins-smoke.mjs` |
| C2 | Smoke under Node, at the peer floor | `smoke-node` (matrix `lts/*`, `latest`): a scratch project, `npm i "$cm_tgz" @codemirror/state@6.5.2 @codemirror/view@6.36.2 @codemirror/lint@6.2.0 @happy-dom/global-registrator`; asserts the installed `package.json` bytes equal the packed ones; `node codemirror-smoke.mjs` | prints `codemirror-visimark ok — 2 marks, 1 disagrees, 1 diagnostic`; exit 0 |
| C3 | Smoke under Bun, at the latest peers | `smoke-bun`: the same scratch project with `bun add` and no peer versions; `bun codemirror-smoke.mjs` | the same line; exit 0 |
| C4 | Versions agree | `ci.yml` "every version-carrying file must agree" | fails unless `packages/codemirror-visimark/package.json`'s `version` and its `bun.lock` workspace block equal the engine's |

**The smoke document** (`scripts/codemirror-smoke.mjs`, rows C2–C3)
registers happy-dom, builds an `EditorView` with
`[visimark({ recompute: "on-refresh" }), visimarkLint()]` over

````markdown
# smoke

```vmark #s
a = 2
b = a * 3
c = a + 1
```

B is **6**<!--vmark=s.b--> and C is **4**<!--vmark=s.c-->.
````

dispatches `refresh.of(null)`, calls `forceLinting`, waits for the lint
pass, and counts `.visimark-computed` elements (2), `.visimark-disagrees`
elements (1) and diagnostics via `forEachDiagnostic` (1 — the engine's second
`STALE`, the collapsed anchor group, has no span). Any other count is
`::error::` and exit 1.

## 5. Compatibility

| Consumer | Before | After |
|---|---|---|
| `visimark` CLI, `--json`, exit codes | — | unchanged |
| `action.yml`, `dogfood.yml`, `docs/ci.md` recipes | — | unchanged; none imports an editor package |
| `visimark` engine's published `exports` | closed per #201 | unchanged; the playground's global gains `describeFinding` — that global is the page's, not a published entry |
| Obsidian plugin users | Live Preview marks | the same marks, the same 400 ms cadence, the same `data-*` attributes, `tabindex` as today; no lint |
| Obsidian release | `obsidian-release.yml` builds from the checkout | unchanged; the workspace package resolves locally |
| Playground visitors | CodeMirror 5 from cdnjs | CodeMirror 6 from `vendor/`; marks and lint diagnostics are new; editing, undo, scroll sync, file switching, revert, persistence and the quest behave as before |
| `smoke-node` / `smoke-bun` existing steps | — | unchanged; the new tarball does not match `visimark-[0-9]*` or `visimark-mcp-*` |
| Release | four npm packages | five; `release.yml` gains a `codemirror-visimark` leg after the engine's |

Reversible until the first publish; after it, the name and the option shape
are fixed in the usual npm way, which is why [§2.2](#22-the-public-api) is closed and pinned.

## 6. Interaction with the rest of the tooling

- **The engine.** Imported from source; no engine change except the one
  addition to the playground's global ([§2.6](#26-the-playground)).
- **`visimark-lsp` and the VS Code extension.** Untouched. The lint severity
  table copies the LSP's rows; the LSP's own fallback for `PRECISION`,
  `COVERAGE` and `NOTE` is not changed here.
- **Reading mode, the findings view, the sweep, the vault index** in Obsidian
  call the package's internals through the source alias; behaviour unchanged.
- **The cross-host check** (`scripts/cross-host-check.ts`) reads
  `visimark-browser.js` only; unchanged.
- **The playground pipeline's cost guard.** `measure()` times the whole pass
  including the extension's recompute, since `runPass` now ends with the
  refresh; `playground-pipeline-cost-plan.md` gains a column for it.
- **The workspace's CodeMirror copies.** The root `package.json` gains
  `overrides` pinning `@codemirror/state` and `@codemirror/view` to one version
  each, so the `obsidian` typings' exact peer pins (6.5.0, 6.38.6) stop
  installing second copies beside the workspace's. The `fieldValue` cast in
  Obsidian's wiring stays (its argument is still Obsidian's own field object);
  `test/harness/cm-state.ts` may simplify, and is not required to.
- **The peer floor** is exercised against the packed artifact, not the
  workspace: `smoke-node` installs the floor versions exactly, `smoke-bun` the
  latest ([§4](#4-behaviour-table), C2–C3). Between them the two ends of every peer range run a real
  `EditorView` on every CI run.
- **What does not change:** the CLI, the composite Action, the MCP server, the
  remark plugin, the markdownlint rule, `docs/ci.md`, the
  `visimark-browser.js` entry's existing API, and the Obsidian plugin's version
  and release path.

## 7. Documentation to update

- `docs/design/obsidian-plugin-spec.md` — [§2.1](obsidian-plugin-spec.md#21-package-layout)
  (the layout tree: the extension lives in the package),
  [§2.6](obsidian-plugin-spec.md#26-the-vault-reader--the-one-piece-the-engine-does-not-supply)
  (the snapshot moved), [§5](obsidian-plugin-spec.md#5-compatibility) (the npm set: correct the
  drifted "five packages", name `codemirror-visimark`, keep "the plugin is not
  published to npm").
- `CONTRIBUTING.md` — the Obsidian build section (source alias), the packages
  list, the version-field count under "What CI checks", the playground build.
- `docs/releasing.md` — the npm package count, the version-carrying file count,
  the dry-run list, and a worked line in "Publishing a new package for the first
  time" for this package.
- `scripts/prepare-release.ts` — the manifest list (six → seven) and the
  `bun.lock` block; the header comment's count.
- `scripts/verify-release.sh` — the npm package loop.
- `.github/workflows/release.yml` — the publish leg, its dry-run outcome line
  and the "every leg must have landed" list.
- `.github/workflows/ci.yml` — the `pack` step, upload glob and smoke-script
  copy, the version-agreement step and its comment, the smoke steps ([§4](#4-behaviour-table), C1–C4),
  and `node-support-policy`'s manifest loop, which must name
  `packages/codemirror-visimark/package.json`.
- `scripts/codemirror-smoke.mjs` — new, beside `plugins-smoke.mjs`.
- `.agents/rules/runtime-parity.md` — add `codemirror-visimark` to the
  published packages with no `bin`.
- `docs/playground.html` — the CSP comment, the preload comment, the removed
  CodeMirror tags and CSS.
- `packages/visimark/src/playground/app/globals.d.ts` — the "deliberately not
  dependencies" note goes with the CodeMirror declarations.
- `docs/design/playground-pipeline-cost-plan.md` — the extension's recompute.
- `packages/codemirror-visimark/README.md` — install (`npm i` and `bun add`,
  per runtime-parity), the two factories, the options, the DOM contract, the
  peer floors.
- `README.md` — one sentence naming the package beside the other clients.
- `CHANGELOG.md` — `## Unreleased` → `### Added`: the package; the playground
  editor move under `### Changed`.
- `editors/obsidian/CHANGELOG.md` — no entry: no user-visible change.
- `docs/vocabulary-catalogue.md` — the row moves to the Shipped register as
  `UNRELEASED`.

## 8. Non-goals

- A Joplin host, and anything that reads another note.
- Lint in Obsidian, or relaxing #176's constraint 6.
- Hover, explain or quick-fix UI in the package. Obsidian keeps its own
  popover; the playground keeps its REASONING panel.
- A published `visimark/browser` subpath (#201's deferral stands).
- Removing `style-src 'unsafe-inline'` from the playground — a follow-up issue,
  needing a real-browser test.
- Per-file undo history in the playground — CodeMirror 5 shared one history
  across file switches, and so does this.
- Fixing the LSP's severity fallback for `PRECISION` and `COVERAGE`.
- Sharing one engine build across the playground's `fmt`, `pgEval` and
  `pgExplain` (the catalogue row "Shared build across the document phases").

## 9. Open questions

None.

<!--vmark:no-formulas-->
