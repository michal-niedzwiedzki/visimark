# A pre-commit hook for the pre-commit framework — feature spec

**Status:** approved (#149) · **Date:** 2026-09-22 · **Decision:** [#149 (comment)](https://github.com/michal-niedzwiedzki/visimark/issues/149#issuecomment-5780522480)

## 1. Purpose

A repository that already uses the [pre-commit](https://pre-commit.com)
framework — the Python/data/docs-team default for local commit checks — has no
way to add `visimark check` today except by hand-copying the `repo: local`
recipe `docs/ci.md` chapter 23 teaches:

```yaml
repos:
  - repo: local
    hooks:
      - id: visimark
        name: visimark check
        language: system
        entry: npx --yes visimark@0.1.7 check
        files: \.md$
```

Every consumer edits this into their own `.pre-commit-config.yaml`, hand-pins
the version inside `entry:`, and gets no `pre-commit autoupdate` support,
because `repo: local` carries no `rev:` for that command to move. It also
breaks outright on a machine that has Bun but no Node — `npx` ships inside
`npm`, and there is none to run.

This spec adds `.pre-commit-hooks.yaml` at this repository's root, so a
consumer's config becomes four lines with no local recipe to maintain:

```yaml
repos:
  - repo: https://github.com/michal-niedzwiedzki/visimark
    rev: v0.1.7
    hooks:
      - id: visimark
```

This is the cheapest distribution surface in the roadmap's section 2 — no
plugin architecture is involved ([§2](../visimark-design.md#2-constraints-that-shaped-the-design)
constraint 4 is untouched, because a document's meaning does not change; only
how `check` is invoked does), and it reaches a population — pre-commit users —
who will never read the landing page.

## 2. The surface

### 2.1 The file

`.pre-commit-hooks.yaml`, new, at the repository root:

```yaml
- id: visimark
  name: visimark check
  description: Recompute every formula in a Markdown document and fail if a number no longer agrees with it.
  language: system
  entry: >-
    sh -c 'if command -v visimark >/dev/null 2>&1; then
      exec visimark check "$@";
    elif command -v bunx >/dev/null 2>&1; then
      exec bunx visimark@0.1.7 check "$@";
    elif command -v npx >/dev/null 2>&1; then
      exec npx --yes visimark@0.1.7 check "$@";
    else
      echo "visimark: needs npx (Node) or bunx (Bun) on PATH" >&2; exit 127;
    fi' --
  files: \.md$
```

The three-way dispatch mirrors `action.yml`'s own preference order exactly —
that file already tries `command -v visimark` before falling back to a
fetcher, so a caller with the branch's build on `PATH` (this repo's own
workspace link, via `bun install`) dogfoods that build instead of fetching the
published package. `bunx` is added ahead of `npx` for a Bun-only machine, for
which `npx` does not exist rather than merely being non-preferred (see the
issue discussion on #149). Whichever branch runs, it lands on the same
`packages/visimark/bin/visimark` `sh` launcher
([`runtime-portable-launcher-spec.md`](runtime-portable-launcher-spec.md),
#29), which resolves Node-or-Bun itself once the package is fetched — so the
three branches differ only in *how* the package is obtained, never in what
runs once it is.

`0.1.7` inside `entry:` is hardcoded, matching the current release, and is
bumped at every release alongside the other four version-carrying files (§5).

### 2.2 The hook id and defaults

- **`id: visimark`** — the name a consumer's `hooks:` list references; becomes
  public API the moment anyone pins a `rev:` against it.
- **`files: \.md$`** — matches the hand-written recipe `docs/ci.md` ch23
  already teaches. No `exclude:`; a repository that wants a narrower scope
  sets its own `files:`/`exclude:` in its `.pre-commit-config.yaml`, which
  overrides this default.
- **No `args:`** — the hook always runs bare `check`. `fmt`, `--fix-dates`, and
  `--json` are not exposed through this hook; see §8.
- **`language: system`** — pre-commit does not attempt to install anything;
  the dispatch script in `entry:` is self-contained. `language: node` was
  considered and rejected: pre-commit's node support runs `npm install .` in
  the *cloned repo root*, and this repository's root `package.json` is
  `"private": true` with `workspaces: ["packages/*", "editors/*"]` and no
  `bin` field — the installable package with a `bin` entry is
  `packages/visimark/package.json`, two directories down. Making
  `language: node` work would mean restructuring the root manifest, an
  unrelated change with its own blast radius. `language: system` needs no such
  restructure and is already this project's established idiom.

### 2.3 Consumer-side usage (unchanged, documented for completeness)

```yaml
repos:
  - repo: https://github.com/michal-niedzwiedzki/visimark
    rev: v0.1.7
    hooks:
      - id: visimark
```

`pre-commit autoupdate` moves `rev:` to the latest tag; the version baked into
this repository's own `.pre-commit-hooks.yaml` at that tag is what actually
runs.

## 3. The machine contract

| Outcome | Exit code | stdout | stderr | `--json` |
|---|---|---|---|---|
| Every staged `.md` file's formulas still agree with its numbers | `0` | The human report (`N problems (0 stale, 0 errors)`) | empty | not invoked by this hook |
| At least one number, date, or reference is wrong | `1` | The human report, one block per problem | empty | not invoked by this hook |
| `visimark` cannot be fetched (`npx` and `bunx` both absent) | `127` | empty | `visimark: needs npx (Node) or bunx (Bun) on PATH` | n/a |
| A named file does not exist (e.g. `check` handed a stale path) | `2` | — | `visimark`'s own usage-error line | n/a |

`127` is not a `visimark` exit code — it is the dispatch script's own `exit 127`
when neither fetcher is found, chosen to match the POSIX shell convention for
"command not found" rather than overloading `2` (`visimark`'s own usage-error
code) for a failure that happens before `visimark` is ever reached. `0`, `1`
and `2` are `check`'s existing, unmodified codes.

This is `check`'s existing contract, verified against the working tree, unchanged:

```console
$ bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md
docs/example-invoice.md

  0 problems (0 stale, 0 errors)
$ echo $?
0

$ bun run packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md
docs/example-invoice-drift.md
  STALE   lines.Net       · On-call support         3120.00 ≠ 5200.00    Qty * Rate
  ...
  26 problems (21 stale, 5 errors)
$ echo $?
1
```

Both streams stay exactly as `check` already produces them — this hook
introduces no new code at the exit-code/stream layer, only a new way to invoke
the same one. `--json` is not part of this hook's default `entry:`; pre-commit
consumes the human-readable exit-code contract, not JSON, and nothing here
prevents a consumer from writing their own hook entry that adds `--json` if
they want it.

## 4. Behaviour table

| Case | Invocation (as pre-commit runs it) | Result |
|---|---|---|
| Clean commit, all staged `.md` pass | `entry… check docs/a.md docs/b.md` | Hook passes, exit `0`, commit proceeds |
| One staged file has drifted arithmetic | `entry… check docs/a.md` | Hook fails, exit `1`, human report on stdout, commit blocked |
| A staged file is deleted | (pre-commit does not pass a deleted path to a `language: system` hook — it resolves paths from the diff of files still present) | Not exercised; deletions never reach `entry:` |
| No `.md` files staged | hook not invoked at all (pre-commit's `files:` filter finds nothing) | No-op, exit `0` implicitly (pre-commit itself reports "no matching files") |
| Bun-only machine (no Node/npm, `bunx` present) | `bunx visimark@0.1.7 check …` | Same as the clean/dirty cases above — identical output, because both fetchers land on the same `sh` launcher |
| Node-only machine (no Bun) | `npx --yes visimark@0.1.7 check …` | Same as above |
| Neither Node nor Bun on PATH | dispatch's `else` branch | Exit `127`, `visimark: needs npx (Node) or bunx (Bun) on PATH` on stderr |
| This repository's own commits (dogfooded, §6) | `visimark check …` (PATH branch, workspace-linked build) | Exercises the branch under test, not the last published release — same reasoning as `dogfood.yml`'s `GITHUB_PATH` wiring for the composite Action |

The "staged file deleted" row is the acceptance test for the one behavioural
claim in this spec not already covered by an existing, verified command: it is
confirmed by literally running `pre-commit run` in a scratch repository during
implementation, not assumed from memory of pre-commit's internals.

## 5. Compatibility

- **No existing CI job, script, or the composite Action changes behaviour.**
  This is a new, additive entry point. `action.yml`, `.github/workflows/ci.yml`,
  `.github/workflows/dogfood.yml`, and `.github/workflows/release.yml` are
  unmodified except where §7 below says otherwise.
- **`ci.yml`'s "every version-carrying file must agree" step** currently checks
  four files (`packages/visimark/package.json`, `packages/visimark-lsp/package.json`,
  `editors/vscode/package.json`, `action.yml`'s `version` default) against each
  other. `.pre-commit-hooks.yaml`'s hardcoded `entry:` version becomes a
  **fifth** file that step must extract and compare, for the same reason
  `action.yml` joined the first four: leaving it behind means a consumer who
  pinned `rev: v0.1.7` keeps quietly running an older engine than the tag
  implies, with nothing at run time to say so.
- **`docs/releasing.md`'s "Bump the version" step** gains `.pre-commit-hooks.yaml`
  as the fifth version-carrying file in its list.
- Nothing about an installed extension, a running release, or a cached
  artifact is affected. This change is fully reversible — deleting
  `.pre-commit-hooks.yaml` (or a bad version bump) is undone by a normal commit,
  with no re-publish, re-pin, or migration needed on the consumer side beyond
  moving their own `rev:`.

## 6. Interaction with the rest of the tooling

- **Dogfooding.** This repository adds its own `.pre-commit-config.yaml` at
  the root, `repo: local`, referencing the new hook definition, running
  against this repo's own tracked Markdown. This proves the hook works the
  way `dogfood.yml`'s `self-check` job proves the composite Action works, and
  exercises the PATH-first branch of the dispatch script (§2.1) against the
  branch under test, the same way `dogfood.yml` wires `GITHUB_PATH` so the
  Action's own `command -v visimark` resolves to `node_modules/.bin/visimark`
  rather than the published package.
- **The CI gate is unaffected and still authoritative.** A hook is the
  shorter local feedback loop; `docs/ci.md` chapter 23 already states "the
  hook saves a round trip, the gate is what actually enforces" — this remains
  true. A hook only sees staged files, never repository-wide coverage.
- **`--json`, `fmt`, `infer`, `explain`, `eval`, `ref`** are all untouched;
  this hook only ever invokes `check`.
- **The release workflow** (`release.yml`) is unaffected beyond the version-carrying
  file addition in §5 — no new publish leg, no new registry.

Nothing about what a VisiMark *document* means changes. No new finding, no new
syntax, no widened taxonomy entry.

## 7. Documentation to update

- **`docs/ci.md` chapter 23** ("Git hooks and pre-commit") — becomes the
  primary path: the published-hook `repo:`/`rev:` form leads, with the
  hand-written `repo: local` recipe kept immediately after as the
  no-framework fallback (a plain `.git/hooks/pre-commit` still needs it).
- **`docs/cli-reference.md`** — the intro paragraph ("Install it with `bun add
  -g visimark` or `npm i -g visimark`, or run it without installing with `npx
  visimark`") gains `bunx visimark` alongside `npx visimark` as the ephemeral,
  no-install form, matching what this hook's dispatch actually does on a
  Bun-only machine.
- **`docs/releasing.md`** — "Bump the version" step's file list gains
  `.pre-commit-hooks.yaml` as the fifth entry (§5).
- **`.github/workflows/ci.yml`** — the "every version-carrying file must
  agree" step's comment and extraction logic gain the fifth file.
- **`CONTRIBUTING.md`** — a line noting this repository dogfoods its own
  pre-commit hook (§6), the way it already documents `bun run vscode-install`
  as a from-a-clone step.
- **`CHANGELOG.md`** — an `## Unreleased` → `### Added` entry.

## 8. Non-goals

- **No `fmt` or `--fix-dates` exposed through this hook.** A pre-commit hook
  that rewrites staged files by default is a materially different, riskier
  proposal (constraint 2, [§9](../visimark-design.md#9-write-back)) than one
  that only checks. A consumer who wants a `fmt` hook writes their own
  `repo: local` entry for it; this spec ships `check` only.
- **No `language: node` support** (§2.2) — closed for the stated reason
  (would require restructuring the monorepo root manifest), not merely
  deferred; reopen only if the root manifest changes shape for unrelated
  reasons.
- **No GitLab-CI-specific packaging.** `docs/ci.md` chapter 22 already covers
  GitLab CI as a plain job, unrelated to the pre-commit framework.
- **No new npm package.** The hook fetches the existing `visimark` package;
  nothing new is published to any registry.
- **No `--json` output from this hook by default** — see §3.

## 9. Open questions

None.
