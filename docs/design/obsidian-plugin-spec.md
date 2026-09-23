# The Obsidian plugin — feature spec

**Status:** draft (#176) — the fork is decided, the v1 rows are not.
Row 1 has been built ([#200](https://github.com/michal-niedzwiedzki/visimark/issues/200)),
and what it falsified is corrected in place: §2.1, §2.6, §5 and §9. ·
**Date:** 2026-09-23 ·
**Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/176#issuecomment-5791675790

**What this document is and is not.** The fork-B decision states that the v1 /
v1.1 / v2 tables are a roadmap, that approving the fork approves none of them,
and that each row becomes its own issue on its own form. This spec is the
substrate those issues cite. It exists so that eleven issues do not each
re-decide the package layout, the manifest, the build, the vault reader and the
words a finding is shown in — and so that the first row filed does not settle
all of that by accident, in an implementation, where nobody reviews it as a
decision.

It ratifies nothing. A row may still be rejected on its own merits, and a
rejected row leaves the rest of this document standing.

Builds on [`visimark-design.md`](../visimark-design.md) (the engine),
[`visimark-editor-plugins-design.md`](../visimark-editor-plugins-design.md) (the
LSP and the VS Code client) and
[`obsidian-manual-test.md`](obsidian-manual-test.md) (Part 2 is this spec's
acceptance script, written before it).

## 1. Purpose

`editors/obsidian` is a VisiMark client for audience B: someone who keeps a
knowledge base in Obsidian, reads it on a phone, and will never open a
terminal. It is a **reading surface first**, which inverts the VS Code priority
list — there, diagnostics come first and the preview is incidental; here, what
a value looks like in reading mode is the product and the editing affordances
follow.

### 1.1 The motivating session

A person has a note with a table of numbers and a paragraph that quotes one of
them. They edit a number in the table. The paragraph now lies, and nothing
tells them. The CLI would tell them:

```console
$ visimark check notes/consulting-q3.md
notes/consulting-q3.md

  STALE  lines.net_total  stored 23300.00, computed 24100.00

  1 problem (1 stale, 0 errors)
```

They will not run that. They do not have a terminal on the device the note was
written on, they have never installed a package from npm, and the output above
is addressed to a build system.

### 1.2 Why the shipped surfaces do not reach it

| Surface | Why not |
|---|---|
| The CLI | Requires a terminal, a package manager and a path. Audience B is defined by not having the first of those. |
| `editors/vscode` over `visimark-lsp` | Requires VS Code. It is also an editing surface: its whole feature list — diagnostics, quick fixes, CodeLens — is addressed to someone who reads error lists. And it has no mobile client at all, which is the larger half of this audience. |
| `visimark-mcp` | Addressed to an agent, not a person. |
| The browser playground | A scratchpad, not a vault. Nothing persists and nothing is a note. |

There is no adaptation of any of these that reaches a phone-first reader. That
is the argument the fork-B decision settled; it is restated here because a
spec that does not say who it is for gets implemented for whoever is nearest.

### 1.3 What this spec does not cover

- **The v1.1 and v2 rows**, and everything on the rejected list in
  [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176). §8.
- **Any engine change.** This spec names none, deliberately: spike check 1's
  pass condition was that a third client needs no engine diff, and a spec that
  quietly spends that result has falsified it rather than used it. Where the
  engine does not reach, §2.6 builds the missing piece *inside the plugin*.

  Building row 1 found one the spec had not anticipated, and it was filed and
  shipped on its own issue rather than inside a plugin PR, exactly as §6 says
  it must be:
  [#201](https://github.com/michal-niedzwiedzki/visimark/issues/201), the
  engine's browser-safe entry point. It is additive — a new module of
  `export … from` lines, zero deletions, no published entry point changed —
  which is the *second* half of spike check 1's stated pass condition ("zero
  lines of engine diff, **or additive exports only**"). The spike is not spent;
  this is the first thing to exercise its browser half.
- **The three spike gaps** —
  [#189](https://github.com/michal-niedzwiedzki/visimark/issues/189),
  [#190](https://github.com/michal-niedzwiedzki/visimark/issues/190),
  [#191](https://github.com/michal-niedzwiedzki/visimark/issues/191). They are
  filed, in flight, and ahead of the first plugin row.
- **The public API facade.** It belongs to the section-F catalogue row *Shared
  build across the document phases*, per the decision comment. §2.7 describes
  the plugin's *own* API surface, which is a different object: a facade over
  the vault, not over the engine.

## 2. The surface

### 2.1 Package layout

```
editors/
  obsidian/
    manifest.json      the Obsidian plugin manifest — id, version, minAppVersion
    versions.json      minAppVersion history, required by the community registry
    src/
      main.ts          the Plugin subclass: lifecycle, commands, settings
      snapshot.ts      the vault-backed ReaderPort (§2.6)
      api.ts           the public plugin API (§2.7)
      findings.ts      the audience-B finding vocabulary (§3.2)
      reading.ts       the Markdown post-processor (reading mode)
      live.ts          the CodeMirror 6 ViewPlugin (Live Preview)
      sweep.ts         the vault health sweep
    test/
      bundle.test.ts   the graph guard (§2.2)
    esbuild.config.mjs
```

It depends on the engine as `"visimark": "workspace:*"`, exactly as
`packages/visimark-lsp` and `editors/vscode` do, and it imports one engine
specifier and nothing else — no path into `src/eval/` or `src/model/`. That is
the same condition the two shipped clients meet and it is not relaxed here.

**The specifier is the engine's browser-safe entry point, not `index.ts`.**
This was written expecting `"visimark"` and the expectation was wrong: the
public entry point cannot be bundled for a browser at all. It reaches
`node:fs`, `node:crypto`, `node:module` and `node:url` through exports made on
purpose — `nodeReader`/`onDisk`, `runCli`, `readVersion`, `writeArtifact` — and
a bundler resolves before it tree-shakes, so nine specifiers fail to resolve
before anything is shaken. Nobody had hit it because no browser consumer went
through `index.ts`: the playground enters at `playground/browser-entry.ts` and
imports the engine by path. `packages/visimark/src/browser.ts`
([#201](https://github.com/michal-niedzwiedzki/visimark/issues/201)) is the
named boundary, a subset of `index.ts` enforced by test, and it is what the
plugin imports. The condition above is unchanged in substance: one engine
specifier, no reach into internals.

**The plugin does not go through `visimark-lsp`.** Obsidian has no language
server client and no diagnostics surface to feed. The plugin is a third client
of the *engine*, not a second client of the *server* — which means
[`visimark-editor-plugins-design.md`](../visimark-editor-plugins-design.md) §1's
"one engine, one language server, thin clients" is now one client too narrow.
§7 lists that amendment.

### 2.2 The manifest and the build

| Field | Value | Why |
|---|---|---|
| `id` | `visimark` | matches the npm package and the CLI |
| `isDesktopOnly` | `false` | mobile is the entire reason fork B is not a VS Code feature |
| `minAppVersion` | the version the CodeMirror 6 editor extension API in use was introduced in, recorded in `versions.json` | required by the registry; a guess here is a support claim nobody tested |

Build: **esbuild**, format `cjs`, one `main.js`, with `obsidian`, `electron`
and the CodeMirror packages Obsidian itself provides marked external.

**No `node:` specifier may reach `main.js`, and that is stricter than the
playground's rule.**
[`browser-graph.test.ts`](../../packages/visimark/test/playground/browser-graph.test.ts)
permits exactly one builtin, `node:path`, with a written rule for adding
another. That permission does not transfer: Obsidian desktop is Electron and
has Node, Obsidian mobile is not and does not, so a `node:path` that works on
the desktop is a crash on the device this fork exists for. The plugin build
maps `node:path` to a bundled browser implementation, and
`test/bundle.test.ts` asserts **zero** `node:` specifiers over the shipped
bytes, by the same two-ended method as the playground guard — a source walk
from `main.ts` and a grep over the output — with dynamic `import()` banned so
the walk cannot go blind.

The bundle's size is recorded as a checked ceiling, in the shape
[#191](https://github.com/michal-niedzwiedzki/visimark/issues/191) settles for
the playground bundle. It gets its own number: a plugin ships one `main.js` and
the registry's reviewers read its size. Row 1 recorded it — **161,078 bytes**
on 2026-09-23, with the same 10% margin and the same rule for bumping it.

**Versioning is independent of the npm packages.** The three published packages
share one version and a `vX.Y.Z` tag releases the set. The plugin does not join
that: an Obsidian release goes through a human registry review, and coupling an
engine patch to that review latency would either stall the engine or ship plugin
versions nobody changed. `manifest.json` carries its own version, and the
engine version it bundles is stated in the release notes and in
`CONTRIBUTING.md`.

**v1 is side-loadable, not listed.** The community registry — a PR against
`obsidianmd/obsidian-releases`, a human review, and a GitHub release carrying
`manifest.json`, `main.js` and `styles.css` — is submitted once the v1 rows are
complete and [Part 2](obsidian-manual-test.md) passes end to end, not at the
first row. Until then the plugin installs from a GitHub release asset or
through BRAT. Submitting a plugin whose acceptance script has never been run
whole spends a reviewer's time on a draft.

### 2.3 Activation

**Opt-in per note, and invisible otherwise** (v1 constraint 4). The plugin
registers its lifecycle on load, but every surface — status bar item, ribbon
state, decorations, findings view — is gated on the *active note containing at
least one ```` ```vmark ```` fence*. A vault of ordinary notes is
indistinguishable from one without the plugin installed. This is the pass
condition of manual test §2.1 and it is not a preference.

The gate is the fence, not a frontmatter key and not a folder: the fence is
what `locate()` already keys on, and any second gate would be a second
definition of "is this a VisiMark document" that can disagree with the CLI's.

The commands in §2.4 remain registered and are no-ops with a plain notice on a
note with no fence — a command palette that hides and unhides entries as the
active note changes is worse than one that answers.

**One surface is pulled forward into row 1: a status bar item that reports the
gate.** Manual test §2.1's pass condition has a positive half — *open
`example-invoice.md`, VisiMark activates* — and every surface that could show
it otherwise belongs to a later row, which would leave row 1 acceptable by unit
test alone and §2.1 half-runnable until row 12. So row 1 ships the smallest
observable thing: an item reading `VisiMark` when `locate` found a block,
hidden when it did not, with no verdict, no count and no engine call beyond the
gate's own parse. Row 12 adds the ribbon and the checked / findings states to
that element rather than introducing one.

### 2.4 Commands

Five, mirroring the CLI's verbs, each scoped to the active note (v1 row 4).

| Command | Engine path | Writes |
|---|---|---|
| **VisiMark: Check** | `analyze(source)` | never |
| **VisiMark: Format** | `planFmt` → preview → `applyEdits` | on the explicit invocation only |
| **VisiMark: Infer** | `infer` → `planInfer` → preview → `applyEdits` | on the explicit invocation only, inserts only |
| **VisiMark: Evaluate** | `analyze(source)`, values by name | never |
| **VisiMark: Explain** | `explainView` | never |
| **VisiMark: Sweep the vault** | `analyze` over every note containing a fence | never |

The sweep is the sixth and has no CLI twin — it is the row that justifies fork
B over the VS Code extension (v1 row 8), and it is read-only.

**Explain is blocked, and the blocker is not in the plugin.** `explainView`
lives in `report/explain.ts`, which imports `readVersion()` from
`cli/version.ts`, which imports `node:module` — so it cannot enter a browser
bundle at all. `docs/design/cross-host-equivalence-check-spec.md` §2 found this
first, from the other side, and calls its own workaround "closer to forced than
chosen": it builds the `--json` envelope host-side, outside the bundle. The
same wall stands in front of the whole envelope, which §2.7's `explain` and any
future JSON output would want.

Making it browser-safe means making the engine's own version injectable rather
than read through `createRequire` at module scope. That is a change to modules
neither this spec nor
[#201](https://github.com/michal-niedzwiedzki/visimark/issues/201) touches, and
"what version does a browser host report" is a real decision with
[#189](https://github.com/michal-niedzwiedzki/visimark/issues/189) downstream
of it. **Filed as
[#204](https://github.com/michal-niedzwiedzki/visimark/issues/204)**, which
lays out three candidate designs; until it is decided, Explain is not a v1 row
that can be started, and §9 records it as the spec's one open question.

**The sweep's row states a size bound before it is filed.** An on-demand scan
of every note containing a fence is the whole feature, and it is also the one
surface whose cost grows with the vault rather than with the note. The row
names the vault size at which the scan is still acceptable **on a phone**, and
what happens above it — progress with a cancel, or a refusal with the count.
Without that, v1.1 row 13's incremental index stops being a deferred
improvement and becomes an unstated dependency, which is exactly what holding
it back was meant to avoid: the cache has to be justified by the feature
working, not by the feature not working.

### 2.5 Settings

Four, and the defaults are the spec.

| Setting | Default | Note |
|---|---|---|
| Format on explicit save | off | The VS Code client defaults this *on* ([editor plugins design §13](../visimark-editor-plugins-design.md#13-known-tensions)). It defaults off here because audience B has not agreed to a tool that changes bytes they did not type, and because mobile's save is a timer far more often than it is a decision. An autosave never triggers `fmt` on either surface. |
| Write chart artifacts | off, and not settable in v1 | There is no vault-backed write port (§8). Declining the write does **not** silence the finding — the shipped `--no-artifacts` contract, verbatim ([`cli-reference.md`](../cli-reference.md)). |
| Show provenance in Live Preview | on | v1 row 2 covers reading mode **and** Live Preview, as #176 states it and as manual test §2.2 demands. The setting exists because §16 records that Live Preview shows the anchor comment as literal text everywhere, so the decoration sits beside a visible `<!--vmark=…-->` — a design this spec commits to and wants one toggle away from if it reads badly in practice. |
| Sweep on vault open | off | A vault sweep on open is a scan of every note; it is a command, not a startup cost. |

### 2.6 The vault reader — the one piece the engine does not supply

This is the load-bearing part of the spec, and the one place the "thin client"
claim needed checking rather than repeating.

**The problem.** `ReaderPort`
([`packages/visimark/src/fs/reader.ts`](../../packages/visimark/src/fs/reader.ts))
is **synchronous** in all four methods, and `readSealed` must return a SHA-256
digest. Obsidian's vault adapter is **asynchronous**, and in a browser context
the only hash available is `crypto.subtle.digest`, which is also asynchronous.
A vault-backed `ReaderPort` therefore cannot be written as a direct adapter.

One bad answer, rejected: make the port async — an engine change, spending the
spike result this spec is built on.

**A second answer was rejected on a premise that turned out to be false, and is
now the design.** This section originally rejected "ship a synchronous SHA-256
into the bundle" for its weight and for "a second hash implementation to keep
honest". That implementation is already in the tree and already honest:
`packages/visimark/src/playground/sha256.ts` is a dependency-free synchronous
SHA-256, and `test/playground/sha256.test.ts` pins it against the FIPS 180-4
vectors *and* against `node:crypto` over randomised inputs. Its sibling
`playground/memory-reader.ts` is a map-backed synchronous `ReaderPort` built on
it, written for exactly this shape of problem in the playground. Both are
reachable from the browser-safe entry point
([#201](https://github.com/michal-niedzwiedzki/visimark/issues/201)), which
exports them because `index.ts` never did.

So the plugin builds no reader and no hash. It prefetches text and hands
`memoryReader` a lookup over the result.

**The design: prefetch, then serve from a snapshot.** Three phases, and the
first is the reason it works.

1. **Collect.** `locate(source)` yields the declared `import … from <path>`
   declarations and the `chart` image paths **before any evaluation happens**.
   Both classes are syntactic. There is no third class: nothing in the engine
   asks the reader for a path that a parse of the document did not name.
2. **Prefetch.** For each collected path, resolved relative to the note's
   folder: `await vault.adapter.read(p)`, then
   `await crypto.subtle.digest("SHA-256", bytes)`. Store `{ text, sha256 }`.
3. **Serve.** Call `check(model, { doc: { path, reader } })` with
   `memoryReader((p) => snapshot.get(p))`. Its four methods answer from the
   map: `exists` is membership, `realpath` is identity, `readText` returns the
   text or `null`, and `readSealed` hashes the bytes held *now* with
   `sha256Hex` — never a precomputed digest, or the stamp check is theatre.
   Phase 2 therefore needs only `vault.adapter.read`, not
   `crypto.subtle.digest`: the asynchrony that made a direct adapter impossible
   is confined to fetching text.

**Why this preserves `readSealed`'s guarantee rather than working around it.**
The port's contract is that the digest describes *the bytes that were actually
read*, with no opportunity to re-resolve the name between the gate's verdict
and the bytes. The snapshot satisfies that by construction and more strongly:
the name is resolved exactly once, in phase 2, and the text and the digest come
from that one read. No descriptor and no bytes cross the boundary — text and a
hex digest, as the port intends.

`realpath` as identity is sound because the vault adapter does not expose
symlinks and refuses paths outside the vault root. **The plugin adds no path
policy of its own**: a path that escapes the vault is simply not in the
snapshot, `exists` answers false, and the engine emits the `IMPORT` finding it
already emits for a missing file. The vault root is the gate, and it is
Obsidian's gate, not a second one written here.

**The invariant phase 1 rests on is asserted, not assumed.** A test in
`packages/visimark` wraps a recording reader around the acceptance corpus,
logging every path any phase asks for, and asserts the set equals the paths
declared in the source. If the engine ever grows a third class of read, that
test goes red in the engine's own suite — where it belongs — rather than as a
mystery `null` inside a plugin.

### 2.7 The plugin API

v1 row 9, and spike check 2 shipped: the surface a second plugin or an agent
calls to ask this vault for a verified number.

```ts
interface VisiMarkApi {
  readonly apiVersion: 1;
  check(file: TFile | string): Promise<Finding[]>;
  evaluate(file: TFile | string): Promise<Record<string, string>>;
  get(file: TFile | string, name: string): Promise<string | null>;
  explain(file: TFile | string, name: string): Promise<ExplainView>;
}
```

Reached as `app.plugins.plugins["visimark"].api`. Every method is async,
because every one of them goes through §2.6's prefetch.

`explain` is the exception to "row 9 is small": it returns an `ExplainView`,
and `explainView` cannot be bundled for a browser today for the reason §2.4
gives. Row 9 either ships without `explain` and adds it when that is fixed —
`apiVersion` is semver'd and adding a method is not a break — or waits. It does
not reimplement the view, which would be a second contract over the one thing
the API exists to make single.

**Values are strings, never numbers.** A JavaScript number cannot carry a
declared width, and the width is the point
([§7](../visimark-design.md#7-numeric-semantics)): `686.0000` and `686` are
different renderings of one value and the difference is the document's, not the
formatter's. A caller that wants arithmetic can parse; a caller handed a number
has already lost what VisiMark exists to keep. This is also what makes the
acceptance in manual test §2.9 a byte comparison against `eval --get` rather
than a numeric one.

`apiVersion` is semver'd from day one and a bump is a breaking change with no
migration channel — the same property that freezes the MCP tool names.

## 3. The contract

### 3.1 There is no exit code

The CLI's machine contract is exit codes and streams. A plugin has neither, so
the contract is stated as the mapping — and the mapping is the acceptance for
"one engine, thin client", because every row says *the same finding set as the
CLI*, differently presented.

| CLI outcome | Exit | Plugin surface |
|---|---|---|
| Clean | `0` | Status bar reads checked; no findings view rows; no decorations other than provenance |
| Findings | `1` | One findings-view row per finding, in §3.2's words; provenance decoration distinguishes values that disagree with their formulas; status bar reads in audience-B language |
| Usage error | `2` | **Cannot occur.** The plugin parses no argv. A command on a note with no fence is a notice, not a usage error |
| Engine throw | — | One notice naming the note, and the findings view says the note could not be checked. The plugin never silently shows a clean state for a note it failed to check |

**No red, no `STALE`, no "1 problem", no exit code anywhere in the UI** (v1
constraint 6). The finding code is available in the detail popover for someone
who goes looking; it is never in a row.

### 3.2 The finding vocabulary for audience B

One translation of the [§10](../visimark-design.md#10-error-taxonomy) taxonomy,
owned here, so that the findings view, the hover popover and the sweep all say
the same thing.

| Code | The row reads | Action offered |
|---|---|---|
| `STALE` (cell or anchor) | This value no longer matches its formula. | Repair |
| `STALE` (artifact) | This chart is older than the numbers it draws. | none in v1 (§2.5) |
| `DATE` | This looks like a date but is not one VisiMark can read. | none |
| `UNIT` | This column mixes units. | none |
| `UNDEF` | Nothing in this note is called *name*. | the did-you-mean name, from `closest` |
| `DUP` | *name* is defined twice. | none |
| `VECTOR` | This uses a whole column where one value is expected. | none |
| `CYCLE` | These values depend on each other in a loop. | the cycle path |
| `TYPE` | This formula does not fit together. | none |
| `SHEET` | This block has rules but no table above it. | none |
| `ANCHOR` | This highlighted value has nothing to bind to. | none |
| `PRECISION` | VisiMark cannot tell how many decimals this should have. | none |
| `ASSERT` | The assertion source line, verbatim, and that it does not hold. | none |
| `ARTIFACT` | This chart could not be built. | none |
| `IMPORT` | The data file this note reads could not be read. | none |
| `WARN` | *name* is defined but never used. | shown under advice, not as a problem |
| `NOTE` | not a row — it collapses into the finding it depends on | — |
| `COVERAGE` | Nothing in this table is checked yet. | Infer |

Only `STALE` offers a repair, because `fmt` repairs only `STALE`
([§10](../visimark-design.md#10-error-taxonomy)) and an action the engine will
not honour is worse than no action.

**This table is plugin code** — `src/findings.ts` — not an engine addition.
A plain-language sibling of `describeFinding` in the engine would be real reuse
the moment there is a second audience-B surface, and there is not one; adding it
now would be the engine change §1.3 says this spec does not make. When a second
surface wants these words, that is new information for the section-F catalogue
row, and the table lifts out unchanged.

### 3.3 What the plugin may write

Only `applyEdits` over a `planFmt` or `planInfer` plan, and only on an explicit
command or an explicit save (v1 constraint 3). Never on a keystroke, never on
idle, never on an autosave. `planInfer` **inserts only**: accepting an Infer
preview adds a ```` ```vmark ```` block and rewrites no existing byte of the
table, which manual test §2.7 verifies with `git diff` rather than by eye.

## 4. Behaviour table

| # | Situation | Result |
|---|---|---|
| 1 | Open a note with no ```` ```vmark ```` fence | Nothing: no status bar item, no ribbon state, no decorations, no findings view |
| 2 | Open `example-invoice.md` | Plugin activates; every computed value is marked as computed in reading mode and Live Preview; status bar reads checked |
| 3 | Open `example-invoice-drift.md` | Values disagreeing with their formulas are distinguishable from those that agree; findings view lists them in §3.2's words |
| 4 | Copy either file out of the vault and open it on GitHub | Renders exactly as before the plugin existed. Any decoration that survives into the file is a constraint-1 violation and a failed acceptance |
| 5 | Hover a computed value (tap on mobile) | Popover naming the formula, its inputs and the result, byte-identical to `explain` for the same binding; a cross-sheet input is named |
| 6 | Edit a note, wait, scroll, switch away and back, without invoking Format | The file is unchanged — not changed and changed back. On mobile too |
| 7 | Invoke Format on a drifted note | Computed cells and anchors repaired; prose, headings and input columns untouched; no chart SVG written; the stale-chart finding still listed |
| 8 | Invoke Infer on a plain table | A preview of the insertion first; accepting inserts a fence and rewrites no existing byte |
| 9 | Run the sweep with three drifted notes among a dozen ordinary ones | Exactly the three are listed; no ordinary note appears; a clean VisiMark note does not appear; the list is legible on a phone |
| 10 | Call `api.get(file, "lines.gross_total")` from the console | Equals `eval --get lines.gross_total` for the same file, as a string |
| 11 | A command on a note with no fence | A notice saying the note has no VisiMark block. No error, no exit code |
| 12 | An import path pointing outside the vault | Not prefetched; `exists` false; the engine's ordinary `IMPORT` finding, shown in §3.2's words |
| 13 | Insert a template into a new note | Passes `check` from the CLI with zero findings before anything is edited, and contains no Obsidian-only syntax |

Rows 1–13 are manual test Part 2 restated as a table; that document remains the
script, this is the contract.

## 5. Compatibility

| Thing | Before | After |
|---|---|---|
| The published npm packages (`visimark`, `visimark-lsp`, `visimark-mcp`, `remark-visimark`, `markdownlint-visimark`) | five packages | unchanged. The plugin is not published to npm |
| [`.agents/rules/runtime-parity.md`](../../.agents/rules/runtime-parity.md) | a published package with no `bin` gains no launcher and no second CI job | unchanged, and it applies: `editors/obsidian` has no `bin`, so no `sh` launcher, no `acceptance-node` leg, no `smoke-bun` leg |
| Workspace root | `packages/*`, `editors/*` | `editors/obsidian` is picked up by the existing globs; `bun test` walks it |
| `ci.yml` | builds and tests the workspace | **nothing.** `bun run build` and `bun run typecheck` are `--filter '*'` and `bun test` walks the tree, so the package joins all three by existing. Row 1 confirmed it: no workflow edit, no new job, no added step |
| `release.yml` | npm publish on tag, plus the MCP registry leg | unchanged for v1. The plugin ships as GitHub release assets on its own version, outside the npm tag (§2.2) |
| Every existing CI job, script and composite-Action invocation | — | **none behaves differently.** Nothing in this spec touches the engine, the CLI, `--json`, exit codes, or any published manifest |

## 6. Interaction with the rest of the tooling

- **`visimark-lsp` and `editors/vscode`** — untouched. The plugin does not
  speak LSP and shares no code with either beyond the engine both import.
- **`visimark-mcp`** — untouched. An agent that wants a vault number goes
  through §2.7's API from inside Obsidian, or through the MCP server from
  outside against a path; these do not meet.
- **The engine** — **no behaviour change**, and that is a specified property,
  not an accident. If a row's implementation finds it needs one, that is new
  information about spike check 1 and belongs on its own issue, not in a plugin
  PR. Row 1 found one and it went to
  [#201](https://github.com/michal-niedzwiedzki/visimark/issues/201) — additive
  exports only. The section-F catalogue row *Shared build across the document
  phases* is the wider question and is untouched by it, except that its
  standing con "No motivating document needs it" is now false.
- **[#189](https://github.com/michal-niedzwiedzki/visimark/issues/189)** — its
  scope is CLI `--json` against the browser bundle. The snapshot reader of §2.6
  is a natural third host for that corpus later; this spec does not widen #189.
- **[#191](https://github.com/michal-niedzwiedzki/visimark/issues/191)** — the
  playground bundle's ceiling. `main.js` gets its own, by the same mechanism.

### 6.1 What does not change

No document syntax. No evaluation semantics. No finding code, and none added.
No write-back behaviour. No CLI option, exit code or `--json` shape. No
`fmt` policy — the one difference from VS Code is the *default* of format-on-save
(§2.5), not what `fmt` does when it runs.

## 7. Documentation to update

- [`docs/visimark-editor-plugins-design.md`](../visimark-editor-plugins-design.md)
  §1 — "one engine, one language server, thin clients" now has a client that is
  not a language-server client. Amend it, and add Obsidian to §12's deferred
  list's converse: it is no longer deferred.
- [`docs/design/obsidian-manual-test.md`](obsidian-manual-test.md) — the header
  says Part 2 is not runnable and that `editors/` contains `vscode` and nothing
  else. Both become false with the first row.
- `README.md` — the surfaces list.
- [`docs/ci.md`](../ci.md) — if the build step is described there.
- `CONTRIBUTING.md` — building and side-loading the plugin into a test vault.
- `CHANGELOG.md` — per row, as each ships.

[`docs/visimark-design.md`](../visimark-design.md) §16 needs nothing: #192
already recorded the Part 1 results, including the accepted Live Preview row.

## 8. Non-goals

Everything in #176's v1.1 and v2 tables, and the whole of its rejected list. The
ones worth naming because someone will ask:

- **Chart generation in the vault.** Needs a vault-backed *write* port, which
  §2.6 deliberately does not build — the read snapshot is enough for v1 and a
  write port is a separate decision with its own failure modes. The stale-chart
  finding still shows (§3.2), which is the `--no-artifacts` split working as
  intended.
- **CSV import writes.** Same port. The *read* half works today through §2.6;
  only stamp insertion is blocked. #176's v1 constraint 2 — "anything needing
  `node:fs` is desktop-only" — is stricter than the engine requires and is not
  adopted here: the blocker is a missing write port, not a runtime.
- **Publishing scalars to YAML properties** (fork C as a feature of B),
  **cross-note transclusion**, **the scenario panel**, **the incremental sweep
  index**, **anything that adds Obsidian-only syntax**.
- **A spreadsheet grid, live rewrite on keystroke, a second preview, a custom
  chart view, cross-note queries** — #176's rejected list, unchanged.

## 9. Open questions

**One, and it was found by building row 1 rather than by drafting.**

**How does a browser host get `explainView` and the `--json` envelope?** Both
reach `node:module` through `readVersion()` and therefore cannot be bundled
(§2.4). It blocks v1 rows 3 and 4's Explain and §2.7's `explain`, and the
answer is an engine decision — inject the version, or something else — not a
plugin one. Filed as
[#204](https://github.com/michal-niedzwiedzki/visimark/issues/204) with three
candidate designs; it is decided there, not here.

Everything raised while drafting is resolved and recorded in the body rather
than here: versioning independent of the npm packages (§2.2), side-loadable
before the community registry (§2.2), Live Preview decorations inside v1 row 2
(§2.5), the finding vocabulary as plugin code (§3.2), the sweep's size bound as
a requirement on the row that files it (§2.4), and the activation witness in
row 1 (§2.3).

Two things this document asserted were checked while building row 1 and came
back **false**, and both are corrected in place above rather than listed here:
that the plugin could import `"visimark"` (§2.1 — it cannot; `index.ts` does
not bundle for a browser), and that a synchronous SHA-256 would be a second
implementation to keep honest (§2.6 — it already exists, and is already pinned
against `node:crypto`).

<!--vmark:no-formulas-->
