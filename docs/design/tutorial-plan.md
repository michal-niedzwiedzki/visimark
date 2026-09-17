# Tutorial Plan

**Goal:** One complete end-to-end tutorial that takes a reader from a plain
Markdown table to a checked document, a CI job and a script reading values back
out — teaching the language in dependency order, and never stating anything the
CLI has not been run to confirm.

**Architecture:** The tutorial is Markdown. [`docs/tutorial.md`](../tutorial.md)
holds every word of it and renders on GitHub with no JavaScript.
[`docs/tutorial.html`](../tutorial.html) is a **generic viewer** over that file,
not a second copy of the content. Two runnable documents under
[`docs/tutorial/`](../tutorial/) are the tutorial's own dogfood and are checked
in CI beside the worked examples.

**Spec:** none. This is documentation, not a language or tooling change, so
there is no behaviour to specify — the CLI it documents is already specified in
[`visimark-design.md`](../visimark-design.md) and
[`cli-reference.md`](../cli-reference.md).

**Status:** delivered. All four files below exist and pass
`visimark check`.

## Global Constraints

- **Every transcript in the tutorial is captured from a real run.** No invented
  output, no plausible-looking numbers, no counts written from memory. A claim
  about the tool that has not been run is not written down.
- **The tutorial documents only what the current release does.** Where behaviour
  is missing or incomplete, it is stated as a current limit — never described as
  though it worked, and never quietly omitted.
- **No tutorial text lives in `tutorial.html`.** Deleting that file must leave a
  complete tutorial behind in `tutorial.md`.
- **Reference material is linked, never restated.**
  [`cli-reference.md`](../cli-reference.md) and
  [`function-reference.md`](../function-reference.md) are the lookup tables; the
  tutorial teaches the habit of consulting them (`visimark ref`) instead of
  duplicating them into a second place that can rot.
- **The two documents under `docs/tutorial/` are listed in
  [`dogfood.yml`](../../.github/workflows/dogfood.yml)**, so the tutorial's own
  promises fail the build when they stop being true.
- Run `bun run format` and `bun run lint` before any commit. CI fails on
  `oxfmt --check` and `oxlint --max-warnings 0`.
