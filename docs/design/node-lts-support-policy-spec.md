# Node LTS support policy — feature spec

**Status:** approved (#184) · **Date:** 2026-09-23 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/184#issuecomment-5790907466

## Purpose

Three different Node versions were in play in this repository and none of
them was the one being tested:

- **Declared floor `>=18`** in both published `engines.node` fields — Node 18
  reached end-of-life in April 2025, seventeen months before this spec, and no
  CI job has ever run it. `engines.node: ">=18"` was an unverified promise
  about a dead runtime.
- **Tested `20`**, hardcoded in `.github/workflows/ci.yml` and `release.yml` —
  Node 20 reached end-of-life in April 2026. The pin was written on
  2026-09-07, four months *after* that date, and nothing noticed, because a
  numeric pin is a fact about the day it was typed, not a standing claim.
- **What a consumer actually runs** — the current LTS or the latest stable
  release — was never exercised by anything.

`acceptance-node` and `smoke-node` exist specifically to prove
`.agents/rules/runtime-parity.md` (the Bun/Node parity rule, `#171`/`#175`,
already `APPROVED`) holds. They were proving it on a runtime nobody should be
running, while the floor the published packages promise was proven by
nothing.

The fix is not "bump `20` to `24`" — that fixes today and rots identically by
the next LTS transition. The fix is to name Node with aliases that cannot go
stale (`lts/*`, `latest`) and add a CI job that asserts the whole policy holds,
so a future numeric pin or a stale floor fails the build instead of drifting
silently for another seventeen months.

Motivating evidence (verified against `master` during pre-review, not just
asserted by the issue):

```console
$ grep -rn "node-version" .github/workflows/
.github/workflows/release.yml:43:          node-version: 20
.github/workflows/ci.yml:168:          node-version: 20
.github/workflows/ci.yml:233:          node-version: 20

$ grep -n '"node"' packages/*/package.json
packages/visimark/package.json:64:    "node": ">=18"

$ git log -1 --format='%ai %s' -S "node-version: 20" -- .github/workflows/ci.yml
2026-09-07 17:47:42 +0200 Spec #29: Runtime-portable CLI launcher (#34)
```

Pre-review also found `action.yml` (the published composite Action) carrying
the same class of stale pin, invisible to the guard's original scope. That gap
is folded into this spec's surface (§2) rather than deferred, since it is the
one artifact a downstream consumer's CI actually invokes — an unguarded pin
there reproduces the exact failure mode this spec exists to close.

**Where this lands.** `#183` merged on 2026-09-23 (`da4df84`), carrying
`f2eec25` and `d6767dc` into `master` — confirmed directly: `ci.yml` and
`release.yml` now use `lts/*`/`latest`, `engines.node` is `>=24` in both
`visimark` and `visimark-mcp`, `.nvmrc` holds `lts/*`, and
`.agents/rules/runtime-parity.md` carries the "Which Node" section. Cherry-
picking those commits separately, as originally considered, was never
possible anyway: they sit on top of the 17 commits that created
`packages/visimark-mcp`, which did not exist on `master` before `#183`.

That merge did **not** carry the two additions this decision folds into
scope, because neither was in `f2eec25`/`d6767dc`: `action.yml`'s
`node-version: 20` is still unfixed and still outside the guard's grep (both
reconfirmed against `master` post-merge), and the `CONTRIBUTING.md` fence
defect (§7) shipped as-is. This spec's implementation PR closes exactly those
two gaps, against current `master` — a small, self-contained follow-up, not a
cherry-pick. `master` currently has **no branch protection configured**
(confirmed via the GitHub API — `Branch not protected`), so the
required-checks-repointing concern raised in the original issue and pre-review
does not apply; there is nothing to repoint.

## The surface

No CLI command, option, or flag is affected. The surface is entirely CI
configuration, published manifests, and one repo-root file. The first five
rows are already live on `master` via `#183`; only the `action.yml` row is
this decision's own implementation work.

