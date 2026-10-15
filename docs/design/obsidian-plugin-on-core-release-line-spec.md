# Obsidian plugin on the core release line — feature spec

**Status:** approved (#396) · **Date:** 2026-10-15 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/396#issuecomment-6187465115

## 1. Purpose

Every artifact one release ships should carry one version number. The eight
manifests in `scripts/release-manifests.ts` already do, and
`scripts/check-versions.ts` fails CI when they disagree. The Obsidian plugin
(`editors/obsidian/manifest.json`, `versions.json`) is the only shipped
artifact that still has a number of its own:

```console
$ grep '"version"' packages/visimark/package.json editors/obsidian/manifest.json
packages/visimark/package.json:  "version": "0.2.0",
editors/obsidian/manifest.json:  "version": "0.3.0",
$ git tag | grep -E '^v?0\.[23]\.'
0.2.0 0.2.1 0.2.2 0.3.0 v0.2.0
$ bun scripts/check-versions.ts; echo $?
0                      # the plugin is not in RELEASE_MANIFESTS, so nothing compares it
```

Engine 0.2.0 shipped inside plugin 0.3.0. Only the plugin changelog's
"Bundles engine X." line records that pairing, and
`scripts/check-obsidian-engine-line.ts` polices that line. The check cannot
run in `ci.yml`, because a core-only bump leaves the line behind. A test that
ran it against the live tree turned `ci` red on the v0.2.0 release commit
(`3f15bd6`).

[`obsidian-plugin-spec.md`](obsidian-plugin-spec.md) §2.2 kept the plugin off
the npm line for one reason: each Obsidian release would wait on a human
registry review. That premise no longer holds. [`releasing.md`](../releasing.md)
("Submitting to the community registry") records that submission was a
one-time step and that later releases are reviewed automatically. Plugin
0.2.1 and 0.2.2 were both tagged on 2026-09-28. The VS Code extension already
uses the model this spec adopts: it shares the core number, keeps its own
changelog, and writes "No editor-visible changes. Bundles engine X." when
nothing changed for it.

This change also replaces the bump-kind rule in
[#345](https://github.com/michal-niedzwiedzki/visimark/issues/345) part 3,
which kept two numbers. Under one number, plugin `X.Y.Z` bundles engine
`X.Y.Z` by construction: the plugin builds the engine from source at the same
commit.

## 2. The surface

No `visimark` CLI command or option changes. The surface is four scripts,
one workflow, and the shape of a release commit.

| File | Change |
|---|---|
| `scripts/release-manifests.ts` | Exports `OBSIDIAN_MANIFEST = "editors/obsidian/manifest.json"` and `OBSIDIAN_VERSIONS = "editors/obsidian/versions.json"`. The plugin does **not** join `RELEASE_MANIFESTS`, because it is not a `package.json` and has no `bun.lock` version. The header comment changes from "its version is its own" to point at `docs/releasing.md#versioning`. |
| `scripts/check-versions.ts` | Two more `expectEngine` comparisons: `OBSIDIAN_MANIFEST`'s `"version"`, and the newest key of `OBSIDIAN_VERSIONS`. "Newest" is the last key in file order, the one `prepare-release.ts` appends. Neither the root `manifest.json` nor the root `versions.json` is read. Root/editor byte equality stays with `check-obsidian-root-mirror.ts`. |
| `scripts/prepare-release.ts` | Bumps the plugin with the core files (§4). The new version must also be newer than the plugin's current version. The header and closing message stop saying the plugin is untouched. |
| `scripts/check-changelog-entries.ts` | The plugin pair's hint becomes `Add an entry, even "No plugin changes. Bundles engine ${v}."`. Its comment links `docs/releasing.md#versioning` instead of citing §2.2. The pair itself is unchanged. |
| `scripts/check-obsidian-engine-line.ts` | **Deleted**, with its `describe` block in `scripts/release-checks.test.ts`. The version number now says what the line said. |
| `.github/workflows/obsidian-release.yml` | The "Verify the changelog names the bundled engine" step and its comment are deleted. Every other step, the trigger, and "Verify the tag matches manifest.json" stay. |

Tag schemes do not change. Core is still `vX.Y.Z` and the plugin still uses
a bare `X.Y.Z`, because the community registry and BRAT match the release tag
against `manifest.json` exactly. The difference is that both tags now name
the same `X.Y.Z`.

## 3. The machine contract

Exit codes are unchanged everywhere: `0` clean, `1` findings or refusal, `2`
usage. Annotations go to stdout as `::error file=<file>::<message>`. Nothing
new goes to stderr except the existing usage lines. No `--json` surface is
involved.

| Script | Condition | Exit | stdout |
|---|---|---|---|
| `check-versions.ts` | Every file agrees, plugin included | 0 | The existing `seen` lines plus `editors/obsidian/manifest.json "version"=X.Y.Z` and `editors/obsidian/versions.json newest key=X.Y.Z` (28 lines where today prints 26) |
| `check-versions.ts` | The plugin manifest disagrees | 1 | `::error file=editors/obsidian/manifest.json::editors/obsidian/manifest.json "version" says G but packages/visimark/package.json says E. Bump every version-carrying file in the release commit — run bun scripts/prepare-release.ts, see docs/releasing.md.` and the `seen` lines |
| `check-versions.ts` | The newest `versions.json` key disagrees | 1 | `::error file=editors/obsidian/versions.json::editors/obsidian/versions.json newest key says G but packages/visimark/package.json says E. Bump every …` (same tail) |
| `check-versions.ts` | The plugin manifest or `versions.json` is unreadable, is not JSON, or has no version or keys | 1 | The existing `moved()` text: `cannot read "version" in editors/obsidian/manifest.json. Fix scripts/check-versions.ts if the layout moved.` For `versions.json`, `what` is `newest key`. |
| `prepare-release.ts` | Success | 0 | `Prepared C -> V (D, LEVEL) in 19 files.` and the closing lines in §4 |
| `prepare-release.ts` | `V` is not newer than the plugin's current version | 1 | `::error file=editors/obsidian/manifest.json::V is not newer than the Obsidian plugin's current version P.` Nothing is written. |
| `prepare-release.ts` | A root copy differs from its `editors/obsidian/` copy before the run | 1 | `::error file=manifest.json::manifest.json differs from editors/obsidian/manifest.json. Make the root copies byte-equal first — see scripts/check-obsidian-root-mirror.ts.` (`versions.json` likewise). Nothing is written. |
| `prepare-release.ts` | `versions.json` already has a `"V"` key | 1 | `::error file=editors/obsidian/versions.json::editors/obsidian/versions.json already has a "V" key.` Nothing is written. |
| `prepare-release.ts` | `minAppVersion` is unreadable in the plugin manifest | 1 | `::error file=editors/obsidian/manifest.json::editors/obsidian/manifest.json: cannot find "minAppVersion". The layout moved; fix scripts/prepare-release.ts.` Nothing is written. |

Every existing `prepare-release.ts` refusal (empty Unreleased, not newer than
core, bump not earned, a pattern that does not match) behaves as today.
"Nothing is written" stays all-or-nothing: the new edits go into the same
`pending` map, which is flushed only after every edit has matched.

## 4. Behaviour table

`prepare-release.ts`'s plugin edits, in addition to everything it does today:

| File | Edit |
|---|---|
| `editors/obsidian/manifest.json` | Top-level `"version"` → `V`, with the same pattern as the package manifests |
| `editors/obsidian/versions.json` | `"V": "<minAppVersion of editors/obsidian/manifest.json>"` appended as the last key, two-space indent, comma added to the previous last line |
| `manifest.json`, `versions.json` (root) | Written with the same bytes as the two edited `editors/obsidian/` files |
| `editors/obsidian/CHANGELOG.md` | If `## Unreleased` exists **and has content**: rename it to `## V - D` and open a fresh empty `## Unreleased` above it. If `## Unreleased` is **empty or absent**: keep it if present, and insert `## V - D\n\nNo plugin changes. Bundles engine V.\n` as the newest dated entry below it. |

The closing message, literally (shown for `0.4.0`):

```text
Prepared 0.2.0 -> 0.4.0 (2026-10-16, MINOR) in 19 files.
Now: read the diff, and rewrite the placeholder line in editors/vscode/CHANGELOG.md
or editors/obsidian/CHANGELOG.md if that editor has user-visible changes
(docs/releasing.md, "Preparing the changelog"). Fill the Shipped-register
Released cells (step 5), run the pre-push checks, then commit as "chore: release v0.4.0".
```

A hand-written plugin entry no longer needs a "Bundles engine X." line. Only
the placeholder keeps the sentence, for parity with the VS Code extension.

Sessions, which double as acceptance:

| # | Tree | Invocation | Output | Exit |
|---|---|---|---|---|
| 1 | Core and plugin both 0.4.0, newest `versions.json` key 0.4.0 | `bun scripts/check-versions.ts` | 28 `seen` lines, no `::error` | 0 |
| 2 | Plugin manifest 0.4.1, core 0.4.0 | `bun scripts/check-versions.ts <tmp>` | `::error file=editors/obsidian/manifest.json::editors/obsidian/manifest.json "version" says 0.4.1 but packages/visimark/package.json says 0.4.0. Bump every version-carrying file in the release commit — run bun scripts/prepare-release.ts, see docs/releasing.md.` | 1 |
| 3 | Newest `versions.json` key 0.3.0, everything else 0.4.0 | `bun scripts/check-versions.ts <tmp>` | `::error file=editors/obsidian/versions.json::editors/obsidian/versions.json newest key says 0.3.0 but packages/visimark/package.json says 0.4.0. Bump …` | 1 |
| 4 | Today's tree (core 0.2.0, plugin 0.3.0) | `bun scripts/prepare-release.ts MINOR` | `::error file=editors/obsidian/manifest.json::0.3.0 is not newer than the Obsidian plugin's current version 0.3.0.`; no file changed | 1 |
| 5 | Today's tree | `bun scripts/prepare-release.ts 0.4.0 --date 2026-10-16` | `Prepared 0.2.0 -> 0.4.0 (2026-10-16, MINOR) in 19 files.` and the closing lines. Both plugin manifests are at 0.4.0 and byte-equal. Both `versions.json` copies end `"0.3.0": "1.8.7",\n  "0.4.0": "1.8.7"\n}`. The plugin changelog has `## Unreleased` and then `## 0.4.0 - 2026-10-16` with the placeholder line. | 0 |
| 6 | As 5, but plugin `## Unreleased` holds `- Something.` | as 5 | `## Unreleased\n\n## 0.4.0 - 2026-10-16\n\n- Something.` in the plugin changelog, with no placeholder line | 0 |
| 7 | As 5, but root `manifest.json` differs by one byte | as 5 | `::error file=manifest.json::manifest.json differs from editors/obsidian/manifest.json. Make the root copies byte-equal first — see scripts/check-obsidian-root-mirror.ts.`; no file changed | 1 |
| 8 | As 5, but `versions.json` already has `"0.4.0"` | as 5 | `::error file=editors/obsidian/versions.json::editors/obsidian/versions.json already has a "0.4.0" key.`; no file changed | 1 |
| 9 | Tree after 5 | `bun scripts/check-versions.ts <tmp>`, `bun scripts/check-changelog-entries.ts <tmp>`, `bun scripts/check-obsidian-root-mirror.ts <tmp>` | All clean | 0, 0, 0 |
| 10 | Any | `bun scripts/check-obsidian-engine-line.ts` | The file does not exist. `obsidian-release.yml` has no step that runs it. | — |
| 11 | Plugin manifest unchanged, root `manifest.json` changed | `bun scripts/check-obsidian-root-mirror.ts` | Fails as today; this change does not touch the root check | 1 |

Cases 2, 3 and 11 go in `scripts/pin-checks.test.ts` and
`scripts/release-checks.test.ts` as temp-tree tests. `COPY` in the
`check-versions` block gains `editors/obsidian/manifest.json` and
`editors/obsidian/versions.json`. Cases 4–9 go in
`scripts/prepare-release.test.ts`, whose `FILES` gains the five plugin files.
"Passes on the real repository" stays and passes once the tree is at 0.4.0
(§5).

## 5. Compatibility

**Landing.** Once the plugin is on the check, today's tree fails it. So the
implementation PR ends with the 0.4.0 release commit, made by the new
`bun scripts/prepare-release.ts 0.4.0 --date <that day>`:

1. Commits on `issue/396-obsidian-plugin-on-core-release-line-impl`: the
   scripts, the tests, the workflow and the documentation. The last commit is
   `chore: release v0.4.0`. In it, prepare-release's output is edited by hand
   as `releasing.md` steps 3–5 say: the plugin 0.4.0 entry is written out (it
   is not the placeholder), the VS Code placeholder is rewritten if needed,
   and the Shipped-register **Released** cells are filled, this change's row
   included.
2. CI on the PR is green, including `check-versions` and "passes on the real
   repository".
3. The maintainer squash-merges with subject `chore: release v0.4.0 (#<pr>)`,
   waits for `ci` and `dogfood` on `master`, and runs
   `scripts/release-tag.sh v0.4.0`. After `release.yml` and
   `scripts/verify-release.sh v0.4.0`, they run `scripts/release-tag.sh 0.4.0`
   and check the plugin release's three assets and attestation. This is the
   last release under the two-tag process. [#345](https://github.com/michal-niedzwiedzki/visimark/issues/345)
   parts 2–4 follow it.

The line restarts at **0.4.0**. Core 0.3.1 would be a patch on a 0.3.0 that
core never had, and `## Unreleased` already holds `### Added` (and
`### Removed`) entries, so the next release is a minor anyway.

Before and after, concretely:

| Consumer | Before | After |
|---|---|---|
| `ci.yml` "every version-carrying file must agree" | Compares 26 values. The plugin can be at any number. | Compares 28. A plugin manifest or `versions.json` key that differs from the engine fails the job. That break is intended. |
| `ci.yml` changelog-entries and root-mirror steps | As today | Unchanged |
| `obsidian-release.yml` | Tag must equal the manifest. The changelog must name the tree's engine. | Tag must equal the manifest. The engine-line step is gone. |
| `release.yml`, `scripts/release-tag.sh`, `scripts/verify-release.sh` | — | Unchanged. `release-tag.sh X.Y.Z` still takes the bare plugin tag. |
| `.github/workflows/dogfood.yml`, `action.yml`, `docs/ci.md` snippets | Do not read the plugin manifest | Unchanged |
| Obsidian users (registry, BRAT) | 0.3.0 | An ordinary update to 0.4.0. The registry and BRAT read the same files from the same places. |
| Joplin pack | Stamps the engine version at build time | Unchanged. It already carries the release number. |
| `visimark-lsp` | On `RELEASE_MANIFESTS` | Unchanged |

**Shipping a fix that touches only the plugin.** It is a patch release of the
whole line, with no exception in the check. The npm packages already ship
versions in which nothing changed. An exception would need its own carve-out
in the check. It would also force the next core patch to skip a number.

**Reversibility.** Removing the two `expectEngine` calls and reverting
`prepare-release.ts` restores the old behaviour without a release. Tags that
were pushed (`v0.4.0`, `0.4.0`) stay, and later plugin numbers have to stay
above them. `check-obsidian-engine-line.ts` can be restored from git.

**A known window, not a new one.** Obsidian clients read the root
`manifest.json` on `master` as the latest version. Every release commit now
bumps it, so users may see an update they cannot download until tag `X.Y.Z`
and its release exist. The same window exists today between merging the
plugin PR and tagging. #345's plugin leg should run right after the npm legs.

## 6. Interaction with the rest of the tooling

- **`check-obsidian-root-mirror.ts`** stays the only check on the root copies.
  `prepare-release.ts` refuses to start from a drifted pair rather than
  silently repair it.
- **`check-changelog-entries.ts`** still requires a dated plugin entry for the
  manifest's version. Under one number, that means every release, as the VS
  Code extension already requires.
- **`changelog-section.ts`** is unchanged. The plugin release body is still
  that version's section. The placeholder rule never leaves a dated section
  empty.
- **Order of the two tags.** The plugin is still tagged after core has
  shipped, and the order is still enforced by process. No tag gate is built
  (pre-review question 3), because #345 part 3 makes the plugin a leg of
  `release.yml`, and that enforces the order by structure.
- **#345.** Approving this withdraws #345's rejection of lockstep. Part 3
  becomes "same version, no bump-kind computation". Part 1's plugin half
  (bump the manifests, add the `versions.json` key, roll the changelog) is
  delivered here, so #345 does not duplicate it. A comment on #345 records
  this at decision time.
- **Unchanged:** the `visimark` CLI and all its commands, `--json`, the
  language, the VS Code extension and LSP, `markdown-it-visimark`,
  `codemirror-visimark`, the Joplin build, `release.yml`, `release-tag.sh`,
  `verify-release.sh`, `dogfood.yml`, `action.yml`, the issue-review workflow
  and its commands, and `.github/ISSUE_TEMPLATE/`.

## 7. Documentation to update

`docs/releasing.md` becomes the one place that states the versioning policy.
Every other file links to it (`.agents/rules/dependencies-and-pins.md`,
"State each fact in one place").

- `docs/releasing.md`:
  - a new `## Versioning` section (anchor `#versioning`). It says every
    shipped artifact carries the release's version. It says a plugin-only fix
    is a patch release of the whole line, that Joplin stamps the version at
    pack time, and that `visimark-lsp` is on the list. It says the line
    restarted at 0.4.0 because plugin tag `0.3.0` already existed.
  - step 3's file list gains the five plugin files, and its prose names the
    plugin;
  - "Release order": the same `X.Y.Z` for both tags, still core first. The
    "A core bump leaves the plugin changelog behind" paragraph is deleted.
  - "Releasing the Obsidian plugin": the tag is the release's `X.Y.Z`. The
    engine-line sentences are deleted. "Keeping the root copies in step" says
    `prepare-release.ts` writes them.
  - "Submitting to the community registry", item 4: "each fix is a patch
    release of the whole line".
  - "Preparing the changelog": the plugin bullet follows the VS Code bullet's
    pattern, with the "No plugin changes. Bundles engine X.Y.Z." placeholder.
    The "End each entry with Bundles engine…" requirement is removed.
  - "Rules that bite": the version row names the plugin manifest and the
    newest `versions.json` key. The "Core ships before the plugin" row's
    consequence no longer refers to the engine line.
- `docs/design/obsidian-plugin-spec.md` §2.2: a dated amendment under
  "Versioning is independent of the npm packages". It records the reversal on
  #396 and that the registry-review premise lapsed once the plugin was
  listed, and links `../releasing.md#versioning`. The original paragraph,
  the §5 table row (line 684) and the §9 note stay as the v1 record.
- `editors/obsidian/CHANGELOG.md`: the header paragraph is replaced with one
  sentence saying the plugin carries the release's version, with a link to
  `../../docs/releasing.md#versioning`.
- `editors/obsidian/README.md`: "Versioning" links to `releasing.md#versioning`
  instead of citing §2.2. The "Installing it" example tag becomes
  `0.4.0`, not `v0.4.0`.
- `CONTRIBUTING.md`: the paragraph at lines 149–152 links to
  `docs/releasing.md#versioning`. "Every version-carrying file must agree"
  (lines 321–327) names the plugin manifest and `versions.json`.
- `.agents/rules/dependencies-and-pins.md`: the `check-versions.ts` row of the
  pin table names the Obsidian plugin's manifest and `versions.json`.
- Code comments: the headers of `scripts/release-manifests.ts`,
  `scripts/prepare-release.ts` and `scripts/check-versions.ts`, the plugin
  comment in `scripts/check-changelog-entries.ts`, and the comments in
  `.github/workflows/obsidian-release.yml` that mention the engine line.
- `CHANGELOG.md`: under `## Unreleased` → `### Changed`, one line saying the
  Obsidian plugin now carries the release version, starting at 0.4.0. The
  release commit rolls it into `## 0.4.0`.
- `editors/obsidian/CHANGELOG.md` `## 0.4.0`: the entry opens by saying the
  plugin now carries the release version and that this release bundles engine
  0.4.0. It goes on to the engine changes the plugin surfaces.
- `editors/vscode/CHANGELOG.md`: no line for this change. The release commit
  writes its normal 0.4.0 entry.
- `docs/vocabulary-catalogue.md`: the row moves into the Shipped register,
  with Landed set to the implementation PR and Released set to v0.4.0 in the
  same PR (§5).

**Explicitly not edited**, because each is a dated record that was true when
written: `docs/design/obsidian-release-plan.md` (its "does not reopen §2.2"
paragraph), `docs/reviews/2026-09-25-obsidian-plugin.md`,
`docs/design/extract-live-preview-codemirror-spec.md`, and older
`CHANGELOG.md` entries. `docs/distribution.md` and the `README.md`
distribution table do not state the version line, and stay as they are.

## 8. Non-goals

- #345 parts 1 (beyond the plugin half), 2, 3 and 4: generating the release
  PR, the dry run on release PRs, the plugin as a leg of `release.yml`, and
  tagging on merge.
- A gate that checks the plugin tag against an existing core tag (pre-review
  question 3).
- An exception that lets the plugin run ahead of core for one release.
- A committed version for the Joplin plugin.
- Checking the `versions.json` *values* (`minAppVersion`) or any key other
  than the newest.
- Changing either tag scheme, or what `obsidian-release.yml` uploads.

## 9. Open questions

None.

<!--vmark:no-formulas-->
