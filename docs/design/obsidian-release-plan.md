# The Obsidian plugin's release mechanics

**Status: decided 2026-09-27 — Option C.** This document originally laid out
the options for getting `editors/obsidian` onto the community registry and
keeping it there, without picking one, because a code review of the plugin
(row 20) asked for the options to be written down before anything was built.
The options below are kept as the record of that comparison; the decision and
what it built follow immediately after.

## The decision

**Option C**, built in
[`.github/workflows/obsidian-release.yml`](../../.github/workflows/obsidian-release.yml).
A bare-version tag (`0.1.0`, not `v0.1.0` or `obsidian-v0.1.0`) pushed to this
repository triggers a dedicated workflow — `release.yml`'s own `v*` trigger
cannot fire on it, since every tag that workflow creates starts with a literal
`v` and this one's glob (`[0-9]*.[0-9]*.[0-9]*`) requires the first character
to be a digit. The workflow fails the run if the pushed tag disagrees with
`editors/obsidian/manifest.json`'s `version`, builds `main.js`, and attaches
`main.js`, `manifest.json` and `styles.css` to a GitHub Release cut against
that same tag — the three files and the tag-equals-version rule the registry's
own submission documentation states outright
(<https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions>).

**What this decision does not do.** It does not solve problem 1 below (a root
`manifest.json` for the *submission* PR's automated check) with any ongoing
automation — no root-level file, no test guarding a copy. That check runs once,
at submission time, against whatever the default branch's root holds
(<https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>: "The
directory processes the `manifest.json` at the HEAD of your repository's
default branch"), not on every tagged release, so it is a manual, one-time
step the maintainer does by hand when actually submitting to the registry —
recorded here so it is not forgotten, not automated because nothing recurring
depends on it. `docs/releasing.md` documents the recurring leg this decision
did build.

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
3. creates a **separate, bare-version git tag** (`0.1.0`, no `obsidian-v`
   prefix) pointing at the same commit, and cuts the GitHub Release against
   *that* tag — not the `obsidian-v0.1.0` tag that triggered the workflow —
   since the registry and BRAT match the release's tag string itself, not its
   title, and attaches `main.js`, `manifest.json` and `styles.css` to it.

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

## This was a maintainer decision, and it was made here

The review that asked for this document was explicit: draft the options with
their trade-offs, and stop — no workflow file changes, and no new workflow,
as part of that document or the change that introduced it. Picking between A,
B, C, or a variant was left for the maintainer to make once the plugin was
closer to a registry submission, and it was made on 2026-09-27: Option C,
built in `.github/workflows/obsidian-release.yml`. See "The decision," above.
