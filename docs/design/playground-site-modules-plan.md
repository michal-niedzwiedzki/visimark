# The other four pages — Implementation Plan

**Source:** `docs/reviews/2026-09-20-playground-followup.md` §2.3 (row 3,
High). It is the largest item in that review and the only one bigger than the
review it follows.

**Goal:** §2.3's own — "the four gates fail on a bad edit to `index.html`'s
script; every page under `docs/` either carries a CSP or has a recorded reason
not to; and the decision for each of the four is written down the way the
playground's was."

---

## What it looked like before

The original review scoped `playground.html`, and §2.4 and §2.6 answered it
completely: 1,535 lines of inline `<script>` became a typed module tree under
the existing gates, and the page got a real `default-src 'none'` allowlist.

Next door, unchanged:

| page | inline `<script>` | CSP |
|---|---:|---|
| `index.html` | 578 lines, 4 blocks | none |
| `tutorial.html` | 183 lines | none |
| `ci.html` | 112 lines | none |
| `preview.html` | 70 lines | none |

943 lines that no linter, typechecker, formatter or test in this repository
could see, which is §2.4's finding verbatim — and `index.html`'s share of it
is larger than any module in `src/playground/app/`, on the page the README
sends people to first. `grep -c Content-Security-Policy docs/*.html` returned
1 of 5.

**Credit first, so the scope stays honest.** Two of the three §2.6 findings do
not repeat here. `tutorial.html` and `preview.html` both already had real
`fetch` failure paths with `file://`-specific copy, and `preview.html`
validates its `?file=` against `/^[A-Za-z0-9_-]+\.md$/` before fetching or
interpolating it. What repeats is the *tooling blindness* and the *missing
CSP*, and that is what this changes.

## The decisions

### (a) Where the code goes: TypeScript, not a plain `.js`

§2.3 put the choice as a third bundle against a plain `docs/site.js` that
oxlint and oxfmt pick up with no build step, and noted the calculus that
produced the TypeScript answer for the playground might produce the plain-JS
answer here, "because `index.html`'s script is a landing-page demo and not an
application."

**TypeScript, under `packages/visimark/src/site/`.** Two things decide it.

The first is that "four gates" means four. A `docs/site.js` is seen by oxlint
and oxfmt and by nothing else — no typecheck, and no test, because a file that
runs page wiring on import cannot be imported by a test. The review's own
"done when" asks for all four to fail on a bad edit, and two of four is the
outcome that leaves `splitBlocks` — a CommonMark fence rule implemented by
hand, the largest piece of real logic on the site — untested for the same
reason it was untested before.

The second is that the tax is already paid. `playground-bundle` diffs the
whole of `docs/vendor/`, so a fourth, fifth and sixth artifact in that
directory cost nothing new: the staleness guard, the pinned Bun, and the
failure message all already exist and already cover them.

### (b) One bundle behind a page check, or one per page

**One per page.** The alternative the review offered — fold it into the
playground app bundle behind a page check — would ship `index.html`'s
landing-page code to everyone who opens `preview.html`, and the playground's
37 KB to everyone who opens any of them. Four entry points out of shared
modules is one line of build script and gives each page only what it uses:

| bundle | minified |
|---|---:|
| `visimark-site-index.js` | 7.5 KB |
| `visimark-site-tutorial.js` | 3.4 KB |
| `visimark-site-ci.js` | 2.0 KB |
| `visimark-site-preview.js` | 1.3 KB |

The sharing that matters happens at the module level instead, and it is real:
`ci.html` and `tutorial.html` both carried their own copy of the `<dialog>`
table of contents, down to the two comments explaining why the backdrop click
works and why the dialog closes before it scrolls, and their own copy of the
`file://` failure paragraph — the single piece of copy on these pages a reader
is most likely to actually meet. Those are now `toc.ts` and
`source-document.ts`, once.

### (c) The same effort for all four, or a CSP only for the small ones

§2.3 asked whether `ci.html` and `preview.html` are worth the same effort as
`index.html`, "or whether the honest answer is that they are small and rarely
visited and get the CSP only."

**All four, and the reason is that after (a) and (b) the small ones are
nearly free.** `ci.html` is 112 lines of which roughly 70 are the TOC dialog
`tutorial.html` already needed extracted; `preview.html` is 70 lines and the
smallest bundle here. Extracting them costs less than writing down why they
were skipped, and leaving two pages inline would mean the `test/site/csp.test.ts`
sweep needs an exemption list — which is the shape of a rule that erodes.

