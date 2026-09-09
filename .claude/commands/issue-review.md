---
description: First-pass review of a GitHub issue — a vocabulary request or any other design/tooling issue — producing an analysis, a pre-review comment, and a NEW catalogue row
argument-hint: <issue-number> [--draft]
allowed-tools: Bash(gh:*), Bash(git:*), Bash(bunx:*), Bash(mktemp:*), Bash(cat:*), Read, WebFetch
---

You are running the **pre-review** stage of the issue-review workflow.

Read first, every run:
- `.claude/rules/ai-attribution.md` — commit / PR trailer for **this** session (never copy a hardcoded Claude line)
- `docs/superpowers/specs/2026-09-06-vocabulary-review-workflow-design.md` — the design
- `docs/vocabulary-catalogue.md` — the register you will add a row to, its four vocabulary criteria, and sections E–F for everything else
- `docs/visimark-design.md` — [§1](../../docs/visimark-design.md#1-purpose) (purpose, non-goals), [§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) (constraints), [§4](../../docs/visimark-design.md#4-syntax) (shape system), [§7](../../docs/visimark-design.md#7-numeric-semantics) (numeric semantics), [§9](../../docs/visimark-design.md#9-write-back) (write-back), [§14](../../docs/visimark-design.md#14-deferred) (deferred)

Arguments: `$ARGUMENTS`
- First token: the issue number `<n>`.
- `--draft` present anywhere: do the analysis, print it, post and branch nothing.

## 1. Load and guard

Run `git status --porcelain`. If it is non-empty, stop: "Working tree is dirty — commit or stash first." Do nothing else.

Run `gh issue view <n> --json number,title,body,labels,author,url,state,comments`.

**Already decided** — refuse and say "Already decided — use /issue-decide or the reopen path" if:
- any comment body starts with `Decision: ` and its author is the repository owner, or
- `docs/vocabulary-catalogue.md` already has a row linking `#<n>` whose Status cell is not empty and not `NEW`.

**Pick the track.** This routes everything below.

- **VOCAB track** — *both* of: a label exactly `vocabulary`, and a title starting `vocabulary: `. The issue is a rendered [Vocabulary request](../../.github/ISSUE_TEMPLATE/vocabulary-request.yml) form. Go to §2V.
- **GENERAL track** — anything else: a free-form issue proposing a language feature, a tooling or process change, a documentation change, or reporting a spec-level bug. Go to §2G.

A title starting `vocabulary: ` but with no `vocabulary` label (or vice versa) is a malformed vocab request — treat it as GENERAL track and let the classification in §2G.1 tell the author to refile on the template.

---

## 2V. Vocab track

### 2V.1 Parse the request

The body is the rendered issue form. Extract each field by its bold label:
`Name`, `Kind`, `Signature and shape`, `What it does`,
`The real document that needs it`, `Why not existing vocabulary or an input column`,
`Constraint check`, `Anything else`.

If any field except `Anything else` is blank or missing, set **INCOMPLETE**.

Compute `<slug>` from `Name`: lowercase, every run of non-`[a-z0-9]` → single `-`, trim `-`. If empty, slugify the `Kind` word instead (`operator`, `sorting-rule`). The branch is `vocab/issue-<n>-<slug>`.

### 2V.2 Verify the motivating document

Skip if INCOMPLETE. Run the shared procedure in §3 against the `The real document that needs it` field.

### 2V.3 Rubric

Score each pass / fail / unclear, and cite the design-doc section:
1. **In scope** — one primitive; vocabulary, not syntax. A sorting-rule request *is* in scope and targets catalogue section D ([§D](../../docs/vocabulary-catalogue.md#d-sorting-rules) says an open issue is what makes it a proposal).
2. **Criterion 1 — shape** ([§4](../../docs/visimark-design.md#4-syntax) "Shape: map and reduce") — mapper scalar→scalar; reducer vector→scalar over a **bare column reference**; no vector→vector; a mapper result is number/date/string, never boolean.
3. **Criterion 2 — document-local** ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraint 4) — no locale, clock, network, ambient data, config. This rejected `TODAY()`, `WORKDAY()`.
4. **Criterion 3 — no ambiguity** ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) constraint 3) — no context-dependent coercion; watch radians vs degrees, string index base, `blank` handling, precision with no binding to infer from.
5. **Criterion 4 — a real document needs it** ([§14](../../docs/visimark-design.md#14-deferred)) — the motivating document exercises the primitive **and** existing vocabulary or a human-written input column does not already cover it. Fails outright if DOC_UNVERIFIED.
6. **Overlap** — against the nine builtins, the operator set, and **every existing catalogue row**. If a `DEFERRED`/`REJECTED` row already covers it, link that row's deciding comment and note "reopen only with new information".
7. **Precision cost** ([§7](../../docs/visimark-design.md#7-numeric-semantics)) — irrational or binary-float results that dent "re-add it on a calculator".

Then decide **table placement** — A mappers / B operators / C reducers / D sorting — and draft the **row cells**: Name, What it does, Pros, Cons, Request (`[#<n>](<url>)`), Status (blank).

### 2V.4 Disposition

One of `APPROVED` / `DEFERRED` / `REJECTED` with a one-paragraph reason in the catalogue's idiom. If INCOMPLETE, the disposition is "ask the author to fill in: <the blank fields>".

Go to §4.

---

## 2G. General track

### 2G.1 Classify

Read the issue title and body. Put it in exactly one class — this sets the catalogue section and the rest of the rubric:

| Class | What it is | Catalogue section | Note |
|---|---|---|---|
| `language feature` | new syntax, an operator's semantics, evaluation behaviour, a new finding, a change to the format or the CLI surface | **E** | the common case; assertions, `by` sorting, a new anchor form |
| `vocabulary primitive` | a single mapper, reducer, or operator | — | **Do not review here.** The pre-review comment tells the author to refile on the [Vocabulary request template](../../.github/ISSUE_TEMPLATE/vocabulary-request.yml) — it drives the shape rubric and the one-primitive rule — then stop. No branch, no PR. |
| `tooling / process` | the review workflow, CI, releasing, the command/skill set, repo layout, the design docs' structure | **F** | |
| `documentation` | a doc is wrong, missing, or unclear, with no design decision behind it | — | Confirm it in the pre-review comment, recommend the fix, no catalogue row. |
| `bug` | an existing feature behaving against its spec | — | The pre-review reproduces it (§3 if a document is attached), points at the spec clause it violates, and recommends a fix or `wontfix`. A catalogue row only if the fix needs a spec change — then it is really a `language feature`. |

### 2G.2 Sufficiency gate

The issue must carry enough to assess. Require **all** of:

- **What** — a concrete statement of the proposal or the defect, not just a topic.
- **A motivating case** — a document, a worked example, a scenario, or (for a bug) a reproduction. "Documents often need this" with no example does not clear the bar; [§14](../../docs/visimark-design.md#14-deferred)'s rule — a real document needs it — applies to every class, not just vocabulary.
- **For a `language feature`** — at least a sketch of the syntax or semantics, and what a document cannot express or verify without it.
- **For `tooling / process`** — the current behaviour, the wanted behaviour, and why the gap matters.

If any is missing, this is an **unstructured / thin** issue. **Comment back** rather than pre-reviewing:

- Write the body to a temp file and `gh issue comment <n> --body-file <file>`.
- **Do not** use the `**Automated pre-review**` first line. Open plainly, e.g. `Thanks for the issue. Before this can be reviewed against the design doc, it needs:` and then a short bullet list naming exactly the missing pieces, phrased for this issue — reference the [Vocabulary request template](../../.github/ISSUE_TEMPLATE/vocabulary-request.yml) fields as a model for the shape of a complete request where useful.
- Then **stop**. No rubric, no branch, no PR. Print the comment URL and: "Thin issue — asked the author for specifics. Re-run /issue-review <n> once they reply."

### 2G.3 Compute the slug and verify any document

`<slug>` from the issue title: strip a leading `feature:` / `bug:` / `docs:` and similar; lowercase; every run of non-`[a-z0-9]` → single `-`; trim `-`; cap at ~40 chars on a word boundary. If degenerate, fall back to the class word (`language-feature`, `tooling`). The branch is `issue/<n>-<slug>`.

If the issue body or the motivating case contains a ```vmark fenced block, run the shared procedure in §3 against it. Otherwise skip it — a `language feature` is often about syntax that does not exist yet, so a document that does not check is expected, not a failure. Note that distinction in the analysis.

### 2G.4 Rubric

Score each pass / fail / unclear / n-a, citing the design-doc section. Skip an item only with a one-line reason.

1. **In scope** — it serves [§1](../../docs/visimark-design.md#1-purpose)'s purpose (calculation that is auditable in review and enforceable in CI) and does not cross a stated non-goal (a grid, a presentation layer, cell styling, locale, Excel compatibility, Excel's function library).
2. **Constraint 1 — renders unmodified** ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design)) — a document using the feature still renders correctly on GitHub, VS Code preview, Obsidian, pandoc, with no plugin. Anything that needs a renderer extension fails here.
3. **Constraint 2 — the tool writes only what it owns** ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design), [§9](../../docs/visimark-design.md#9-write-back)) — computed cells and anchored values only; human input, prose and headings are never rewritten without an explicit opt-in flag (`fmt --fix-dates` is the shape any exception must take).
4. **Constraint 3 — ambiguity is an error, never a guess** ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design)) — nothing a reader could read two ways; no context-dependent coercion. This settled ISO-only dates and the thousands-separator ban.
5. **Constraint 4 — meaning depends only on the document text and the `visimark` version** ([§2](../../docs/visimark-design.md#2-constraints-that-shaped-the-design)) — no config, environment, network, or clock. And **no plugin architecture** — a feature that lets a document select code CI then runs is refused outright.
6. **Shape system** ([§4](../../docs/visimark-design.md#4-syntax)) — if the feature touches expressions or evaluation: does it respect scalar/vector shapes, the map/reduce split, and the "no boolean in a cell" rule?
7. **Diffability** ([§9](../../docs/visimark-design.md#9-write-back), [§13](../../docs/visimark-design.md#13-testing)) — a one-input change still produces a small, readable diff; the offset splicer still applies.
8. **Overlap** — against the builtins, the operator set, existing findings and behaviour, and **every catalogue row** including sections E–F. If a `DEFERRED`/`REJECTED` row covers it, link that row's deciding comment and note "reopen only with new information".
9. **Cost / precision** ([§7](../../docs/visimark-design.md#7-numeric-semantics)) — implementation size, and any dent in the "re-add it on a calculator" promise.

Then draft the **catalogue row** for section E or F. Row shape (both sections): `Feature` (a short name), `What it changes`, `Pros`, `Cons`, `Request` (`[#<n>](<url>)`), `Status` (blank).

For a `language feature` also list, as **Open design questions**, every fork the issue leaves unsettled that a spec would have to close — syntax, edge semantics, interaction with existing rules. `/issue-decide` resolves these with the maintainer before an `APPROVED` lands.

### 2G.5 Disposition

One of `APPROVED` / `DEFERRED` / `REJECTED`, one paragraph, in the catalogue's idiom, citing the design-doc section that governs. For a `documentation` or `bug` class with no catalogue row, the disposition is a recommended action (`fix`, `wontfix`, `works as specified`) instead.

Go to §4.

---

## 3. Verify a motivating document (shared)

Given a field or block that should contain a VisiMark document:

- **Contains a ```vmark fenced block** → `d="$(mktemp -d)"`, write it to `"$d/<slug>.md"`, then run `bunx visimark check "$d/<slug>.md"` and `bunx visimark infer "$d/<slug>.md"`. Keep the exact stdout/stderr.
- **Only a link** → fetch it: `gh api "repos/{owner}/{repo}/contents/{path}" -q .content | base64 -d` for a github.com repo file, else WebFetch. On success run the same two commands. On any failure set **DOC_UNVERIFIED**.
- **Neither** → set DOC_UNVERIFIED.

Interpret:
- `check` failing *because a binding calls a proposed unknown function or uses syntax that does not exist yet* → the document is genuinely written to the proposal (supports "a real document needs it").
- `infer` reproducing every number using only existing vocabulary → the addition is not needed.

## 4. Output

### With --draft

Print: the track and (general) the class; the parsed request or the analysed proposal; every rubric item with its verdict and citation; the `check`/`infer` output if run; the disposition; the proposed catalogue row; and (general, language feature) the Open design questions. End with: "Re-run without --draft to publish the pre-review, or run /issue-decide <n>." Post and branch nothing.

### Without --draft

**Post the pre-review comment.** Write the body to a temp file and run `gh issue comment <n> --body-file <file>`. First line verbatim:
`**Automated pre-review** — analysis for the maintainer's decision, not a decision itself.`
Then: the parsed request or analysed proposal; each rubric item (verdict + cited §); the `check`/`infer` output in a fenced block if run; overlap findings; (general, language feature) the Open design questions; the recommended disposition; the proposed catalogue row rendered as a Markdown table row.

**Special stops — comment only, no branch, no PR:**
- VOCAB **INCOMPLETE** → the comment names the blank fields and asks the author to complete them.
- GENERAL **`vocabulary primitive`** → the comment asks the author to refile on the Vocabulary request template.
- GENERAL **thin issue** → handled in §2G.2 (a plain comment, not a pre-review), already stopped.
- GENERAL **`documentation`** / **`bug` with no spec change** → the comment carries the analysis and the recommended action; no catalogue row, no PR.

**Otherwise open PR #1:**
1. `git fetch origin`
2. `git switch -c <branch> origin/master` — `<branch>` is `vocab/issue-<n>-<slug>` (vocab track) or `issue/<n>-<slug>` (general track).
3. Add the row to the correct section table in `docs/vocabulary-catalogue.md` (A–D vocab, E language features, F tooling / process), Status cell empty (rendered as ` ` — the row still has the right number of `|`), Request `[#<n>](<url>)`.
4. `git add docs/vocabulary-catalogue.md`
5. `git commit -m "$(printf 'docs: catalogue #%s (%s) as NEW\n\n%s' <n> '<name>' '<attribution-trailer>')"` — `<attribution-trailer>` from `.claude/rules/ai-attribution.md` for this session.
6. `git push -u origin HEAD`
7. `gh pr create --base master --title "Catalogue #<n>: <name> (NEW)" --body "$(printf '<one-paragraph summary of the request>\n\nDecision to follow on #%s.' <n>)"` — no `Generated with Claude Code` footer unless this session is Claude Code (same rule).
8. `git switch -`

Print the comment URL, the PR URL, and: "Discuss on the issue or here, then run /issue-decide <n> when ready."
