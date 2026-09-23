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

**v1 row 1 only** ([#200](https://github.com/michal-niedzwiedzki/visimark/issues/200)):
the browser bundle and the activation gate. The plugin loads on desktop and on
mobile, and shows a status bar item reading `VisiMark` on a note that contains
a ```` ```vmark ```` block. That is all it does yet. Provenance decorations,
the hover popover, the five commands, the findings view, the vault sweep and
the plugin API are rows 2 through 12 and are not implemented.

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

**It moves when a row uses something newer**, and the row that moves it says
so. The spec ties it to the CodeMirror 6 editor-extension API that row 2's
Live Preview decorations will use; row 1 registers no editor extension, so that
version is not yet knowable and is not guessed here. Before the registry
submission it is checked against the API documentation rather than inferred —
a `minAppVersion` is a support claim, and the registry's reviewers read it.

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