### (d) What each policy grants

Every page gets `default-src 'none'`, closed `base-uri` and `form-action`, and
no `'unsafe-inline'` for script — the last being the whole point, and possible
only because of (a).

| page | script-src | style-src | connect-src | font-src |
|---|---|---|---|---|
| `index.html` | cdnjs | `'unsafe-inline'`, cdnjs, googleapis | — | gstatic |
| `tutorial.html` | cdnjs | `'unsafe-inline'` | `'self'` | — |
| `ci.html` | cdnjs | `'unsafe-inline'` | `'self'` | — |
| `preview.html` | cdnjs | `'unsafe-inline'`, googleapis | `'self'` | gstatic |

`style-src` keeps `'unsafe-inline'` on all four, for the reason
`playground.html`'s does and one more: mermaid injects a `<style>` into every
diagram it renders, Swiper's bundle injects its own, and the dependency graph
is coloured by setting element styles. An inline-style injection is a
defacement, not code execution.

`index.html` gets **no `connect-src` at all**, which under `default-src
'none'` means none: nothing on that page fetches anything, because its demos
render Markdown that is already in the markup. The other three fetch exactly
one sibling document each, which is what `'self'` is for.

`img-src 'self'` everywhere — every image on all four pages is a sibling file.
No page grants `data:`; that is the playground's chart grant and it stays
there (see [`playground-csp-plan.md`](playground-csp-plan.md)).

**`<script type="text/plain">` is not inline script.** `index.html` carries
eight Markdown snippets in data blocks, and they stay: the demos are curated
excerpts for that page's narrative rather than copies of `docs/*.md`. The HTML
spec settles the type before it consults CSP, so a non-JS `type` is never
executed and never checked — which is why the policy can refuse inline script
while the page keeps its data.

## What moved where

```
src/site/
  dom.ts              byId (null on a miss, unlike the playground's), escapeHtml, slugify
  blocks.ts           splitBlocks — the CommonMark fence rule, testable at last
  toc.ts              the <dialog> contents, shared by ci and tutorial
  source-document.ts  the one fetch and the one failure paragraph
  demo-panes.ts       dedent + the landing page's source/preview pairs
  preview-cards.ts    the Author/Adopt/Enforce slides and their table arithmetic
  index-page.ts       entry — diagrams, demos, Explore toggles, cards
  tutorial-page.ts    entry
  ci-page.ts          entry
  preview-page.ts     entry
```

`tsconfig.app.json` — the program that carries the DOM lib, so the engine and
the CLI keep failing the typecheck if they ever reach for a browser global —
grows from "the playground application" to "the browser UI", and covers
`src/site` and `test/site` too. One program rather than two: the two
directories are the same kind of thing and share the CDN-library declarations
(`marked` is used by five pages and declared once).

## Verification

Rendered in headless Chromium against the served tree, reading the browser's
security log rather than the DOM, since a CSP failure is quiet in the markup:

| page | rendered | CSP violations | console errors |
|---|---|---|---|
| `index.html` | 2 mermaid flowcharts, 7 demo pairs, 3 cards laid out | none | none |
| `tutorial.html` | 572 source/output block pairs, 138 TOC links | none | none |
| `ci.html` | 56 headings slugged, 62 TOC links | none | none |
| `preview.html` | source and preview both filled | none | none |
| `playground.html` | boots, `?file=` honoured, quest renders | none | none |

Unit tests: `test/site/site-scripts.test.ts` covers the three functions with
real logic in them — `splitBlocks` (nested fences, mismatched fence
characters, a closing fence with an info string, CRLF), `dedent`, and the
preview cards' table arithmetic, padding and column alignment.
`test/site/csp.test.ts` is the sweep: it reads every `docs/*.html` and checks
the policy against the page rather than against a copy of itself, so a new CDN
tag, a re-inlined script or a stale grant fails before it ships.

## Not in scope

The pages' CSS, which is still inline on three of them and in `styles.css` for
the other two — see
[`playground-shared-tokens-plan.md`](playground-shared-tokens-plan.md), which
ruled on that separately and whose conclusion (the repeated values are a
handful of scalars, guarded by `test/site-tokens.test.ts`) has not changed.
Closing `style-src` would depend on it, and it is a different piece of work.
