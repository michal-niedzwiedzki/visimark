# Reviewing a vocabulary request

**Claude drafts; the maintainer decides; the issue comment is the reason.**
A vocabulary request
([`.github/ISSUE_TEMPLATE/vocabulary-request.yml`](../.github/ISSUE_TEMPLATE/vocabulary-request.yml))
is judged against the design doc's constraints, recorded as a comment that
[`vocabulary-catalogue.md`](vocabulary-catalogue.md) then links, and catalogued
through one pull request to `master`. Three Claude Code commands carry the
mechanics; every judgement call is yours.

## The commands

| Command | What it does | What it writes |
|---------|--------------|----------------|
| `/vocab-review <n> [--draft]` | Parses the request, checks it against every constraint, runs `visimark check` / `infer` on the motivating document, drafts a recommendation | A pre-review comment on the issue and a PR adding the row as `NEW` — or, with `--draft`, nothing |
| `/vocab-discuss <n>` | Condenses the review conversation you had with Claude in the session into a neutral summary, shows it to you, and posts it only if you approve | A `**Discussion summary**` comment on the issue — nothing else |
| `/vocab-decide <n> [notes]` | Reconciles the pre-review with your steer, writes the decision, and lands it. **On `APPROVED` it first drafts the feature spec with you** — a gap hunt and a round of questions — and does nothing public until you call the spec ready; then it offers to draft the implementation plan too | A `Decision:` comment on the issue; the catalogue PR **merged** to `master` with the row at its verdict (the merge commit quotes the decision); the issue **closed** for `DEFERRED` / `REJECTED`, left open for `APPROVED`; and, for `APPROVED`, a second PR on `vocab/issue-<n>-<slug>-impl` carrying `docs/vocab/<slug>.md` and, if you asked for it, `docs/vocab/<slug>-plan.md` |

`/vocab-discuss` is optional and repeatable — reach for it when the session
argument mattered and the issue thread should carry it before the decision.

## The sequence

1. **`/vocab-review <n>`** — add `--draft` first if you want to read the
   analysis before anything is public. Without `--draft` it posts the
   pre-review and opens the `NEW`-row PR on `vocab/issue-<n>-<name>`.
2. **Talk it over.** Reply on the issue, or just keep talking to Claude in the
   session — "isn't this `MID`?", "re-check criterion 3". No command needed.
   If that conversation produced reasoning the thread should keep, run
   **`/vocab-discuss <n>`** and approve the summary it drafts.
3. **Optionally merge the `NEW`-row PR** if you want the catalogue to show the
   request as `NEW` before the decision lands. You can also leave it open —
   `/vocab-decide` pushes the final row onto the same PR and merges it.
4. **`/vocab-decide <n> <your verdict and reason>`** — settles the verdict.
   - On **`DEFERRED` / `REJECTED`**: posts the deciding comment in your voice,
     sets the row's `Status` to `[VERDICT](<comment link>)`, merges the
     catalogue PR (the merge commit quotes the decision), and closes the issue.
   - On **`APPROVED`**: *first* drafts `docs/vocab/<slug>.md` in the house
     design-doc style from the issue, hunts for gaps (unpinned types,
     unspecified boundaries, un-coded errors, acceptance still hand-wavy), and
     puts them to you as questions. Nothing is posted or merged until you
     answer "Spec ready to hand off?" with **Ready**. *Then* it posts the
     deciding comment, merges the catalogue PR, and opens a second PR on
     `vocab/issue-<n>-<slug>-impl` with the spec committed. Finally it asks
     whether to **write the implementation plan** now — if yes, it drafts
     `docs/vocab/<slug>-plan.md`, asking you about any decision the spec does
     not settle, and commits it onto the same PR. The issue stays open and now
     tracks that PR.
   If a PR cannot merge (conflict, red check), the command stops and leaves it
   for you.
5. **Execute the plan** (`superpowers:executing-plans` or
   `superpowers:subagent-driven-development`) — or, if you deferred it, write it
   first with `superpowers:writing-plans` against the spec PR. The catalogue row
   becomes a design-doc §4 entry when the primitive ships.

## Reopening

The catalogue reopens a `REJECTED` row "only with new information". Add that
information to the issue, then run `/vocab-decide <n>` again: a fresh
`Decision:` comment, and a PR that **edits the existing row** rather than
adding a second one. If a re-decision lands on `APPROVED` and the `-impl` PR
already exists, the revised spec is committed onto it rather than opening a
second one.

## What Claude checks

`/vocab-review` and `/vocab-decide` judge the request against the four criteria in the
[catalogue preface](vocabulary-catalogue.md#requesting-an-addition) and the
constraints in [`visimark-design.md`](visimark-design.md) §2, §4, §7 and §14 —
shape system, document-local value, no ambiguity, a real document that needs
it — plus overlap with the nine builtins, the operator set, and every row
already catalogued. The pre-review comment shows its working and is labelled
as Claude's analysis, not a decision.
