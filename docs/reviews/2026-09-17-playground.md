# VisiMark — `docs/playground.html` review

**Date:** 2026-09-17 · **Commit:** `6dbeec9` (plus an uncommitted 222-line
change to this file) · **Scope:** [docs/playground.html](docs/playground.html)
and the way it is built and served.

Reviewed: 2,868 lines / 128 KB of hand-written HTML — 955 lines of inline CSS,
1,535 lines of inline JavaScript, 376 lines of markup — plus the 288 KB
committed bundle it loads, the 21 runtime `fetch()` calls it makes, and the
Pages/CI pipeline around it.

**Overall: C+.** The *engine* half of this page is exemplary and is reviewed
elsewhere: the browser `ReaderPort`, the synchronous SHA-256, the deliberate
decision to withhold a reader from `12-charts.md` — all correct, all explained
in-code with the rationale rather than the restatement. The *web application*
half has not had the same attention. It is a single 128 KB file with no build
step, no responsive layout, no accessibility semantics, no error path for its
own boot sequence, and 1,535 lines of application logic that no linter,
typechecker, formatter or test in this repository can see.

The distinction matters for prioritisation: nothing below is a defect in
VisiMark. Everything below is a defect in the page that is the product's
primary public demo.

---

## How it is built and served

There is no bundler and no build step for the page itself.

1. [packages/visimark/src/playground/browser-entry.ts](packages/visimark/src/playground/browser-entry.ts)
   is compiled by `build:playground` (`bun build --target browser --format iife
   --minify`) into [docs/vendor/visimark-browser.js](docs/vendor/visimark-browser.js),
   a **committed** 288 KB artifact that assigns `window.VisiMark`.
2. [.github/workflows/ci.yml](.github/workflows/ci.yml) has a dedicated
   `playground-bundle` job that pins Bun to `1.4.2`, rebuilds, and fails on
   `git diff --exit-code -- docs/vendor/`. This closes the staleness hole from
   [the 2026-09-15 review §2.5](docs/reviews/2026-09-15.md) and is a good fix.
3. [.github/workflows/pages.yml](.github/workflows/pages.yml) uploads `docs/`
   **verbatim** — no build, no minification, no hashing, no headers.
4. At runtime the page loads 8 cross-origin assets (CodeMirror 5.65.16 core +
   4 modes/addons, `marked` 18, `canvas-confetti` 1.9.4, a Google Font) and
   then `fetch()`es 21 same-origin files: 20 Markdown/CSV documents and
   `playground/scenarios.json`.
5. [scripts/serve.mjs](scripts/serve.mjs) reproduces Pages locally. The page
   cannot be opened over `file://` at all, because step 4 needs `fetch()`.

Two things this pipeline gets right and should be kept: **every** cdnjs and
jsdelivr tag carries `integrity` + `crossorigin` + `referrerpolicy`, and the
`playground-bundle` CI job explains in a comment *why* Bun is pinned there and
nowhere else. Both are better than the median project.

---

## 1. Findings

