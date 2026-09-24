# VisiMark for Obsidian

A VisiMark client for someone who keeps a knowledge base in Obsidian, reads it
on a phone, and will never open a terminal. It is a **reading surface first**,
which inverts the VS Code client's priority list: there, diagnostics come first
and the preview is incidental; here, what a value looks like in reading mode is
the product.

The design is [`docs/design/obsidian-plugin-spec.md`](../../docs/design/obsidian-plugin-spec.md).
The fork was decided on [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176);
each v1 row is its own issue.

## What is built so far

**All twelve of v1's rows** ([#176](https://github.com/michal-niedzwiedzki/visimark/issues/176)),
each on its own issue:

| Row | | Issue |
|---|---|---|
| 1 | browser bundle + activation gate | [#200](https://github.com/michal-niedzwiedzki/visimark/issues/200) |
| 2 | provenance and staleness, reading mode and Live Preview | [#227](https://github.com/michal-niedzwiedzki/visimark/issues/227) |
| 3 | hover / tap a marked value for its formula | [#229](https://github.com/michal-niedzwiedzki/visimark/issues/229) |
| 4 | the five commands — Check, Format, Infer, Evaluate, Explain | [#221](https://github.com/michal-niedzwiedzki/visimark/issues/221) |
| 5 | `infer` with a preview | [#217](https://github.com/michal-niedzwiedzki/visimark/issues/217) |
| 6 | the findings view, in audience-B language | [#213](https://github.com/michal-niedzwiedzki/visimark/issues/213) |
| 7 | *repair half* — the findings view's per-row repair and Format both ship; format-on-save is still open | — |
| 8 | the vault sweep | [#215](https://github.com/michal-niedzwiedzki/visimark/issues/215) |
| 9 | the public API — `app.plugins.plugins["visimark"].api` | [#219](https://github.com/michal-niedzwiedzki/visimark/issues/219) |
| 10 | four templates — invoice, monthly budget, team capacity, experiment log | [#210](https://github.com/michal-niedzwiedzki/visimark/issues/210) |
| 11 | copy a note's values as JSON | [#223](https://github.com/michal-niedzwiedzki/visimark/issues/223) |
| 12 | status bar states and the ribbon icon | [#225](https://github.com/michal-niedzwiedzki/visimark/issues/225) |

Plus two pieces every row above is built on: the vault-backed reader
([#205](https://github.com/michal-niedzwiedzki/visimark/issues/205)) and the
audience-B finding vocabulary
([#207](https://github.com/michal-niedzwiedzki/visimark/issues/207)).

The templates live in [`templates/`](templates/), Markdown files the CLI can
check directly; each passes `visimark check` with zero findings before it is
edited.

**Row 7 is the one thing left of v1**, and only the format-on-save half: the
per-row repair (row 6) and the whole-note Format command (row 4) both write
today, through an explicit act. Format on an explicit save is a policy about
unattended writes and wants its own review rather than a fold into another
row's PR.

`docs/design/obsidian-manual-test.md` Part 2 is runnable end to end. Its table
says, per section, what a machine already asserts and what still needs a
person — nothing has been run inside a real vault, so §2.2 (everything on
screen), §2.5 (nothing written unbidden, especially on mobile) and §2.11
(portability, which outranks every other section) are where that matters most.

## Installing it

Not in the community registry, and deliberately: the registry submission is a
human review, and it waits until the v1 rows are complete and
[Part 2 of the manual test](../../docs/design/obsidian-manual-test.md) passes
end to end. Submitting a plugin whose acceptance script has never been run
whole spends a reviewer's time on a draft.

Until then, side-load it:

```sh
bun install
bun run --filter visimark-obsidian build
mkdir -p "$VAULT/.obsidian/plugins/visimark"
cp manifest.json main.js styles.css "$VAULT/.obsidian/plugins/visimark/"
```

Then **Settings → Community plugins → Installed plugins** and enable VisiMark.
Obsidian must not be in Restricted Mode for a community plugin to run; the
manual test's Part 1 deliberately uses Restricted Mode, and Part 2 deliberately
does not.

`main.js` is a build artifact and is not committed.

## What the build guarantees

**No `node:` specifier reaches `main.js`, and that is stricter than the rest of
this repository.** The browser playground permits exactly one builtin,
`node:path`, because Bun's browser build of it works in a tab. That permission
does not transfer here: Obsidian desktop is Electron and has Node, Obsidian
mobile is neither, so a `node:path` that works on the desktop is a plugin that
does not load on the device this client exists for. The build substitutes
[`src/browser-path.ts`](src/browser-path.ts), and
[`test/bundle.test.ts`](test/bundle.test.ts) asserts **zero** from both ends —
a source walk from `src/main.ts` through the engine, and a scan of the bytes
esbuild actually emits.

The engine comes in through
[`packages/visimark/src/browser.ts`](../../packages/visimark/src/browser.ts),
its browser-safe entry point
([#201](https://github.com/michal-niedzwiedzki/visimark/issues/201)). The
plugin imports no engine path of its own: it writes `visimark`, and **three
resolvers are made to agree on what that means** — `tsconfig.json`'s `paths`
for `tsc` and for `bun test`, and `esbuild.config.mjs`'s `alias` for the
build. A test ties the two files together, because the failure otherwise is
silent: the plugin would typecheck and test against one engine surface and
ship another.

## `minAppVersion`

`1.0.0`, and `versions.json` records it against the plugin's first version.

Row 1 uses only APIs that predate Obsidian 1.0: `Plugin`, `MarkdownView`,
`addStatusBarItem`, `registerEvent`, `workspace.on`, `debounce` and
`getViewData`. 1.0.0 is therefore a floor the code actually meets rather than a
number chosen to look safe.

**Row 2 is the row the spec said would settle this**, because it is the one
that registers a CodeMirror 6 editor extension. It does not move the floor:
`registerEditorExtension` and the CodeMirror 6 editor arrived with Live
Preview, which predates Obsidian 1.0, so every API this plugin uses still
predates the floor it declares.

That leaves 1.0.0 as an honest floor rather than a guess — but it is still an
*inference*, and a `minAppVersion` is a support claim the registry's reviewers
read. Before submission it is checked against the API documentation, and the
manual test is run on the oldest Obsidian the floor claims.

## Versioning

The plugin's version lives in `manifest.json` and **nowhere else**. The
workspace `package.json` deliberately carries none, so there is one number and
nothing for it to disagree with. It is not the `visimark` npm version and does
not move with it (spec §2.2); `CHANGELOG.md` says which engine version each
build carries, and `scripts/check-changelog-entries.ts` fails a build whose
manifest version has no dated entry.

## Developing

```sh
bun run --filter visimark-obsidian build       # one minified main.js
bun run --filter visimark-obsidian typecheck
bun test editors/obsidian
```

`bun test` builds the bundle in memory from the very options
`esbuild.config.mjs` exports, so the guard cannot drift from the build it
guards and does not depend on `bun run build` having happened first.

<!--vmark:no-formulas-->
