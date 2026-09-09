# Reviewing an issue

**An agent drafts; the maintainer decides; the issue comment is the reason.**
An issue — a vocabulary request on the
[template](../.github/ISSUE_TEMPLATE/vocabulary-request.yml), or any free-form
proposal for a language feature, a tooling change, or a documentation fix — is
judged against the design doc's constraints, recorded as a comment that
[`vocabulary-catalogue.md`](vocabulary-catalogue.md) then links, and catalogued
through one pull request to `master`. Three slash commands carry the
mechanics; every judgement call is yours. Commits the agent makes are
attributed per [`.claude/rules/ai-attribution.md`](../.claude/rules/ai-attribution.md).

## Two tracks

The commands look at the issue and pick a track:

- **Vocabulary request** — label `vocabulary` **and** title `vocabulary: …`.
  The full four-criteria shape rubric runs; the row lands in catalogue
  section A–D.
- **General** — anything else. A lighter rubric against the
  [§2](visimark-design.md#2-constraints-that-shaped-the-design) constraints,
  [§1](visimark-design.md#1-purpose) scope, and diffability; the row lands in
  section **E** (language features) or **F** (tooling / process). A single
  vocabulary primitive filed off-template is bounced back to the template. A
  documentation fix or a plain bug gets a pre-review comment and a recommended
  action, no row. An issue too thin to assess gets a comment asking for the
  missing pieces — no pre-review, no PR — until it is filled in.

## The commands

| Command | What it does | What it writes |
|---------|--------------|----------------|
| `/issue-review <n> [--draft]` | Picks the track, parses or analyses the issue, checks it against the constraints, runs `visimark check` / `infer` on any motivating document, drafts a recommendation | A pre-review comment on the issue and a PR adding the row as `NEW` — or, with `--draft`, nothing. A thin or misfiled issue gets only a comment. |
| `/issue-discuss <n>` | Condenses the review conversation you had with the agent in the session into a neutral summary, shows it to you, and posts it only if you approve | A `**Discussion summary**` comment on the issue — nothing else |
| `/issue-decide <n> [notes]` | Reconciles the pre-review with your steer, writes the decision, and lands it. **On `APPROVED` it first drafts the feature spec with you** — a gap hunt and a round of questions — and does nothing public until you call the spec ready; then it offers to draft the implementation plan, and then to execute it | A `Decision:` comment on the issue; the catalogue PR **merged** to `master` with the row at its verdict (the merge commit quotes the decision); the issue **closed** for `DEFERRED` / `REJECTED`, left open for `APPROVED` (and closed automatically once the change ships in a release); and, for `APPROVED`, a **draft** PR carrying the spec (`docs/vocab/<slug>-spec.md` or `docs/design/<slug>-spec.md`) and, if you asked for them, the plan and the implementation — promoted out of draft only once the build and CI are green |

`/issue-discuss` is optional and repeatable — reach for it when the session
argument mattered and the issue thread should carry it before the decision.

## The sequence

1. **`/issue-review <n>`** — add `--draft` first if you want to read the
   analysis before anything is public. Without `--draft` it posts the
   pre-review and opens the `NEW`-row PR on `vocab/issue-<n>-<slug>` (vocabulary)
   or `issue/<n>-<slug>` (general).
2. **Talk it over.** Reply on the issue, or just keep talking to the agent in the
   session — "isn't this `MID`?", "what about the rounding edge?". No command
   needed. If that conversation produced reasoning the thread should keep, run
   **`/issue-discuss <n>`** and approve the summary it drafts.
3. **Optionally merge the `NEW`-row PR** if you want the catalogue to show the
   request as `NEW` before the decision lands. You can also leave it open —
   `/issue-decide` pushes the final row onto the same PR and merges it.
4. **`/issue-decide <n> <your verdict and reason>`** — settles the verdict.
   - On **`DEFERRED` / `REJECTED`**: posts the deciding comment in your voice,
     sets the row's `Status` to `[VERDICT](<comment link>)`, merges the
     catalogue PR (the merge commit quotes the decision), and closes the issue.
   - On **`APPROVED`**: *first* drafts the spec in the house design-doc style
     from the issue, hunts for gaps (unpinned types, unspecified boundaries,
     un-coded errors, acceptance still hand-wavy, and — for a language feature —
     every syntax and edge-semantics fork the issue left open), and puts them to
     you as questions. Nothing is posted or merged until you answer "Spec ready
     to hand off?" with **Ready**. *Then* it posts the deciding comment, merges
     the catalogue PR, and opens a **draft** PR on the `-impl` branch with the
     spec committed. Then it asks whether to **write the implementation plan**
     now — if yes, it drafts the plan, asking you about any decision the spec
     does not settle, and commits it onto the same PR. Last, it asks whether to
     **start implementation** — if yes, it runs `superpowers:executing-plans`
     against the plan (final task always: design doc, `CHANGELOG.md`
     `## Unreleased`, catalogue row moved to the Shipped register as
     `UNRELEASED`, cli-reference), loops check → fix until the local build is
     green, pushes, waits for CI, and only on a full green build **promotes the
     PR out of draft**. The issue stays open and tracks that PR.
   The implementation PR stays a **draft** until CI is green — a blocked or
   red build leaves it draft for you to pick up.
5. **Review and merge the implementation PR** to ship the change — or, if you
   deferred a step, pick it up with `superpowers:writing-plans` /
   `superpowers:executing-plans` against the spec PR. The catalogue row sits in
   the [Shipped register](vocabulary-catalogue.md#shipped) as `UNRELEASED` from
   the moment the implementation merges; the next `vX.Y.Z` tag promotes it to
   `SHIPPED` and closes the issue (see [`releasing.md`](releasing.md)).

## Reopening

The catalogue reopens a `REJECTED` row "only with new information". Add that
information to the issue, then run `/issue-decide <n>` again: a fresh
`Decision:` comment, and a PR that **edits the existing row** rather than
adding a second one. If a re-decision lands on `APPROVED` and the `-impl` PR
already exists, the revised spec is committed onto it rather than opening a
second one.

## What the pre-review checks

**Vocabulary requests** are judged against the four criteria in the
[catalogue preface](vocabulary-catalogue.md#requesting-an-addition) and the
constraints in `visimark-design.md` [§2](visimark-design.md#2-constraints-that-shaped-the-design), [§4](visimark-design.md#4-syntax), [§7](visimark-design.md#7-numeric-semantics) and [§14](visimark-design.md#14-deferred) —
shape system, document-local value, no ambiguity, a real document that needs
it — plus overlap with the twelve builtins, the operator set, and every row
already catalogued.

**General issues** are judged against [§1](visimark-design.md#1-purpose) scope
and non-goals, the four [§2](visimark-design.md#2-constraints-that-shaped-the-design)
constraints and the no-plugin rule, the shape system where expressions are
touched, diffability ([§9](visimark-design.md#9-write-back)), and overlap with
existing behaviour and every catalogue row. The bar from
[§14](visimark-design.md#14-deferred) — a real document needs it — applies to
every class, not just vocabulary.

The pre-review comment shows its working and is labelled as automated analysis,
not a decision.

<!--vmark:no-formulas-->
