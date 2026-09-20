# What the derived pipeline actually costs — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.10 (row 10, Low).

**Goal:** §2.10's own: "There is a number in a design doc, and a decision that
cites it." It asked for the measurement *first*, and explicitly refused to
assume which phase dominates.

---

## What it looked like before

Every 500 ms of typing inactivity the page ran `fmt` + `pgEval` + `pgExplain`
+ `marked.parse` + chart rendering inline on the UI thread, then wrote back
into CodeMirror. There was no measurement anywhere and no `Worker`. At
tutorial-chapter sizes it is imperceptible; paste a few hundred rows and the
tab locks with no cancel and no spinner.

## The measurement

Run from inside the page in Chromium, over a generated table with a `vmark`
block computing `Total = Qty * Price`, `grand_total = SUM(Total)` and one
assertion. Each phase timed separately; JIT warmed first; two runs, second
shown.

| rows | source | `fmt` | `pgEval` | `pgExplain` | `marked.parse` | preview write | **pass** |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 50 | 2 KB | 3 | 3 | 5 | 0.3 | 2 | **12 ms** |
| 100 | 3 KB | 6 | 5 | 5 | 0.4 | 3 | **20 ms** |
| 500 | 16 KB | 50 | 45 | 47 | 1.6 | 13 | **155 ms** |
| 1000 | 31 KB | 224 | 215 | 201 | 2.7 | 23 | **666 ms** |
| 2000 | 64 KB | 613 | 808 | 791 | 4.9 | 46 | **2,262 ms** |

For scale: the largest document the playground ships is 8 KB with 14 table
rows, and the whole twenty-document catalogue is 60 KB. A 500-row paste is
roughly sixty times the largest thing on the page.

### What the numbers say

**Rendering is not the problem.** `marked.parse` never reaches 5 ms and the
preview write never reaches 50; together they are under 3% of the pass at
every size. This is worth stating because "it must be the Markdown" is the
natural guess and it is wrong by two orders of magnitude. Chart rendering does
not appear at all — the generated documents carry no charts, and a chart's
cost is bounded by its series rather than by the table.

**The cost is spread across the three engine calls, not concentrated in one**
— they are within ~30% of each other at every size — **and each is
superlinear.** Doubling the rows roughly quadruples the pass: 155 ms → 666 ms
→ 2,262 ms.

**Four passes, one document.** `fmt`, `pgEval` and `pgExplain` each locate,
build and check the whole text from scratch, and `hasStaleFindings` adds a
fourth on every settle where a quest step is watching for STALE — which is
every tutorial chapter that has one, i.e. most of the time anyone is actually
using the page. So a tick pays for four full passes over the same document,
and the table above only shows three of them: the measured 2,262 ms at 2,000
rows is the three-call pass, and the quest-watching case is nearer 2.9 s.
That is the largest single lever available and it is a 3–4× one.

(The follow-up review's §2.13 is exactly this: the published measurement said
three and the code did four. Corrected here rather than re-measured — the
fourth call is the same `locate`+`build`+`check` as the third, over the same
text, so its cost is the `pgExplain` column again.)

## The decision

§2.10 offered three outcomes and said "accept it, documented" was a legitimate
one. The measurement splits the answer in two.

**The 3–4× is real, and it is not fixed here.** Sharing one `build()` across
`fmt`, `pgEval`, `pgExplain` and `check` means a combined entry point in
`src/playground/browser-entry.ts` and a look at whether `fmt`'s re-check can
consume a build the caller already has — an engine and API change. §2.10
anticipated exactly this case: "If the cost is concentrated in one phase, the
fix is probably in the engine and belongs in a different review." It is not
concentrated in one phase, but it *is* concentrated in one duplicated
structure, and that structure is the engine's.

**And it is now tracked where this repository tracks work**, which is the
other half of the follow-up review's §2.13: a design doc under a filename
beginning `playground-` is where an engine-wide API change goes to be
forgotten. See the *Shared build across the document phases* row in section F
of [`vocabulary-catalogue.md`](../vocabulary-catalogue.md). This page keeps the
numbers and stops standing in for the work item.

Two details for whoever picks it up. The measurement counts four passes, not
three (above). And the natural fix — one `build()` result shared by all four —
is the same shape as the reader-injection work in
[`browser-fs-port-plan.md`](browser-fs-port-plan.md): an API that currently
takes source text and should take a built document.

**No `Worker`.** It would move a cost that, at every size the playground is
actually used at, is 12–20 ms. The review already named the real obstacle:
`playgroundReader` reads the live CodeMirror buffer synchronously, so a worker
means serialising the document in, the results out, and re-deciding what the
ReaderPort means — non-trivial, in exchange for nothing a visitor can
perceive.

**No input cap.** A cap has to pick a number, and the honest number is not
about rows: it is about how long a pass takes, which the page can simply
measure.

**What ships is the cheap half: the debounce sizes itself to the last pass.**
`EDIT_DEBOUNCE` becomes a floor rather than a constant, and the next wait is
`min(max(500 ms, last pass), 3000 ms)`. A document heavy enough to lock the
tab locks it once per typing pause instead of continuously, so the page stays
usable while someone types in it rather than fighting them for the thread.
Past 250 ms the page also says so once in TERMINAL, with the actual number and
a pointer here — the lag stops being mysterious, and saying it once rather
than every pass keeps the explanation from becoming the noise.

For every document the playground holds, and for anything a visitor is likely
to hand-type, none of this engages: the pass is 12–20 ms and the wait stays at
the 500 ms floor the review called well chosen.

## Verification

The table above, measured twice with consistent results. The floor behaviour
is pinned in `test/playground/app/pipeline-cost.test.ts`: the wait never drops
below 500 ms, tracks the last pass above it, and is capped at 3 s.

## Addendum: the debounce is per file (follow-up review §2.1)

What shipped here was one number and one boolean for the whole session:
`lastPass`, and a `saidItIsSlow` one-shot. Both outlived the document they
described.

Paste a 2,000-row table into `demo.md`, then open `01-tables.md` (8 KB): the
next keystroke waited `nextDebounce(2262)` = 2,262 ms, for a document that
checks in twelve. The reverse missed too — switching *into* a heavy document
got one 500 ms pass that locked the tab, which is the exact case this shipped
for — because `switchTo` ran `runFmt`/`refreshDerived` directly rather than
through the timed path, so a switch never measured anything. And the one-shot
message says "this document", then stays silent while the second heavy
document waits three seconds with no explanation at all.

Both are now keyed to the file. `createPassCosts()` holds a `Map` of measured
costs and a `Set` of documents already explained; `Pipeline.runNow()` is the
timed pair every non-typing path calls (a file switch, a revert, "Infer and
write"), so a document is measured *before* its first keystroke rather than
after it. A never-measured file starts at the `EDIT_DEBOUNCE` floor — seeding
it with the last known cost of something else is the bug this replaces wearing
a different hat.

Pinned in `test/playground/app/pipeline-cost.test.ts`: a heavy document does
not make a light one wait, a light one does not make a heavy one under-wait, a
re-measurement replaces the old one, and the slow-document line is said once
per document rather than once per session.

## Not in scope

Sharing one build across the four engine calls — see the decision above; it is
an engine change with a number attached, not a playground one, and it is now a
catalogue row rather than a paragraph here.
