# VisiMark — playground review follow-up

**Date:** 2026-09-20 · **Commit:** `77276dd` · **Scope:** the work that answered
[docs/reviews/2026-09-17-playground.md](docs/reviews/2026-09-17-playground.md)
— [#114](../../pull/114) (§2.1–§2.4, §2.11) and [#115](../../pull/115)
(§2.5–§2.13) — plus what those two commits left behind.

Reviewed: the 23 modules and 3,104 lines of
[packages/visimark/src/playground/app/](packages/visimark/src/playground/app/),
the 1,510 lines of test beside them, the 1,843-line
[docs/playground.html](docs/playground.html) they load from, the eleven
`docs/design/playground-*.md` decision records, and the four sibling pages in
`docs/` that the original review did not scope.

**Verification run at this commit:** `bun test` 1106 pass / 0 fail;
`bun run lint`, `bun run typecheck`, `bun run format:check` all clean;
`bun run --filter visimark build:playground` produces no diff in `docs/vendor/`.
Every finding below was re-derived against that tree, and the ones marked
*verified* were reproduced in a runnable test rather than read off the diff.

**Overall: A−**, against the C+ this page carried three days ago. That is not a
polite upgrade. Thirteen findings were answered, none of them cosmetically:
the inline script is a typed module tree under the existing gates, the CSP is a
real `default-src 'none'` allowlist rather than a gesture, the boot path names
the resource it could not load, and the §2.10 measurement was actually taken
and actually contradicted the guess the review was careful not to make. Two of
the commits went further than the rows asked — #115 found and fixed a
file-switch bug that #114 had faithfully preserved through the §2.11 dedup, and
recorded §2.13 as a *departure* rather than dressing a non-reproducing finding
up as compliance. That is the hardest thing on this list to do and it was done
unprompted.

What follows is the residue. Most of it is the seam where two rows that shipped
together do not quite compose, which is the characteristic failure of answering
a thirteen-row review in two passes — and one structural item that is bigger
than anything in the original list.

---

## 1. Findings

| # | Area | What the code actually does | Severity | Suggestion |
|---|---|---|---|---|
| 1 | **The adaptive debounce follows you to the next file** | `lastPass` and `saidItIsSlow` ([pipeline.ts:159-160](packages/visimark/src/playground/app/pipeline.ts#L159)) live for the lifetime of the pipeline. Nothing resets them on a file switch, and `switchTo` runs `runFmt`/`refreshDerived` directly rather than through the timed `runPass`, so a switch never updates them either. Paste a 2,000-row table, then open `01-tables.md` (8 KB): the next keystroke waits `nextDebounce(2262)` = **2,262 ms** before anything updates. *Verified.* The reverse also misses — switching *into* a heavy document gets one 500 ms pass that locks the tab, which is the exact case §2.10 shipped this for. And `saidItIsSlow` is a session-wide one-shot whose message says "*this* document", so the second heavy document gets a 3 s wait with no explanation at all. | **High** | Key both to the file; reset on switch. [§2.1](#21-reset-the-pass-cost-when-the-file-changes-row-1) |
| 2 | **A malformed `scenarios.json` is fatal at boot and silently corrupting on a switch** | `normalizeStep` ([quest.ts:26](packages/visimark/src/playground/app/quest.ts#L26)) is documented to throw "on anything scenarios.json is not allowed to say", and neither call site catches it. At boot, `quest().render(initial)` throws into `boot().catch` → the full-page **"The playground failed to start"** overlay, for what costs one chapter's checklist — violating §2.1's own stated rule that a partial boot is offered whenever what is missing costs a feature. On a file switch it is worse: `void switchTo(name)` ([files.ts:99](packages/visimark/src/playground/app/files.ts#L99)) swallows the rejection *after* the store, the filename, the URL and the FILES panel have moved and *before* `tabs.select`, `runFmt` and `refreshDerived` — the editor shows the new file under the old file's TERMINAL, REASONING and PREVIEW. That is precisely the half-switch [files.ts:114](packages/visimark/src/playground/app/files.ts#L114) says "would be worse than not moving". And **nothing in CI normalizes the real `docs/playground/scenarios.json`** — `quest-steps.test.ts` tests the function against fixtures; the data file itself is validated only in the visitor's browser. | **High** | Catch per-scenario; gate the real file in CI. [§2.2](#22-make-a-bad-scenario-cost-a-scenario-row-2) |
| 3 | **Four sibling pages still carry §2.4 and §2.6 unchanged** | The review scoped `playground.html`, and it was answered completely. Next door: [index.html](docs/index.html) holds **578 lines** of inline `<script>` — larger than any module in `app/` — plus 183 in [tutorial.html](docs/tutorial.html), 112 in [ci.html](docs/ci.html), 70 in [preview.html](docs/preview.html). 943 lines that no linter, typechecker, formatter or test in this repository can see, which is §2.4's finding verbatim. None of the four carries a CSP, while the page next to them has a `default-src 'none'` allowlist; three of them do `marked.parse(…)` → `innerHTML`, which is §2.6's. `index.html` is the page the README sends people to *first*. The §2.4 machinery now exists, so the second page costs a fraction of the first. | **High** | [§2.3](#23-finish-the-site-not-the-page-row-3) |
| 4 | **"Infer and write" escapes the persistence contract** | `runInfer(true)` ([infer.ts:64](packages/visimark/src/playground/app/infer.ts#L64)) calls `store.setText(current, updated)` but never `store.persist`, then calls `pipeline.cancelPendingRefresh()` — killing the only typing-settle that would have saved it. `cm.setValue` fires `change` with origin `"setValue"`, which the handler skips, so no new timer is scheduled either. §2.7's "done when" is *a reload preserves edits*; this is the one edit path where it does not. Of the four writers to the buffer — typing, switch, `+ New`, infer — only this one is unpersisted. | **Medium** | One line. [§2.4](#24-persist-the-one-edit-path-that-does-not-row-4) |
| 5 | **`?file=` cannot name a file the visitor created** | §2.7 restores visitor-created files from `localStorage` ([store.ts:157](packages/visimark/src/playground/app/store.ts#L157)); §2.8 writes *every* current filename into the address bar, created ones included ([files.ts:132](packages/visimark/src/playground/app/files.ts#L132)). But boot resolves `?file=` against `FILE_SOURCES` alone ([main.ts:121](packages/visimark/src/playground/app/main.ts#L121)) — and must, because it runs before the buffer store exists. So the page writes `?file=scratch.md`, and on reload silently serves `demo.md` and rewrites the bar, while `scratch.md` is sitting in the FILES panel. *Verified.* The two rows shipped in the same commit and do not compose. | **Medium** | [§2.5](#25-let-the-url-name-a-created-file-or-refuse-to-write-it-row-5) |
| 6 | **`badges.ts` trusts `localStorage` where `buffers.ts` validates it** | `loadEarned()` ([badges.ts:189](packages/visimark/src/playground/app/badges.ts#L189)) is `JSON.parse(getItem(…) ?? "{}")` with no shape check. A stored `"null"` — or `"[]"`, or a number — makes `earnedBadges[name]` throw a `TypeError` inside `createBadgeBoard`, which §2.1 placed *inside the boot chain*: the whole page dies on the fatal overlay. *Verified.* `buffers.ts` ([buffers.ts:151](packages/visimark/src/playground/app/buffers.ts#L151)) versions its payload and checks its shape for exactly this reason. The newer module got the discipline; the older one became load-bearing and did not. | **Medium** | [§2.6](#26-give-the-older-store-the-newer-stores-discipline-row-6) |
| 7 | **The tests that guard §2.2/§2.3 assert on source text, not behaviour** | [a11y.test.ts:72](packages/visimark/test/playground/a11y.test.ts#L72) is `expect(tabs).toContain('tab.setAttribute("aria-selected", String(active))')`. `small-screen.test.ts` matches on exact CSS whitespace. These pass a behaviour change that keeps the string and fail a pure rename that keeps the behaviour — a change-detector, not a regression guard, which is what §2.3's "done when" asked for. The markup half of `a11y.test.ts` is fine (it asserts on the shipped artifact). It is the module half that is upside down, and `store.test.ts`'s fake-editor pattern already shows the cheap way to do it properly. | **Medium** | [§2.7](#27-test-the-behaviour-the-string-is-standing-in-for-row-7) |
| 8 | **`ensure()` and `ensureAll()` have no in-flight dedup** | Clicking a chapter while `prefetchRest` is still running fetches it **twice** — *verified*: 19 prefetch requests, the click adds a 20th for a file already in flight. `fetchMissing` ([store.ts:206](packages/visimark/src/playground/app/store.ts#L206)) snapshots `wanted` at call time, so every late `ensureAll` response re-enters `receive()` and re-runs the freshness check against a file that may since have become current and been edited. It does not corrupt today — the editor buffer wins for the current file and `buffers.restore` recovers the rest — but that is two unstated invariants doing the work of one missing map. | **Medium** | [§2.8](#28-deduplicate-in-flight-fetches-row-8) |
| 9 | **`terminal.trim()` is a caller obligation, not an invariant** | The cap exists to stop a long session growing the DOM without bound, and all 23 `line()` call sites have to remember to ask for it. `main.ts`'s boot-failure loop ([main.ts:228](packages/visimark/src/playground/app/main.ts#L228)) does not. Separately, `trim()` counts child *nodes* while its doc says "lines" — a multi-line `VM.formatCheck` block is one node, so the real cap is somewhere between 400 and unbounded depending on what was logged. | **Low** | [§2.9](#29-make-the-terminal-cap-an-invariant-row-9) |
| 10 | **`BUILD` can be left permanently disabled** | `btn.disabled = false` ([builder.ts:128](packages/visimark/src/playground/app/builder.ts#L128)) is not in a `finally`. Anything thrown above it — a DOM failure, a `byId` miss after a markup edit — leaves the button dead with "running…" beside it and no way back except a reload. `checkOne(current, …)` also runs a second full check purely to emit a quest signal for a result the loop above already computed. | **Low** | [§2.10](#210-make-build-recoverable-and-stop-checking-the-current-file-twice-row-10) |
| 11 | **Scenario data reaches a CSS selector unescaped** | `markDone`/`unmarkDone` ([quest.ts:210](packages/visimark/src/playground/app/quest.ts#L210)) do `listEl.querySelector('[data-id="' + id + '"]')`, where `id` is `raw.id` straight from `scenarios.json`. A quote or `]` throws `SyntaxError` out of a step completion. Repo-controlled today and clean at this commit (checked all 87 step ids), but `types.ts` documents `id` as free-form JSON, so the contract permits what the code cannot take. | **Low** | [§2.11](#211-escape-the-selector-or-stop-using-one-row-11) |
| 12 | **The CSP silently narrows what PREVIEW can render** | `img-src 'self' data:` means a visitor who types `![](https://example.com/logo.png)` — ordinary Markdown, in an editor whose whole point is typing Markdown into it — gets a broken image, a console violation and no message. No bundled document uses a remote image (checked), so nothing regressed; but the constraint is now a property of the editing surface and it is not written down next to the thing it constrains. | **Low** | [§2.12](#212-say-that-the-csp-constrains-the-preview-row-12) |
| 13 | **The 3× engine pass is deferred but untracked** | §2.10 correctly ruled that sharing one `locate`+`build`+`check` across `fmt`, `pgEval` and `pgExplain` is an engine change belonging to a different review, and [playground-pipeline-cost-plan.md](docs/design/playground-pipeline-cost-plan.md) has the numbers. But it is *four* passes, not three — `hasStaleFindings` ([pipeline.ts:368](packages/visimark/src/playground/app/pipeline.ts#L368)) is a fourth whenever a quest is watching — and a design doc is not a work item in a repo that tracks work as catalogue rows. | **Low** | [§2.13](#213-turn-the-deferred-engine-work-into-a-row-row-13) |

---

## 2. Suggestions

Same contract as the review this follows: each section states the problem, how
to re-derive it, what has to be decided, and what "done" looks like. Unlike
that review, several of these are small enough that the sample *is* the answer
— where that is true it is given, and where the decision is real the sample is
deliberately withheld.

### 2.1 Reset the pass cost when the file changes (row 1)

**Re-derive it.** `bun run serve`. Paste a 2,000-row table into `demo.md`, wait
for the "takes 2262ms to check" line, click `01-tables.md`, type a character,
and time the gap before PREVIEW moves. Then do it the other way round. Or
directly: `nextDebounce(2262)` returns `2262`, and nothing between a
`switchTo` and the next keystroke calls anything that would lower it.

**Decide.** Two questions. (a) Is the pass cost a property of the *file* or of
the *session*? Per-file is more honest and makes the message accurate again,
but it means a `Map<string, number>` and a decision about what a never-yet-
measured file starts at — `EDIT_DEBOUNCE`, which under-waits once on a heavy
document, or the last known cost of anything, which over-waits. (b) Should
`switchTo` measure its own `runFmt`/`refreshDerived` pair? It is already doing
the work; not timing it is why the first keystroke in a new file is always
sized from the wrong document. Timing it there means the debounce is right from
the first keystroke and costs nothing, but it makes `switchTo` a second writer
of pipeline state, which is why it is a decision rather than an edit.

A per-file shape, if (a) goes that way:

```ts
const passCost = new Map<string, number>();
const explained = new Set<string>();

/** The measured cost of the last full pass over `name`, or the floor. */
function costOf(name: string): number {
  return passCost.get(name) ?? 0;
}
```

…with `onInactivity` writing `passCost.set(store.current(), lastPass)`, the
`change` handler scheduling `nextDebounce(costOf(store.current()))`, and the
slow-document line gated on `explained` per file rather than on one boolean —
so the message stops claiming "this document" about a document it is not
describing. Whatever shape wins, `Pipeline` needs to say out loud that the
debounce is per-file, because today's interface implies it is not.

**Done when.** Switching from a 2,000-row document to an 8 KB chapter does not
inherit its wait; switching the other way does not get one free 500 ms lockup;
the "takes Nms to check" line names a document it is actually describing and
can appear more than once per session for different documents; and there is a
test on `nextDebounce` plus whatever holds the cost, since both are pure.

### 2.2 Make a bad scenario cost a scenario (row 2)

**Re-derive it.** Put `{"kind":"eval","text":"t","check":"vibes"}` into any
chapter's `quest` array in `docs/playground/scenarios.json`. Load the page:
full-page fatal overlay, no editor, for a typo in a checklist. Put it in a
chapter that is *not* the starting file instead, and switch to it: the editor
loads the new document while TERMINAL, REASONING and PREVIEW keep showing the
previous one's output, with nothing in the console but an unhandled rejection.

**Decide.** Three things, and the first is the one that matters. (a) Where the
boundary goes. `normalizeQuest` throwing is *correct* — it is how `types.ts`'s
"scenarios.json can name a check, it can never supply one" is enforced. The bug
is that nobody treats it as a per-scenario failure, which is what it is. The
natural boundary is `Quest.render`, which already has a "this file has no
scenario" branch and already has somewhere to put a message. (b) What the
visitor sees: §2.1's rule says a lost feature is announced, so the SCENARIO
panel should say this chapter's checklist could not be loaded, and TERMINAL
should carry the reason — reusing the `scenariosAvailable` path rather than
inventing a second one. (c) Whether the whole switch should still be wrapped
regardless. It should: `void switchTo(name)` currently drops *any* rejection
from five downstream calls, and the half-switch it produces is the failure mode
`files.ts` already named. A `.catch` that reports to TERMINAL and finishes the
switch is strictly better than one that reports nothing and does not.

The CI half is not a decision, it is a missing gate — the data file has a
schema, the schema is executable, and nothing runs it:

```ts
// test/playground/scenarios-data.test.ts
// scenarios.json is data a chapter author edits without touching code. The
// only thing that validates it today is a visitor's browser, where the cost
// of being wrong is a dead page (boot) or a half-switched one.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeQuest } from "../../src/playground/app/quest.js";
import { TUTORIAL_CHAPTERS } from "../../src/playground/app/sources.js";

const raw = JSON.parse(
  readFileSync(join(import.meta.dir, "../../../../docs/playground/scenarios.json"), "utf8"),
) as Record<string, { quest?: unknown[]; badge?: { icon: string } }>;
const names = Object.keys(raw).filter((n) => n !== "//");

test("every scenario's quest normalizes", () => {
  for (const name of names) {
    expect(() => normalizeQuest(raw[name]!.quest as never), name).not.toThrow();
  }
});

test("every tutorial chapter has a scenario, and every badge icon resolves", () => {
  for (const chapter of TUTORIAL_CHAPTERS) expect(names).toContain(chapter);
  // BADGE_ICONS[badge.icon] ?? "" renders nothing rather than failing, so a
  // typo here is invisible until someone earns the badge.
  const icons = readFileSync(join(import.meta.dir, "../../src/playground/app/badges.ts"), "utf8");
  for (const name of names) {
    const icon = raw[name]!.badge?.icon;
    if (icon) expect(icons, `${name}: unknown icon "${icon}"`).toContain(`\n  ${icon}:`);
  }
});
```

That test passes at this commit — 87 step ids, 13 badges, all valid. It is
worth adding precisely *because* it passes: it converts a class of runtime
fatal into a CI failure before anyone writes chapter 14.

**Done when.** A bad step costs that chapter's checklist and says so in the
panel and in TERMINAL; a file switch cannot end with the editor and the
diagnostics disagreeing about which file is open, whatever throws; and
`docs/playground/scenarios.json` is validated by the same gates as the code
that reads it.

### 2.3 Finish the site, not the page (row 3)

**Re-derive it.** `awk '/<script>/,/<\/script>/' docs/index.html | wc -l` →
578. Repeat for `tutorial.html` (183), `ci.html` (112), `preview.html` (70).
`grep -c Content-Security-Policy docs/*.html` → 1 of 5. Introduce a syntax
error into `index.html`'s script and run all four gates: they pass.

**Decide.** This is the §2.4 decision again, with the answer already paid for
once — so the interesting question is not *whether* but *how far*, and the four
pages are not alike.

Credit first, so the scope stays honest: `tutorial.html` and `preview.html`
both already have real `fetch` failure paths with `file://`-specific copy, and
`preview.html` validates its `?file=` against `/^[A-Za-z0-9_-]+\.md$/` before
fetching or interpolating it. §2.1 does not repeat here and §2.6's injection
half does not either. What repeats is the *tooling blindness* and the *missing
CSP*.

So: (a) Does `index.html`'s 578 lines justify a third bundle, or should it move
into the existing playground app bundle behind a page check, or into a plain
`docs/site.js` that oxlint and oxfmt pick up with no build step at all? The
review's §2.4 weighed (a) against (b) on whether the UI code needed types badly
enough to pay the artifact-commit tax. That tax is now already being paid by
`playground-bundle`, which diffs the whole of `docs/vendor/` — so adding a
third entry point is nearly free, and the calculus that produced the TypeScript
answer for the playground may well produce the plain-`.js` answer here, because
`index.html`'s script is a landing-page demo and not an application. Say which
and why. (b) Is a CSP on the other four worth it before their scripts move?
`style-src`/`script-src` would both need `'unsafe-inline'`, which is the
"buys much less" case §2.6 identified — but `default-src 'none'` with
`base-uri 'none'`, `form-action 'none'`, a closed `connect-src` and a closed
`img-src` still closes real doors, and the playground's policy is a ready
template. (c) Whether `ci.html` and `preview.html` are worth the same effort as
`index.html`, or whether the honest answer is that they are small and rarely
visited and get the CSP only.

**Done when.** The four gates fail on a bad edit to `index.html`'s script;
every page under `docs/` either carries a CSP or has a recorded reason not to;
and the decision for each of the four is written down the way the playground's
was, in `docs/design/`.

### 2.4 Persist the one edit path that does not (row 4)

**Re-derive it.** Open `example-quote-plain.md`, press **Infer and write**,
reload without touching the keyboard. The inferred block is gone. Type one
character first and it survives — which is the tell.

**Decide.** Nothing, really. The fix is the missing half of the pair that every
other writer already does:

```ts
      const updated = VM.applyEdits(source, edits);
      const cursor = cm.getCursor();
      cm.setValue(updated);
      cm.setCursor(cursor);
      store.setText(current, updated);
      // `setText` is memory; `persist` is the reload. Every other writer does
      // both — the typing-settle in ./pipeline.ts, `switchTo` and `add` — and
      // cancelPendingRefresh() below kills the settle that would otherwise
      // have caught this one.
      store.persist(current);
```

The one thing worth resolving explicitly while here: `runPass` is the only
place that writes `fmt`'s corrections back into the editor, so `runFmt` from
`switchTo` prints its findings and applies nothing. That is almost certainly
deliberate — opening a drifted document and having it silently repaired would
destroy the `example-invoice-drift.md` demonstration — but `Pipeline.runFmt`'s
doc says only *"callers that want the corrected text apply `result.output` back
to the editor"*, which describes the mechanism and not the policy. One sentence
saying opening a file never rewrites it, and why, stops the next reader
"fixing" it.

**Done when.** Every path that writes the editor also persists; there is a test
asserting it for all four; and `runFmt`'s comment states the open-does-not-
rewrite policy rather than leaving it to be inferred from call sites.

### 2.5 Let the URL name a created file, or refuse to write it (row 5)

**Re-derive it.** `+ New`, accept `untitled.md`, note `?file=untitled.md` in
the address bar, reload. You land on `demo.md`, the bar is rewritten to say so,
and `untitled.md` is in the FILES panel the whole time.

**Decide.** Which of the two features gives way, and this is genuinely a
product call, not a bug with an obvious patch.

(a) *Make the URL honest by teaching boot about created files.* It means
constructing the `BufferStore` before resolving `initial` — the ordering in
`main.ts` is the only thing preventing it, and it exists because `createStore`
wants the initial text in hand. `buffers.createdNames()` is synchronous and
reads `localStorage`, so it can move above the fetch cheaply. The catch is that
the link then works on one machine and silently falls back on every other,
which is arguably a worse lie than the current one: a shareable-looking URL
that is not shareable.

(b) *Make the URL honest by not writing it.* `writeFileToUrl` is only called
for a name the store holds; it could decline for a name not in `FILE_SOURCES`
and strip the parameter instead. The address bar then names `demo.md` while a
scratch file is open, which breaks the invariant `url.ts` states in its own
header — *"the address bar always names what is on screen"* — so if this wins,
that sentence has to change to name the exception.

(c) *Both, scoped:* restore created files at boot (so (a)'s reload works), and
accept that the URL is a local convenience for them. Then say so in `url.ts`.

There is a third-order point worth settling in the same breath, because it is
the same seam: `revertAll` deliberately leaves visitor-created files alone
([files.ts:170](packages/visimark/src/playground/app/files.ts#L170)), and
`isDirty` deliberately returns `false` for them, so a created file can never be
marked, never be reverted, and never be deleted. There is currently **no way to
remove one** short of clearing site data. That is defensible — it is the
visitor's work — but it is not a decision anyone recorded, and "the only
unremovable object in the application" deserves a sentence either way.

**Done when.** `?file=` and the FILES catalogue agree about what a valid file
name is, in whichever direction is chosen; `url.ts`'s stated invariant matches
what the code does; and the lifecycle of a created file — created, persisted,
never dirty, never reverted, never deleted — is written down in
[playground-file-lifecycle-plan.md](docs/design/playground-file-lifecycle-plan.md)
rather than distributed across four comments that each explain their own half.

### 2.6 Give the older store the newer store's discipline (row 6)

**Re-derive it.** In the console: `localStorage.setItem("visimark-playground-badges", "null")`,
reload. Fatal overlay, whole page, no editor. Try `"[]"` and `"7"` for the same
result by different routes.

**Decide.** Only how far to go. `buffers.ts` already establishes the house
pattern — a version integer, a shape check, and *discard rather than migrate*
because the worst case is losing scratch state — and badges are strictly
cheaper to lose than buffers. The minimum is a shape guard; the consistent
answer is the same versioned envelope, so both stores fail the same way and a
future third store has one pattern to copy rather than two to choose between:

```ts
function loadEarned(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(BADGES_STORAGE_KEY) ?? "{}");
    // A hostile or half-written value must not reach the boot chain: §2.1 put
    // createBadgeBoard() inside it, so a TypeError here is a dead page for
    // what is only a record of which badges were already shown.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const earned: Record<string, boolean> = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (value === true) earned[name] = true;
    }
    return earned;
  } catch {
    return {};
  }
}
```

While auditing this, note `buffers.ts`'s own guard stops one level short:
`typeof payload.files === "object"` admits `null` (rescued by the `?? {}` on
the next line, so it is not a live bug) and admits `{"a": 7}`, where `entry.text`
is a number that reaches `cm.setValue`. Same one-loop fix, same reasoning.

**Done when.** No `localStorage` value of any shape can prevent the editor from
coming up; both stores validate the same way; and there is a test per store
feeding it `null`, an array, a number and a well-shaped-but-wrongly-typed
entry, the way `buffers.test.ts` already tests quota and corrupt payloads.

### 2.7 Test the behaviour the string is standing in for (row 7)

**Re-derive it.** Rename `active` to `isActive` in `tabs.ts`. Behaviour is
identical; `a11y.test.ts` fails. Now change `tab.tabIndex = active ? 0 : -1`
to `tab.tabIndex = 0` — the roving tabindex is gone, the pattern is broken, and
the test still passes because the string it greps for is on a different line.

**Decide.** Which half to convert. The markup assertions in `a11y.test.ts` are
sound and should stay as they are: they check the shipped artifact, which is
the thing a screen reader sees. It is the four module assertions — and
`small-screen.test.ts`'s exact-whitespace CSS matches — that invert the
relationship between test and implementation.

`store.test.ts` already demonstrates the pattern that makes the alternative
cheap: a hand-rolled fake with only the methods under test. `createTabs` needs
`document.querySelectorAll` over six buttons and an `onSelect` spy; that is a
small fixture, and it buys assertions about what actually matters — that a
click moves `aria-selected` to exactly one tab per group, that `ArrowRight`
from the last tab wraps to the first, that `Home` and `End` land where the APG
says, that exactly one tab per strip has `tabIndex === 0` after every
operation, and that `select()` called from a file switch updates the strip the
same way a click does.

The 900 px breakpoint is a different case: it genuinely is written twice in two
languages, so a text match is the right tool — but it should match the
*breakpoint*, not the formatting around it. `expect(page).toContain(".playground,\n        .boot-overlay {\n          display: none;")` will be broken by `oxfmt`, not by a regression.

**Done when.** `tabs.ts` can be refactored without touching a test, and cannot
have its pattern broken without one failing; the breakpoint tests match values
rather than indentation; and the markup-level assertions are left alone.

### 2.8 Deduplicate in-flight fetches (row 8)

**Re-derive it.** Throttle the network, hard-reload, and click a tutorial
chapter within the `requestIdleCallback` window — two requests for the same
path in the Network tab. Reproduced in a test by resolving `fetch` manually:
`ensureAll()` issues 19, a concurrent `ensure("05-mappers.md")` makes it 20.

**Decide.** Only the shape. `fetchMissing` filters against `contents` at call
time and nothing tracks what is in the air between then and the response, so
one map closes it:

```ts
  /** Paths already in the air. `fetchMissing` filters against `contents`,
   *  which is only written when a response lands — so without this, a click
   *  during the idle-time prefetch re-requests a document that is already
   *  on its way, and the late response re-enters receive() for a file that
   *  may since have become current. */
  const inFlight = new Map<string, Promise<FailedFile[]>>();
```

…keyed per name, resolving to that name's failures, with the entry deleted on
settle. The thing to decide is what a caller awaiting a name someone else is
already fetching should get back — the shared promise (simplest, and correct
for both `ensure` and `ensureAll`) or its own — and whether `ensureAll` should
join the outstanding singles or issue around them.

The reason this is worth doing beyond the wasted request: it removes the need
for the two unstated invariants currently absorbing the race. `receive()`
overwriting `contents` for a file that is open is harmless *only* because
`text()` prefers the editor buffer and `buffers.restore` replays the edit —
two separate mechanisms neither of which was designed for this. That is the
shape of a bug that arrives later, in a change that touches neither.

**Done when.** No document is requested twice in a session; `receive()` cannot
run for a name already in the store; and the store documents that a fetch is
at-most-once rather than leaving it to be re-derived.

### 2.9 Make the terminal cap an invariant (row 9)

**Re-derive it.** `grep -c 'terminal\.\(line\|cmd\)' src/playground/app` → 23.
Count how many are followed by a `trim()`. Then log a `VM.formatCheck` block
with 40 lines in it and count the child nodes it added: one.

**Decide.** Whether the cap is about DOM nodes or about visible lines — the
code implements the first and the doc promises the second, and they diverge by
however many newlines a `formatCheck` block carries. Then: trim inside `line()`
(the invariant holds by construction, one `removeChild` check per append, and
`trim()` stops being part of the interface) or keep it explicit and audit the
23 call sites. The first is a smaller interface and a stronger guarantee; the
only argument for the second is batching, which at these volumes is not an
argument.

**Done when.** No call site can breach the cap by forgetting something; the
cap's unit matches its name; and `Terminal` exposes whichever of `trim` is
still meaningful, rather than both.

### 2.10 Make BUILD recoverable, and stop checking the current file twice (row 10)

**Re-derive it.** Read `run()` top to bottom and find the paths between
`btn.disabled = true` and `btn.disabled = false` that do not return through it.
Separately, note `checkOne(current, …)` at the end recomputes an outcome the
loop above already produced.

**Decide.** Nothing. `try`/`finally` around the body, and lift the current
file's outcome out of the loop rather than recomputing it — a full
`locate`+`build`+`check` pass, on the largest document in the store, to decide
whether to emit one string. On a 2,000-row document that is the 2.2 seconds
§2.10 measured, spent twice.

**Done when.** No throw can leave BUILD disabled; the current file is checked
once per press; and the quest signal reads the outcome the panel displayed
rather than a second opinion about it.

### 2.11 Escape the selector, or stop using one (row 11)

**Re-derive it.** Give any step an `"id"` containing a `"` in
`scenarios.json`, complete it, and watch `markDone` throw.

**Decide.** `CSS.escape(id)` is one call and ends it. The alternative is
better: `startQuest` already creates every `<li>` and already has the `Step`
in hand, so it can keep a `Map<string, HTMLLIElement>` and never build a
selector at all — which is faster, total, and removes the question. The only
reason to prefer the escape is that it is a smaller diff.

**Done when.** No value `types.ts` permits in `RawStep["id"]` can throw out of
a step completion — with a test that feeds it one, since `RawStep` is the
contract and a contract nobody tests at its edges is a suggestion.

### 2.12 Say that the CSP constrains the preview (row 12)

**Re-derive it.** Type `![alt](https://upload.wikimedia.org/x.png)` into the
editor. Broken image, console violation, no explanation on the page.

**Decide.** Whether `img-src` should grant `https:` for the preview. The case
against is real and probably wins: `'self' data:` is a closed allowlist, the
playground's documents are all local, and remote images in a demo editor are a
tracking vector pointed at whoever opens a shared document. The case for is
that this is a Markdown editor refusing valid Markdown silently.

If it stays closed — the likely answer — the decision belongs in two places it
is currently in neither: as a sentence in the CSP comment block in
`playground.html` (which explains `data:` for charts but not what the grant
*excludes*), and, if it is cheap, as something the page says rather than
swallows. A `securitypolicyviolation` listener that puts one line in TERMINAL —
*"the playground blocks remote images; the preview renders local documents
only"* — turns a silent failure into the same kind of named, explained failure
§2.1 built everywhere else. That is a small feature, not a fix, so it is a
decision and not an instruction.

**Done when.** The constraint is documented next to the policy that creates it,
and either the page explains it at the moment it bites or there is a recorded
reason it does not.

### 2.13 Turn the deferred engine work into a row (row 13)

**Re-derive it.** Read
[playground-pipeline-cost-plan.md](docs/design/playground-pipeline-cost-plan.md)
and then look for where that work is tracked. It is not in
`vocabulary-catalogue.md` and it is not an issue.

**Decide.** Whether "three engine calls each re-locate, re-build and re-check
the same document" is a playground finding or an engine one. It is an engine
one — §2.10 said so and was right — which is exactly why it should leave
`docs/design/` and become a catalogue row or an issue, the way every other
piece of work in this repository is tracked. A design doc under a filename
beginning `playground-` is where an engine-wide API change goes to be
forgotten.

Two details for whoever picks it up. The measurement says four passes, not
three: `hasStaleFindings` adds a full `locate`+`build`+`check` on every settle
where a quest step is watching for STALE, and it is not in the published table.
And the natural fix — one `build()` result shared by `fmt`, `pgEval`,
`pgExplain` and `check` — is the same shape as the reader-injection work in
[browser-fs-port-plan.md](docs/design/browser-fs-port-plan.md): an API that
currently takes source text and should take a built document.

**Done when.** The work is tracked where this repo tracks work, the measurement
it cites counts all four passes, and `playground-pipeline-cost-plan.md` points
at the row rather than standing in for it.

---

## 3. Sequencing

Rows 1, 4, 6, 10 and 11 are independent, small, and mechanical enough to land
together — none needs a design decision and none touches another's code.

Row 2 has two halves that should not be split: the CI gate is what makes the
runtime boundary safe to rely on, and the runtime boundary is what makes the CI
gate's absence survivable while it is being written. Do both, in one change.

Rows 5 and 8 are the same seam as each other and as row 2's second half — all
three are about the store's contract with things outside it (the URL, the
network, the data file). Whoever takes one should read the other two first;
`playground-file-lifecycle-plan.md` is the place the combined answer belongs.

Row 7 is a prerequisite for anything that touches `tabs.ts` or the breakpoint,
in the same way §2.4 was a prerequisite for the original thirteen: until the
guard tests behaviour, no change to the tab pattern is reviewable by anything
but a human with a keyboard and a screen reader.

Row 3 is the largest item here and the only one that is bigger than the review
it follows. It should be planned on its own, per page, and it should not be
started until rows 1–2 are done — the playground is the page that still has the
most readers, and finishing it is worth more than starting the next one.
