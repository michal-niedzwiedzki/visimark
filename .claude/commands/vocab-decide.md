---
description: Record the maintainer's decision on a vocabulary-request issue — a Decision comment and the catalogue PR
argument-hint: <issue-number> [verdict and/or notes]
allowed-tools: Bash(gh:*), Bash(git:*), Bash(bunx:*), Bash(mktemp:*), Bash(cat:*), Read, WebFetch
---

You are running the **decision** stage of the vocabulary-review workflow.

Read first, every run:
- `docs/superpowers/specs/2026-09-06-vocabulary-review-workflow-design.md` — the design
- `docs/vocabulary-catalogue.md` — the register and its four criteria and status values
- `docs/visimark-design.md` — §2, §4, §7, §14

Arguments: `$ARGUMENTS`
- First token: the issue number `<n>`.
- The rest: the maintainer's verdict and/or notes. May be empty — the steer can instead be in the issue comments or in this session's conversation.

## 1. Re-read

Run `git status --porcelain`; if non-empty, stop: "Working tree is dirty — commit or stash first."

- `gh issue view <n> --json number,title,body,labels,author,url,state`
- `gh issue view <n> --comments`

Read: the request, the pre-review comment if present (first line starts `**Automated pre-review**`), **every maintainer comment posted since**, the free-text argument, and the conversation preceding this command in the session.

Guard: refuse unless the issue has a `vocabulary` label **and** a title starting `vocabulary: `.

Recompute `<slug>` from the `Name` field (lowercase, non-`[a-z0-9]` runs → `-`, trim; fall back to the `Kind` word).

## 2. Evaluate

- **Pre-review exists** → reconcile it with the maintainer's input. On any conflict the maintainer wins.
- **No pre-review** → run the rubric now: in scope; criterion 1 shape (§4); criterion 2 document-local (§2 constraint 4); criterion 3 no ambiguity (§2 constraint 3); criterion 4 a real document needs it (§14); overlap with the nine builtins / operators / existing rows; precision cost (§7).

Settle on `APPROVED` / `DEFERRED` / `REJECTED` and the reason, citing the design-doc section that governs.

## 3. Deciding comment

Author it in the maintainer's voice, first person. Structure:
- First line, verbatim: `Decision: <APPROVED|DEFERRED|REJECTED>.`
- The reason, in the catalogue's idiom, with the design-doc citation.
- One sentence naming any divergence from the pre-review ("The pre-review leaned DEFERRED; deciding APPROVED because …").
- If a pre-review existed, a final line: `Pre-review: <link to that comment>`.

Write it to a temp file, post with `gh issue comment <n> --body-file <file>`, then capture the URL:
`gh issue view <n> --json comments -q '.comments[-1].url'`.

## 4. Catalogue PR

Locate this issue's row in `docs/vocabulary-catalogue.md` (the row whose Request cell links `#<n>`).

Check PR #1: `gh pr list --search "head:vocab/issue-<n>-<slug>" --state all --json number,state,headRefName`.

- **Row already on `master`** (PR #1 merged, or added by an earlier decide run):
  `git fetch origin && git switch -c vocab/issue-<n>-<slug>-decision origin/master`
- **PR #1 open**:
  `git fetch origin && git switch vocab/issue-<n>-<slug>` (check it out from the remote)
- **No row anywhere** (review was skipped):
  `git fetch origin && git switch -c vocab/issue-<n>-<slug> origin/master`, and add the full row.

Edit the row: fill `Pros` / `Cons` from the decided reasoning; set `Status` to `[<VERDICT>](<deciding-comment-url>)`. Keep `Request` as `[#<n>](<url>)`.

```bash
git add docs/vocabulary-catalogue.md
git commit -m "$(printf 'docs: decide #%s (%s) — %s\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>' <n> <Name> <VERDICT>)"
git push -u origin HEAD
```

- **New branch** → `gh pr create --base master --title "Catalogue #<n>: <Name> (<VERDICT>)" --body "$(printf '%s\n\n%s\n\nDeciding comment: %s\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)' '<the decision>' '<the reason>' '<comment-url>')"`
- **Existing PR #1** → the push updates it; `gh pr edit <num> --title "Catalogue #<n>: <Name> (<VERDICT>)"` and append the decision to its body with `gh pr edit <num> --body ...`.

Do **not** put `closes #<n>` anywhere in the PR body — the issue's state is set explicitly in step 5, not by a merge keyword.

`git switch -`.

## 5. Land the decision

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
   - `APPROVED` → leave it **open**. It now tracks implementation and becomes a
     design-doc §4 row when the primitive ships.
   - `DEFERRED` / `REJECTED` → close it:
     `gh issue close <n> --reason "not planned" --comment "$(printf 'Catalogued %s — see %s\n\nReopen only with new information.' <VERDICT> '<comment-url>')"`

Print: the deciding-comment URL, the merged-PR URL, and whether the issue was
left open or closed.

## 6. Reopen note

If the issue already had a `Decision:` comment (this is a re-decision with new
information), everything above still holds: reopen the issue first if it was
closed (`gh issue reopen <n>`), post the new `Decision:` comment, and the PR
**edits the existing row** — never add a second row for the same issue — then
step 5 re-merges and re-closes as needed.
