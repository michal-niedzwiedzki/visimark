# Runtime-portable CLI launcher — feature spec

**Status:** approved (#29) · **Date:** 2026-09-07 · **Decision:** [#29 (comment)](https://github.com/michal-niedzwiedzki/visimark/issues/29#issuecomment-5572442105)

## 1. Purpose

The published `visimark` command cannot start on a machine that has Bun but no
Node.js. `packages/visimark/bin/visimark.js` begins `#!/usr/bin/env node`, and
`bun install -g` links the bin as a bare symlink (`~/.bun/bin/visimark →
…/node_modules/visimark/bin/visimark.js`) rather than writing a launcher shim
the way npm/pnpm/yarn do. Typing `visimark` then makes the kernel honour the
shebang and hunt for `node`; on a Bun-only image there is none, and `env` aborts
with `env: 'node': No such file or directory` before Bun is ever consulted. The
CLI code itself runs correctly under Bun — only the launch path is broken.

`bunx visimark` and every npm/npx path already work; the single broken path is
`bun install -g` (equivalently `bun add -g`). Fixing it is not separable from
advertising Bun support: a `node` shebang cannot be kept and made to work under
a bare symlink, so the thing in the `bin` slot must resolve a runtime itself.

The whole project already treats Bun as first-class everywhere except this file
— `packageManager: bun@1.4.2`, `bun run --filter`, a `postinstall` that shells
out to `bun`, `bunx visimark` in the README and the agent skill. This change
brings the published executable in line with that: **the installed `visimark`
CLI is runtime-agnostic — install it with `bun add -g` or `npm i -g`, and it
runs under whichever of Node or Bun is on `PATH`.** In-repo development stays
Bun-first; Node becomes a CI-tested target.

This is a tooling / process decision, catalogued in
[`docs/vocabulary-catalogue.md`](../vocabulary-catalogue.md) **section F**. It
changes no language surface — no syntax, no evaluation behaviour, no finding, no
CLI subcommand.

## 2. The launcher

### 2.1 File layout

`packages/visimark/bin/` gains one file and keeps the existing one:

| File | Role | Shebang | Formatter/linter |
|---|---|---|---|
| `bin/visimark` | **new** — the launcher; the `bin` entry points here | `#!/bin/sh` | extensionless → not matched by oxfmt/oxlint or the Stop hook (all scoped to `*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}`); no config change needed |
| `bin/visimark.js` | **unchanged** — the payload: `import { runCli } from "../dist/cli/main.js"` and run it | `#!/usr/bin/env node` (now only cosmetic — the file is always passed as an argument to a runtime, never exec'd directly; kept so `node bin/visimark.js …` from a clone still works) | plain ESM, formatted as today |

`bin/visimark` ships with the executable bit set (committed via
`git update-index --chmod=+x`). `packages/visimark/package.json` `files` already
lists `bin`, so both files publish.

### 2.2 The script

```sh
#!/bin/sh
# visimark launcher. The published package links this file as the `visimark`
# command. It runs the real CLI (bin/visimark.js) under whichever JS runtime is
# on PATH — Node preferred, Bun as fallback — so that `npm i -g visimark` and
# `bun add -g visimark` both produce a working command.
# See docs/design/runtime-portable-launcher-spec.md.

# Resolve symlinks: npm links node_modules/.bin/visimark and bun links
# ~/.bun/bin/visimark straight at this file, so $0 is a symlink chain.
target=$0
while [ -L "$target" ]; do
  link=$(readlink "$target")
  case $link in
    /*) target=$link ;;
    *) target=$(dirname "$target")/$link ;;
  esac
done
dir=$(CDPATH= cd -- "$(dirname -- "$target")" && pwd)

runtime=$(command -v node || command -v bun) || {
  echo "visimark: needs Node.js or Bun on PATH" >&2
  exit 127
}

exec "$runtime" "$dir/visimark.js" "$@"
```

### 2.3 Behaviour

Runtime resolution: **Node if present, else Bun, else exit 127** with the
message above. Behaviour is identical under either runtime — `decimal.js` is pure
JS and the payload runs the same node-target `dist/` build — so the preference
order is only "least surprising default": Node is the more universally present
runtime. (On a machine whose only `node` is a `~/.bun/bin/node → bun` shim,
`command -v node` succeeds and Bun runs the payload; harmless.)

`process.argv[1]` inside `dist/cli/main.js` is `…/bin/visimark.js`, so the
`invokedDirectly` guard in `packages/visimark/src/cli/main.ts` stays `false` and
`bin/visimark.js` calls `runCli` itself — unchanged from today. The comment at
`main.ts:73-77` is reworded to say the entry point is now reached via the `sh`
launcher.

### 2.4 Install-path × environment matrix

| Install | Node present | Bun present | Before | After |
|---|---|---|---|---|
| `npm i -g` / `pnpm` / `yarn` (POSIX) | yes | – | works (cmd-shim) | works (shim runs `sh bin/visimark`) |
| `npx visimark` | yes (npx requires it) | – | works | works |
| `bun add -g` | yes | yes | works | works (Node) |
| `bun add -g` | **no** | yes | **`env: 'node'` failure** | **works (Bun)** |
| `bunx visimark` | – | yes | works | works |
| clone + `bun install` → `bunx visimark` / `node_modules/.bin/visimark` | – | yes | works | works |
| any | **no** | **no** | opaque `env` error | `visimark: needs Node.js or Bun on PATH` (exit 127) |

### 2.5 Correct regardless of current Bun behaviour

The report observed Bun 1.4.x writing a bare symlink for a global bin. If a
newer Bun already writes a wrapper script instead, this launcher is still
correct and still the right fix: it also covers older Bun, the neither-runtime
case, and any installer that links rather than shims. The plan's first task
packs the tarball and records what `bun add -g` actually does on the pinned Bun
version, but the outcome does not change the design — only the size of the "was
broken" set the smoke test demonstrates.

## 3. package.json

`packages/visimark/package.json`:

- `"bin": { "visimark": "bin/visimark" }` (was `"bin/visimark.js"`).
- `"engines": { "node": ">=18", "bun": ">=1.0.0" }` — adds the `bun` key. Neither
  installer enforces the other's key; this is documentation of intent. `node:
  ">=18"` is unchanged and still accurate.
- `"files"` unchanged (`bin` already covered).

No change to `"exports"` — its existing `"bun"` condition is for the library
entry and is unrelated to the executable.

## 4. CI

All new work lands in `.github/workflows/ci.yml`. The existing `build` job
(Bun: lint, format:check, typecheck, build, test, package the extension) is
unchanged.

### 4.1 Node acceptance run

A job `acceptance-node` that proves the CLI runs under Node against the real
documents:

- `actions/checkout`, `oven-sh/setup-bun` (to build) **and** `actions/setup-node`
  (node 20).
- `bun install --frozen-lockfile`, `bun run build`.
- Run the built CLI **under Node** against each worked example and assert the
  documented exit code:
  - `node packages/visimark/bin/visimark.js check docs/example-invoice.md` → exit 0
  - `node …/visimark.js check docs/example-invoice-drift.md` → exit non-zero
  - `node …/visimark.js check docs/example-quote-plain.md` → exit non-zero (COVERAGE)
  - `node …/visimark.js --version` → exit 0, prints `visimark <version>`
- `bun test` is **not** re-run here — it is Bun's test runner and stays Bun-only.
  This job is the "the shipped code path works under Node" check, not a second
  copy of the suite.

### 4.2 Packaged global-install smoke — two isolated runs

A job `pack` builds the tarball once and uploads it:

- `oven-sh/setup-bun`, `bun install --frozen-lockfile`, `bun run build`.
- `cd packages/visimark && npm pack` → `visimark-<version>.tgz`.
- `actions/upload-artifact` (name `visimark-tarball`).

Then two jobs, each `needs: pack`, each downloading the tarball:

- **`smoke-node`** — plain `ubuntu-latest`, `actions/setup-node` only, **no
  setup-bun**:
  - `npm i -g ./visimark-*.tgz`
  - `visimark --version` → prints `visimark <version>`, exit 0
  - `visimark check docs/example-invoice.md` → exit 0 (repo is checked out for the fixture)

- **`smoke-bun`** — runs in `container: oven/bun:latest` (that image ships Bun
  and **no Node**), **no setup-node**:
  - `bun add -g ./visimark-*.tgz`; put `~/.bun/bin` on `PATH`
  - `visimark --version` → prints `visimark <version>`, exit 0
  - `visimark check <fixture>` → exit 0, where `<fixture>` is a two-line `vmark`
    document the job writes itself (a full `actions/checkout` is avoided because
    the `oven/bun` image may lack `git`; `--version` alone would not exercise the
    payload's `dist/` import path, so a minimal check is kept)

`smoke-bun` on `master` before this change fails with `env: 'node': No such file
or directory` — it is the regression test for #29.

### 4.3 Trigger

Both additions run on the existing `ci.yml` triggers (`pull_request`; `push` to
`master` and `v*` tags). No new workflow file.

## 5. Release automation

The generalisation in #27 renamed the impl-branch convention to
`issue/<n>-<slug>-impl` for the general track, but the release tooling still
only recognises the vocab-track `vocab/issue-<n>-<slug>-impl`. #29 is the first
issue to exercise the general-track lifecycle, so its own row would never
promote and its issue would never auto-close without this fix.

- **`.github/workflows/release.yml`**, "Close shipped vocabulary-request issues"
  step: widen the branch filter from `^vocab/issue-[0-9]+-.+-impl$` to also match
  `^issue/[0-9]+-.+-impl$`, and make the issue-number extraction handle both
  prefixes (`vocab/issue-<n>-…` and `issue/<n>-…`). Rename the step to "Close
  shipped issues". The "issue still open" guard and the ancestor checks are
  unchanged.
- **`docs/releasing.md`**: the table row at line 20 and any prose naming
  `vocab/issue-<n>-<slug>-impl` gains the `issue/<n>-<slug>-impl` form.

This is the minimum needed for #29's lifecycle; it is not a broader rework of
releasing.

## 6. README and docs

The audience split raised during review (issue thread, discussion summary).
Consumer-facing surfaces stay on npm/npx; contributor surfaces stay on Bun; the
one consumer surface where Bun legitimately appears is the now-portable global
install.

- **`README.md` "Status" section** — the CLI line becomes: global install is
  `bun add -g visimark` **or** `npm i -g visimark`, `npx visimark` runs it
  without installing, and the command runs under whichever of Bun/Node is on
  PATH. State the Windows caveat (below).
- **`README.md` extension block (currently `bun run vscode-install` /
  `bun run vscode-uninstall`)** — reframed as an explicit *from-a-clone
  contributor* step, sitting with the other `bun` commands, and pointing plain
  users at the Marketplace / `code --install-extension` instead. The `bun run`
  commands themselves are unchanged (the underlying scripts are Bun-only).
- **`README.md` "In CI" section** — unchanged (`npx visimark check …` is
  correct); no Bun form added.
- **`docs/cli-reference.md`** — line 6 gains the `bun add -g` alternative and the
  "runs under Node or Bun" sentence.
- **Windows caveat, stated once (README Status + cli-reference):** `npx visimark`
  and `npm i -g visimark` work as before. npm's *global* Windows shim for a bin
  whose shebang is `#!/bin/sh` invokes `sh`, which must be on `PATH` — Git Bash
  and WSL provide it, plain PowerShell does not. For this tool's audience
  (developers, agents, CI) this is an accepted trade, not a silent one.
- **`skills/visimark/SKILL.md`** — no change required (`node bin/visimark.js …`
  and `bun src/cli/main.ts …` both still valid), but the "From a clone" line may
  add `bun bin/visimark.js …` for symmetry.

## 7. Acceptance

1. **`smoke-bun` is the headline check.** With this change on a branch, the
   `smoke-bun` CI job (Bun container, no Node) installs the packed tarball
   globally and `visimark --version` prints `visimark <version>` with exit 0.
   The same job on `master` fails with `env: 'node': No such file or directory`.
2. **`smoke-node`** — same, on a Node-only runner, still passes.
3. **`acceptance-node`** — the three worked examples produce their documented
   exit codes when checked by `node …/bin/visimark.js`.
4. **Existing `build` job and `dogfood` workflow stay green** — `node_modules/.bin/visimark`
   now resolves through the `sh` launcher; `command -v visimark` in `action.yml`
   and the dogfood PATH assertion are unaffected (the launcher is what the
   symlink points at, and it `exec`s the payload).
5. **`bun run lint` and `bun run format:check` stay green** with no config
   change — `bin/visimark` is extensionless and outside their globs.
6. **Local, no runtime:** `PATH= /bin/sh packages/visimark/bin/visimark` prints
   `visimark: needs Node.js or Bun on PATH` and exits 127.

## 8. Non-goals

- **No polyglot single-file launcher** (the rejected "shape A"): a `#!/bin/sh` +
  JS polyglot in `bin/visimark.js` was considered and rejected — it would need
  an oxfmt/oxlint ignore entry with a silent-severe failure mode, and puts an
  obscure trick in a `.js` file. The two-file split has no such cost.
- **No change to how the repo builds or is developed** — `packageManager`,
  `bun run --filter`, the `postinstall`, `bun test` all stay Bun-only.
- **No `dist/` restructure** — the payload runs the existing node-target
  `dist/cli/main.js` under both runtimes; the launcher never branches into
  `src/`.
- **No broader releasing rework** — only the branch-name recognition needed for
  the general track.
- **No Windows shim replacement** — the `sh`-on-PATH caveat is documented, not
  engineered around.
- **No new CLI subcommand, flag, or output.**

## 9. Open questions

None.
