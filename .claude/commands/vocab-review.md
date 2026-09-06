---
description: First-pass review of a vocabulary-request issue — analysis, a pre-review comment, and a NEW catalogue row
argument-hint: <issue-number> [--draft]
allowed-tools: Bash(gh:*), Bash(git:*), Bash(bunx:*), Bash(mktemp:*), Bash(cat:*), Read, WebFetch
---

You are running the **pre-review** stage of the vocabulary-review workflow.

Read first, every run:
- `docs/superpowers/specs/2026-09-06-vocabulary-review-workflow-design.md` — the design
- `docs/vocabulary-catalogue.md` — the register you will add a row to, and its four criteria
- `docs/visimark-design.md` — [§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) (constraints), [§4](../../docs/visimark-design.md#4-syntax) (shape system), [§7](../../docs/visimark-design.md#7-numeric-semantics) (numeric semantics), [§14](../../docs/visimark-design.md#14-deferred) (deferred)

Arguments: `$ARGUMENTS`
- First token: the issue number `<n>`.
- `--draft` present anywhere: do the analysis, print it, post and branch nothing.

## 1. Load and guard

Run `git status --porcelain`. If it is non-empty, stop: "Working tree is dirty — commit or stash first." Do nothing else.

Run `gh issue view <n> --json number,title,body,labels,author,url,state,comments`.

Refuse (print the reason, do nothing else) if **either**:
- no label is exactly `vocabulary`, or
- the title does not start with `vocabulary: `.

Refuse and say "Already decided — use /vocab-decide or the reopen path" if:
- any comment body starts with `Decision: ` and its author is the repository owner, or
- `docs/vocabulary-catalogue.md` already has a row linking `#<n>` whose Status cell is not empty and not `NEW`.

## 2. Parse the request

The body is the rendered issue form. Extract each field by its bold label:
`Name`, `Kind`, `Signature and shape`, `What it does`,
`The real document that needs it`, `Why not existing vocabulary or an input column`,
`Constraint check`, `Anything else`.

If any field except `Anything else` is blank or missing, set **INCOMPLETE**.

Compute `<slug>` from `Name`: lowercase, every run of non-`[a-z0-9]` → single `-`, trim `-`. If empty, slugify the `Kind` word instead (`operator`, `sorting-rule`).

## 3. Verify the motivating document

Skip if INCOMPLETE.

From the `The real document that needs it` field:
- **Contains a ```vmark fenced block** → `d="$(mktemp -d)"`, write the field to `"$d/<slug>.md"`, then run `bunx visimark check "$d/<slug>.md"` and `bunx visimark infer "$d/<slug>.md"`. Keep the exact stdout/stderr.
- **Only a link** → fetch it: `gh api "repos/{owner}/{repo}/contents/{path}" -q .content | base64 -d` for a github.com repo file, else WebFetch. On success run the same two commands. On any failure set **DOC_UNVERIFIED**.
- **Neither** → set DOC_UNVERIFIED.

Interpret:
- `check` failing *because a binding calls the proposed unknown function* → the document is genuinely written to use the primitive (supports criterion 4).
- `infer` reproducing every number using only existing vocabulary → the primitive is not needed (fails criterion 4).

## 4. Rubric

Score each pass / fail / unclear, and cite the design-doc section:
1. **In scope** — one primitive; vocabulary, not syntax. A sorting-rule request *is* in scope and targets catalogue section D ([§D](../../docs/vocabulary-catalogue.md#d-sorting-rules) says an open issue is what makes it a proposal).
2. **Criterion 1 — shape** ([§4](../../docs/visimark-design.md#4-syntax) "Shape: map and reduce") — mapper scalar→scalar; reducer vector→scalar over a **bare column reference**; no vector→vector; a mapper result is number/date/string, never boolean.
3. **Criterion 2 — document-local** ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraint 4) — no locale, clock, network, ambient data, config. This rejected `TODAY()`, `WORKDAY()`.
4. **Criterion 3 — no ambiguity** ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraint 3) — no context-dependent coercion; watch radians vs degrees, string index base, `blank` handling, precision with no binding to infer from.
5. **Criterion 4 — a real document needs it** ([§14](../../docs/visimark-design.md#14-deferred)) — the motivating document exercises the primitive **and** existing vocabulary or a human-written input column does not already cover it. Fails outright if DOC_UNVERIFIED.
6. **Overlap** — against the nine builtins, the operator set, and **every existing catalogue row**. If a `DEFERRED`/`REJECTED` row already covers it, link that row's deciding comment and note "reopen only with new information".
7. **Precision cost** ([§7](../../docs/visimark-design.md#7-numeric-semantics)) — irrational or binary-float results that dent "re-add it on a calculator".

Then decide **table placement** — A mappers / B operators / C reducers / D sorting — and draft the **row cells**: Name, What it does, Pros, Cons, Request (`[#<n>](<url>)`), Status (blank).

## 5. Disposition

One of `APPROVED` / `DEFERRED` / `REJECTED` with a one-paragraph reason in the catalogue's idiom. If INCOMPLETE, the disposition is "ask the author to fill in: <the blank fields>".

## 6. Output

### With --draft
Print: the parsed request, every rubric item with its verdict and citation, the `check`/`infer` output, the disposition, and the proposed row. End with: "Re-run without --draft to publish the pre-review, or run /vocab-decide <n>." Post and branch nothing.

### Without --draft

**Post the pre-review comment.** Write the body to a temp file and run `gh issue comment <n> --body-file <file>`. First line verbatim:
`**Automated pre-review** — analysis by Claude for the maintainer's decision, not a decision itself.`
Then: the parsed request; each rubric item (verdict + cited §); the `check`/`infer` output in a fenced block; overlap findings; the recommended disposition; the proposed catalogue row rendered as a Markdown table row.

**If INCOMPLETE:** the comment instead names the blank fields and asks the author to complete them. Stop — no branch, no PR.

**Otherwise open PR #1:**
1. `git fetch origin`
2. `git switch -c vocab/issue-<n>-<slug> origin/master`
3. Add the row to the correct section table in `docs/vocabulary-catalogue.md`, Status cell empty (rendered as ` ` — the row still has the right number of `|`), Request `[#<n>](<url>)`.
4. `git add docs/vocabulary-catalogue.md`
5. `git commit -m "$(printf 'docs: catalogue #%s (%s) as NEW\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>' <n> <Name>)"`
6. `git push -u origin HEAD`
7. `gh pr create --base master --title "Catalogue #<n>: <Name> (NEW)" --body "$(printf '<one-paragraph summary of the request>\n\nDecision to follow on #%s.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)' <n>)"`
8. `git switch -`

Print the comment URL, the PR URL, and: "Discuss on the issue or here, then run /vocab-decide <n> when ready."
