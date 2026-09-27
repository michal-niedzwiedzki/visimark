# VisiMark — code review: the Obsidian plugin, final

**Date:** 2026-09-27 · **Scope:** the "What's left" list of
[`2026-09-26-obsidian-plugin-followup.md`](2026-09-26-obsidian-plugin-followup.md)
(rows 14/23, 19, 22, plus the `vault.ts` comment), closed by
[PR #275](https://github.com/michal-niedzwiedzki/visimark/pull/275), merged
into `obsidian-integration` at `ab499cd`.

This is a close-out, not a fresh pass over the plugin: it verifies the four
remaining rows against the code that actually landed, and records the one
defect a review caught along the way, rather than re-deriving everything the
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

## 3. Verification run against the merged state

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

## 4. What is still open, unchanged from the prior review

Nothing in PR #275 touched either open maintainer question from
§3 of the 2026-09-26 follow-up:

- Whether advice deserves a vault-wide count, beyond "a note whose only
  finding is advice is checked, but not listed."
- Which of the three drafted release-mechanics options
  (`docs/design/obsidian-release-plan.md`) to build before the
  community-registry submission.

Both remain maintainer decisions, not defects, and both are still marked
"not decided" in their own documents. There is no more "what's left" list to
carry forward: the 2026-09-26 follow-up's four open rows are closed, and the
one thing a review pass found along the way is closed too.

## 5. Overall grade: **A-**

Every row the prior review left open is now closed and re-verified against
the code that actually merged, not trusted from a commit message. The one
process worth naming is unusual for this project's own history: row 19's fix
introduced a real, if narrow, data-integrity defect — sharing an analysis
cache across callers with different readers — and it was caught and closed
*within the same PR*, before merge, rather than in a subsequent follow-up
review the way row 17's performance regression was. That is what the
harness-plus-review discipline this whole review sequence has been arguing
for is supposed to look like once it is working: not zero defects introduced,
but no defect surviving past the PR that introduced it.
