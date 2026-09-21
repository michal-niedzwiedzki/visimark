# Tab, keyboard and motion semantics for the playground — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.3 (row 3, High). Stacked
on [§2.4](playground-app-extraction-plan.md),
[§2.1](playground-boot-failure-plan.md) and
[§2.2](playground-small-screens-plan.md) — §2.2 and §2.3 touch the same markup
and were planned together, as §3 of the review asks.

---

## What it looked like before

`grep -c 'role='` returned **0**. `grep -c '<label'` returned **0**. The only
ARIA on the page was one `aria-label="Site"` on the nav.

- The six `.diag-tab` buttons were two tab sets in every respect except the
  ones a screen reader can perceive: no `role="tablist"`/`tab"`/`tabpanel"`, no
  `aria-selected`, no `aria-controls`, no roving `tabindex`, no arrow keys.
  Reaching the BUILD or REFERENCE tab from the keyboard meant tabbing to a
  button whose state was never announced.
- `<textarea id="editor-ta">` had no accessible name, and CodeMirror 5 hands
  assistive technology a `<textarea>` it creates itself — the one in the markup
  is replaced, so labelling it would not have helped either.
- Eight transitions and a full-screen confetti burst fired regardless of
  `prefers-reduced-motion`.

## The decisions §2.3 asked for

**Full APG pattern, not the minimum subset.** The subset (`role`,
`aria-selected`, `aria-controls`) announces correctly but leaves every tab in
the Tab order, which is the thing that makes a six-tab page tedious rather than
merely unlabelled. The full pattern brings roving `tabindex` and arrow-key
navigation, and changes `selectTab()`'s contract for both groups at once — a
real design change, and the moment to make it is while the code is being
rewritten anyway (§2.4), not later against a stable file.

**Automatic activation** — arrowing to a tab selects it rather than requiring a
further Enter. The APG recommends that when the panels are already loaded and
switching costs nothing, which is exactly the case here: every panel's content
is computed by the same pipeline pass whether or not it is on screen.

**The editor's name is the filename.** It changes per file, and
`#editor-filename` already tracks that for sighted visitors, so both are now
set in one function rather than two places that can disagree.

## How it is split

Markup carries what is *structural* and never changes — `role="tablist"`,
`role="tab"`, `role="tabpanel"`, the ids, `aria-controls`, `aria-labelledby`,
and `tabindex="0"` on each panel so its scrollable content is reachable from
the keyboard. `tabs.ts` owns what is *stateful* — `aria-selected` and the
roving `tabindex` — because those have to move whenever the selection does,
including when `select()` is called from somewhere else entirely (a file switch
resets the diagnostics group to REASONING).

Motion is split the same way, for a harder reason: the transitions are CSS and
are collapsed by `@media (prefers-reduced-motion: reduce)`, but the confetti is
a `<canvas>` painted by JavaScript and can only be suppressed in code. Hence
`motion.ts`. It reads the query per call rather than caching it, so a visitor
who turns the preference on mid-session is taken at their word without a
reload. When the burst is skipped the completion reveal is no longer held back
`CONFETTI_SETTLE_MS`, since there is nothing left to wait for.

Transitions are collapsed to `0.01ms` rather than removed, so anything keyed to
`transitionend` still fires.

## Verification

Driven for real in headless Chromium over the DevTools protocol, against the
served page:

| action | result |
|---|---|
| focus REASONING, press `ArrowRight` | `knowledge` selected (`aria-selected=true`, `tabindex=0`), REASONING deselected, focus on KNOWLEDGE, the KNOWLEDGE panel active |
| press `End` | `infer` selected, focus follows |
| press `ArrowRight` from the last tab | wraps to `reasoning` |
| click a file in FILES | `#editor-filename` and the CodeMirror textarea's `aria-label` both read `03-sheets.md`; the diagnostics group resets to REASONING with `aria-selected` moved |

At boot, all six tabs carry the right `aria-selected`/`tabindex` pair and all
six panels exist. Under `--force-prefers-reduced-motion` the query matches, the
computed `transition-duration` on a quest step is `1e-05s`, and the page still
works.

`test/playground/a11y.test.ts` is the regression guard §2.3's "done when" asks
for. It checks the pairing in both directions — every tab's `aria-controls`
names a panel that names it back — that exactly one tab per group is selected
and is the strip's only tab stop, that all four keys are handled and the strip
wraps, that the editor's name is set on `cm.getInputField()` and tracks the
file, and that the confetti is gated on the preference.

## What is not covered

An automated axe-class audit needs a DOM in the test runner, which this
repository does not have and which is a larger decision than this section. The
checks above are structural and source-level; they hold the specific findings
§2.3 names rather than standing in for a full audit.
