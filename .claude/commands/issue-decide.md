---
description: Decide a GitHub issue — a vocabulary request or any other design/tooling issue. On APPROVED, draft the spec and implementation plan with the maintainer, post the decision, merge the catalogue PR, open a draft implementation PR, and on confirmation execute the plan and promote the PR once CI is green
argument-hint: <issue-number> [verdict and/or notes]
allowed-tools: Bash(gh:*), Bash(git:*), Bash(bun:*), Bash(bunx:*), Bash(mktemp:*), Bash(cat:*), Bash(mkdir:*), Read, Write, Edit, Glob, Grep, WebFetch, AskUserQuestion
---

You are running the **decision** stage of the issue-review workflow.

Read first, every run:
- `.claude/rules/ai-attribution.md` — commit / PR trailer for **this** session (never copy a hardcoded Claude line)
- `docs/superpowers/specs/2026-09-06-vocabulary-review-workflow-design.md` — the design
- `docs/vocabulary-catalogue.md` — the register, its four vocabulary criteria, its status values, and sections E–F for everything else
- `docs/visimark-design.md` — [§1](../../docs/visimark-design.md#1-purpose), [§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design), [§4](../../docs/visimark-design.md#4-syntax), [§5](../../docs/visimark-design.md#5-dates), [§7](../../docs/visimark-design.md#7-numeric-semantics), [§9](../../docs/visimark-design.md#9-write-back), [§10](../../docs/visimark-design.md#10-error-taxonomy), [§13](../../docs/visimark-design.md#13-testing), [§14](../../docs/visimark-design.md#14-deferred)

Arguments: `$ARGUMENTS`
- First token: the issue number `<n>`.
- The rest: the maintainer's verdict and/or notes. May be empty — the steer can instead be in the issue comments or in this session's conversation.

## 1. Re-read

Run `git status --porcelain`; if non-empty, stop: "Working tree is dirty — commit or stash first."

- `gh issue view <n> --json number,title,body,labels,author,url,state`
- `gh issue view <n> --comments`

Read: the request, the pre-review comment if present (first line starts `**Automated pre-review**`), the discussion summary if present (first line starts `**Discussion summary**`), **every maintainer comment posted since**, the free-text argument, and the conversation preceding this command in the session.

**Pick the track** (same rule as `/issue-review`):
- **VOCAB track** — *both* a label exactly `vocabulary` and a title starting `vocabulary: `.
- **GENERAL track** — anything else.

There is no label/title guard beyond this — any open issue can be decided. If the GENERAL-track issue is really a single vocabulary primitive (see `/issue-review` §2G.1), stop and tell the maintainer to refile it on the template; do not decide it here.

**Slug and branch.**
- VOCAB: `<slug>` from the `Name` field (lowercase, non-`[a-z0-9]` runs → `-`, trim; fall back to the `Kind` word). Branches `vocab/issue-<n>-<slug>`, `vocab/issue-<n>-<slug>-impl`. Spec at `docs/vocab/<slug>-spec.md`, plan at `docs/vocab/<slug>-plan.md`.
- GENERAL: `<slug>` from the issue title (strip a leading `feature:`/`bug:`/`docs:`; lowercase; non-`[a-z0-9]` runs → `-`; trim; cap ~40 chars). Branches `issue/<n>-<slug>`, `issue/<n>-<slug>-impl`. Spec at `docs/design/<slug>-spec.md`, plan at `docs/design/<slug>-plan.md`.

## 2. Evaluate

- **Pre-review exists** → reconcile it with the maintainer's input. On any conflict the maintainer wins.
- **No pre-review** → run the rubric now:
  - **VOCAB**: in scope; criterion 1 shape ([§4](../../docs/visimark-design.md#4-syntax)); criterion 2 document-local ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraint 4); criterion 3 no ambiguity ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraint 3); criterion 4 a real document needs it ([§14](../../docs/visimark-design.md#14-deferred)); overlap with the builtins / operators / existing rows; precision cost ([§7](../../docs/visimark-design.md#7-numeric-semantics)).
  - **GENERAL**: in scope ([§1](../../docs/visimark-design.md#1-purpose) purpose and non-goals); the four [§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraints and the no-plugin rule; shape system ([§4](../../docs/visimark-design.md#4-syntax)) where expressions are touched; diffability ([§9](../../docs/visimark-design.md#9-write-back)); overlap with existing behaviour and every catalogue row including E–F; cost / precision ([§7](../../docs/visimark-design.md#7-numeric-semantics)).

Settle on `APPROVED` / `DEFERRED` / `REJECTED` and the reason, citing the design-doc section that governs.

**Order from here:** for `DEFERRED` / `REJECTED`, skip to step 4. For `APPROVED`, step 3 must complete — a handoff-ready spec — **before** step 4 posts anything or step 5 merges anything.

## 3. Draft the spec — APPROVED only

The approval is not landed until a feature spec exists that an
implementation-plan writer (`superpowers:writing-plans`) can consume without
coming back with questions. Draft it now, with the maintainer.

### 3.1 First draft

Guard: if the `-impl` branch already exists on the remote
(`gh pr list --search "head:<impl-branch>" --state all --json number,url,state`),
a spec PR is already open — note it, skip to step 4, and in step 7 update that
branch's spec file instead of creating a new PR.

Build the draft in a temp file — **do not touch the working tree yet**. Source
material: the issue body (VOCAB: the form fields; GENERAL: the proposal and its
motivating case), the pre-review, the discussion summary, and this session's
conversation.

House design-doc style — prose sections and tables, like `docs/visimark-design.md`.
Header:

```
# <Name> — feature spec

**Status:** approved (#<n>) · **Date:** <today> · **Decision:** <deciding-comment-url once step 4 has run; leave a placeholder until then>
```

**VOCAB sections**, in order:
1. **Purpose** — what the primitive is; the document that motivated it (quote the `#…` block from the issue); why existing vocabulary does not reach it.
2. **Signature and shape** — `<Name>(args) -> <type>`; map or reduce; exact arity; each argument's type. Cite [§4](../../docs/visimark-design.md#4-syntax).
3. **Semantics** — a table, one row per behavioural case, each with a worked input → output. Normal case; boundary inputs (zero, negative, empty); everything the arithmetic makes special. Every worked value in the issue appears here, plus the ones the issue did not think of.
4. **Type rules and errors** — wrong arity, wrong operand types, any argument that must be further constrained. Name the [§10](../../docs/visimark-design.md#10-error-taxonomy) code for each; cite [§4](../../docs/visimark-design.md#4-syntax) for static arity/shape checking.
5. **Interaction with the rest of the language** — dates [§5](../../docs/visimark-design.md#5-dates), numeric semantics and write precision [§7](../../docs/visimark-design.md#7-numeric-semantics), write-back [§9](../../docs/visimark-design.md#9-write-back), name resolution [§6](../../docs/visimark-design.md#6-name-resolution-and-scoping), units [§7](../../docs/visimark-design.md#7-numeric-semantics). State explicitly what does **not** change.
6. **Acceptance** — in [§13](../../docs/visimark-design.md#13-testing) style: the new fixture or the edit to an existing example document, and the exact `visimark check` / `eval` output it must produce.
7. **Non-goals** — adjacent things this spec does not cover.
8. **Open questions** — must be **empty** before handoff.

**GENERAL sections** (language feature), in order:
1. **Purpose** — what the feature is; the motivating document or scenario (quote it); what a document cannot express or verify without it; why existing features do not reach it.
2. **Syntax** — the exact surface: the grammar addition, where it may appear, what it binds or produces, and how it reads in an unmodified renderer (constraint 1, [§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design)).
3. **Semantics** — a table, one row per behavioural case, worked input → output. Normal case; every boundary; interaction with rounding ([§7](../../docs/visimark-design.md#7-numeric-semantics)) and with vectors vs scalars ([§4](../../docs/visimark-design.md#4-syntax)).
4. **Type rules and errors** — every failure mode with its [§10](../../docs/visimark-design.md#10-error-taxonomy) code (a new code if the taxonomy needs one — say so); static vs evaluation-time; suppression behaviour under an upstream error ([§8](../../docs/visimark-design.md#8-evaluation)).
5. **Interaction with the rest of the language** — the shape system [§4](../../docs/visimark-design.md#4-syntax), evaluation and the dependency graph [§8](../../docs/visimark-design.md#8-evaluation), write-back [§9](../../docs/visimark-design.md#9-write-back) (does the tool now own anything new? does `fmt` touch it?), anchors ([§3](../../docs/visimark-design.md#3-document-model)), name resolution [§6](../../docs/visimark-design.md#6-name-resolution-and-scoping), and every CLI surface — `check`, `fmt`, `infer`, `explain`, `eval`, `--json`. State explicitly what does **not** change.
6. **Acceptance** — in [§13](../../docs/visimark-design.md#13-testing) style: the new fixture or the edit to an example document (the drift invoice's `#recon` sheet is the obvious home for an invariant check), and the exact tool output it must produce.
7. **Non-goals** — adjacent things this spec does not cover, especially anything the deciding comment carved out for a later issue.
8. **Open questions** — must be **empty** before handoff.

### 3.2 Gap hunt

Walk this checklist against the draft and turn every gap into a concrete question:

- Is every type pinned — argument types, result type, "integer not merely number" where it matters?
- Every boundary — zero / negative / empty / overflow / leap / out-of-range / rounding edge — is the result **specified**, not implied?
- For each error case, is the [§10](../../docs/visimark-design.md#10-error-taxonomy) code chosen (not "an error"), and is a **new** code called out if one is needed?
- (GENERAL) Does the new surface compose with anchors, `fmt` write-back, and the dependency graph? Is its behaviour under an upstream error specified?
- Does the result type compose with what the motivating document then does with it?
- Write precision / decoration: what does a written cell or anchor look like?
- Does `visimark infer` need to know about it? `explain`? `--json`? the did-you-mean list once a new name is known?
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
- For `APPROVED`, one line: `Spec: to be committed on <impl-branch>.`
- If a pre-review existed, a final line: `Pre-review: <link to that comment>`.

Write it to a temp file, post with `gh issue comment <n> --body-file <file>`, then capture the URL:
`gh issue view <n> --json comments -q '.comments[-1].url'`. For `APPROVED`, substitute this URL into the spec header's `**Decision:**` placeholder.

## 5. Catalogue PR

Locate this issue's row in `docs/vocabulary-catalogue.md` (the row whose Request cell links `#<n>`) — sections A–D for a vocab primitive, E for a language feature, F for tooling / process.

Check the review PR: `gh pr list --search "head:<review-branch>" --state all --json number,state,headRefName` (`<review-branch>` is `vocab/issue-<n>-<slug>` or `issue/<n>-<slug>`).

- **Row already on `master`** (review PR merged, or added by an earlier decide run):
  `git fetch origin && git switch -c <review-branch>-decision origin/master`
- **Review PR open**:
  `git fetch origin && git switch <review-branch>` (check it out from the remote)
- **No row anywhere** (review was skipped):
  `git fetch origin && git switch -c <review-branch> origin/master`, and add the full row.

Edit the row **in its section table**: fill `Pros` / `Cons` (or `Cons` / the equivalent columns for E–F) from the decided reasoning; set `Status` to `[<VERDICT>](<deciding-comment-url>)`. Keep `Request` as `[#<n>](<url>)`. For `APPROVED` the row stays in the section table here — step 8's documentation task later moves it, condensed, into the Shipped register. `DEFERRED` / `REJECTED` rows stay in the section table permanently.

```bash
git add docs/vocabulary-catalogue.md
git commit -m "$(printf 'docs: decide #%s (%s) — %s\n\n%s' <n> '<name>' <VERDICT> '<attribution-trailer>')"
git push -u origin HEAD
```
`<attribution-trailer>` is the `Co-Authored-By:` line from `.claude/rules/ai-attribution.md` for this session.

- **New branch** → `gh pr create --base master --title "Catalogue #<n>: <name> (<VERDICT>)" --body "$(printf '%s\n\n%s\n\nDeciding comment: %s' '<the decision>' '<the reason>' '<comment-url>')"` — no vendor footer unless the attribution rule says this session owns one.
- **Existing review PR** → the push updates it; `gh pr edit <num> --title "Catalogue #<n>: <name> (<VERDICT>)"` and append the decision to its body with `gh pr edit <num> --body ...`.

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
     --subject "docs: decide #<n> (<name>) — <VERDICT>" \
     --body-file <file>
   ```
   If `gh pr merge` fails (merge conflict, or a required check not green), stop:
   print the PR URL and the error, say "resolve and merge by hand, then re-run
   `/issue-decide <n>`", and do nothing else. Never `--admin`, never force.
2. **Set the issue state:**
   - `APPROVED` → leave it **open**; continue to step 7. It is closed
     automatically when the change ships in a tagged release
     (`.github/workflows/release.yml`; see `docs/releasing.md`) — never close it
     by hand here.
   - `DEFERRED` / `REJECTED` → close it and **stop**:
     `gh issue close <n> --reason "not planned" --comment "$(printf 'Catalogued %s — see %s\n\nReopen only with new information.' <VERDICT> '<comment-url>')"`
     Print: the deciding-comment URL, the merged-PR URL, and "Issue closed."

## 7. Open the implementation PR — APPROVED only

Only after the catalogue PR is merged.

```bash
git fetch origin
git switch -c <impl-branch> origin/master   # or: git switch to the existing branch (3.1 guard)
mkdir -p docs/vocab   # VOCAB;  or:  mkdir -p docs/design   # GENERAL
```

Write the finalised step-3 spec to the spec path (VOCAB: `docs/vocab/<slug>-spec.md`; GENERAL: `docs/design/<slug>-spec.md`). The header's `**Decision:**` now carries the real comment URL. The `-spec` suffix mirrors the `-plan` suffix step 8 uses.

```bash
git add <spec-path>
git commit -m "$(printf 'docs: spec for #%s (%s)\n\nApproved on #%s. Feature spec for handoff to an implementation plan.\n\n%s' <n> '<name>' <n> '<attribution-trailer>')"
git push -u origin HEAD
```

- **New branch** →
  `gh pr create --draft --base master --title "Spec #<n>: <name>" --body "$(printf 'Feature spec for `%s`, approved on #%s.\n\nDeciding comment: %s\n\n**Draft** until the implementation is complete and CI is green — it holds the spec now, then the plan, then the code.' '<name>' <n> '<comment-url>')"`
- **Existing `-impl` PR** (3.1 guard) → the push updates it; no new PR. If it was promoted out of draft by an earlier run, leave it as it is.

The PR is opened **as a draft** and stays a draft through steps 8 and 9 — only
step 9, on a full green build with passing CI, promotes it with `gh pr ready`.

No `closes #<n>` — #<n> stays open and now also tracks this PR.

Stay on `<impl-branch>` and continue to step 8.

## 8. Implementation plan — APPROVED only

Ask the maintainer via `AskUserQuestion` — "Write the implementation plan now?":
**Write it** / **Not now**.

- **Not now** → `git switch -`; print the deciding-comment URL, the merged
  catalogue-PR URL and the spec-PR URL, and: "Issue #<n> stays open. The draft
  PR holds the spec; write the plan later with `superpowers:writing-plans`."
  Stop.

- **Write it** → draft the plan against the finalised step-3 spec, in the
  `superpowers:writing-plans` house format — `Goal`, `Architecture`,
  `Tech Stack`, a `Spec:` link to the spec file, `Global Constraints`,
  then checkbox `Task` sections each with `Files`, `Interfaces`, and `Step`s.
  Global Constraints must require the commit trailer from
  `.claude/rules/ai-attribution.md`; do not hardcode a vendor name into the
  plan.

  **While drafting, do not silently fill a gap the spec does not settle.** Any
  decision you cannot infer with high confidence — module boundaries and which
  files change, where a new function's classification row goes in
  `eval/functions.ts` (VOCAB), where new grammar lives in `lang/` (GENERAL),
  test-file layout and fixtures, evaluation-order and error-suppression edge
  handling, exact error-message wording, whether an example document is edited
  or a new one added — is put to the maintainer (`AskUserQuestion` for discrete
  choices, prose otherwise) and folded in. Iterate until nothing low-certainty
  remains.

  The plan's **final task is always "documentation"**, and it must list, at
  minimum:
  - the relevant `visimark-design.md` section — the [§4](../../docs/visimark-design.md#4-syntax) builtin table for a VOCAB primitive; the section(s) the feature changes for a GENERAL feature (syntax [§4](../../docs/visimark-design.md#4-syntax), evaluation [§8](../../docs/visimark-design.md#8-evaluation), the [§10](../../docs/visimark-design.md#10-error-taxonomy) taxonomy table if a finding is added, [§14](../../docs/visimark-design.md#14-deferred) if it clears a deferred item);
  - a `CHANGELOG.md` entry under `## Unreleased` → `### Added` (and a one-line `editors/vscode/CHANGELOG.md` entry when the LSP/extension surface changes — e.g. a name that used to flag as unknown no longer does, or a new diagnostic);
  - the `vocabulary-catalogue.md` row **moved out of its section table into the Shipped register** as `UNRELEASED` — condensed to that table's columns (`Name`, `Kind`, `Request`, `Landed` = this PR, `Released` = `—`, `Decision` = the deciding comment), dropping the prose columns;
  - `docs/cli-reference.md` if it enumerates the changed surface;
  - `docs/issue-review.md` and this command / `issue-review.md` if the change is `tooling / process` and alters the workflow they describe.
  A merged implementation PR with no `## Unreleased` line is a bug in the plan.

  The row stays `UNRELEASED` until a tagged release ships it — `releasing.md`
  fills its `Released` cell and `release.yml` closes issue #<n>. Neither the
  plan nor this command promotes it to `SHIPPED` or closes the issue.

  Then:
  ```bash
  git add <plan-path>
  git commit -m "$(printf 'docs: implementation plan for #%s (%s)\n\n%s' <n> '<name>' '<attribution-trailer>')"
  git push
  ```
  The push updates the spec PR, which now carries the spec and the plan. Stay on
  `<impl-branch>` and continue to step 9.

## 9. Implement — APPROVED only

Ask the maintainer via `AskUserQuestion` — "Start implementation now?":
**Start** / **Not now**.

- **Not now** → `git switch -`; print the deciding-comment URL, the merged
  catalogue-PR URL and the spec-PR URL, and: "Draft PR ready on <spec-PR>.
  Execute the plan with `superpowers:executing-plans` when ready." Stop.

- **Start** → on `<impl-branch>`, invoke **`superpowers:executing-plans`**
  against the plan file and work it task by task under that skill's
  discipline, **including the final documentation task**. After
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
    from draft — review and merge to ship `<name>`. The catalogue row is
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
re-decision lands on `APPROVED` and `<impl-branch>` already exists, steps 7–9
commit the revised spec (and plan / implementation if present) onto it rather
than opening a second PR. A row already condensed into the Shipped register
stays there — the re-decision edits it in place, never restores a section-table
row.