- Commit messages follow the repo's Conventional Commits style and end with the
  `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md).
  Do not copy a trailer out of this file or an older commit.

---

## Part A — format decisions

### 1. Format: Markdown, not hand-built HTML like index.html

Write the tutorial as plain .md files, not as more embedded-HTML like the landing page. index.html's marked.js-in-browser trick exists to solve a narrow problem (show raw source next to its live rendering for a marketing demo) — it has no navigation, no TOC, no cross-linking, and every new demo means more hand-written HTML/CSS. A tutorial is long-form, multi-page, needs headings/TOC/search, and must render correctly with zero JS on GitHub itself (that's core to VisiMark's own pitch — "renders correctly on GitHub, no plugin"). Plain Markdown is also what a VisiMark tutorial should eat its own dog food with: worked .md examples the CLI can actually check, same as docs/example-invoice.md.

### 2. Same repo: yes

Done.

### 3. GitHub Pages: fine. Don't inline images as data: URIs for the tutorial

Done.

### 4. The standalone page is a viewer, not the content

The tutorial is asked for as a standalone web page with the Markdown source
beside its rendering, scrolling in lockstep. That is satisfied without
contradicting decision 1: the content stays in `docs/tutorial.md`, and
`docs/tutorial.html` is a **generic viewer** that fetches that file, splits it
into top-level blocks, and lays each block out as one grid row with source on
the left and rendering on the right.

Laying the panes out as paired grid rows is what makes the lockstep exact and
free: each row is as tall as the taller of its two halves, so block *n* on the
left is always level with block *n* on the right, with one page scrollbar and
no scroll-position JavaScript to drift. Three view modes (side by side, source
only, rendered only) make the prose readable; side by side is the default
because seeing `**158.00**<!--vmark=order.total-->` next to the sentence it
renders as *is* the product.

No tutorial text lives in the HTML. Deleting `tutorial.html` must leave a
complete tutorial behind in `tutorial.md`, readable on GitHub.

## Part B — contents plan

### Audience and constraints

- A reader who knows Markdown and Git, and has never seen VisiMark.
- Many readers are not native English speakers: short sentences, common words,
  one idea per paragraph, no idioms.
- Every command output shown in the tutorial is a real transcript, captured
  from the CLI while writing it. Nothing invented.
- Every concept arrives **because the previous chapter left a problem open**.
  Nothing is introduced "for completeness".
- The four required threads — the language, the CLI, CI, knowledge extraction —
  are not four parts. The language comes first because the other three have
  nothing to act on without it; CI and extraction then reuse the same running
  example rather than starting fresh.

### The spine: one document, grown across the whole tutorial

A single order/quote document is started in chapter 4 and is still the example
in the CI and extraction chapters. The reader never has to re-learn a new
scenario to learn a new feature. The capstone rebuilds one from nothing, using
everything.

### Chapters

**Part 1 — The problem (why this exists)**

1. **A number that is no longer true.** A three-line order table, one input
   changed, every total silently wrong. It renders perfectly. Nothing complains.
   Why Markdown, Git and AI agents make this common now.
2. **The idea in one page.** Write the formula, let the tool write the number.
   The four ideas (block, column rules, scalars, anchors) shown once, in one
   snippet, with no detail. A promise of what the reader will be able to do.

**Part 2 — First contact (the CLI)**

3. **Install and first run.** `npx visimark`, `--version`, `check` on a file
   that already works, and what exit codes 0 / 1 / 2 mean. Nothing written yet.
4. **Write your first document.** Table → `vmark` block → `0.00` placeholders →
   `visimark fmt`. Read the transcript, read the diff. First derived number.
5. **Prove it is really derived.** The trap: `check` passes on a document with
   no formulas, so a green check on its own proves nothing. The `COVERAGE`
   finding, the `no-formulas` marker, and the habit that outranks both — change
   one input and confirm the checker starts complaining.

**Part 3 — The language, one step at a time**

6. **Columns: one rule for every row.** Uniform column rules; why there is no
   per-cell formula; a column with no rule is a human input.
7. **Who owns which bytes.** The tool owns computed cells and anchored values;
   everything else is yours. Never hand-edit an output. Why `fmt` splices bytes
   and what that does to diffs.
8. **Scalars and aggregates.** `SUM`, `COUNT`, `MIN`, `MAX`, `AVG`. Why totals
   are scalars and not a totals row. The trap that a rule whose name is not a
   column header silently becomes a scalar — and the `WARN` that catches it.
9. **Anchors: a number inside a sentence.** Anchor grammar, why the comment is
   invisible everywhere, why an anchor is an output and never an input, and the
   current limit (only numeric values are rewritten and checked).
10. **More than one table: sheets.** Naming a sheet, referring across sheets,
    the two rules that bite: cross-sheet references must be qualified, and a
    column crossing a sheet boundary must be aggregated (`VECTOR`).
11. **Functions that run per row.** Maps vs reduces. `ROUND`, `IF`, `ABS`,
    `MOD`, `FLOOR`, `CEILING`, `SQRT`. Comparisons and booleans, and why a
    boolean never lands in a cell. **`visimark ref` as the habit** — look a
    function up instead of guessing.
12. **Percent, currency and units.** `23%`, `$5.00`, `12 N`. Decoration is
    inert, must be uniform down a column, and currency in prose goes outside
    the anchor.
13. **Dates.** ISO 8601 only, and why. `EOMONTH`, `MIN`/`MAX` over dates.
    `fmt --fix-dates`, and the ambiguous date it refuses to touch.
14. **Precision: how wide a number is written.** Where width comes from for
    each operation; the three that bound nothing (`/`, `AVG`, `SQRT`);
    `name precision N =`; declaring it electively to protect money columns;
    why prose never decides a width.
15. **Headers that are not names.** `"Header text" is symbol` and
    `"Header text" = expr`. Why rewriting someone's header is the wrong fix.
16. **Assertions: facts that must stay true.** `assert`, what it does and does
    not do, rounding explicitly instead of a tolerance, row-wise checks via
    `MIN`/`MAX`, and reading the substituted failure report.

**Part 4 — Documents you did not write**

17. **`infer`: wiring up a table that already has its numbers.** Run it, read
    the proposal, `--write`. Why a rule must reproduce every row exactly; the
    near-miss that means the document already has a wrong number; "also fits,
    not proposed"; "weak, not written" on a short table; what `--write` will
    and will not do.
18. **Reading `check`.** Every finding code, one short worked example each,
    what fixes it, and which ones `fmt` may touch. A table at the end as the
    lookup.
19. **`explain`, and reviewing a VisiMark diff.** Inputs, rules, evaluation
    order, assertions. What a propagation diff looks like in review and what a
    reviewer should actually check.

**Part 5 — Beyond one file**

20. **Rows from a CSV.** `from … labelled … at sha256:…`, why the stamp exists,
    what changes when a sheet is imported (no column rules), and the failure
    modes.
21. **Charts as generated artifacts.** `chart … as … of … labelled …`, the
    image anchor, what `check` guarantees about an SVG and what it does not.

**Part 6 — Automation (CI and knowledge extraction)**

22. **In CI.** The one-line `npx` form, the composite Action, pinning, what
    fails a build, `fmt` in CI vs `check` in CI, and what to tell a contributor
    whose build failed.
23. **Knowledge extraction.** `eval`, `--get`, `--json`, the shape of the JSON,
    what a script should and should not depend on. Three real uses: a CI shard
    matrix, an agent spend gate, a capacity decision that no longer has a second
    source of truth. The idea: a document that a person reads and a machine
    reads, with no export step between them.
24. **Working with an AI agent.** Why this format suits agents; the skill file;
    the review loop; the rationalizations to refuse.
25. **In the editor.** The language server and the VS Code extension: live
    diagnostics, format on save, quick fixes, inlay hints.

**Part 7 — Putting it together**

26. **Capstone: a quote, end to end.** From an empty file to a checked,
    asserted, CI-guarded document: table, rules, schedule sheet, reconciliation
    assertion, anchors, then `check` in a workflow and `eval --json` out of it.
    Every command shown in order.
27. **What VisiMark refuses to do.** Scope boundaries, no plugins, no locale,
    no config — and why each refusal makes the format smaller rather than only
    stricter.
28. **Where to go next.** Links out to `cli-reference.md`,
    `function-reference.md`, `visimark-design.md`, the worked examples, the
    playground, and the vocabulary process for asking for a new function.

### Why this order

- 1–2 give a reason to read on before any syntax appears.
- 3–5 get a real green check on the reader's own machine early, and immediately
  teach the one habit that keeps a green check meaningful. Everything after that
  can be trusted by the reader because they know how to test it.
- 6–16 introduce the language in dependency order. Nothing in a chapter uses a
  concept from a later chapter. Precision (14) lands after the operations whose
  widths it explains (8, 11, 12), and assertions (16) land last in the language
  part because they are the only construct whose value is an argument about the
  document rather than a number in it.
- 17–19 are the "someone handed me this" path; they need the language part to
  be able to read what `infer` proposes.
- 20–21 are optional features. They come after the complete core so that a
  reader who stops at 19 has still learned the whole product.
- 22–23 are the payoff, and they reuse the spine document rather than a new one.
- 26 proves the reader can now do it unaided.

### Things deliberately kept out of the tutorial

- Re-stating the CLI reference or the function reference. Both are linked; the
  tutorial teaches the habit of looking them up (`visimark ref`) instead.
- The design rationale documents in `docs/design/`.
- Anything not shipped in the version the tutorial is written against.

## File Structure

| File | Responsibility |
|---|---|
| [`docs/tutorial.md`](../tutorial.md) | The tutorial. Complete on its own, renders on GitHub. |
| [`docs/tutorial.html`](../tutorial.html) | Generic side-by-side viewer with lockstep scrolling. Holds no tutorial content. |
| [`docs/tutorial/order.md`](../tutorial/order.md) | The spine document in its finished state, runnable. |
| [`docs/tutorial/capstone.md`](../tutorial/capstone.md) | The finished capstone, runnable. |
| [`.github/workflows/dogfood.yml`](../../.github/workflows/dogfood.yml) | Gains the three new Markdown documents, so the tutorial is verified on every push. |
| [`README.md`](../../README.md), [`docs/index.html`](../index.html) | Link to the tutorial. |

## Verification

1. `visimark check` passes on `docs/tutorial.md` and both documents under
   `docs/tutorial/`.
2. Each `$ visimark …` transcript in the tutorial reproduces byte-for-byte when
   the command beside it is run.
3. The viewer's block splitter loses no content: splitting `tutorial.md` and
   rejoining it yields the same non-blank lines, and no fenced block is left
   unterminated.
4. Every relative link in `tutorial.md` resolves to a file that exists.
5. `bun run format:check` and `bun run lint` are clean.

## Deferred

- **Non-numeric anchors.** A string- or date-valued scalar is neither rewritten
  by `fmt` nor reported by `check` in 0.1.5, although
  [§3](../visimark-design.md#3-document-model) of the design document says a
  string-valued scalar can be materialised. Chapter 9 states this as a current
  limit. When it is fixed, that paragraph comes out.
- **`visimark ref` coverage of operators.** The tutorial's precision table
  (chapter 14) is hand-written because `ref` documents functions only. It should
  cite `ref` once operators have entries.
- **Splitting the tutorial into several files** if it grows past comfortable
  single-file length. The viewer would need a manifest; nothing else changes.
- **A `check`-in-CI recipe that annotates a pull request** from `--json`.
  Chapter 22 shows the JSON but stops short of a worked GitHub annotation step.

<!--vmark:no-formulas-->
