# What the playground is below 900px — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.2 (row 2, High). Stacked
on [§2.4](playground-app-extraction-plan.md) and
[§2.1](playground-boot-failure-plan.md).

**Goal:** a visitor on a phone gets an answer instead of five unusable slivers
on a page that deliberately cannot scroll.

---

## What it looked like before

`grep -c '@media'` returned **0**. `.playground` was `height: 100vh; width:
100vw` over `html, body { overflow: hidden }`, with five flex panels sharing
the width. Below roughly 900px the FILES/EDITOR/PREVIEW columns became slivers
and nothing scrolled, because the page cannot — `overflow: hidden` is what
makes the panel layout work at all. `100vh` compounded it: on mobile Safari and
Chrome that is the viewport with the browser chrome *retracted*, so the bottom
action bars sat underneath the toolbar with no way to scroll them into view.

This is the page the README and `index.html` send people to.

## The decision §2.2 asked for

The review was explicit that this is a product question, not a CSS one, and
listed three plausible answers: a single-panel view with a switcher; an
editor+preview pair with diagnostics in a drawer; or an honest "this demo needs
a wider screen" interstitial.

**The interstitial.** The playground's whole claim is that you can watch the
source, the preview, the terminal and the extracted knowledge move *together*
— which is why it is five panels and not one. A phone-sized version that shows
one panel at a time does not demonstrate that; it demonstrates a text editor.
The tutorial covers the same ground in prose, with every example worked
through, and reads perfectly well on a phone, so there is somewhere honest to
send people.

This also means §2.2's warning about the `flex: 5/95`, `82/18`, `55/…` ratios
does not apply: there is no second set of ratios to express, because there is
no second layout. That was a real part of the appeal.

**Hard block, no escape hatch.** A "continue anyway" button would lead to the
five slivers the interstitial exists to avoid, and anyone who wants them can
already reach the page from a desktop browser or by requesting the desktop site.

## How it is built

Two halves, and they have to agree:

1. `@media (max-width: 899px)` in `docs/playground.html` hides `.playground`
   and the boot overlay, shows `.small-screen`, and restores `height: auto;
   overflow: auto` on `html, body` so the interstitial scrolls like the
   ordinary document it is. Its padding carries `env(safe-area-inset-*)`, so
   nothing sits under the browser chrome or a notch.
2. `whenWideEnough()` in `src/playground/app/boot.ts` —
   `matchMedia("(min-width: 900px)")` — is awaited before anything else in
   `boot()`. Below the breakpoint there is nothing on screen to fill, so the
   application does not fetch 22 documents, does not construct a CodeMirror
   instance and does not run the engine. It resolves on the first `change`
   event past the breakpoint, so dragging a desktop window back open boots the
   playground rather than revealing a dead one.

`height: 100vh` becomes `100dvh`, and `width: 100vw` becomes `100%` — the
latter because `100vw` includes the scrollbar gutter and overflows the document
by its width.

## Verification

Rendered in headless Chromium at four widths against the real `docs/` tree:

| width | boot overlay dismissed | FILES entries | BUILD |
|---|---|---|---|
| 390px | — (no boot) | 0 | NOT RUN |
| 899px | — (no boot) | 0 | NOT RUN |
| 900px | yes | 20 | PASSING |
| 1280px | yes | 20 | PASSING |

The breakpoint is exact in both directions, and below it the application
genuinely does not run rather than running invisibly. Screenshots at 390 × 844
and 1280 × 900 confirm the interstitial reads with a 16px gutter and no
horizontal scroll, and that the desktop layout is untouched.

`test/playground/small-screen.test.ts` pins the pairing: that the CSS and JS
breakpoints are the same number, that the media query replaces the layout
rather than narrowing it, that scrolling is restored, that `whenWideEnough()`
is awaited *before* the first fetch, and that no `height: 100vh` has come back.

## Not in scope

§2.3's tab and motion semantics touch the same markup and land next, which is
the pairing §3 of the review asks for.
