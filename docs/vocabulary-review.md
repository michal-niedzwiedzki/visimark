# Reviewing a vocabulary request

**Claude drafts; the maintainer decides; the issue comment is the reason.**
A vocabulary request
([`.github/ISSUE_TEMPLATE/vocabulary-request.yml`](../.github/ISSUE_TEMPLATE/vocabulary-request.yml))
is judged against the design doc's constraints, recorded as a comment that
[`vocabulary-catalogue.md`](vocabulary-catalogue.md) then links, and catalogued
through one pull request to `master`. Two Claude Code commands carry the
mechanics; every judgement call is yours.

## The two commands

| Command | What it does | What it writes |
|---------|--------------|----------------|
| `/vocab-review <n> [--draft]` | Parses the request, checks it against every constraint, runs `visimark check` / `infer` on the motivating document, drafts a recommendation | A pre-review comment on the issue and a PR adding the row as `NEW` — or, with `--draft`, nothing |
| `/vocab-decide <n> [notes]` | Reconciles the pre-review with your steer and the conversation, writes the decision | A `Decision:` comment on the issue and a PR moving the row to the verdict |

## The sequence

1. **`/vocab-review <n>`** — add `--draft` first if you want to read the
   analysis before anything is public. Without `--draft` it posts the
   pre-review and opens the `NEW`-row PR on `vocab/issue-<n>-<name>`.
2. **Talk it over.** Reply on the issue, or just keep talking to Claude in the
   session — "isn't this `MID`?", "re-check criterion 3". No command needed.
3. **Merge the `NEW`-row PR** once you're satisfied the request belongs in the
   catalogue at all. It is a one-row change.
4. **`/vocab-decide <n> <your verdict and reason>`** — posts the deciding
   comment in your voice and opens the PR that sets the row's `Status` to
   `[APPROVED|DEFERRED|REJECTED](<comment link>)`.
5. **Merge that PR.** Then close the issue by hand if the verdict was
   `DEFERRED` or `REJECTED`; leave it open if `APPROVED` — it now tracks the
   implementation and becomes a design-doc §4 row when the primitive ships.

## Reopening

The catalogue reopens a `REJECTED` row "only with new information". Add that
information to the issue, then run `/vocab-decide <n>` again: a fresh
`Decision:` comment, and a PR that **edits the existing row** rather than
adding a second one.

## What Claude checks

Both commands judge the request against the four criteria in the
[catalogue preface](vocabulary-catalogue.md#requesting-an-addition) and the
constraints in [`visimark-design.md`](visimark-design.md) §2, §4, §7 and §14 —
shape system, document-local value, no ambiguity, a real document that needs
it — plus overlap with the nine builtins, the operator set, and every row
already catalogued. The pre-review comment shows its working and is labelled
as Claude's analysis, not a decision.
