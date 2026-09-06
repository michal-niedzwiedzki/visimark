---
description: Summarize the session's review discussion on a vocabulary-request issue and, on approval, post it as an issue comment
argument-hint: <issue-number>
allowed-tools: Bash(gh:*), Bash(mktemp:*), Bash(cat:*), Read, AskUserQuestion
---

You are running the **discussion** stage of the vocabulary-review workflow — it
sits between `/vocab-review` and `/vocab-decide`. The design has the maintainer
"talk it over with Claude in the session" (design [§1](../../docs/visimark-design.md#1-purpose)); that back-and-forth is
where the real reasoning happens and today it is lost. This command condenses it
into a public comment so the issue thread stays the durable record.

Read first, every run:
- `docs/superpowers/specs/2026-09-06-vocabulary-review-workflow-design.md` — §1–§2, how the thread is meant to read
- the issue and its comments (fetched below)

Arguments: `$ARGUMENTS` — the issue number `<n>`, nothing else.

## 1. Load and guard

Run `gh issue view <n> --json number,title,labels,url,comments`.

Refuse (print the reason, do nothing else) if **either**:
- no label is exactly `vocabulary`, or
- the title does not start with `vocabulary: `.

Refuse and say "Nothing to summarize — no discussion about #<n> in this session."
if the conversation preceding this command holds no substantive back-and-forth
about this issue.

## 2. Gather the discussion

Source material, in priority order:
- **the conversation preceding this command in this session** — the primary input;
- any maintainer comments on the issue posted since the pre-review;
- the pre-review comment (first line `**Automated pre-review**`) — context only; do not re-summarize it.

## 3. Write the summary

Scope it **ruthlessly**:
- Keep only what bears on the disposition of *this* issue or the wording of its
  catalogue row — the question(s) raised, the considerations for and against,
  where the discussion landed, and any point left open.
- Compress every precedent, analogy, or outside reference to the single sentence
  that changes the decision.
- Drop entirely: which commands were run, tooling or process asides,
  meta-discussion of the workflow or this command, and any tangent that would
  not move the decision or the row.

Form:
- First line, verbatim:
  `**Discussion summary** — the review conversation on this issue, condensed for the record. Not a decision.`
- Then neutral prose or tight bullets — e.g. **The question**, **Against**,
  **For**, **Where it landed**, **Still open**. Attribute positions to no one;
  write it as the thread's shared state.
- Never begin a line with `Decision: ` — that token from the repo owner is how
  `/vocab-review` and `/vocab-decide` detect a settled issue.
- Write only what a reader opening the issue cold needs before the eventual
  `Decision:` comment. Shorter is better.

## 4. Approve, then post

Post the drafted comment as an ordinary chat message — the full text, exactly as
it would appear on the issue. Do not put it in a file preview, a code block for
approval, or the body of the approval prompt.

Then use **AskUserQuestion** with only the bare question `Post this discussion
summary to #<n>?` and these three options — **do not restate the summary text in
the question or anywhere in the prompt**:
- **Post** — publish it as written.
- **Revise** — the maintainer says what to change; redraft from step 3, post the new text as a chat message, and ask again.
- **Cancel** — post nothing.

On **Post**: write the body to a temp file, run
`gh issue comment <n> --body-file <file>`, then capture and print the URL with
`gh issue view <n> --json comments -q '.comments[-1].url'`. End with:
"Discussion recorded. Run `/vocab-decide <n>` when ready."

On **Cancel**: print "Nothing posted." and stop.
