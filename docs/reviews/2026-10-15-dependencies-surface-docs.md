# VisiMark — code review: dependencies, exposed surface, pinning, isolation, documentation

**Date:** 2026-10-15 · **Commit:** `99076a4` · **Scope:** whole repository,
through five lenses only: what each published artifact depends on, what it
exposes, how versions are pinned, how components and pipelines are isolated
from one another, and whether the documentation is current and complete.
Code style, language design and test quality are out of scope here; the
[2026-09-15 review](2026-09-15.md) covers them.

Reviewed: the eight workspace manifests and four editor manifests, `bun.lock`,
every `dist/` the build produces, the six published npm tarballs as they sit
on the registry today (`visimark@0.2.0`, `remark-lint-visimark@0.2.0`,
`markdownlint-rule-visimark@0.2.0`, `visimark-mcp@0.2.0`; `codemirror-visimark`
and `markdown-it-visimark` are not published yet), all six workflows,
`action.yml`, the pre-commit hook, the agent config under `.agents/`, and the
top-level, package and editor READMEs plus `SECURITY.md`, `CONTRIBUTING.md`,
`docs/releasing.md` and `docs/distribution.md`. `bun test` is green: 3,084
pass, 0 fail, 242 files.

**Overall: B.** The release engineering here is more careful than most
projects of any size. Version agreement, Node-floor policy, generated-artifact
freshness and single-runtime install smoke tests are all enforced in CI rather
than written down. The weak spot is one level below that machinery. What the
bundler puts in `dist/` does not match what the manifests declare. It ships a
debug build of the Markdown parser. And the checks that look like they guard
this test something adjacent. Release secrets, editor settings and type
floors have isolation gaps of the same kind: the intent is written down
precisely, and the mechanism falls short of it.

---

## 1. Findings

Ratings: **Impl** grades the code, configuration or pipeline; **Docs** grades
the documentation for the same item. `—` means that half does not apply.

