# VisiMark — code review: the Obsidian plugin, final

**Date:** 2026-09-27, updated same day · **Scope:** the "What's left" list of
[`2026-09-26-obsidian-plugin-followup.md`](2026-09-26-obsidian-plugin-followup.md)
(rows 14/23, 19, 22, plus the `vault.ts` comment), closed by
[PR #275](https://github.com/michal-niedzwiedzki/visimark/pull/275), merged
into `obsidian-integration` at `ab499cd`; then both of that follow-up's open
maintainer questions, decided the same day and closed by
[PR #278](https://github.com/michal-niedzwiedzki/visimark/pull/278), merged
at `d0b47d7`.

This is a close-out, not a fresh pass over the plugin: it verifies the rows
and the two decisions against the code that actually landed, and records the
defects a review caught along the way, rather than re-deriving everything the
prior two reviews already established.

## 1. What PR #275 closed

| Row | Fix | Verified |
|---|---|---|
| 22 — sweep pane rebuild | `SweepView.drawProgress` (`editors/obsidian/src/sweep-view.ts`) now builds the progress line and its **Stop** button once per pane, keyed on a `progressText` field cleared only when `container()` rebuilds the pane from under it; every later chunk callback updates the retained line's text instead of tearing the pane down. | Read. `bun test` has no dedicated UI test for this (the harness doesn't assert DOM node identity across calls here), but the diff is small and mechanical enough to read directly against the prior code. |
| 14/23 — `ADVICE` list and its false comment | `findings.ts`'s `forReader` now derives `severity` from the engine's own `isProblem()` (imported from `visimark`) instead of a second `ADVICE: ReadonlySet<FindingCode>`. The comment above it now states the true half of row 23's claim: severity agrees with the engine "by construction," and does, because the set is gone. | Reproduced. `findings.test.ts` still passes; `isProblem`'s codes (`STALE` plus the `ERROR_CODES` set) are unchanged, so `WARN`/`NOTE` still classify as advice and everything else as a problem — the same partition as before, now with one source of truth. |
| 23 — `vault.ts`'s CSV/`TFile` comment | The comment no longer claims a CSV import "is not a `TFile`." It now says what is actually true: the adapter fallback runs for any path `getAbstractFileByPath` doesn't resolve to a `TFile` — outside the vault, or not yet synced to its index — and an indexed CSV is a `TFile` like any other vault file and takes the `cachedRead` branch above it. | Read. `git diff` against `869a819` (the last commit before both reviews) is the whole change; no code path moved, only the doc comment. |
| 19 — API memoization | `api.ts`'s private `analyse` no longer runs its own read-imports-then-check pipeline per call. It now calls `analysis.ts`'s `analyseWithSnapshot(source, path, read)` — the same `(path, source)`-keyed cache the editor's renderers already share — instead of keeping a second one. | Reproduced. `api.test.ts`'s new "concurrent get calls for the same note share one analysis" case fetches a CSV-backed note through two concurrent `get()` calls and asserts the read count comes out under double the solo cost; it passes. |

Row 19's fix is the one worth a second look, because reusing an existing
cache instead of writing a new one is exactly the kind of move that can
introduce a defect the reused code never had to guard against — see below.

## 2. What review caught before merge: the reader-identity bug

CodeRabbit's review of PR #275 (commit `28f6e9d`) flagged that
`analyseWithSnapshot`'s cache — keyed on `(path, source)` alone — assumed
every caller shares one `VaultRead`. That assumption held for the cache's
original callers (`main.ts`, `reading-mode.ts`, `live-preview.ts`, `at-cursor.ts`),
which all close over the one running plugin's vault. It stopped holding the
moment `api.ts`'s `analyse` started calling it too: `createApi` takes its
`read` as a parameter specifically so `api.test.ts` can exercise it against a
`Map` rather than a real vault, and two `createApi` instances built over
*different* readers could — if they ever analysed the same `(path, source)`
concurrently — have the second silently receive the first's answer, imported
files and all. CodeRabbit graded it Major under "Data Integrity &
Integration," and the security-architecture pass on the same review called it
a low-severity, conditional exposure rather than a confirmed cross-vault
leak — correctly, since the running plugin only ever builds one reader; the
risk was to a caller (or a test) that builds more than one against the same
note.

Fixed in commit `cec74fc`, same PR: the cache key now also compares `read` by
reference, so two distinct readers can never collide regardless of what path
and source they happen to share. `analysis-snapshot.test.ts` gained a
regression case — two readers answering the same `(path, source)`
concurrently with different CSV contents, asserting both the distinct-object
result and the correct per-reader `disagrees`/`computed` verdict — and it
passes. The CodeRabbit thread was replied to and marked resolved before
merge.

This is the follow-up review's own point from row 12, still holding: a fix
commit in this layer is exactly where a new defect tends to land, and here it
was a second review pass — not the existing test harness — that caught it,
because the harness has no reason to construct two readers over one note
unless something asks it to.

## 3. Verification run against PR #275's merged state

- `bun test editors/obsidian` — **236 pass, 0 fail** (up from 234 at the
  prior follow-up; +1 for row 19's concurrency case, +1 for the
  reader-identity regression case).
- `bun test` (repo root) — **1883 pass, 0 fail**. No out-of-scope failures
  this time — the two the prior two reviews carried (`editors/vscode` needing
  a built `dist/`, the MCP spawn test needing Node on `PATH`) did not
  reproduce in this run's environment; nothing to do with this PR.
- `bun run typecheck` — clean across all seven workspaces.
- `bun run lint --max-warnings 0` — clean.
- `bun run format:check` — clean.
- `main.js` builds to **294.6 KB**, down from the prior review's 301,642
  bytes — row 19's fix deleted more duplicated pipeline code than the new
  test coverage added.
- CI on PR #275: all actionable checks green, including CodeRabbit's own
  gate, before merge.

## 4. What PR #278 closed: both open maintainer decisions

§3 of the 2026-09-26 follow-up left two questions open. The maintainer
decided both on 2026-09-27, and PR #278 built the decisions:

| Question | Decision | Verified |
|---|---|---|
| Whether advice deserves a vault-wide count | **Yes.** `SweepResult` gains `adviceOnly` (paths whose only findings are advice); `LiveVaultIndex` gains `adviceCount()`; the sweep pane's summary reports both counts, never folded together. | Reproduced. `sweep.test.ts`'s new cases assert `adviceOnly` lists the advice-only note and excludes it from `notes`, and that it's tracked separately even alongside a genuinely disagreeing note in the same sweep. |
| Which release-mechanics option to build | **Option C.** New `.github/workflows/obsidian-release.yml`: a bare-version tag verifies against `manifest.json`, builds `main.js`, and attaches it with `manifest.json`/`styles.css` to a GitHub Release. Confirmed against Obsidian's own release and submission docs before building, per the original review's §2.8 ask. | Read, plus a real external check: the tag-format and required-assets claims were verified against `docs.obsidian.md`'s own release and submission pages, not just against this repo's design doc, before the workflow was written. Not exercised by an actual tag push — no tag was pushed as part of either PR — so the workflow's happy path is validated by YAML parsing and by reading the steps, not by a live run. |

Building the advice-count feature surfaced a real inconsistency the follow-up
review's own scope (row 8, and its own note that `vault-index.ts`'s
`drawFromIndex` was "new v1.1 feature work, not a fix for this row") had
explicitly left unexamined: `LiveVaultIndex`'s incremental `verdictFor` used
`isClean` (advice *or* problems both counted as "not clean"), which
`seed()`'s own `sweep()`-derived data never would after row 8's fix. A note
edited into an advice-only state could show as "disagrees with itself" in the
live pane until the next full "Look again" silently dropped it — the same
shape of bug row 8 closed in the cold-scan path, latent in the incremental
one. Fixed in the same PR, because correctly implementing a *live* advice
count required `entries` and the new `advice` set to agree with `sweep()`
about what counts as which, and that agreement is what the fix is.
`vault-index.test.ts` gained cases for both directions (a note edited into and
out of advice-only) and for `remove()`.

