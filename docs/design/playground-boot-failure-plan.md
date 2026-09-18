# Give the playground's boot a failure path — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.1 (row 1, **Critical**).
Behaviour change with no new engine surface — no paired spec. Lands on top of
[§2.4's extraction](playground-app-extraction-plan.md), which is what made it
reviewable by tooling instead of by eye.

**Goal:** no path between navigation and first render ends in silence. Every
`await` is inside a handler, every failure names the resource and the likely
cause, and the panels are covered by a "loading…" state until there is
something in them.

---

## What it looked like before

The whole application was one `(async function () { … })()` with no `try` in
it and no top-level rejection handler. `loadFiles()` did `Promise.all` over 21
`fetch()`es and `loadScenarios()` a 22nd. One 404, one flaky network, one
`file://` open, and the IIFE rejected into the void: the visitor got the fully
styled dark shell with an empty file list, an empty editor, and **no message at
all**. There was no loading state either — the panels simply sat empty until
all 22 responses landed.

## The decisions §2.1 asked for

**(a) Partial boot or loud failure?** Partial, with a stated rule: *a partial
boot is offered whenever what is missing costs a feature, and refused when it
costs the editor.*

| missing | outcome |
|---|---|
| one example or chapter | dropped from FILES, one red TERMINAL line naming the path and the status |
| `playground/scenarios.json` | editor and every diagnostic panel work; the SCENARIO panel says the tutorial track did not load; TERMINAL says it too |
| `vendor/visimark-browser.js`, CodeMirror or `marked` | fatal overlay, naming which script did not arrive |
| the starting document (`demo.md`, or `?file=`) | fatal overlay — there is nothing to open |
| anything thrown by the wiring | fatal overlay, labelled a bug, with the stack |

The tutorial track is load-bearing for the *tutorial*, not for the playground:
a visitor who came to paste a table and watch `check` run does not need
`scenarios.json`, and failing their visit because a quest file 404'd would be
the wrong trade. But the panel has to *say* it is missing, because hiding it
looks exactly like a file that simply has no scenario.

**(b) Where does the error surface?** A full-page overlay for the fatal cases,
TERMINAL for the non-fatal ones. TERMINAL is already the page's place for "a
command had something to say", so a dropped document belongs there, above the
first `visimark fmt` line. It is the wrong surface for a fatal error, because
a visitor who cannot see the editor has no reason to look at a panel below it.

**(c) Does `file://` deserve its own message?** Yes. It is one distinct,
predictable, recoverable failure that would otherwise present as 22 identical
CORS errors, and it is the most likely way a new contributor first opens this
file. It is detected from `window.location.protocol` before any fetch is
attempted, and the message is the fix: `bun run serve`, then the URL.

## The one failure the application cannot report

If `vendor/visimark-playground.js` itself does not arrive, no code of ours runs
to say so. That is why the overlay is **markup, visible at first paint**, and
why its resting copy is not a bare spinner: it says what is being fetched, and
then says that if the message stays put, the bundle did not load and the page
probably needs a server. A stuck overlay is therefore still an explanation.
This also gives §2.1's requested loading state for free — the overlay is
dismissed once, after the first `fmt`/refresh pass, rather than being a second
mechanism.

## Verification

Behaviour was checked by rendering, in headless Chromium, across four trees:

| tree | result |
|---|---|
| the real `docs/` over http | overlay dismissed, `BUILD PASSING` |
| `docs/playground.html` opened as `file://` | "The playground needs a web server", with `bun run serve` in the detail |
| `scenarios.json` renamed, `example-charts.md` deleted | overlay dismissed; SCENARIO explains the missing track; TERMINAL carries both failures; the editor and every panel work |
| `playground/demo.md` deleted | overlay stays, "The starting document (demo.md) did not arrive", detail `playground/demo.md: HTTP 404` |

`test/playground/app/sources.test.ts` is new and covers the loader contract
that makes the partial boot possible: one 404 costs one document and is not
contagious; a network error is reported rather than thrown; every failure
carries the path that was actually requested, since that is what the overlay
and TERMINAL print.

## Not in scope

§2.5 will make most of those 21 fetches lazy, at which point "which documents
failed" becomes a smaller set and a later question. The classification above is
written so that change does not invalidate it: it is about what a missing file
costs, not about when it is fetched.