| # | Area | Finding | Impl | Docs | Proposed improvement |
|---|---|---|---|---|---|
| 1 | Dependencies | Every Node-target `bun build` (engine, remark plugin, markdownlint rule) bundles **micromark's development build** with `debug` wired in. With `DEBUG=micromark` set, `visimark check docs/example-invoice.md` prints **78,977 lines** to stderr. The published 0.2.0 tarballs carry the same build. | **C−** | — | Build with `--production`; add a CI assertion that `DEBUG=*` produces empty stderr. [§2.1](#21-row-1-micromark-development-build) |
| 2 | Dependencies | **Declared dependencies are not the loaded dependencies.** The engine bundles `unified`, `remark-*` and `decimal.js` and still installs them: 68 packages, 7.3 MB, none imported at run time. The remark and markdownlint plugins bundle a full engine copy (~775 KB) *and* depend on `visimark@0.2.0`, which they never import. The exact pin and the smoke step that verifies "the packed engine" therefore protect nothing. | **C** | — | Engine: keep bundling, drop the dead runtime deps. Plugins: `--external visimark`, as `visimark-mcp` already does. [§2.2](#22-row-2-declared-versus-loaded-dependencies) |
| 3 | Isolation | `release.yml` is **one job** that holds `NPM_TOKEN`, `VSCE_PAT`, `OVSX_PAT`, `contents: write`, `issues: write` and `id-token: write`. In that same job it runs `bun-version: latest`, tag-pinned third-party actions, and an `mcp-publisher` binary downloaded from `releases/latest` with no checksum. `actions/checkout` leaves the write token in `.git/config`. | **C+** | B | npm trusted publishing (no `NPM_TOKEN`). Split build from publish. Pin `mcp-publisher` by version and SHA-256. Use `persist-credentials: false`. SHA-pin third-party actions. [§2.3](#23-row-3-release-job-isolation) |
| 4 | Exposed surface | `visimark.server.path` is readable from **workspace** settings. A cloned repo's `.vscode/settings.json` can therefore name any `.js` file, and the extension runs it as the language server once the folder is trusted. The manifest declares no `untrustedWorkspaces` capability. | **C+** | — | `"scope": "machine"`, plus `capabilities.untrustedWorkspaces.restrictedConfigurations`. [§2.4](#24-row-4-workspace-settable-server-path) |
| 5 | Version pinning | **Type packages float above the runtime floors they stand in for.** `@types/vscode` is locked at 1.138.0 against `engines.vscode ^1.91.0`. `obsidian` is locked at 1.13.1 against `minAppVersion 1.8.7`. `@types/node` is locked at 26.6.5 against `engines.node >=24`. The Dependabot comment that excludes `@types/vscode` assumes this cannot happen. | **C+** | C | Exact-pin each type package to its floor, extend the Dependabot ignore list, and assert lock ≤ floor in CI. [§2.5](#25-row-5-type-packages-above-runtime-floors) |
| 6 | Version pinning | The root `overrides` pins `@codemirror/view` to 6.43.13. That is *below* the `^6.43.14` that five manifests declare. Dependabot cannot see overrides, so it keeps bumping the manifests and the bumps do nothing. | **B−** | C | CI check: every override satisfies every declared range for that package. Bump overrides and manifests together. [§2.6](#26-row-6-codemirror-overrides-below-declared-ranges) |
| 7 | Version pinning | **Bun has no tested floor and no single pin.** `packageManager` says 1.4.2. Most CI jobs, the release build and the `oven/bun` container use `latest` (1.4.3 today). `engines.bun` says `>=1.0.0`, and no job runs that. Two published manifests declare no `engines.bun` at all. | **B−** | C | Release builds from `packageManager`. `engines.bun` equals a version CI runs, enforced the way `node-support-policy` enforces Node. [§2.7](#27-row-7-bun-version-policy) |
| 8 | Isolation | The root `bunfig.toml` preloads the **Obsidian test harness** into every workspace's tests: global happy-dom plus `mock.module("obsidian")`. CI runs only the root `bun test`, so engine, MCP and lint-plugin tests all run with a DOM present. The markdownlint tests print a KaTeX quirks-mode warning under the root run and not when run alone. | **B−** | — | Move the preload into `editors/obsidian/bunfig.toml`; CI runs each workspace's tests from its own directory. [§2.8](#28-row-8-obsidian-test-preload-leaks-everywhere) |
| 9 | Isolation | The **engine package hosts the website and playground.** `src/playground`, `src/site`, seven `@codemirror/*` devDependencies, and a tsconfig path into `codemirror-visimark`, which itself bundles the engine. That makes a package cycle. The published tarball still ships `dist/playground/*.d.ts`. | **B** | — | Move the playground and site into a private `site/` workspace. [§2.9](#29-row-9-site-and-playground-inside-the-engine) |
| 10 | Exposed surface | `visimark` exports **60 runtime symbols** and ~40 types: `runCli`, `levenshtein`, `closest`, `lineOf`, `topoOrder` and others. None of them is documented, and no test pins the list. `visimark-mcp` exports ~25 internals, including its write-gate functions. | **B−** | **D** | Snapshot the export list in a test. Document the supported library API. Mark first-party-only exports `@internal` or narrow them. [§2.10](#210-row-10-undocumented-public-api) |
| 11 | Exposed surface | `remark-lint-visimark`'s published `.d.ts` imports from `unified` and `mdast`, and the package declares neither. Every consumer of `visimark` in the repo typechecks against engine *source* through tsconfig `paths`, so no job ever typechecks a packed `.d.ts`. | **B−** | — | Peer `unified`, depend on `@types/mdast` (or go structural, as the markdownlint rule did). Typecheck the packed tarballs in the smoke jobs. [§2.11](#211-row-11-published-declarations-are-never-typechecked) |
| 12 | Version pinning | `action.yml` and `scripts/precommit-visimark-check.sh` run **any `visimark` already on `PATH`** before the version they pin. A consumer pinned to `@v0.2.0` who has an old global install runs the old engine, and nothing says so. | **B−** | C | Use the `PATH` binary only when its `--version` matches the pin. [§2.12](#212-row-12-path-binary-bypasses-the-pin) |
| 13 | Dependencies | `visimark-mcp` installs **158 packages / 34 MB**, including `express`, `hono`, `cors`, `jose` and `pkce-challenge`, for a server that only speaks stdio. The SDK is exact-pinned, so the server already gives up the patch flow that would justify a runtime dependency. | **B−** | — | Close call: bundle the SDK's server + stdio subset (recommended), or move to a caret range. [§2.13](#213-row-13-mcp-sdk-footprint) |
| 14 | Exposed surface | MCP **read** tools accept any path the process can read; only writes are contained to declared roots. `SECURITY.md` says nothing about the MCP server, the LSP or the editor plugins. Its supported-versions list omits the MCP registry and the Obsidian plugin. | **B** | **C** | Close call on read containment. Expand `SECURITY.md` either way. [§2.14](#214-row-14-mcp-read-scope-and-securitymd-coverage) |
| 15 | Dependencies | **No supply-chain scanning.** CI has no audit or OSV scan, no dependency review on PRs, no workflow linting (`zizmor`/`actionlint`), and no Dependabot cooldown. `skills-lock.json` is described as "pinned by hash", but nothing verifies the hashes and no upstream commit is recorded. | **C+** | B− | `dependency-review-action` on PRs. Weekly `osv-scanner`. `zizmor`. A cooldown. A hash-verify script for skills. [§2.15](#215-row-15-supply-chain-scanning) |
| 16 | Version pinning | The version-agreement check is ~100 lines of inline YAML shell. Its file list duplicates `scripts/prepare-release.ts`'s, so a new package means three edits. One is already behind: `release.yml`'s `dry_run` description says "five packages" (there are six). | **B** | B | Move the check to `scripts/check-versions.ts`, sharing one manifest list with `prepare-release.ts`. [§2.16](#216-row-16-version-agreement-check-as-a-script) |
| 17 | Docs freshness | The README **Status** section has several stale or wrong statements. "All five commands" (there are seven). "The extension is not published to a marketplace yet", which the same section contradicts two paragraphs later. A link into gitignored `docs/superpowers/`, which 404s on GitHub; three checked-in agent commands point at the same tree. "Publishes the engine to npm" (it publishes six packages and an MCP registry entry). An unpaired `npx visimark`, against the runtime-parity rule. | — | **C** | Rewrite the section from `docs/distribution.md`. Remove or vendor the `docs/superpowers` references. [§2.17](#217-row-17-readme-status-section) |
| 18 | Docs freshness | `visimark-mcp`'s npm `description` and its README both say "every command as a tool". `simulate` is not exposed. The root README and `docs/mcp-server.md` correctly say "every command except `simulate`". | — | **C+** | Align the two package-facing texts, which are what npm shows. [§2.18](#218-row-18-mcp-every-command-claim) |
| 19 | Docs freshness | Smaller drift. `editors/obsidian/README.md` links `templates/` and `src/browser-path.ts`, and both moved. `AGENTS.md` lists four commands and omits `visimark-check`. The runtime-parity rule names directories instead of npm packages and calls private `visimark-lsp` "published". `.gitignore` ignores `.vscode/`, yet three files there are tracked. `server.json` commits version 0.1.7. | — | **B−** | Fix each, and add a dependency-free relative-link check to CI. [§2.19](#219-row-19-smaller-documentation-drift) |

### What is already strong, and needs no action

These are the reason the overall grade is a B and not lower; they are the
foundation the fixes above should build on rather than replace.

- **Lockfile discipline.** Every job installs with `--frozen-lockfile`.
  `bun.lock` carries SHA-512 integrity for every package. There is no
  `trustedDependencies` entry, so Bun's default blocks dependency lifecycle
  scripts.
- **Provenance.** Every npm leg publishes with `--provenance`, and the Obsidian
  release attests its build.
- **Policy as code.** `node-support-policy`, version agreement, changelog
  presence, `mcpName` agreement and the Obsidian root mirror are each a red CI
  job, never a checklist line.
- **Generated-artifact freshness.** The playground bundle, docs pages, MCP
  resources, articles and examples are all regenerated and diffed in CI. The
  playground job pins Bun for byte-exactness and says why.
- **Install smoke tests in single-runtime environments.** `smoke-node` asserts
  Bun is absent and `smoke-bun` asserts Node is absent. Peer floors are tested
  exactly (`codemirror-visimark` at its declared minimums; `markdown-it` at
  13.0.2, 14.3.2 and latest).
- **Browser bundles prove their own isolation.** The Obsidian and Joplin bundle
  tests assert that no `node:` specifier survives, and keep CodeMirror
  external.
- **The MCP write gate.** It needs both an operator flag and host-declared
  roots, and no tool argument can reach either.

### Priority order

1. **[§2.1](#21-row-1-micromark-development-build)** and **[§2.2](#22-row-2-declared-versus-loaded-dependencies)**
   together. They are one build-flag change across three `build` scripts, they
   affect every published Node artifact, and [§2.1](#21-row-1-micromark-development-build) is visible to users today.
2. **[§2.3](#23-row-3-release-job-isolation)**. It has the largest blast
   radius of anything here, and trusted publishing removes the most valuable
   secret outright.
3. **[§2.4](#24-row-4-workspace-settable-server-path)**. A two-line manifest
   change closes a code-execution path.
4. **[§2.5](#25-row-5-type-packages-above-runtime-floors)**, **[§2.17](#217-row-17-readme-status-section)** and **[§2.18](#218-row-18-mcp-every-command-claim)**.
   They are cheap, and the docs fixes correct what users read first.
5. The rest in table order. [§2.8](#28-row-8-obsidian-test-preload-leaks-everywhere)
   and [§2.9](#29-row-9-site-and-playground-inside-the-engine) are the
   largest structural changes and can wait for a quiet week.

---

## 2. Details

### 2.1 Row 1: micromark development build

**Problem.** micromark publishes two builds behind package `exports`
conditions: a production build, and a `development` build instrumented with
`debug("micromark")` and `devlop` assertions. A plain `bun build --target node`
without `--production` resolves the `development` condition, so the engine's
`dist/index.js` and `dist/cli/main.js` contain `micromark/dev/lib/*` together
with `debug`, `ms`, `supports-color` and `has-flag`. The two lint plugins
bundle the engine with the same command, so they carry it too. The browser
bundles (`codemirror-visimark`, `markdown-it-visimark`, the playground) do not.
They are built through `Bun.build({ minify: true })`, which takes the
production branch.

**Evidence.**

- `DEBUG=micromark node packages/visimark/bin/visimark.js check docs/example-invoice.md`
  writes 78,977 lines to stderr, where a normal run writes 3. Any user with
  `DEBUG=*` exported, which is common in Node development shells, sees this
  from the CLI, from markdownlint and from remark.
- The registry tarballs `visimark@0.2.0` and `remark-lint-visimark@0.2.0` each
  contain nine `micromark/dev/` module paths.
- Rebuilding `src/cli/main.ts` with `--production` takes the bundle from
  772 KB to 383 KB. `check` on `docs/visimark-design.md` (88 KB) drops from
  ~167 ms to ~120 ms per process. `check --json` output is byte-identical
  between the two builds.

**Recommendation.** Add `--production` to the three Node-target `build`
scripts (`packages/visimark`, `packages/remark-visimark`,
`packages/markdownlint-visimark`). If unminified output is wanted for
readable stack traces, `--conditions` cannot do it alone: the default
condition set still includes `development`. Use `--production` and ship
sourcemaps instead. Then lock the behaviour in, preferably in `pack` or
`acceptance-node`:

```sh
out=$(DEBUG='*' node packages/visimark/bin/visimark.js check docs/example-invoice.md 2>&1 >/dev/null)
[ -z "$out" ] || { echo "::error::the CLI writes to stderr under DEBUG=*"; exit 1; }
! grep -l 'micromark/dev/' packages/*/dist/*.js packages/*/dist/*/*.js
```

Test behaviour, not only paths. The grep catches this one library, while
the `DEBUG` run catches any instrumented dependency that arrives later. Fix
this together with [§2.2](#22-row-2-declared-versus-loaded-dependencies): if
the plugins stop bundling the engine, only the engine's build needs the flag.

### 2.2 Row 2: declared versus loaded dependencies

**Problem.** Each Node-target package declares one dependency set and loads
a different one.

| Package | Declares | Actually loads at run time |
|---|---|---|
| `visimark` | `decimal.js`, `unified`, `remark-parse`, `remark-gfm` | nothing; all four, plus 60 transitive packages, are bundled into `dist/` (zero bare-specifier imports in either entry) |
| `remark-lint-visimark` | `visimark` (exact) | nothing; a full engine copy is bundled into its 774 KB `dist/index.js` (zero `from "visimark"`) |
| `markdownlint-rule-visimark` | `visimark` (exact) | nothing; same, 778 KB |
| `visimark-mcp` | `visimark` (exact), SDK (exact) | both, via `--external` (correct) |

The consequences:

- `npm i visimark` installs 68 packages (7.3 MB) to run a 1.7 MB tarball,
  none of whose dependencies are ever `require`d.
- A project that uses the CLI, the remark plugin and the markdownlint rule
  holds three engine copies. Each plugin carries its bundled copy, plus the
  `node_modules/visimark` it installed and never uses.
- `ci.yml`'s long comment on why the plugins pin `visimark` exactly ("a caret
  range would let the plugin drift onto an engine version never tested
  against it") describes a dependency the code never reaches. The smoke step
  then proves byte-for-byte that `node_modules/visimark` is the packed engine,
  but the plugin under test never loads that directory. If the bundled copy
  and the installed copy diverged, the check would still pass.
- The engine tarball contains two full bundles: `dist/index.js` and
  `dist/cli/main.js`, ~770 KB each, because `bin/visimark.js` imports the
  latter and `index.ts` re-exports `runCli` from it.

**Recommendation.** Make the manifests true, and choose the direction for
each package deliberately:

- **Engine: keep bundling third-party code; stop declaring what is bundled.**
  For an integrity tool this is the better side of the trade. "Pinning the
  Action pins the engine" (the `action.yml` comment) only holds if a
  transitive micromark update cannot change how a released version parses a
  document. Move `unified`, `remark-parse` and `remark-gfm` to
  `devDependencies`. Keep `decimal.js` as a dependency, because seven public
  `.d.ts` files import its `Decimal` type, and note in `index.ts` that this is
  the reason. This also matches the maintainer's stated preference, from the
  #367 review, for the smallest dependency surface: 68 installed packages
  become 2.
- **Plugins: externalize the engine.** Add `--external visimark` to both
  plugins' `build`, as `visimark-mcp` already does. The exact pin and the
  existing smoke check then mean what their comments say. The tarballs shrink
  from ~775 KB to a few KB, and one engine is shared across hosts.
- **One engine bundle.** Point `bin/visimark.js` at `../dist/index.js`
  (`runCli` is exported there) and drop the `src/cli/main.ts` entry from
  `build`, or build with `--splitting`.

*Alternative, if the engine should instead stay patchable without a release:*
use `--packages external` on the engine as well. Node then resolves
micromark's production build by itself, which fixes
[§2.1](#21-row-1-micromark-development-build) as a side effect. The cost is the
determinism argument above. I would not choose it for this project.

### 2.3 Row 3: release job isolation

**Problem.** `release.yml` runs everything in one job: install, build, test,
six npm publishes, the MCP registry, both extension marketplaces, the GitHub
Release and issue closing. Every step in that job therefore shares:

- the workflow-level `contents: write`, `issues: write` and `id-token: write`
  permissions. Any step can mint an OIDC token, and `actions/checkout`'s
  default `persist-credentials: true` leaves the write-scoped `GITHUB_TOKEN`
  in `.git/config`, readable by every later step;
- whatever Bun is `latest` that day, and whatever code `bun install` pulls;
- a binary fetched from
  `github.com/modelcontextprotocol/registry/releases/latest/download/…`, with
  no version pin and no checksum, extracted and executed in the same job;
- tag-pinned third-party actions: `oven-sh/setup-bun@v2`, and
  `softprops/action-gh-release@v3` (also used in `obsidian-release.yml` with
  `contents: write`). A moved tag runs new code with these permissions.

The secrets are scoped per step through `env:`, which helps. They do not
help against a step that reads `.git/config` or requests an OIDC token, and
`NPM_TOKEN` is a long-lived credential that can publish all six packages.

**Recommendation**, in order of value per effort:

1. **npm trusted publishing.** Configure each of the six packages' trusted
   publisher on npmjs.com (repo + `release.yml`), then delete `NPM_TOKEN` and
   every `NODE_AUTH_TOKEN` line. Provenance stays automatic. The most valuable
   secret stops existing.
2. **Pin and verify `mcp-publisher`.** Name a release version and check a
   committed SHA-256 before running it:

   ```sh
   v=1.2.3  # bump deliberately
   curl -sSLo /tmp/mcp.tgz "https://github.com/modelcontextprotocol/registry/releases/download/v$v/mcp-publisher_linux_amd64.tar.gz"
   echo "<sha256>  /tmp/mcp.tgz" | sha256sum -c -
   ```

3. **`persist-credentials: false`** on every `actions/checkout` that is not
   going to push. That is all of them except `dependabot-lockfile.yml`.
4. **SHA-pin third-party actions** (`oven-sh/setup-bun`,
   `softprops/action-gh-release`), with the tag in a trailing comment.
   Dependabot's `github-actions` ecosystem keeps SHAs current.
   First-party `actions/*` can stay on tags if you accept GitHub as the trust
   root.
5. **Split the job.** Move `build` + `test` + `npm pack` / `vsce package` into
   an unprivileged job that uploads artifacts. Give each publish leg its own
   job, with only the permission and secret it needs, behind a protected
   `release` environment. This is the largest change. The existing
   per-leg-outcome and "every leg must have landed" design maps cleanly onto
   `needs:` and job outcomes.

`docs/releasing.md` and the README's "the workflow needs three repository
secrets" sentence change with item 1.

### 2.4 Row 4: workspace-settable server path

**Problem.** `editors/vscode/src/extension.ts:24` reads
`visimark.server.path` through `workspace.getConfiguration`, which merges
user and workspace settings, and passes it to the language client as the
server `module`. The setting has no `scope`. The manifest has no `capabilities`
block, so VS Code applies its default: the extension is off in Restricted
Mode, and once a folder is trusted every workspace setting is honoured. A
repository can ship `.vscode/settings.json` with
`"visimark.server.path": "./tools/x.js"`, and opening any Markdown file then
runs that file under VS Code's Node with the user's privileges. Workspace
trust is a real gate. But the setting's own description says it is
"Development only", and nothing about a document-checking extension tells a
user that trusting a folder lets the folder choose its executable.

**Recommendation.** Two manifest lines:

```json
"visimark.server.path": { "type": "string", "default": "", "scope": "machine", "description": "…" }
```

```json
"capabilities": {
  "untrustedWorkspaces": {
    "supported": "limited",
    "description": "VisiMark checks documents in Restricted Mode; a custom server path is ignored.",
    "restrictedConfigurations": ["visimark.server.path"]
  }
}
```

`machine` scope makes the setting user-only, so no workspace can set it.
`limited` support has a side benefit: diagnostics work in untrusted folders,
which is exactly where a reader wants to know whether a document's numbers
add up. `F5` development keeps working through the user setting or a launch
configuration.

### 2.5 Row 5: type packages above runtime floors

**Problem.** A type package's version *is* an API claim. Compiling against
types newer than the runtime floor lets code call APIs the floor does not
have, and typecheck passes.

| Type package | Declared | Locked | Runtime floor it stands for |
|---|---|---|---|
| `@types/vscode` | `^1.91.0` | **1.138.0** | `engines.vscode ^1.91.0` |
| `obsidian` | `^1.8.7` | **1.13.1** | `manifest.json` `minAppVersion 1.8.7` |
| `@types/node` | `^26.6.4` | **26.6.5** | `engines.node >=24` (CI's LTS) |

The `.github/dependabot.yml` comment on `@types/vscode` says vsce refuses
types newer than `engines.vscode`. But vsce checks the declared *range*, not
the installed version. The caret lets the lockfile resolve far past the floor
(any `bun install` that re-resolves does it), and the ignore rule only stops
Dependabot from editing `package.json`. Node and the VS Code extension host
are partly backstopped at run time (`acceptance-node` runs on the LTS, and
`esbuild` targets `node18`, older than 1.91's Node 20). Obsidian has no
backstop: no job runs the plugin on 1.8.7.

**Recommendation.** Pin each type package exactly at its floor:
`"@types/vscode": "1.91.0"`, `"obsidian": "1.8.7"`, `"@types/node": "24.x"`
(the LTS major the policy names). Add `obsidian` and `@types/node` to the
Dependabot `ignore` list, with a comment saying each moves with its floor and
not on its own. Add a few lines to `node-support-policy` that fail when the
locked `@types/node` major exceeds the `engines.node` floor. That makes the
LTS promotion step bump both together. Correct the Dependabot comment's
reasoning while there. Align the VS Code `esbuild` target with the floor's
Node (`node20` for 1.91) so the bundle and the types claim the same thing.

### 2.6 Row 6: CodeMirror overrides below declared ranges

**Problem.** The root `overrides` keeps a single copy of four CodeMirror
packages in the workspace, for a good reason (two `@codemirror/state` copies
are two editor states). The override versions are a second source of truth
that Dependabot does not read, and they have already diverged. Dependabot
PR #359 bumped five manifests to `@codemirror/view ^6.43.14`. Two days
later, #363 added `"@codemirror/view": "6.43.13"` to `overrides`. Every
workspace now runs a version below its own declared minimum, and
`bun install --frozen-lockfile` accepts it silently. JSON allows no comments,
so `package.json` cannot explain any of this, and the rationale lives only in
two `docs/design/*-plan.md` files.

**Recommendation.** Add a check (a short `scripts/check-overrides.ts`, run in
the `build` job) asserting that each override version satisfies every range
any workspace declares for that package. That turns the next divergence into
a red PR. Then pick one of two ways to keep them in step:

- Exclude the four overridden packages from the Dependabot group and bump
  them by hand, overrides and manifests together (the `@types/vscode`
  pattern). This is simple, and recommended.
- Or let Dependabot bump them, and have `dependabot-lockfile.yml` rewrite
  `overrides` to the new manifest floor before regenerating the lockfile.

Either way, add a sentence on `overrides` to `CONTRIBUTING.md`'s setup
section, since that is where a contributor meets the symptom.

### 2.7 Row 7: Bun version policy

**Problem.** Node has a precise, enforced policy. Bun has three answers that
disagree:

- `packageManager: bun@1.4.2`, used locally and by the `playground-bundle`
  job;
- `bun-version: latest` (1.4.3 today) for `build`, `release.yml`,
  `obsidian-release.yml` and `dogfood.yml`, and `container: oven/bun:latest`
  for `smoke-bun`. **The published npm tarballs and the Obsidian `main.js`
  are built by a Bun that no developer used and that may differ from the one
  that ran CI on the release commit;**
- `engines.bun: ">=1.0.0"` on four published manifests. This is exactly the
  "floor nothing exercises" that `runtime-parity.md` criticises for Node.
  `codemirror-visimark` and `markdown-it-visimark` declare no `engines.bun`
  at all.

**Recommendation.**

- **Release builds use the pin.** In `release.yml` and `obsidian-release.yml`,
  set `bun-version-file: package.json`; setup-bun reads `packageManager`.
  Keep `latest` in `ci.yml`'s `build` job as the canary, as its comment
  intends.
- **`engines.bun` equals a version CI runs.** The simplest honest floor is the
  `packageManager` version: `>=1.4.2`. Extend `node-support-policy` (or a
  sibling job) to assert that every published manifest declares it.
- Pin `smoke-bun`'s container to the same version (`oven/bun:1.4.2`), or keep
  `latest` there on purpose and say so. Today it reads as an oversight.
- Add a "Which Bun" section to `runtime-parity.md` next to "Which Node". The
  rule currently says "This says nothing about Bun".

### 2.8 Row 8: Obsidian test preload leaks everywhere

**Problem.** The root `bunfig.toml` contains
`preload = ["./editors/obsidian/test/harness/preload.ts"]`, added with the
Obsidian plugin (#231). Bun applies a `bunfig.toml` from the directory it
runs in, and CI runs `bun test` once, from the root. Every test in the
monorepo therefore runs with:

- happy-dom registered globally (`document`, `window`, `HTMLElement` …);
- Obsidian's prototype extensions installed on `HTMLElement`;
- `mock.module("obsidian", …)` active.

The engine, the MCP server and the lint plugins are Node libraries. A test
that passes only because `document` exists, or code that branches on
`typeof document`, would go unnoticed. The leak is already visible: the
markdownlint tests print *"KaTeX doesn't work in quirks mode"* under the root
run (markdownlint takes its browser path because a DOM is present) and do not
print it when run from their own directory. The packages pass in isolation
today (engine: 2,208 tests). Nothing keeps that true.

**Recommendation.** Move the preload to `editors/obsidian/bunfig.toml`.
`codemirror-visimark` and `markdown-it-visimark` already have their own.
Change `bun run test` (and the CI step) to run each workspace from its own
directory: `bun run --filter '*' test`, adding `"test": "bun test"` where it is
missing. Any test that then fails was depending on the leaked DOM and should
register its own. The cost is a slightly longer CI step. The gain is that each
package's test environment matches its runtime.

### 2.9 Row 9: site and playground inside the engine

**Problem.** `packages/visimark` is the published engine, and it also hosts
the website's scripts (`src/site/*`), the playground app
(`src/playground/app`), their build (`build:playground`, `build:site`,
`build-playground.ts`), and seven `@codemirror/*` devDependencies. Its
tsconfig maps `codemirror-visimark/*` to that package's source, while
`codemirror-visimark` bundles the engine. Two layers now depend on each
other. `tsconfig.build.json` excludes `src/playground/app` and `src/site`, but
not the rest of `src/playground`, so the published tarball ships
`dist/playground/browser-entry.d.ts`, `memory-reader.d.ts` and `sha256.d.ts`.

**Recommendation.** Create a private `site/` workspace that owns the
playground, the site pages, their build scripts and their CodeMirror
devDependencies, and depends on `visimark` and `codemirror-visimark` like
any other client. The engine's manifest then lists only what the engine
needs, the cycle disappears, and no browser-UI declaration can be published.
This is a mechanical move, but a large one, with path changes in
`ci.yml`, `.pre-commit-config.yaml`, `CONTRIBUTING.md` and
`scripts/cross-host-check.ts`. Schedule it, don't squeeze it in.

### 2.10 Row 10: undocumented public API

**Problem.** `packages/visimark/src/index.ts` is carefully commented about
*why* each block is exported (mostly: `visimark-mcp` and the editors need it,
and re-deriving it would fork a contract). The result is still a 0.x package
with 60 runtime exports and ~40 types. Some are general utilities
(`levenshtein`, `closest`, `lineOf`, `topoOrder`, `refText`), some are
whole front ends (`runCli`), and some are security primitives
(`resolveArtifactPath`, `writeArtifact`, `readMarker`). The README, `docs/`
and the package README do not document a single one. The only API test,
`test/api.test.ts`, checks that 13 names are functions. Nothing notices an
export being added or removed. Smoke tests treat `import("visimark")` as a
supported contract (#170, #190), so outside users can and will depend on any
of the 60. `visimark-mcp` has the same pattern on a smaller scale: it exports
`permits`, `closedGate`, `writeTools` and `createServer`, so its write-gate
mechanics become semver surface.

**Recommendation.** Dependency-free, in line with keeping engine internals
internal and pinning them with drift tests:

1. **Pin the surface.** Add a test that snapshots
   `Object.keys(await import("../src/index.ts")).sort()` and the list of
   exported type names (read from `dist/index.d.ts` after build). Any change
   to the public API then shows up as a reviewable diff.
2. **Say what is supported.** Add a short "Using VisiMark as a library"
   section, in the engine README or `docs/library.md`, covering the handful a
   third party should use (`analyze`, `check`, `fmt`/`planFmt`, `infer`,
   `onDisk`, the finding types and the envelope helpers). State that
   everything else is exported for first-party front ends and may change in
   any minor release.
3. **Mark the rest.** Tag first-party-only exports `/** @internal */`.
   TypeScript's `stripInternal` would remove them from the published `.d.ts`,
   which breaks the first-party consumers that read published types. So use
   the tag as documentation only, or move those exports to a
   `visimark/internal` subpath that the first-party packages import and the
   docs disclaim.
4. For `visimark-mcp`, narrow the root export to `runServer`, `createServer`,
   `engineVersion` and `serverVersion`. The smoke test needs only
   `engineVersion`.

### 2.11 Row 11: published declarations are never typechecked

**Problem.** `remark-lint-visimark/dist/index.d.ts` is:

```ts
import type { Plugin } from "unified";
import type { Root } from "mdast";
declare const remarkLintVisimark: Plugin<[], Root>;
```

The package declares neither `unified` nor `@types/mdast`. Both resolve
today only because `visimark`'s dependencies hoist them, and
[§2.2](#22-row-2-declared-versus-loaded-dependencies)'s fix would remove that
by accident. Under pnpm's strict layout the two imports already fail to
resolve, and the plugin's type falls back to `any`. The markdownlint rule solved the same problem
correctly, with structural types and a comment explaining why. This was not
caught because every in-repo consumer resolves `visimark` through tsconfig
`paths` to engine *source*, and the smoke jobs exercise packed tarballs at
run time only.

**Recommendation.** For the remark plugin, add
`"peerDependencies": { "unified": "^11" }` (a remark plugin always has a
unified host) and `"dependencies": { "@types/mdast": "^4" }`. That is the
convention published `remark-lint-*` rules follow. Then add a type-level smoke
step: in the existing `lib/` scratch project in `smoke-node`, write a
three-line `.ts` that imports each packed package and run `tsc --noEmit`
against it with `moduleResolution: node16`. That is dependency-light,
because `typescript` is already in the lockfile. An alternative is
`@arethetypeswrong/cli` over the tarballs. It is more thorough, and it is a
new dependency.

### 2.12 Row 12: PATH binary bypasses the pin

**Problem.** Both consumer entry points prefer an already-installed
`visimark`:

- `action.yml`: `if command -v visimark …; then visimark …; else npx --yes "visimark@$VISIMARK_VERSION" …`
- `scripts/precommit-visimark-check.sh`: `if command -v visimark …; then exec visimark check …`

The comments explain why: it lets this repo dogfood its working tree. For
everyone else it bypasses the pin. The input description says "pinning the
Action pins the engine too". A runner image or developer machine with
`visimark@0.1.6` installed globally runs 0.1.6 against a `rev: v0.2.0` hook,
and nothing in the output says which engine ran.

**Recommendation.** Use the `PATH` binary only when it is the pinned version,
or when the caller asks for it explicitly:

```sh
if command -v visimark >/dev/null 2>&1 &&
   { [ "$VISIMARK_VERSION" = "path" ] || visimark --version | grep -qx "visimark $VISIMARK_VERSION"; }; then
```

This repo's own `dogfood.yml` passes `version: path`. The pre-commit script
uses the same version comparison. In both cases, print the engine version
before the findings, so a log always shows what ran.

### 2.13 Row 13: MCP SDK footprint

**Problem.** `@modelcontextprotocol/sdk@1.32.1` declares `express`,
`express-rate-limit`, `cors`, `hono`, `@hono/node-server`, `jose`,
`pkce-challenge`, `eventsource`, `cross-spawn`, `ajv` and `zod` as runtime
dependencies. These serve its HTTP transports and OAuth client, which this
stdio-only server never imports. `npm i -g visimark-mcp` installs 158
packages, 34 MB. Every one is in the advisory surface a user's scanner will
report against `visimark-mcp`. Because the SDK is pinned exactly (there is no
recorded rationale), a security fix in any of them already needs a
`visimark-mcp` release to reach users. The exact pin pays the cost of
bundling without its benefit.

**Recommendation (close call).**

- **Bundle the SDK** (recommended). Drop `--external @modelcontextprotocol/sdk`
  from `build` and move the SDK to `devDependencies`. Bun tree-shakes the bundle
  to `server/index.js` + `server/stdio.js` and their real imports (`zod`, the
  JSON-RPC types). The install drops to the engine alone, which is 2 packages
  once [§2.2](#22-row-2-declared-versus-loaded-dependencies) lands. The existing
  `handshake.mjs` smoke under both runtimes is exactly the test that would
  catch a bundling break. This applies the engine's own rule (bundle
  third-party code, depend on first-party code).
- **Caret range** (`^1.32.1`). This keeps the SDK external and lets users
  take patches without a release. Choose it if you would rather inherit
  upstream fixes than control the footprint. The 158 packages remain.

Either way, record the choice in `docs/design/mcp-server-spec.md`'s
dependency section, which today explains only the `visimark` pin.

### 2.14 Row 14: MCP read scope and SECURITY.md coverage

**Problem.** The MCP write gate is well designed. Reads are a different
story: `resolveInput` reads whatever `path` a tool call names. A
prompt-injected agent can ask the server to `check`, `explain` or `eval` any
file the process can read, and findings and `explain` views echo document
text back. Most MCP hosts already give the agent file read, so this rarely
adds capability. It does contradict the README's "read-only unless an
operator deliberately opens the write gate" framing, which implies the server
has a boundary.

Separately, `SECURITY.md` describes the CLI's threat model in detail and
nothing else. It does not mention the MCP server (agent-supplied paths, the
write gate, roots), the LSP (it runs in the editor process for every open
file), the editor plugins, or the VS Code setting in
[§2.4](#24-row-4-workspace-settable-server-path). "Supported versions"
lists npm, the VS Code Marketplace and Open VSX, and omits the MCP registry
and the Obsidian plugin's separate release line.

**Recommendation.**

- *Read containment (close call).* When the host has declared roots, refuse
  reads outside them, with the same `realish` + `contains` the write gate
  uses. When it has declared none, keep today's behaviour (an agent drafting
  in `content` mode is unaffected either way). This narrows the surface
  without breaking hosts that don't send roots. If you decide against it,
  say so in `docs/mcp.md` and `SECURITY.md`: "reads are not contained; the
  server reads what its process can".
- *`SECURITY.md`*: add an "MCP server" subsection (what the gate guarantees,
  what it doesn't, and that reads are or aren't contained), a sentence each
  for the LSP and the editor plugins, and the two missing release lines.

### 2.15 Row 15: supply-chain scanning

**Problem.** The repo enforces its own policies strictly but does not scan
what it pulls in:

- no `npm audit`, `bun audit` or OSV scan of `bun.lock`;
- no `actions/dependency-review-action`, so a PR (Dependabot's included) can
  add a package with a known advisory or an unexpected licence;
- no static analysis of the workflows themselves (`zizmor` would have flagged
  most of [§2.3](#23-row-3-release-job-isolation));
- no Dependabot `cooldown`, so a freshly published malicious version is
  proposed within the week, and `bun-version: latest` picks up a new Bun the
  hour it ships;
- `skills-lock.json` and the dogfood comments say the vendored skills are
  "pinned by hash". `computedHash` is recorded, but nothing verifies it, and
  no upstream commit is stored, so the pin cannot be reproduced either. Two of
  those skills (`iterate-pr`, `humanizer`) ship Python scripts that agents
  execute.

**Recommendation.**

- `dependency-review-action` on `pull_request` (first-party, no install, and
  it fails on new advisories at or above a severity you choose).
- A weekly scheduled `osv-scanner --lockfile=bun.lock` job, or `bun audit` if
  the pinned Bun supports it. Report only, don't block master.
- `zizmor` (or `actionlint` + `zizmor`) as a step in `build`.
- `cooldown: { default-days: 7 }` on both Dependabot ecosystems. If the `bun`
  ecosystem ignores it, Bun's `install.minimumReleaseAge` in `bunfig.toml`
  does the same at install time.
- `scripts/check-skills.ts`: recompute each skill's hash the way the
  `skills` CLI does and compare it with `skills-lock.json`. If the CLI can
  record a commit, record that too.

### 2.16 Row 16: version-agreement check as a script

**Problem.** The "every version-carrying file must agree" step is about 100
lines of shell embedded in `ci.yml`, with an `awk` parser for `bun.lock`.
Its manifest list duplicates `scripts/prepare-release.ts` (lines 160–169)
and the prose list in `docs/releasing.md`. Adding `codemirror-visimark` and
`markdown-it-visimark` meant editing all three, and the step's own header
comment now spends ~40 lines narrating the history of each file. The text has
already drifted in one place: `release.yml`'s `dry_run` input says
"`npm publish --dry-run` for the five packages". There are six, and the step
below it rehearses all six. The neighbouring checks (`check-changelog-entries`,
`check-mcp-name`, `check-obsidian-root-mirror`) were already moved to
`scripts/` so they could be tested against a temp tree.

**Recommendation.** Move the step to `scripts/check-versions.ts`, importing
its manifest table from a small module that `prepare-release.ts` also
imports, so there is one list. Test it the way the other checks are tested.
Cut the YAML comment down to one line that points at the script. Fix the
"five packages" text in the same PR.

### 2.17 Row 17: README Status section

**Problem.** The [README's Status section](../../README.md#status) (lines 447–512) was written when the CLI
first shipped and has been appended to since. It now contradicts itself and
the repository:

- "All five commands are implemented". The CLI has seven (`check`, `fmt`,
  `infer`, `eval`, `explain`, `simulate`, `ref`).
- "The extension is not published to a marketplace yet". Forty lines later,
  the same section says a tag publishes it to the VS Code Marketplace and Open
  VSX, and `docs/distribution.md` marks both **Live**.
- "pushing a `vX.Y.Z` tag publishes the engine to npm and the extension to …".
  It also publishes five more npm packages and the MCP registry entry.
- It links `docs/superpowers/plans/2026-09-03-visimark-cli.md`. `docs/superpowers/`
  is in `.gitignore`, so the link 404s on GitHub and in every clone. Three
  checked-in agent commands (`issue-decide`, `issue-review`, `issue-discuss`)
  tell agents to read
  `docs/superpowers/specs/2026-09-06-vocabulary-review-workflow-design.md`,
  which is equally absent outside the maintainer's machine.
- "run it without installing with `npx visimark`" has no `bunx` twin. That
  breaks `.agents/rules/runtime-parity.md`, which exempts only the CI
  one-liner.

**Recommendation.** Rewrite "Status" as a short, current table: one row per
artifact (CLI, library, MCP server, LSP + VS Code, Obsidian, Joplin,
CodeMirror, markdown-it, remark, markdownlint), each with where it is published
and a link to its README. Generate the facts from `docs/distribution.md`, or
link to it rather than restating it. For `docs/superpowers`, either commit the
two referenced design documents under `docs/design/`, where every other spec
lives, or remove the references. A gitignored path should never appear in a
checked-in instruction.

### 2.18 Row 18: MCP every-command claim

**Problem.** `packages/visimark-mcp/package.json`'s `description` ("every
command as a tool") and `packages/visimark-mcp/README.md` ("every `visimark`
command as a tool") are the two texts npm and the MCP directories show. Both
are wrong since `simulate` was added: the tool list is `check`, `fmt`,
`fmt_apply`, `infer`, `infer_apply`, `eval`, `explain`, `ref`. The root
README and `docs/mcp-server.md` already say "every command except
`simulate`".

**Recommendation.** Use the root README's wording in both places. If
excluding `simulate` is deliberate (it can run long, and an MCP call should
be bounded), add one sentence on why to `docs/mcp.md`. An agent reading the
`cli-reference` resource will find the command and wonder.

### 2.19 Row 19: smaller documentation drift

Each item is a one-line fix. Together they show that link and claim drift is
not caught mechanically.

- `editors/obsidian/README.md:49` links `templates/`, but the templates moved
  to `editors/shared/templates/`. Line 118 links
  `src/browser-path.ts`, now at `packages/codemirror-visimark/src/browser-path.ts`.
- `AGENTS.md` lists the slash commands as `issue-prepare`, `issue-review`,
  `issue-decide` and `issue-discuss`, and omits `.agents/commands/visimark-check.md`.
- `.agents/rules/runtime-parity.md` lists "`remark-visimark`,
  `markdownlint-visimark`, … `visimark-lsp`" as published packages with no
  `bin`. The first two are directory names (the npm names are
  `remark-lint-visimark` and `markdownlint-rule-visimark`). `visimark-lsp` is
  `"private": true` and ships only inside the `.vsix`.
- `.gitignore` ignores `.vscode/`, yet `.vscode/launch.json`, `settings.json`
  and `tasks.json` are tracked. Either un-ignore them (`!.vscode/*.json`) or
  untrack them. Today a new file there is silently left out.
- `server.json` commits `"version": "0.1.7"`. `release.yml` rewrites it at
  publish time and says so, but a reader of the repository sees a version
  three releases old. Either add it to the version-agreement check
  ([§2.16](#216-row-16-version-agreement-check-as-a-script) makes that one
  line), or replace the committed value with `"0.0.0-set-at-release"` so it
  cannot be mistaken for real.

**Recommendation.** Fix the five items, then add a dependency-free check to
`build`: walk the tracked `*.md` files outside `docs/WIP/`, resolve every
relative `](…)` link and every backticked repo path, and fail on a missing
target. This review used a 30-line script for that; it found the two Obsidian
README links and the `docs/superpowers` references in a few seconds.

<!--vmark:no-formulas-->