| File | Change | Status |
|---|---|---|
| `.github/workflows/ci.yml` | `acceptance-node` and `smoke-node` are a `strategy.matrix.node: ["lts/*", "latest"]` job, `fail-fast: false`, both legs blocking. A `node-support-policy` job runs the assertions in §3. | Live on `master` |
| `.github/workflows/release.yml` | `node-version: "lts/*"`. Node is a tool here (npm publishes), not the thing under test, but it still must not name an EOL runtime. | Live on `master` |
| `packages/visimark/package.json`, `packages/visimark-mcp/package.json` | `engines.node: ">=24"`. | Live on `master` |
| `.nvmrc` | Contains exactly `lts/*`. | Live on `master` |
| `.agents/rules/runtime-parity.md` | Carries the "Which Node" section: current LTS is the floor, CI blocks on current LTS **and** latest stable, workflows name Node only with `lts/*`/`latest`, `.nvmrc` tracks `lts/*`, floor moves on a deliberate commit — never by drifting. | Live on `master` |
| `action.yml` | `node-version: 20` (line 36) → `node-version: "lts/*"`. This is the published composite Action's own setup step, distinct from its `version:` input (which selects the `visimark` npm version to install) — the two are unrelated and this change touches only the Node runtime the Action's own steps execute under. `node-support-policy`'s third assertion (§3) must also start scanning `action.yml`, not only `.github/workflows/`, or a future regression here goes uncaught again. | **This PR** |

## The machine contract

No exit code, stdout/stderr split, or `--json` shape changes for any
`visimark` command — this spec touches no command. The "machine contract"
here is what `node-support-policy` itself asserts and reports:

| Assertion | On success | On failure |
|---|---|---|
| Every published `engines.node` floor equals the major `lts/*` resolves to | Step logs `current LTS major: <N>` and exits 0 | `::error file=<manifest>::engines.node says >=<X> but the current Node LTS is <N>. Bump every engines.node to >=<N>, say so in CHANGELOG.md, and update the prose in CONTRIBUTING.md and docs/ci.md. Do not pin this job to an older LTS to make it pass.` — job exits 1 |
| `.nvmrc` contains exactly `lts/*` | Step logs `.nvmrc is lts/*` | `::error file=.nvmrc::.nvmrc says "<value>"; it must be "lts/*" so it tracks the LTS instead of naming a version that will go EOL.` — job exits 1 |
| No workflow **or `action.yml`** pins Node with a numeric `node-version:`/`node-version-file:`, other than `node-version-file: .nvmrc` | Step logs `every node-version is lts/* or latest` | One `::error::<offending line> — name Node with lts/*, latest, or node-version-file: .nvmrc. Never a number. See .agents/rules/runtime-parity.md.` per offending line — job exits 1 |

`node-support-policy` already runs on every PR and on `master`. Its third
assertion currently greps only `.github/workflows/`; this PR widens that grep
to also cover `action.yml`, which is the actual gap being closed — `action.yml`
was never covered and its stale pin was never caught.

## Behaviour table

| Case | Before this spec | After this spec |
|---|---|---|
| CI runs Node-facing jobs on... | a single hardcoded `20` | current `lts/*` **and** `latest`, matrix, both blocking |
| `engines.node` claims | `>=18`, unverified for 17 months | `>=<current LTS major>`, asserted every CI run against the live LTS |
| A future contributor reintroduces `node-version: 20` | Passes review silently; nothing catches it | `node-support-policy` fails the PR with the offending line quoted |
| A future contributor pins `.nvmrc` to a number | Never checked (file didn't exist before this spec) | `node-support-policy` fails, quoting the bad value |
| A workflow routes around the `node-version:` check via `node-version-file: some-other-file` | Not applicable (no such check existed) | Caught: only `node-version-file: .nvmrc` is accepted; any other file name fails the same job |
| Node promotes a new LTS major (e.g. `24` → `26`) | Nothing changes; the stale floor persists silently | `node-support-policy` goes red on the next CI run **by design** — the floor must move on a deliberate commit with a CHANGELOG entry, not by drifting. The rule and the error message both say explicitly not to pin the job to an older LTS to make it pass. |
| A consumer runs `visimark` on Node 20 after this ships | Works (declared floor was `>=18`) | Works — npm warns rather than hard-fails on an `engines` mismatch by default — but is told they are on an unsupported runtime |
| A downstream repo pins this repo's `action.yml` at a released tag | Action's own setup step runs Node 20 (EOL) regardless of the consumer's runtime | Action's own setup step runs `lts/*`, matching the policy everywhere else |

## Compatibility

- **`ci.yml`** (already live) — `acceptance-node` and `smoke-node` job names
  carry matrix suffixes (`(lts/*)`/`(latest)`). `master` has no branch
  protection configured (confirmed via the GitHub API), so nothing needed
  repointing; if branch protection is added later, it must name the suffixed
  jobs. No other job's behavior changed; `pack`, `smoke-bun`, and the Bun-only
  jobs are untouched.
- **`release.yml`** (already live) — publishing behavior is unchanged; only
  the Node runtime used to run `npm publish` moved from a numbered pin to
  `lts/*`.
- **`action.yml`** (this PR) — a downstream consumer pinning this repo's
  Action at a released tag sees no change in the Action's inputs (`files`,
  `command`, `args`, `version` are untouched) or its behavior — only the Node
  version its own setup step runs under moves off an EOL number. Nothing a
  consumer's workflow file has to change.
