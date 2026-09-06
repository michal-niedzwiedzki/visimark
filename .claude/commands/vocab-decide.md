---
description: Decide a vocabulary-request issue — on APPROVED, draft the spec and implementation plan with the maintainer, post the decision, merge the catalogue PR, open a draft implementation PR, and on confirmation execute the plan and promote the PR once CI is green
argument-hint: <issue-number> [verdict and/or notes]
allowed-tools: Bash(gh:*), Bash(git:*), Bash(bun:*), Bash(bunx:*), Bash(mktemp:*), Bash(cat:*), Bash(mkdir:*), Read, Write, Edit, Glob, Grep, WebFetch, AskUserQuestion
---

You are running the **decision** stage of the vocabulary-review workflow.

Read first, every run:
- `docs/superpowers/specs/2026-09-06-vocabulary-review-workflow-design.md` — the design
- `docs/vocabulary-catalogue.md` — the register and its four criteria and status values
- `docs/visimark-design.md` — [§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design), [§4](../../docs/visimark-design.md#4-syntax), [§5](../../docs/visimark-design.md#5-dates), [§7](../../docs/visimark-design.md#7-numeric-semantics), [§9](../../docs/visimark-design.md#9-write-back), [§10](../../docs/visimark-design.md#10-error-taxonomy), [§13](../../docs/visimark-design.md#13-testing), [§14](../../docs/visimark-design.md#14-deferred)

Arguments: `$ARGUMENTS`
- First token: the issue number `<n>`.
- The rest: the maintainer's verdict and/or notes. May be empty — the steer can instead be in the issue comments or in this session's conversation.

## 1. Re-read

Run `git status --porcelain`; if non-empty, stop: "Working tree is dirty — commit or stash first."

- `gh issue view <n> --json number,title,body,labels,author,url,state`
- `gh issue view <n> --comments`

Read: the request, the pre-review comment if present (first line starts `**Automated pre-review**`), the discussion summary if present (first line starts `**Discussion summary**`), **every maintainer comment posted since**, the free-text argument, and the conversation preceding this command in the session.

Guard: refuse unless the issue has a `vocabulary` label **and** a title starting `vocabulary: `.

Recompute `<slug>` from the `Name` field (lowercase, non-`[a-z0-9]` runs → `-`, trim; fall back to the `Kind` word).

## 2. Evaluate

- **Pre-review exists** → reconcile it with the maintainer's input. On any conflict the maintainer wins.
- **No pre-review** → run the rubric now: in scope; criterion 1 shape ([§4](../../docs/visimark-design.md#4-syntax)); criterion 2 document-local ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraint 4); criterion 3 no ambiguity ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraint 3); criterion 4 a real document needs it ([§14](../../docs/visimark-design.md#14-deferred)); overlap with the nine builtins / operators / existing rows; precision cost ([§7](../../docs/visimark-design.md#7-numeric-semantics)).

Settle on `APPROVED` / `DEFERRED` / `REJECTED` and the reason, citing the design-doc section that governs.

**Order from here:** for `DEFERRED` / `REJECTED`, skip to step 4. For `APPROVED`, step 3 must complete — a handoff-ready spec — **before** step 4 posts anything or step 5 merges anything.

## 3. Draft the spec — APPROVED only

The approval is not landed until a feature spec exists that an
implementation-plan writer (`superpowers:writing-plans`) can consume without
coming back with questions. Draft it now, with the maintainer.

### 3.1 First draft

Guard: if `vocab/issue-<n>-<slug>-impl` already exists on the remote
(`gh pr list --search "head:vocab/issue-<n>-<slug>-impl" --state all --json number,url,state`),
a spec PR is already open — note it, skip to step 4, and in step 7 update that
branch's `docs/vocab/<slug>-spec.md` instead of creating a new PR.

Build the draft in a temp file — **do not touch the working tree yet**. Source
material: the issue form fields (`Name`, `Kind`, `Signature and shape`,
`What it does` with its worked values, `The real document that needs it`,
`Constraint check`, `Anything else`), the pre-review, the discussion summary,
and this session's conversation.

House design-doc style — prose sections and tables, like `docs/visimark-design.md`.
Header:

```
# <Name> — feature spec

**Status:** approved (#<n>) · **Date:** <today> · **Decision:** <deciding-comment-url once step 4 has run; leave a placeholder until then>
```

Sections, in order:
1. **Purpose** — what the primitive is; the document that motivated it (quote the `#…` block from the issue); why existing vocabulary does not reach it. A paragraph each.
2. **Signature and shape** — `<Name>(args) -> <type>`; map or reduce; exact arity; each argument's type. Cite [§4](../../docs/visimark-design.md#4-syntax).
3. **Semantics** — a table, one row per behavioural case, each with a worked input → output. Cover the normal case; boundary inputs (zero, negative, empty); everything the arithmetic makes special (year / "month" / leap boundaries for a date primitive; empty column for a reduce; precision for a number primitive). Every worked value in the issue appears here, plus the ones the issue did not think of.
4. **Type rules and errors** — wrong arity, wrong operand types, and any argument that must be further constrained (e.g. integer-only). Name the [§10](../../docs/visimark-design.md#10-error-taxonomy) error code for each; cite [§4](../../docs/visimark-design.md#4-syntax) for static arity/shape checking.
5. **Interaction with the rest of the language** — dates [§5](../../docs/visimark-design.md#5-dates) (does the result feed `date ± number`, sorting, anchors?), numeric semantics and write precision [§7](../../docs/visimark-design.md#7-numeric-semantics), write-back [§9](../../docs/visimark-design.md#9-write-back), name resolution [§6](../../docs/visimark-design.md#6-name-resolution-and-scoping), units [§7](../../docs/visimark-design.md#7-numeric-semantics) where relevant. State explicitly what does **not** change.
6. **Acceptance** — in [§13](../../docs/visimark-design.md#13-testing) style: the new fixture or the edit to an existing example document, and the exact `visimark check` / `eval` output it must produce. This is what the plan turns into a test.
7. **Non-goals** — adjacent things this spec does not cover, especially anything the deciding comment carved out.
8. **Open questions** — must be **empty** before handoff. Anything left here blocks step 4.

### 3.2 Gap hunt

Walk this checklist against the draft and turn every gap into a concrete question:

- Is every argument's type pinned — including "integer, not merely number" where it matters?
- Every boundary — zero / negative / empty / overflow / leap / out-of-range component — is the result **specified**, not implied?
- For each error case, is the [§10](../../docs/visimark-design.md#10-error-taxonomy) code chosen (not "an error")?
- Does the result type compose with what the motivating document then does with it (arithmetic, sort, anchor)?
- Write precision / decoration: what does a written cell or anchor look like?
- Does `visimark infer` need to know about it? `explain`? the did-you-mean list once the name is known?
- Acceptance: is the expected tool output written out literally, or still hand-wavy?
- Anything the pre-review, the discussion, or the deciding reasoning raised that the draft does not answer.

### 3.3 Resolve with the maintainer

Put the gaps to the maintainer — `AskUserQuestion` for choices with discrete
options, plain prose for the open ones. Fold each answer into the draft. Repeat
3.2–3.3 until the checklist is clean and **Open questions** is empty.

Then show the full spec in a chat message and ask via `AskUserQuestion` —
"Spec ready to hand off?": **Ready** / **Keep editing** / **Change the verdict**.

- **Keep editing** → back to 3.3.
- **Change the verdict** → the maintainer is no longer approving; return to step 2 with their new steer.
- **Ready** → keep the finalised spec text in the temp file; continue to step 4.

## 4. Deciding comment

Author it in the maintainer's voice, first person. Structure:
- First line, verbatim: `Decision: <APPROVED|DEFERRED|REJECTED>.`
- The reason, in the catalogue's idiom, with the design-doc citation.
- One sentence naming any divergence from the pre-review ("The pre-review leaned DEFERRED; deciding APPROVED because …").
- For `APPROVED`, one line: `Spec: to be committed on `vocab/issue-<n>-<slug>-impl`.`
- If a pre-review existed, a final line: `Pre-review: <link to that comment>`.

Write it to a temp file, post with `gh issue comment <n> --body-file <file>`, then capture the URL:
`gh issue view <n> --json comments -q '.comments[-1].url'`. For `APPROVED`, substitute this URL into the spec header's `**Decision:**` placeholder.

## 5. Catalogue PR

Locate this issue's row in `docs/vocabulary-catalogue.md` (the row whose Request cell links `#<n>`).

Check PR #1: `gh pr list --search "head:vocab/issue-<n>-<slug>" --state all --json number,state,headRefName`.

- **Row already on `master`** (PR #1 merged, or added by an earlier decide run):
  `git fetch origin && git switch -c vocab/issue-<n>-<slug>-decision origin/master`
- **PR #1 open**:
  `git fetch origin && git switch vocab/issue-<n>-<slug>` (check it out from the remote)
- **No row anywhere** (review was skipped):
  `git fetch origin && git switch -c vocab/issue-<n>-<slug> origin/master`, and add the full row.

Edit the row **in its A–C section table**: fill `Pros` / `Cons` from the decided reasoning; set `Status` to `[<VERDICT>](<deciding-comment-url>)`. Keep `Request` as `[#<n>](<url>)`. For `APPROVED` the row stays in the section table here — step 8's documentation task later moves it, condensed, into the Shipped register. `DEFERRED` / `REJECTED` rows stay in the section table permanently.

```bash
git add docs/vocabulary-catalogue.md
git commit -m "$(printf 'docs: decide #%s (%s) — %s\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>' <n> <Name> <VERDICT>)"
git push -u origin HEAD
```

- **New branch** → `gh pr create --base master --title "Catalogue #<n>: <Name> (<VERDICT>)" --body "$(printf '%s\n\n%s\n\nDeciding comment: %s\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)' '<the decision>' '<the reason>' '<comment-url>')"`
- **Existing PR #1** → the push updates it; `gh pr edit <num> --title "Catalogue #<n>: <Name> (<VERDICT>)"` and append the decision to its body with `gh pr edit <num> --body ...`.

Do **not** put `closes #<n>` anywhere in the PR body — the issue's state is set explicitly in step 6, not by a merge keyword.

`git switch -`.

## 6. Land the decision

Every verdict is recorded as a catalogue row — the catalogue exists so a "no"
has a citable reason too — so the PR is **merged in all three cases**, never
closed unmerged.

1. **Merge, quoting the decision.** Write the merge-commit body to a temp file:
   the line `Decision: <VERDICT>. <comment-url>`, a blank line, then the full
   deciding comment with every line prefixed `> `. Then:
   ```bash
   gh pr merge <num> --merge --delete-branch \
     --subject "docs: decide #<n> (<Name>) — <VERDICT>" \
     --body-file <file>
   ```
   If `gh pr merge` fails (merge conflict, or a required check not green), stop:
   print the PR URL and the error, say "resolve and merge by hand, then re-run
   `/vocab-decide <n>`", and do nothing else. Never `--admin`, never force.
2. **Set the issue state:**
   - `APPROVED` → leave it **open**; continue to step 7. It is closed
     automatically when the primitive ships in a tagged release
     (`.github/workflows/release.yml`; see `docs/releasing.md`) — never close it
     by hand here.
   - `DEFERRED` / `REJECTED` → close it and **stop**:
     `gh issue close <n> --reason "not planned" --comment "$(printf 'Catalogued %s — see %s\n\nReopen only with new information.' <VERDICT> '<comment-url>')"`
     Print: the deciding-comment URL, the merged-PR URL, and "Issue closed."

## 7. Open the implementation PR — APPROVED only

Only after the catalogue PR is merged.

```bash
git fetch origin
git switch -c vocab/issue-<n>-<slug>-impl origin/master   # or: git switch to the existing branch (3.1 guard)
mkdir -p docs/vocab
```

Write the finalised step-3 spec to `docs/vocab/<slug>-spec.md` (the header's
`**Decision:**` now carries the real comment URL). The `-spec` suffix mirrors
the `-plan` suffix step 8 uses for the implementation plan.

```bash
git add docs/vocab/<slug>-spec.md
git commit -m "$(printf 'docs: spec for #%s (%s)\n\nApproved on #%s. Feature spec for handoff to an implementation plan.\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>' <n> <Name> <n>)"
git push -u origin HEAD
```

- **New branch** →
  `gh pr create --draft --base master --title "Spec #<n>: <Name>" --body "$(printf 'Feature spec for `%s`, approved on #%s.\n\nDeciding comment: %s\n\n**Draft** until the implementation is complete and CI is green — it holds the spec now, then the plan, then the code. The plan (superpowers:writing-plans) and the code follow on this branch.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)' '<Name>' <n> '<comment-url>')"`
- **Existing `-impl` PR** (3.1 guard) → the push updates it; no new PR. If it was promoted out of draft by an earlier run, leave it as it is.

The PR is opened **as a draft** and stays a draft through steps 8 and 9 — only
step 9, on a full green build with passing CI, promotes it with `gh pr ready`.

No `closes #<n>` — #<n> stays open and now also tracks this PR.

Stay on `vocab/issue-<n>-<slug>-impl` and continue to step 8.

## 8. Implementation plan — APPROVED only

Ask the maintainer via `AskUserQuestion` — "Write the implementation plan now?":
**Write it** / **Not now**.

- **Not now** → `git switch -`; print the deciding-comment URL, the merged
  catalogue-PR URL and the spec-PR URL, and: "Issue #<n> stays open. The draft
  PR holds the spec; write the plan later with `superpowers:writing-plans`."
  Stop.

- **Write it** → draft the plan against the finalised step-3 spec, in the
  `superpowers:writing-plans` house format — `Goal`, `Architecture`,
  `Tech Stack`, a `Spec:` link to `docs/vocab/<slug>-spec.md`, `Global Constraints`,
  then checkbox `Task` sections each with `Files`, `Interfaces`, and `Step`s.

  **While drafting, do not silently fill a gap the spec does not settle.** Any
  decision you cannot infer with high confidence — module boundaries and which
  files change, where the primitive's classification row goes in
  `eval/functions.ts`, test-file layout and fixtures, evaluation-order and
  error-suppression edge handling, exact error-message wording, whether an
  example document is edited or a new one added — is put to the maintainer
  (`AskUserQuestion` for discrete choices, prose otherwise) and folded in.
  Iterate until nothing low-certainty remains.

  The plan's **final task is always "documentation"**, and it must list, at
  minimum: the `visimark-design.md` [§4](../../docs/visimark-design.md#4-syntax) builtin table (or the relevant section);
  a `CHANGELOG.md` entry under `## Unreleased` → `### Added` (and a one-line
  `editors/vscode/CHANGELOG.md` entry when the LSP/extension surface changes —
  e.g. a name that used to flag as unknown no longer does); the
  `vocabulary-catalogue.md` row **moved out of its A–C section table into the
  Shipped register** as `UNRELEASED` — condensed to that table's columns
  (`Name`, `Kind`, `Request`, `Landed` = this PR, `Released` = `—`, `Decision` =
  the deciding comment), dropping the `Pros` / `Cons` prose; and
  `docs/cli-reference.md` if it enumerates the changed surface. A merged
  implementation PR with no `## Unreleased` line is a bug in the plan.

  The row stays `UNRELEASED` until a tagged release ships it — `releasing.md`
  fills its `Released` cell and `release.yml` closes issue #<n>. Neither the
  plan nor this command promotes it to `SHIPPED` or closes the issue.

  Then:
  ```bash
  git add docs/vocab/<slug>-plan.md
  git commit -m "$(printf 'docs: implementation plan for #%s (%s)\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>' <n> <Name>)"
  git push
  ```
  The push updates the spec PR, which now carries the spec and the plan. Stay on
  `vocab/issue-<n>-<slug>-impl` and continue to step 9.

## 9. Implement — APPROVED only

Ask the maintainer via `AskUserQuestion` — "Start implementation now?":
**Start** / **Not now**.

- **Not now** → `git switch -`; print the deciding-comment URL, the merged
  catalogue-PR URL and the spec-PR URL, and: "Draft PR ready on <spec-PR>.
  Execute the plan with `superpowers:executing-plans` when ready." Stop.

- **Start** → on `vocab/issue-<n>-<slug>-impl`, invoke **`superpowers:executing-plans`**
  against `docs/vocab/<slug>-plan.md` and work it task by task under that skill's
  discipline, **including the final documentation task** (design doc,
  `CHANGELOG.md` `## Unreleased`, catalogue row → Shipped register as
  `UNRELEASED`, cli-reference). After
  each task, and again at the end, run the full local checks — `bun test`,
  `bun run typecheck` and `bun run build` from the repo root, plus
  `bun run packages/visimark/src/cli/main.ts check` on every example document
  the plan protects (`bunx visimark` runs the *published* build, not the branch
  — do not use it here). **Loop check → fix → check until everything is green.**
  Do not stop on a red suite, a skipped task, or a `.skip`/`.only` left in a
  test; do not loosen an assertion or delete a failing test to pass.

  When the plan is complete and green locally:
  ```bash
  git push
  ```
  Then **wait for CI on the pushed commit** — `gh pr checks <spec-PR> --watch`.
  - **All checks pass** → promote the PR: `gh pr ready <spec-PR>`. `git switch -`.
    Print: the deciding-comment URL, the merged catalogue-PR URL, the now-ready
    PR URL, the final `bun test` summary, the CI conclusion, and: "PR promoted
    from draft — review and merge to ship `<Name>`. The catalogue row is
    `UNRELEASED`; issue #<n> closes and the row promotes to `SHIPPED` when the
    next release tag ships it."
  - **A check fails** → treat it as part of the loop: fix, commit, push, wait
    again. The PR **stays a draft** until CI is green.

If execution cannot reach green because of a design gap the plan did not
foresee, **stop**: push what is committed, leave the PR a **draft**, add a
comment on it naming the blocker, and tell the maintainer — never force a merge,
promote a red PR, or weaken a test to get past it.

## 10. Reopen note

If the issue already had a `Decision:` comment (this is a re-decision with new
information), everything above still holds: reopen the issue first if it was
closed (`gh issue reopen <n>`), post the new `Decision:` comment, and the
catalogue PR **edits the existing row** — never add a second row. If the
re-decision lands on `APPROVED` and `vocab/issue-<n>-<slug>-impl` already
exists, steps 7–9 commit the revised `docs/vocab/<slug>-spec.md` (and
`-plan.md` / implementation if present) onto it rather than opening a second PR.
A row already condensed into the Shipped register stays there — the re-decision
edits it in place, never restores a section-table row.
