# Changelog entry for every release — feature spec

**Status:** approved (#131) · **Date:** 2026-09-21 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/131#issuecomment-5760479248

## 1. Purpose

`docs/releasing.md` step 4 asks the releaser to write `editors/vscode/CHANGELOG.md` ("same version, same date"), and to write the root `CHANGELOG.md` before tagging. Nothing checks either. `ci.yml`'s "every version-carrying file must agree" step reads the three manifests and `action.yml` and never opens a changelog, so a release can tag with either file missing its entry. The root file becomes the GitHub Release body, so a tag ahead of it ships the previous version's notes; the extension file is what `vsce` puts on the Marketplace page, so a tag ahead of it publishes a version the page silently skips.

The v0.1.6 release exposed the gap: deciding what the extension entry should say meant checking by hand what the language server surfaces. That was caught by the releaser this time, not by CI.

The step follows the precedent the version-agreement step set (`ci.yml`: "a release checklist step that nothing enforces is a step that gets skipped on the release where it matters"). Merging the two changelogs was considered and rejected on #131: `vsce` reads only a `CHANGELOG.md` inside the extension folder, and the two files have different readers.

## 2. The surface

No `visimark` command, option, exit code, stream or `--json` shape changes. Three things change:

**2.1 A script**, `scripts/check-changelog-entries.ts`, run as

```
bun scripts/check-changelog-entries.ts [root]
```

`root` is the directory to check and defaults to the repository root (the script's parent directory). It exists so the check can run against a temp tree. More than one argument prints `usage: check-changelog-entries [root]` to stderr and exits `2`.

The script checks two pairs, each changelog against **its own** manifest's `version`:

| Manifest | Changelog |
|---|---|
| `packages/visimark/package.json` | `CHANGELOG.md` |
| `editors/vscode/package.json` | `editors/vscode/CHANGELOG.md` |

A changelog passes when it has a line matching, for the manifest version `V`, the regular expression `^## V - \d{4}-\d{2}-\d{2}[ \t]*$` with every `.` in `V` escaped. The match is anchored, so `0.1.6` never matches a `## 0.1.60 - …` heading, and it does not test that the date is a real calendar date. `## Unreleased` is ignored by the match. Both pairs are always checked; the script reports every failure, not the first.

**2.2 A CI step** in `.github/workflows/ci.yml`, named `every release must have a changelog entry`, placed directly after "every version-carrying file must agree" and before `bun run lint`. Its body is `run: bun scripts/check-changelog-entries.ts`, with a comment block in the file's existing voice giving the reason. It is a sibling step, not an extension of the agreement step, so it has its own line in the run log. It runs wherever `ci.yml` runs (`pull_request`, `push` to `master`, `v*` tags). The default failure semantics apply: if the agreement step fails, this one does not run.

**2.3 A rule** in `docs/releasing.md` (section 7).

## 3. The machine contract

| Outcome | Exit | stdout | stderr |
|---|---|---|---|
| Both changelogs have a dated heading for their manifest's version | `0` | `changelog entries: CHANGELOG.md 0.1.6, editors/vscode/CHANGELOG.md 0.1.6` | empty |
| A changelog has no heading for the version | `1` | `::error file=<changelog>::<manifest> says V but <changelog> has no "## V - YYYY-MM-DD" heading. <hint> — see docs/releasing.md.` (one line per failing file) | empty |
| A changelog has `## V` with no date | `1` | `::error file=<changelog>::<changelog> has "## V" with no date. Write it as "## V - YYYY-MM-DD" — see docs/releasing.md.` | empty |
| A changelog or manifest is missing or unreadable, or the manifest has no `version` | `1` | `::error file=<file>::cannot read <what> in <file>. The layout moved; fix scripts/check-changelog-entries.ts rather than deleting the check.` | empty |
| More than one argument | `2` | empty | `usage: check-changelog-entries [root]` |

`<hint>` is, for `editors/vscode/CHANGELOG.md`: `Add an entry, even "No editor-visible changes. Bundles engine V."`; for the root `CHANGELOG.md`: `Rename "## Unreleased" to "## V - YYYY-MM-DD" and open a fresh "## Unreleased" above it`. The annotation is on the changelog, the file to edit. Annotations go to stdout, as GitHub reads them and as the agreement step's `echo` does. There is no `--json`; the script is not part of the CLI.

## 4. Behaviour table

Sessions run from the repository root. `T` is a temp tree holding the two manifests and two changelogs.

| Case | Session |
|---|---|
| Today's tree (both at `0.1.6`) | `$ bun scripts/check-changelog-entries.ts`<br>`changelog entries: CHANGELOG.md 0.1.6, editors/vscode/CHANGELOG.md 0.1.6`<br>`$ echo $?` → `0` |
| `T`: `editors/vscode/package.json` at `0.1.7`, extension changelog tops out at `## 0.1.6 - 2026-09-20` | `$ bun scripts/check-changelog-entries.ts T`<br>`::error file=editors/vscode/CHANGELOG.md::editors/vscode/package.json says 0.1.7 but editors/vscode/CHANGELOG.md has no "## 0.1.7 - YYYY-MM-DD" heading. Add an entry, even "No editor-visible changes. Bundles engine 0.1.7." — see docs/releasing.md.`<br>`$ echo $?` → `1` |
| Same tree, heading `## 0.1.7 - 2026-09-22` added | exit `0`, stdout names `editors/vscode/CHANGELOG.md 0.1.7` |
| `T`: `packages/visimark/package.json` at `0.1.7`, root changelog still `## Unreleased` over `## 0.1.6 - …` | `::error file=CHANGELOG.md::packages/visimark/package.json says 0.1.7 but CHANGELOG.md has no "## 0.1.7 - YYYY-MM-DD" heading. Rename "## Unreleased" to "## 0.1.7 - YYYY-MM-DD" and open a fresh "## Unreleased" above it — see docs/releasing.md.` exit `1` |
| Both missing at once | two `::error` lines, exit `1` |
| Heading is `## 0.1.7` with no date | `::error file=…::… has "## 0.1.7" with no date. Write it as "## 0.1.7 - YYYY-MM-DD" — see docs/releasing.md.` exit `1` |
| Manifest at `0.1.6`, changelog only has `## 0.1.60 - 2026-09-30` | the "no heading" error; exit `1` (anchoring) |
| Extension changelog has no `## Unreleased` at all | exit `0`; the section is optional there |
| Extension changelog file missing | `::error file=editors/vscode/CHANGELOG.md::cannot read editors/vscode/CHANGELOG.md. The layout moved; fix scripts/check-changelog-entries.ts rather than deleting the check.` exit `1` |
| Manifest without a `version` | `cannot read version in <manifest>` error, exit `1` |
| Two arguments | usage line on stderr, exit `2` |

## 5. Compatibility

- **`ci.yml`:** gains one failing condition. On today's tree, and on every pull request that does not bump a version, the step passes, so no open PR breaks. It fails on a release commit that bumps the manifests without adding a dated heading, which is the point.
- **`release.yml`:** unchanged. It does not depend on `ci.yml`; the gate is step 2 of "Before you tag", green CI on the commit you tag, which now covers the changelogs.
- **The composite Action (`action.yml`), `docs/ci.md`, `.github/workflows/dogfood.yml`:** do not read the changelogs' headings or `ci.yml`; unchanged. `dogfood.yml` still runs `check` on the root `CHANGELOG.md` as a document.
- **The CLI, the extension, the LSP, a pinned Action ref:** unchanged. No migration note.
- **Reversibility:** delete the `ci.yml` step (and the script); no release, re-pin or re-install.

## 6. Interaction with the rest of the tooling

Does **not** change: the version-agreement step (still the only place the four version files are compared); `--json`; any exit code of `visimark`; what `visimark fmt` or `check` do to a changelog; the extension's own changelog reader (`vsce`). The extension changelog's "same date as the root file" remains guidance; the script does not compare the two dates. `## Unreleased` remains mandatory in the root file as documented today (`releasing.md`), but the script does not check for it.

The script is TypeScript under `scripts/`, like `gen-function-reference.ts`, and must pass whatever lint, format and typecheck already cover `scripts/`.

## 7. Documentation to update

1. **`docs/releasing.md`**
   - "Before you tag" step 4: say CI's "every release must have a changelog entry" step fails the build if either changelog lacks a dated `## X.Y.Z - YYYY-MM-DD` heading for its manifest's version (mirroring the sentence that step 3 has for the version files).
   - "Preparing the changelog": replace the extension paragraph with the rule. Every release gets a dated `## X.Y.Z - YYYY-MM-DD` entry, even one line ("No editor-visible changes. Bundles engine X.Y.Z."). An entry lists only what an extension user sees: diagnostics, hover, highlighting, completion, settings, fixes. A language change belongs there only if the extension surfaces it. To decide that, remember the language server calls the engine's `analyze()` (`packages/visimark-lsp/src/analysis.ts`), so an engine finding reaches the editor as a diagnostic unless the language server maps it away; CI cannot check this, the releaser does. `## Unreleased` is optional in the extension file. The check enforces presence, not accuracy.
   - "Rules that bite": add a row for the check; and reword the existing "Changelog dates are ISO 8601" row, which says the date rule is "unenforced here", since a release heading's date shape now is.
2. **`CONTRIBUTING.md`:** the "Every version-carrying file must agree" paragraph (line ~157) gains a sentence pointing at the changelog check.
3. **`.github/workflows/ci.yml`:** the new step and its comment block.
4. **`docs/vocabulary-catalogue.md`:** move the #131 row out of section F into the Shipped register as `UNRELEASED` (`Name`, `Kind`, `Request`, `Landed` = this PR, `Released` = `—`, `Decision` = the deciding comment), condensed to that table's columns.

Deliberately **not** updated: `CHANGELOG.md` and `editors/vscode/CHANGELOG.md` (`releasing.md`: a change that only touches CI needs no line unless a consumer can observe it, and none can), `docs/ci.md` (the consumer guide; it does not list this repository's own checks), `docs/cli-reference.md`, `README.md`, `.github/ISSUE_TEMPLATE/`, `docs/issue-runbook.md`.

## 8. Non-goals

- Checking that an entry is accurate, or that "No editor-visible changes" is true.
- Comparing the two changelogs' dates.
- Validating the date as a real calendar date.
- Checking the root file's `## Unreleased` section or its `[X.Y.Z]:` link reference.
- Checking that the tag equals the manifest version (`release.yml`'s concern).
- Generating either changelog from the other, or merging them.

## 9. Open questions

None.