| # | Area | What the code actually does | Severity | Suggestion |
|---|---|---|---|---|
| 1 | **Boot has no failure path** | The whole app is one `(async function () { … })()` IIFE. `var FILES = await loadFiles()` ([playground.html:1390](docs/playground.html#L1390)) top-level-awaits `Promise.all` over 21 `fetch()`es; `loadScenarios()` ([:1416](docs/playground.html#L1416)) awaits a 22nd. There is no `try`/`catch` anywhere in the boot chain and no top-level rejection handler. One 404, one flaky network, one `file://` open, and the IIFE rejects into the void: the visitor gets the fully-styled dark shell with an empty file list, an empty editor and **no message at all**. There is also no loading state — panels sit empty until all 22 responses land. | **Critical** | Wrap boot; render a real failure panel naming the file that failed; show a skeleton while loading. See [§2.1](#21-give-boot-a-failure-path-and-a-loading-state-row-1). |
| 2 | **Zero responsive design** | `grep -c '@media'` → **0**. `.playground { height: 100vh; width: 100vw }` ([:48](docs/playground.html#L48)) over `html, body { overflow: hidden }` ([:34](docs/playground.html#L34)), with five flex panels sharing the width. Below ~900 px the FILES/EDITOR/PREVIEW columns become unusable slivers and nothing scrolls, because the page deliberately cannot. `100vh` is also the known mobile bug — browser chrome shrinks the visual viewport and the bottom action bars go under it. This is the page README and [index.html](docs/index.html) send people to. | **High** | A `@media (max-width: 900px)` stacked layout with real page scroll, plus `100dvh`. See [§2.2](#22-make-the-page-usable-below-900-px-row-2). |
| 3 | **No accessibility semantics** | `grep -c 'role='` → **0**. `grep -c '<label'` → **0**. The only ARIA on the page is one `aria-label="Site"` ([:987](docs/playground.html#L987)). The six `.diag-tab` buttons ([:1051](docs/playground.html#L1051)ff) are two tab sets in every respect except the ones a screen reader can perceive — no `role="tablist"`/`role="tab"`/`role="tabpanel"`, no `aria-selected`, no `aria-controls`, no roving `tabindex`, no arrow-key handling. `<textarea id="editor-ta">` ([:1031](docs/playground.html#L1031)) has no accessible name, and CodeMirror 5 hands it to assistive tech unlabelled. There is no `prefers-reduced-motion` guard for the 8 transitions or the full-screen confetti burst ([:1990](docs/playground.html#L1990)). | **High** | Tab-pattern ARIA + keyboard, label the editor, gate motion. See [§2.3](#23-add-tab-keyboard-and-motion-semantics-row-3). |
| 4 | **1,535 lines of app logic are invisible to every tool in the repo** | The inline `<script>` at [:1332–2866](docs/playground.html#L1332) is real application code — a file store, a debounced pipeline, a quest state machine, badge persistence, clipboard fallbacks, social share flows. `tsc` never sees it. `oxlint` cannot parse HTML, so it never sees it. `oxfmt` formats it as HTML, not as JavaScript. No test loads it: [packages/visimark/test/playground/imports-chapter.test.ts:21](packages/visimark/test/playground/imports-chapter.test.ts#L21) says outright that it tests the engine half and not the page, and [playground.test.ts](packages/visimark/test/playground.test.ts) `runInContext`s the *bundle*, not the page. Meanwhile the 4-line `browser-entry.ts` next to it is fully typechecked. Every UI regression on this page is caught only by a human opening it. | **High** | Extract to `docs/playground/app.js` (or `.ts` through the existing bundler) so the existing gates apply. See [§2.4](#24-move-the-inline-script-under-the-existing-quality-gates-row-4). |
| 5 | **20 documents fetched to display one** | `FILE_SOURCES` ([:1363–1373](docs/playground.html#L1363)) enumerates `demo.md`, 13 tutorial chapters, a CSV and 5 examples — ~124 KB — and `loadFiles()` fetches **all of them** before the editor initialises, though only `demo.md` (or `?file=`) is ever displayed. Cold load is therefore: 8 cross-origin assets over 3 origins, 288 KB of bundle, 22 same-origin round trips, *then* first paint of content. Nothing is lazy, nothing is preloaded, nothing is cached beyond default Pages headers. | **Medium** | Fetch the current file eagerly and the rest on demand (or in an idle callback). See [§2.5](#25-stop-fetching-19-documents-nobody-asked-for-row-5). |
| 6 | **No CSP; `marked` output goes straight to `innerHTML`** | [:2403](docs/playground.html#L2403) does `previewEl.innerHTML = marked.parse(source)` with no sanitizer. Today the input is the visitor's own typing plus repo-controlled documents, so this is self-XSS at worst — but it is the one line that turns any future "share a document by URL" or "import from gist" feature into a live XSS, and `marked`'s own docs say to sanitize. GitHub Pages cannot send headers, so the only available control is `<meta http-equiv="Content-Security-Policy">`, and there isn't one. | **Medium** | Add a meta CSP pinned to the 3 origins actually used; decide explicitly whether the preview is a trust boundary and write that decision down. See [§2.6](#26-add-a-meta-csp-and-decide-the-preview-trust-boundary-row-6). |
| 7 | **The visitor's work does not survive a reload** | `contents` ([:1392](docs/playground.html#L1392)) is a plain in-memory object. Earned badges *are* persisted to `localStorage` ([:1851](docs/playground.html#L1851)), so the page already has the mechanism and already decided persistence is worth having — it just persists the score and not the work. Someone eight chapters into the tutorial who refreshes loses every edit, with no `beforeunload` prompt and no warning that this will happen. | **Medium** | Persist dirty buffers alongside the badges, with an explicit reset. See [§2.7](#27-persist-the-visitors-buffers-row-7). |
| 8 | **The URL never reflects state** | `?file=` is read exactly once, at [:1396](docs/playground.html#L1396), and never written. `grep -c 'pushState\|replaceState'` → **0**. So: switching files leaves the address bar lying, the back button exits the playground entirely, and nobody can link a colleague to the chapter or the tab they are looking at — on a page whose whole purpose is being linked to. | **Medium** | `replaceState` on file/tab switch; handle `popstate`. See [§2.8](#28-put-file-and-tab-in-the-url-row-8). |
| 9 | **Four social share buttons, no Open Graph tags** | `shareViaClipboard()` ([:1956](docs/playground.html#L1956)) opens Facebook, LinkedIn, Instagram and X with `SHARE_URL = "https://michal-niedzwiedzki.github.io/visimark/"` ([:1866](docs/playground.html#L1866)). That URL — and every other page on this site — has no `og:title`, no `og:description`, no `og:image`, not even a `<meta name="description">`. Every badge a visitor is prompted to share renders on those networks as a bare blue link. The feature's own success case is broken. | **Medium** | Add OG/Twitter card meta to `index.html`, `playground.html`, `tutorial.html`. See [§2.9](#29-give-the-shared-url-a-card-row-9). |
| 10 | **The engine runs synchronously on the main thread** | Every 500 ms debounce tick ([:2669](docs/playground.html#L2669)) runs `fmt` + `pgEval` + `pgExplain` + `marked.parse` + chart rendering inline on the UI thread, then writes back into CodeMirror. At tutorial-chapter sizes this is imperceptible and the debounce is well chosen. Paste a few hundred rows and the tab locks with no cancel and no spinner. There is no measurement anywhere and no `Worker`. | **Low** | Measure first. Only then consider a Worker or an input cap. See [§2.10](#210-measure-the-pipeline-before-moving-it-off-the-main-thread-row-10). |
| 11 | **`selectFile()` and the New-file handler are the same ten lines twice** | [:1600–1612](docs/playground.html#L1600) and [:1615–1636](docs/playground.html#L1615) both flush the buffer, `setValue`, set the filename, `renderFileList()`, reset INFER, `renderScenario()`, `selectTab("diag","reasoning")`, `runFmt()`, `refreshDerived()`. They already differ: `selectFile` calls `trimTerminal()` and the New-file path does not. That divergence is the bug this duplication was always going to produce. | **Low** | One `switchTo(name)`. See [§2.11](#211-collapse-the-two-file-switch-paths-row-11). |
| 12 | **Deprecated `unescape()` in the chart path** | [:2658](docs/playground.html#L2658): `img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)))`. `unescape` is Annex B legacy, and base64 inflates each inlined SVG by ~33% inside an attribute. | **Low** | `data:image/svg+xml,` + `encodeURIComponent`, or a `Blob` URL with revocation. See [§2.12](#212-replace-the-unescape-base64-svg-hack-row-12). |
| 13 | **Topbar CSS exists twice** | [docs/index.html](docs/index.html) links [docs/styles.css](docs/styles.css); `playground.html` re-authors its own topbar, brand, nav and font stack inline. Same visual component, two sources, no shared token. They will drift, silently, because nothing compares them. | **Low** | Extract shared chrome into `styles.css` or a `tokens.css`. See [§2.13](#213-share-the-topbar-between-the-two-pages-row-13). |

---

## 2. Suggestions

Each section states the problem, the evidence to re-derive it, the decision
the next agent has to make, and what "done" looks like. None prescribes an
implementation — that is the next agent's job, after it has confirmed the
problem still exists at the commit it is working on.

### 2.1 Give boot a failure path and a loading state (row 1)

**Re-derive it.** Serve the page (`bun run serve`), then rename
`docs/playground/scenarios.json` and reload. Observe: full chrome, zero
content, no message, one unhandled rejection in the console. Repeat by opening
`docs/playground.html` over `file://` — same dead page, and this is the most
likely way a new contributor first opens the file.

**Decide.** Three questions, in order. (a) Is a partial boot better than a
failed one — i.e. should a missing `scenarios.json` still give a working
editor without the SCENARIO panel, or is the tutorial track load-bearing
enough that it should fail loudly? (b) Where does the error surface: the
TERMINAL panel (which already exists and already renders errors), a full-page
overlay, or an inline banner? (c) Does `file://` deserve a *specific* message
— it is a distinct, predictable, recoverable failure that the comment at
[:1324](docs/playground.html#L1324) already anticipates in prose but not in
code.

**Done when.** Every `await` in the boot chain is inside a handler; each
failure names the resource and the likely cause; the panels show a skeleton or
"loading…" between navigation and first render; and opening over `file://`
explains itself and points at `bun run serve`.

### 2.2 Make the page usable below 900 px (row 2)

**Re-derive it.** DevTools device toolbar at 390 × 844. Count how many of the
five panels are readable. Then scroll — you cannot, by design
([:34](docs/playground.html#L34)). Then check the bottom action bars against
mobile Safari's collapsing chrome.

**Decide.** The real question is not CSS, it is product: what *is* the
playground on a phone? A five-panel IDE cannot be one. Plausible answers: a
single-panel view with a panel switcher; an editor+preview pair with the
diagnostics collapsed into a drawer; or an honest "this demo needs a wider
screen" interstitial with a link to the tutorial. Pick one deliberately rather
than letting `flex-wrap` decide. Note that the panel proportions are encoded
as `flex: 5/95`, `82/18`, `55/…` ratios throughout the CSS, so whichever
answer wins has to be expressed as a second, explicit set of ratios — not as
overrides sprinkled on the first.

**Done when.** There is at least one `@media` breakpoint; `100vh` is `100dvh`
(or a `--vh` custom property); the page is operable at 390 px wide; and no
control is under the mobile browser chrome.

### 2.3 Add tab, keyboard and motion semantics (row 3)

**Re-derive it.** Tab through the page with a keyboard only and try to reach
the BUILD tab, then the REFERENCE tab. Run any axe-class audit. Grep the
counts in row 3 — they are all zero.

**Decide.** Follow the WAI-ARIA Authoring Practices tabs pattern verbatim, or
adopt the minimum subset (`role`, `aria-selected`, `aria-controls`)? The full
pattern brings roving `tabindex` and arrow-key navigation, which changes
`selectTab()`'s contract for both tab groups at once — that is a real design
choice, not a mechanical edit. Separately, decide what the editor's accessible
name should be: it changes per file, and `#editor-filename` already tracks
that.

**Done when.** Both tab groups announce correctly and are arrow-key operable;
the editor has a name; `@media (prefers-reduced-motion: reduce)` disables the
transitions and suppresses `fireBadgeConfetti()`; and there is a check that
keeps this from regressing, given [§2.4](#24-move-the-inline-script-under-the-existing-quality-gates-row-4).

### 2.4 Move the inline script under the existing quality gates (row 4)

**Re-derive it.** `bun run lint`, `bun run typecheck`, `bun run format:check`
and `bun test` all pass with the page in any state, including syntactically
broken JavaScript inside the `<script>` tag. Confirm by introducing a typo
there and re-running all four.

**Decide.** This is the highest-leverage item and the one with the widest
solution space. Options, roughly in ascending order of cost: (a) extract to a
plain `docs/playground/app.js` — oxlint and oxfmt immediately apply, zero
build step, page stays a static asset; (b) extract to TypeScript under
`packages/visimark/src/playground/` and extend `build:playground` to emit a
second bundle — full typechecking, but the file joins the committed-artifact
regime and the `playground-bundle` CI job, which is why Bun is pinned there;
(c) keep it inline and add an HTML-aware linter. Weigh (a) against (b) on one
axis: does the UI code need types badly enough to pay the artifact-commit tax
that [the 2026-09-15 review](docs/reviews/2026-09-15.md) already had to build
CI machinery for? Also note the script is written in ES5 style throughout
(`var`, `function`, no optional chaining) — decide whether that is a
constraint to preserve or an accident to fix, and say which.

**Done when.** The four existing gates fail on a bad edit to this code; the
page still loads with no build step on Pages *or* the bundle it needs is
covered by `playground-bundle`; and the choice is recorded in a design doc, as
this repo does for everything else.

### 2.5 Stop fetching 19 documents nobody asked for (row 5)

**Re-derive it.** Network tab, hard reload, count requests and total transfer.
Compare with the single document actually rendered.

**Decide.** Lazy-load is not free here: `READER_FS` ([:1456](docs/playground.html#L1456))
needs `13-imports.csv` present whenever `13-imports.md` is open, and
`runBuild()` checks **every** file in the store, so "build" must either force
the remaining fetches first or change meaning. Decide whether the build button
loads-then-builds (slow once, honest) or builds only what is loaded (fast,
but no longer "the same `visimark check` a CI pipeline would run", which is
what the BUILD panel copy at [:1081](docs/playground.html#L1081) promises).
Also consider `<link rel="preload">` for the bundle and the current document,
which is cheaper than any of this and may be enough.

**Done when.** Time-to-interactive is gated on one document, not twenty; the
BUILD panel's promise and its behaviour still match; and the tutorial's
import chapter still demonstrates a real SHA-256 mismatch.

### 2.6 Add a meta CSP and decide the preview trust boundary (row 6)

**Re-derive it.** `curl -I` any Pages URL — no CSP, and none can be added
server-side. Grep the page for `innerHTML`: 9 hits, of which
[:2403](docs/playground.html#L2403) is the one taking Markdown-derived HTML.
Note the other 8 are safe (empty-string clears, `escapeHtml`'d signatures, a
fixed icon dictionary) — do not "fix" them.

**Decide.** Two separate calls. (a) CSP: the page needs `cdnjs.cloudflare.com`
and `cdn.jsdelivr.net` for scripts, `fonts.googleapis.com` for styles,
`fonts.gstatic.com` for fonts, `data:` for images (chart SVGs, row 12), and
`'unsafe-inline'` for both the inline script and the inline style until
[§2.4](#24-move-the-inline-script-under-the-existing-quality-gates-row-4)
lands — which is an argument for sequencing them together, since a CSP that
still needs `'unsafe-inline'` for script buys much less. (b) Sanitization:
decide, and write down, whether the preview is a trust boundary. Right now it
is defensibly not one. The moment any document reaches it from a URL, a gist,
a paste target or another user, it is. Record the condition, do not just
record the answer.

**Done when.** A `<meta http-equiv="Content-Security-Policy">` exists, the
page still works under it (verify: fonts, CodeMirror, confetti, chart data
URIs, the four social `window.open` calls), and the preview's trust status is
documented next to the `innerHTML` line.

### 2.7 Persist the visitor's buffers (row 7)

**Re-derive it.** Edit any chapter, reload, watch the edit vanish while the
badge you earned survives.

**Decide.** Which buffers: all of them, or only ones the visitor actually
changed (a diff against `FILE_SOURCES`, which keeps storage small and makes
"reset this file" trivial)? What happens when a bundled document changes
upstream and a stale local copy shadows it — last-write-wins, or a version
stamp that discards? And whether `beforeunload` is warranted at all; it is an
intrusive API and the better answer may simply be that saving works. Note
`localStorage` is already wrapped in try/catch at
[:1851](docs/playground.html#L1851) for private-mode failures — reuse that
discipline, do not re-invent it.

**Done when.** A reload preserves edits; there is a visible, discoverable way
to reset one file and all files; a bundled-document update cannot be shadowed
forever by a stale copy; and quota/private-mode failures degrade to today's
behaviour rather than breaking boot.

### 2.8 Put file and tab in the URL (row 8)

**Re-derive it.** Switch files, look at the address bar, press back.

**Decide.** Query param or hash? `?file=` already exists and is what the
tutorial links use, so extending it is the compatible choice — but check
[docs/tutorial.html](docs/tutorial.html) and
[docs/tutorial.md](docs/tutorial.md) for every link that already depends on
the current shape before changing anything. Then: `pushState` (back button
walks chapter history — good for a tutorial, noisy for idle clicking) or
`replaceState` (address bar is always shareable, back leaves the page as
today)? Decide whether the diagnostic tab selection belongs in the URL too, or
whether that is over-serialisation.

**Done when.** The address bar always names what is on screen; existing
`?file=` links still work; `popstate` is handled without losing the current
buffer; and unknown values still fall back to `demo.md` as they do now.

### 2.9 Give the shared URL a card (row 9)

**Re-derive it.** Paste `https://michal-niedzwiedzki.github.io/visimark/` into
any of the four networks the badge share buttons open, or into the Facebook
sharing debugger. Then grep the whole `docs/` tree for `og:` — zero hits.

**Decide.** What the card shows. There is a logo
([docs/visimark.webp](docs/visimark.webp)) but no 1200 × 630 share image, and
the two candidate taglines already differ between
[package.json](package.json)'s `description` and
[index.html](docs/index.html)'s subtitle — pick one source of truth rather
than adding a third. Decide whether the playground and tutorial get their own
cards or inherit the site's, and whether a per-badge card (the share button
knows which badge was earned) is worth static pages or is scope creep. It is
probably scope creep; say so explicitly rather than leaving it open.

**Done when.** All three HTML pages carry `<meta name="description">`,
`og:title`, `og:description`, `og:image` (absolute URL — relative ones fail
off-site, the same class of bug as the
`vsix-readme-image-urls` note) and `twitter:card`, and a validator renders the
card.

### 2.10 Measure the pipeline before moving it off the main thread (row 10)

**Re-derive it.** Paste a 500-row table into the editor and watch the 500 ms
tick. Profile it. Find out which of `fmt`, `pgEval`, `pgExplain`,
`marked.parse` or chart rendering actually dominates — do not assume.

**Decide.** Only after measuring. If the cost is concentrated in one phase,
the fix is probably in the engine and belongs in a different review. If it is
spread, the options are a `Worker` (which means serialising the document in
and the results out, and reconciling that with `playgroundReader` reading the
live CodeMirror buffer at [:1464](docs/playground.html#L1464) — non-trivial),
an input-size cap with an honest message, or accepting it because playground
documents are small by construction. "Accept it, documented" is a legitimate
outcome here and may well be the right one.

**Done when.** There is a number in a design doc, and a decision that cites it.

### 2.11 Collapse the two file-switch paths (row 11)

**Re-derive it.** Diff [:1600–1612](docs/playground.html#L1600) against
[:1615–1636](docs/playground.html#L1615). Note `trimTerminal()` appears in one
and not the other, and decide whether that is intentional.

**Decide.** Trivial, but resolve the `trimTerminal()` divergence explicitly
rather than picking one by accident. Best done as part of
[§2.4](#24-move-the-inline-script-under-the-existing-quality-gates-row-4)
rather than as a separate edit to the HTML.

**Done when.** One function; both callers use it; the terminal behaves
identically on both paths.

### 2.12 Replace the `unescape`/base64 SVG hack (row 12)

**Re-derive it.** Open `12-charts.md` in the playground, inspect the rendered
`<img>`, note the base64 payload length against the source SVG length.

**Decide.** `data:image/svg+xml,` + `encodeURIComponent` is the smallest
change and drops the deprecated call. A `Blob` URL is cleaner still but needs
`URL.revokeObjectURL` on every re-render — and `refreshDerived()` runs on a
500 ms debounce, so a leak here is a real leak, not a theoretical one. Note
whichever choice is made must stay consistent with the CSP in
[§2.6](#26-add-a-meta-csp-and-decide-the-preview-trust-boundary-row-6):
`data:` and `blob:` are different `img-src` grants.

**Done when.** No `unescape` on the page; charts still render; the CSP allows
exactly the scheme used.

### 2.13 Share the topbar between the two pages (row 13)

**Re-derive it.** Compare the `.topbar`, `.brand`, `.nav` and font-stack rules
in [docs/styles.css](docs/styles.css) against
[playground.html:56–148](docs/playground.html#L56).

**Decide.** Whether `playground.html` can take a second `<link
rel="stylesheet">` at all — it is currently one self-contained file, and that
has a genuine benefit (no FOUC, one fewer round trip on a page that already
makes 30). A `tokens.css` holding only the shared colours, fonts and the
topbar, with everything else staying inline, is the middle path. Weigh it
against [§2.5](#25-stop-fetching-19-documents-nobody-asked-for-row-5)'s
request-count goal.

**Done when.** The shared chrome has one definition, and the two pages still
look identical.

---

## 3. Sequencing

The items are not independent.
[§2.4](#24-move-the-inline-script-under-the-existing-quality-gates-row-4)
should land first: it is the prerequisite that makes every later change
reviewable by tooling instead of by eye, and
[§2.6](#26-add-a-meta-csp-and-decide-the-preview-trust-boundary-row-6)'s CSP
is much weaker until the inline script is gone.
[§2.1](#21-give-boot-a-failure-path-and-a-loading-state-row-1) is the highest
severity and is small enough to do immediately, in parallel.
[§2.2](#22-make-the-page-usable-below-900-px-row-2) and
[§2.3](#23-add-tab-keyboard-and-motion-semantics-row-3) both touch the same
markup and should be planned together.
[§2.5](#25-stop-fetching-19-documents-nobody-asked-for-row-5),
[§2.7](#27-persist-the-visitors-buffers-row-7) and
[§2.8](#28-put-file-and-tab-in-the-url-row-8) all rewrite how a file becomes
"current" and are one piece of work, not three.
