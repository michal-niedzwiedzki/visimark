# The Obsidian plugin's release mechanics — options, not a decision

**Status: not decided.** This document lays out the concrete options for
getting `editors/obsidian` onto the community registry and keeping it there.
It does not pick one. See
[2026-09-25 code review, §2.8](../reviews/2026-09-25-obsidian-plugin.md#28-make-the-version-and-release-story-true-row-20)
(row 20), which asked for the options to be written down before anything is
built.

## The problems this has to answer

The Obsidian community registry (`obsidianmd/obsidian-releases`) and BRAT both
read a plugin's `manifest.json`, `main.js` and `styles.css` from a specific
place, and neither place is where this repository keeps them today:

1. **The registry reads `manifest.json` from the repository root.** This
   repo's copy lives at `editors/obsidian/manifest.json`, because the plugin
   is one workspace among several in a monorepo. Nothing currently mirrors it
   to the root.
2. **A release tag must equal the bare manifest version** — `0.1.0`, not
   `v0.1.0` — because that is the string the registry's tooling and BRAT both
   match against. This repo's `release.yml` fires on `push: tags: ["v*"]` and
   releases the three npm-published packages under that scheme. A bare
   `0.1.0` tag can't reuse it without a collision the day the npm version and
   the plugin version happen to share a number (both start at `0.1.x` today).
3. **No workflow builds or attaches the three release assets.** `main.js`
   doesn't exist until `bun run --filter visimark-obsidian build` runs, and
   nothing in CI runs that build and attaches its output, `manifest.json` and
   `styles.css` to a GitHub Release the way the registry's submission
   instructions require.
4. **BRAT is the interim channel** (§2.2 of `obsidian-plugin-spec.md`, "v1 is
   side-loadable, not listed"), and its lookup rules should be confirmed
   before this repository leans on them for longer: BRAT reads a GitHub
   Release's tag and assets for a given repo, so whatever scheme is chosen
   for problem 2 has to be one BRAT can already resolve, not a bespoke one
   invented here.

None of this touches `manifest.json`'s *version itself* — spec §2.2 already
decided, on purpose, that the plugin's version does not follow the npm
packages' version, and this document doesn't reopen that. It also doesn't
touch `scripts/check-changelog-entries.ts`, which already requires a dated
`CHANGELOG.md` entry keyed on the manifest version; whatever option below is
chosen keeps the manifest as the single version source and does not add a
second place a version is typed.

## Option A — mirror to the root, checked, with a dedicated tag scheme

Add a root-level `manifest.json` (and `versions.json`) that is a byte-for-byte
copy of `editors/obsidian/manifest.json`, checked by a test — the same shape
as `test/bundle.test.ts` checking the *build* against `esbuild.config.mjs`
instead of restating it, so the copy can't silently drift from the source of
truth. A new tag scheme, `obsidian-v*` (e.g. `obsidian-v0.1.0`), triggers a
dedicated workflow (not `release.yml`) that:

1. checks the pushed tag's suffix against `editors/obsidian/manifest.json`'s
   `version` (fails the run if they disagree — the same "don't publish what
   the tag doesn't match" discipline `release.yml` already has for the npm
   packages);
2. builds `main.js` with `bun run --filter visimark-obsidian build`;
3. cuts a GitHub Release named after the bare version (`0.1.0`, no
   `obsidian-v` prefix, since that's the string the registry and BRAT match)
   and attaches `main.js`, `manifest.json` and `styles.css`.

**Trade-offs.** The root-level copy is a second file that could theoretically
drift if the test guarding it is ever weakened or skipped — a check is not as
strong as there being only one file. It also means `git blame` on the root
`manifest.json` records copies, not decisions. In exchange, it satisfies the
registry's literal requirement (`manifest.json` at the repo root) without
maintaining two independently-edited version numbers, and the tag scheme
can't collide with `v*` even if the npm and plugin versions later match.

## Option B — a submission-time-only root copy, no ongoing sync

Don't check anything in continuously. At submission time (and at each release
after that), a maintainer — or a one-off script run by hand, not a CI job —
copies `editors/obsidian/manifest.json` and `versions.json` to the repo root
as part of cutting that specific release, tags it with the bare version, and
attaches the built assets to a GitHub Release by hand or via a manual
`workflow_dispatch` run. No new tag scheme is wired into automatic `push`
triggers at all.

**Trade-offs.** This is the least commitment: no new permanent workflow,
no root files sitting in the tree between releases inviting them to go stale,
and no interaction with `release.yml`'s existing `v*` trigger to reason about.
The cost is that every release is manual and easy to get wrong exactly
because nothing checks it — the copy could be forgotten, stale, or built from
the wrong commit, and nothing would fail loudly the way Option A's test
would. This suits an early, infrequent release cadence (the plugin is still
side-loading via BRAT, not yet listed) better than a mature one.

## Option C — a path-scoped release disambiguated from the npm tags

Keep bare-version tags (`0.1.0`, not `obsidian-v0.1.0`) since that's the exact
string BRAT and the registry expect, but disambiguate the *release*, not the
tag, from the npm packages' `v*` releases: a GitHub Release can carry a tag
that isn't of the form `v*` without touching `release.yml`'s trigger at all,
because that workflow only fires on `v*` pushes — a bare `0.1.0` tag push
triggers nothing there today and would need its own workflow anyway (as in
Option A), gated on `on: push: tags: ["[0-9]*"]` or similar, rather than a
prefixed scheme. This avoids ever inventing a plugin-specific prefix
(`obsidian-v*`) that BRAT and the registry were never told about, at the cost
of the workflow trigger being a version-number-shaped glob instead of a
human-legible prefix, and of needing to double-check that pattern can never
also match a future npm-package tag.

## What every option keeps fixed

- `editors/obsidian/manifest.json` (or `versions.json`) stays the one place a
  human edits the plugin's version. Nothing above adds a second typed-in
  source.
- `release.yml`'s existing `v*` trigger and its three npm/Marketplace/Open VSX
  legs are untouched. Whatever ships this is a new, separate workflow or a
  manual step, not an edit to that file.
- BRAT's actual current lookup behaviour is confirmed against its own
  documentation or source before any option here is built on top of it, in
  case the plugin's "installs via BRAT" story needs adjusting to match
  whichever tag/asset shape gets chosen.

## This is a maintainer decision, not decided here

The review that asked for this document was explicit: draft the options with
their trade-offs, and stop. No workflow file changes, and no new workflow, are
part of this document or the change that introduced it. Picking between A, B,
C, or a variant is a call for the maintainer to make once the plugin is closer
to a registry submission — the "not decided" status at the top of this file
stays until that happens.
