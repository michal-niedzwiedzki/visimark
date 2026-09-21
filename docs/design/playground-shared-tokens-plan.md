# What docs/ actually repeats — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.13 (row 13, Low).

**Goal:** answer the concern the finding was really about — "they will drift,
silently, because nothing compares them" — having first checked the finding.

---

## The finding does not reproduce as written

§2.13 says the topbar CSS exists twice, and asks for
`playground.html`'s `.topbar`, `.brand` and `.nav` rules to be compared
against `docs/styles.css`.

`grep -c topbar docs/styles.css` returns **0**. There is no second copy:

| page | its chrome | where the CSS is |
|---|---|---|
| `playground.html` | `.topbar` — brand, nav, status badge | inline, this page only |
| `index.html` | `.masthead` — logo, wordmark, subtitle | `styles.css` |
| `preview.html` | `.masthead` | `styles.css`, which it links |
| `tutorial.html` | `.bar` | inline, and a light theme of its own |

`index.html` and `preview.html` already share one definition, through the
stylesheet they both link. `tutorial.html`'s bar belongs to a deliberately
different visual language — a light document viewer rather than a dark IDE —
and is not the same component wearing a different name. **There is no
duplicated component to extract.** Recorded here, and pinned by a test, so the
next person reading the review does not go looking for the second copy.

## What is repeated

A short list of scalars, all of them between `styles.css` and the two pages
with CSS of their own:

- three font stacks — the system sans, the `SF Mono` stack, and the
  `Caveat`/`Bradley Hand` hand-written stack;
- the brand red `#ff453a`, the ink `#1b1b1b`, the paper `#f4f4f4`;
- the page backdrop `linear-gradient(180deg, #252422 0%, #403d39 100%)`.

Ten or so declarations.

## The decision

§2.13 framed this as a weighing — a `tokens.css` against `playground.html`
being one self-contained file, and against
[§2.5](playground-file-lifecycle-plan.md)'s request-count goal. Weighed:

**No `tokens.css`.** A stylesheet is render-blocking, so a file holding ten
declarations costs every page in `docs/` a round trip before first paint, to
remove a few hundred bytes of repetition. §2.5 has just been through the
exercise of taking twenty requests *off* the critical path and adding a
preload to shorten what was left; adding one back here would undo a measured
gain for an unmeasured one. `playground.html` also keeps the benefit §2.13
itself credited it with: no FOUC, nothing to arrive late.

**Instead, the thing that was actually missing.** The review's own sentence is
"They will drift, silently, because nothing compares them." What was missing
was not one definition — it was the comparison. `test/site-tokens.test.ts` is
it, and it is the same shape as the pairings
`test/playground/small-screen.test.ts` and `test/playground/a11y.test.ts`
already pin across markup and code.

This is a deliberate departure from §2.13's "Done when", which asks for one
definition. It is recorded as a departure rather than presented as compliance:
the finding's premise did not hold, and its remedy was priced against a goal
the same review sets elsewhere.

## What the test pins

- Every font stack in `playground.html` and `preview.html` is one of the three
  `styles.css` declares — verbatim, or not present. A page may use fewer; it
  may not use a *different* one, which is how "the same font, almost"
  happens.
- The brand red, ink, paper and backdrop appear in `styles.css`, and
  `playground.html`'s copies are the same strings.
- No hex anywhere in `docs/` is a near-miss for the brand red: a different
  colour is a design choice, a colour one channel away is a typo, and only a
  side-by-side comparison would ever catch it.
- Only `playground.html` has a `.topbar`, and `index.html` and `preview.html`
  get `.masthead` from the stylesheet rather than re-declaring it — so if the
  duplication §2.13 describes ever does appear, this fails.

## Verification

`bun test packages/visimark/test/site-tokens.test.ts`. No page changed, so
there is nothing to look at: the two pages still look identical because
neither of them moved.