- **`docs/cli-reference.md`** — no change. No command, option, or exit code
  moves.
- **`.github/workflows/dogfood.yml`** — read and confirmed to name no Node
  version at all (it runs entirely through `bun run`); unaffected.

## Interaction with the rest of the tooling

- **Bun/Node parity rule** (`.agents/rules/runtime-parity.md`, `#171`) — this
  spec extends that rule with a "Which Node" section; it does not change any
  of the launcher/shim guidance already there. Bun is entirely unaffected: no
  `bun-version` pin changes, and the `packageManager` field in `package.json`
  is untouched.
- **Release workflow** (`docs/releasing.md`) — unaffected beyond the Node
  runtime `release.yml` runs under; no registry, publish step, or gate
  changes.
- **MCP server** (`packages/visimark-mcp`, `#169`) — its `engines.node` moves
  in lockstep with `visimark`'s, since both are asserted by the same
  `node-support-policy` job. It is unreleased, so this is not yet a
  consumer-visible break for it.
- **What does not change** — no `--json` shape, no exit code, no stdout/stderr
  content for any `visimark` command; no editor-extension (`editors/vscode/`)
  behavior; no LSP behavior; no change to what `fmt`, `check`, `infer`,
  `explain`, or `eval` accept or produce.

## Documentation to update

Already done, via `#183`, and reconfirmed against `master`: the "Which Node"
section in `.agents/rules/runtime-parity.md`, `docs/ci.md`'s wording, and the
`CHANGELOG.md` `### Changed` entry.

**Not done, and this PR's final task:**

- **`CONTRIBUTING.md`** — fix the fence defect `#183` shipped. Its edit closes
  a ```` ```console ```` block and runs prose onto the same line as the
  closing fence (`` ``` **VisiMark supports the current Node LTS and``),
  which — per CommonMark, a closing fence line may contain only the fence
  marker and optional whitespace — means the fence never actually closes and
  swallows the following paragraph into the code block. Insert a line break
  between the closing ` ``` ` and the following prose; no wording changes
  otherwise.
- **`action.yml`** and **`.github/workflows/ci.yml`** — the pin bump and the
  widened grep are themselves the implementation (§2), not documentation, but
  `action.yml`'s comment above the `setup-node` step (if any) and the
  `node-support-policy` step's own comments must describe the widened scope,
  not just the old one.
- **`docs/vocabulary-catalogue.md`** — this row moves from section F into the
  Shipped register as `UNRELEASED`, `Landed` pointing at **this PR** (the one
  that closes the spec), with a note that the bulk of the implementation
  shipped earlier via `#183`.

No other file enumerates a Node version: `docs/cli-reference.md` was checked
during pre-review and does not mention one.

## Non-goals

- Does not change what version of `visimark` the composite Action installs by
  default (`action.yml`'s `version:` input) — that is a separate, orthogonal
  pin (the npm package version) from the Node runtime the Action's own setup
  step runs under, which is this spec's only change to that file.
- Does not add a mechanism to detect Node staleness via a network call to
  Node's release schedule — considered and rejected in the issue (adds a
  network dependency to CI, and produces the wrong error message: "your pin is
  stale" instead of "your code broke on Node 26").
- Does not widen the supported floor below the current LTS for broader
  consumer compatibility — considered and rejected: a floor at the previous
  LTS would again be tested by nothing unless the matrix grew a third entry,
  reproducing the original defect in a new place.
- Does not touch `packages/visimark-lsp`, `packages/remark-visimark`,
  `packages/markdownlint-visimark`, or `editors/vscode/` — confirmed by grep
  that none of them declares its own `engines.node`. Only `packages/visimark`
  and `packages/visimark-mcp` (both live via `#183`) carry that field.

## Open questions

(none)
