# How a file becomes current — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.5, §2.7 and §2.8 (rows
5, 7 and 8, all Medium). §3 of the review: "all rewrite how a file becomes
'current' and are one piece of work, not three." They are done as one.

**Goal:** the page stops fetching twenty documents to show one, the visitor's
work survives a reload, and the address bar names what is on screen.

---

## What it looked like before

- **§2.5** — `loadFiles()` fetched all twenty documents (~124 KB, 21 round
  trips) before CodeMirror was constructed, though only `demo.md` or `?file=`
  is ever displayed.
- **§2.7** — `contents` was a plain in-memory object. Earned badges persisted
  to `localStorage`; the work did not. Someone eight chapters into the
  tutorial who refreshed lost every edit, with no warning that this would
  happen.
- **§2.8** — `?file=` was read exactly once and never written.
  `grep -c 'pushState\|replaceState'` returned 0, so switching files left the
  address bar lying and nobody could link a colleague to a chapter.

## A bug found on the way in

`switchTo` did not switch the file. Clicking a document in FILES changed the
filename label, the SCENARIO panel and the diagnostics, and left the previous
document in the editor.

`store.text(name)` prefers the live CodeMirror buffer when `name` is the
current file — correct for reads, because the buffer is the truth. But
`files.ts` did:

```ts
store.switchTo(name);              // name is now current
cm.setValue(store.text(name));     // ...so this reads the editor
```