CodeRabbit's review of PR #278 caught one more thing before merge:
`softprops/action-gh-release@v3` defaults `fail_on_unmatched_files` to
`false`, so a build that silently produced no `main.js` would still cut a
"successful" release missing the one file the registry actually installs.
Fixed in the same PR, same pattern as row 19's reader-identity bug in
PR #275 — a review catching a real defect in new code before it merged, not
after.

## 5. Verification run against PR #278's merged state

- `bun test editors/obsidian` — **241 pass, 0 fail** (up from 236 after
  PR #275; +5 for `adviceOnly`/`adviceCount` coverage in `sweep.test.ts` and
  `vault-index.test.ts`).
- `bun test` (repo root) — **1889 pass, 0 fail**.
- `bun run typecheck` / `lint --max-warnings 0` / `format:check` — all clean.
- `bun scripts/check-changelog-entries.ts` — clean; `editors/obsidian/CHANGELOG.md`
  gained two `## Unreleased` entries for this round.
- `main.js` builds to **295.2 KB** — up slightly from PR #275's 294.6 KB (the
  new advice-count tracking and summary text), still under the 301,642-byte
  margin recorded at the 2026-09-26 follow-up.
- CI on PR #278: all actionable checks green, including CodeRabbit's own
  gate, before merge. The one finding it raised (the missing-asset workflow
  bug in §4, above) was fixed and its thread resolved before merge.
- The new workflow itself was not exercised end to end — no tag was pushed
  by either PR — so "the release actually works" rests on reading the steps
  and validating the YAML, not on a live run. Recorded here rather than
  implied.

## 6. What is still open

Nothing. The 2026-09-26 follow-up's four "what's left" rows are closed
(PR #275), both of its open maintainer decisions are made and built
(PR #278), and every defect a review caught along either PR's way is closed
within that same PR. There is no further list to carry forward from this
review sequence.

One thing PR #278 named but did not build, on purpose: submitting the plugin
to the community registry for the first time needs a `manifest.json` at the
repository's default-branch root, which the registry's own review reads from
there — confirmed against `docs.obsidian.md`. That is a one-time, by-hand
step for the actual submission, recorded in `docs/design/obsidian-release-plan.md`
and `docs/releasing.md` so it isn't forgotten, not something either PR
automated, because nothing recurring depends on it.

## 7. Overall grade: **A**

Every row the prior review left open is closed and re-verified against the
code that actually merged, not trusted from a commit message; both
maintainer decisions the follow-up deliberately left open are now made and
built, with the design doc updated in place to say so rather than left
stale and contradicted by the workflow that shipped. The pattern worth
naming twice now: PR #275 introduced and closed a reader-identity cache bug
within itself, and PR #278 introduced and closed a missing-asset workflow
bug and a latent live-index inconsistency within itself. Three PRs into this
review sequence, that is no longer one clean instance — it is what this
project's review discipline is supposed to produce as a matter of course:
not the absence of defects in new code, but the absence of a defect
surviving past the PR that introduced it.