which is `cm.setValue(cm.getValue())`. It arrived with the §2.11 collapse of
the two file-switch paths (PR #108) and shipped in #114; both copies of the
old code had the same shape, so the deduplication preserved it faithfully.
Verified present at `fb8802e` and fixed here: `switchTo`, `revert` and
`revertAll` now write the editor themselves, so the invariant is one sentence
— *the editor holds the current file's text* — rather than a rule each caller
has to remember. `stored()` exists for reads that must not consult the editor.

## The decisions

### §2.5 — what is lazy, and what is not

**The catalogue is not lazy; only the bytes are.** `FILE_SOURCES` is static
and known before a request goes out, so FILES lists all twenty documents from
the first paint. `store.ensure(name)` fetches on first open.

**The data dependency the review warned about.** `READER_FS` needs
`13-imports.csv` present whenever `13-imports.md` is open, and the ReaderPort
is *synchronous* — there is no await to reach for once the engine is
mid-check. So `DATA_DEPENDENCIES` declares the pairing and `ensure()` resolves
it on the way in. Verified: `?file=13-imports.md` boots with exactly two
document requests and the import still evaluates.

**BUILD loads, then builds.** §2.5 asked which of the two meanings survives.
The BUILD panel's own copy promises "the same `visimark check` a CI pipeline
would run", and a CI pipeline does not skip the files nobody opened — so the
button fetches what is missing and only then checks. Slow once, honest. The
alternative would have made the result depend on which chapters the visitor
had clicked, which is a worse thing to be fast at.

**Idle prefetch**, so the honesty above is rarely paid for: once the page is
interactive, `requestIdleCallback` pulls the rest in. Nothing waits on it.

**`<link rel="preload">` for the two bundles**, which the review suggested and
the measurement vindicated: with the documents off the critical path, what
remains between navigation and first render is almost entirely the 288 KB
engine and its 35 KB application, and their `<script>` tags are at the end of
`<body>` where they are discovered last. Not the starting document — 4 KB
against 288, and `?file=` makes the guess wrong for anyone arriving on a
tutorial link.

### §2.7 — what is persisted, and what can shadow what

**Only changed buffers**, diffed against the bundled text, as §2.5 suggested:
it keeps a full tutorial run to a few KB and makes "revert this file" a delete
rather than a re-fetch.

**A stale copy cannot shadow an updated document.** This is the case §2.7
asked to be designed against, and last-write-wins is exactly the bug this
product exists to catch — so each entry carries `base`, the SHA-256 of the
bundled text it was edited from, and is discarded when the bundled text stops
hashing to it. The digest is VisiMark's own synchronous `sha256Hex`, the same
one the import chapter verifies its CSV with. A discard is *reported*, in
TERMINAL: silently replacing someone's content is the thing the page is about.

Because most documents now arrive after first paint, `discarded()` drains
rather than accumulates, and is reported both at boot and after the prefetch.

**No `beforeunload`.** §2.7 suspected the better answer is simply that saving
works, and it is: an intrusive interstitial to protect work that is already
safe would be worse than the problem.

**Two reset controls**, which is what "visible, discoverable way to reset one
file and all files" asks for:

- *Revert* sits in the EDITOR head and appears only while the open document
  differs from the one that shipped. A control that is present exactly when it
  would do something is more discoverable than one that is always there and
  usually inert — and its presence doubles as the page's only sign that an
  edit is being kept.
- *Reset all documents* sits under "+ New", behind a confirm. Files the
  visitor created are left alone: "restore the documents this page shipped
  with" is a promise about the bundled documents, and deleting someone's
  scratch file under that label is a different, unasked-for operation.

A dot in FILES marks every edited document, including ones saved in an earlier
session and not yet fetched — otherwise §2.5's lazy loading would make an
edited chapter look untouched right up until it is opened.

**Quota and private mode** degrade to the pre-§2.7 behaviour, reusing the
discipline `badges.ts` already established rather than re-inventing it: every
read and write is wrapped, the edit stays in memory, and only the reload is
lost.

### §2.8 — the address bar

**`?file=`, not a hash.** The review asked for every link depending on the
current shape to be checked first. A grep of `docs/`, `README.md` and
`packages/` for `playground.html?` finds *none* — the parameter was documented
and never linked — so there was nothing to migrate.

**`replaceState`, not `pushState`.** The review put the trade plainly: Back
walking the chapter history is good for a tutorial and noisy for idle
clicking. Twenty entries one click apart is what the FILES panel invites, and
someone who has clicked through eight of them should still leave with one
Back press. The address bar is shareable either way, which is the thing that
was broken. It is written on first paint too, not only on the first switch.

**The diagnostic tab stays out of the URL.** It is a view of the current
document rather than a place, it already resets on every file switch, and
serialising it would put two knobs in a link where the person pasting it means
one. That is §2.8's over-serialisation question, answered rather than left
open.

## Verification

Measured in headless Chromium against the served tree, at 60 ms RTT / 4 Mbps,
three runs each, `fb8802e` against this commit:

| to first interactive | before | after |
|---|---|---|
| requests | 34 | **15** |
| transferred | 481 KB | **445 KB** |
| wall clock | 1,630 ms | **1,500 ms** |

Time-to-interactive is now gated on one document instead of twenty. The wall
clock moves less than the request count because the 288 KB engine bundle
dominates what is left — which is what the preload above is for, and worth
recording as the next lever rather than implied.

Driven end to end in the same browser: `?file=13-imports.md` boots with two
document requests and evaluates the import; a file switch changes the document
(the bug above); an edit raises the Revert control, marks FILES and writes
`localStorage`; a reload restores it, with the mark visible before the
document is fetched; Revert restores one file and Reset all restores the rest
while keeping a created file; a planted entry with a mismatched `base` is
discarded and reported in TERMINAL; BUILD reports 14/19 passing, identical to
`fb8802e`.

Unit tests: `test/playground/app/buffers.test.ts` (freshness, drain,
created files, quota and corrupt payloads), `store.test.ts` (catalogue vs
loaded, data dependencies, the switch regression, dirtiness including the
unloaded case, both reset paths), `url.test.ts` (existing links, replace not
push, other query keys preserved, no tab in the URL).

## Not in scope

§2.10's main-thread measurement and §2.13's shared chrome — both independent
of how a file becomes current.
