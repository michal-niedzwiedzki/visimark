# A content security policy for the playground, and what the preview is — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.6 (row 6, Medium).
Stacked on [§2.4](playground-app-extraction-plan.md), which is what makes the
policy worth writing, and paired with
[§2.12](playground-chart-data-uri-plan.md), which decides one of its grants.

**Goal:** the page that is the product's public demo declares what it is
allowed to load — and the question the review actually asked, whether the
PREVIEW panel is a trust boundary, gets an answer written down next to the
line that depends on it.

---

## What it looked like before

`curl -I` on any Pages URL returns no CSP, and none can be added server-side:
`.github/workflows/pages.yml` uploads `docs/` verbatim, and GitHub Pages sends
no custom headers. So the only available control is
`<meta http-equiv="Content-Security-Policy">`, and there wasn't one.

Separately, `previewEl.innerHTML = marked.parse(source)` takes Markdown-derived
HTML with no sanitizer. The review's own triage of that was right and is worth
repeating: today the input is the visitor's own typing plus repo-controlled
documents, so it is self-XSS at worst.

## The two decisions §2.6 asked for

### (a) The policy

The review noted that a CSP still needing `'unsafe-inline'` for script buys
much less, and suggested sequencing it with §2.4 for that reason. §2.4 has
landed: all 1,535 lines of application JavaScript are now
`vendor/visimark-playground.js`, and `docs/playground.html` has no inline
script left at all. So `script-src` carries no `'unsafe-inline'`, no
`'unsafe-eval'`, and only the two CDN origins the page actually loads from:

```
default-src 'none';
script-src  'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;
style-src   'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com;
font-src    https://fonts.gstatic.com;
img-src     'self' data:;
connect-src 'self';
base-uri    'none';
form-action 'none'
```

`default-src 'none'` rather than a permissive default is the part that keeps
this honest over time: every directive above is an allowlist, and any resource
type the page grows later has nothing to fall back on, so it fails closed and
says so in the console.

`style-src` **does** keep `'unsafe-inline'`, and that is a real limit on what
this buys, not an oversight. The page's ~950 lines of CSS are inline by
design, and CodeMirror sets element styles as it lays out the editor. The
trade is a different order of magnitude from the script one — an inline-style
injection is a defacement, not code execution — and a comment in the page says
so, so that removing the inline CSS one day is recognised as the chance to
close it.

`frame-ancestors` is absent because a `<meta>` policy cannot carry it. On
Pages there is nowhere else to put it; noted rather than worked around.

### (b) The trust boundary

**The preview is not a trust boundary today, and the condition on which that
changes is recorded rather than the answer alone**, which is what §2.6 asked
for. The comment sits in `src/playground/app/pipeline.ts` immediately above the
`innerHTML` line: everything that can reach that buffer is the visitor's own
typing or a document committed to this repository and served from this origin.
It stops being true the moment a document arrives from somewhere the visitor is
not — a document carried in the URL, an import from a gist, a paste target, a
shared workspace — and the sanitizer goes in on the same commit as that
feature.

One clarification the comment makes explicitly, because it is the nearest
miss: `?file=` (and [§2.8](playground-url-state-plan.md), which writes to it)
is *not* that. It selects a name out of `FILE_SOURCES`; it cannot carry
content.

The review also warned not to "fix" the other eight `innerHTML` sites. They
are empty-string clears, `escapeHtml`'d signatures and a fixed icon
dictionary, and they are untouched.

## Scope

`docs/playground.html` only. `index.html`, `tutorial.html` and `preview.html`
all still carry inline `<script>` (five blocks in `index.html` alone), so a
policy for them would have to grant `'unsafe-inline'` for script — which is
the weak version §2.6 explicitly argued against shipping. They are the next
page to extract, not the next page to paper over.

## Verification

Rendered in headless Chromium against the real `docs/` tree over
`bun run serve`, reading the browser's own security log rather than the DOM,
since a CSP failure is quiet in the markup:

| checked | result |
|---|---|
| boot completes under the policy | overlay dismissed, 20 files, BUILD PASSING |
| CSP violations reported during boot | none |
| CodeMirror (cdnjs script + stylesheet) | loaded, editor constructed |
| `marked`, `canvas-confetti` (jsdelivr) | both defined |
| Caveat webfont (googleapis → gstatic) | `document.fonts` status `loaded` |
| logo (`'self'`) | `naturalWidth` 256 |
| chart `data:` URI (§2.12) | decoded, 240 × 150 |
| an injected inline `<script>` | blocked, `window.__pwned` undefined |
| an injected `<script src="https://example.com/…">` | blocked |

`test/playground/csp.test.ts` is the regression guard, and it checks the
policy against the page rather than against a copy of itself: every `https://`
origin in the markup must be granted, *and* every granted origin must be one
the markup uses — a stale grant is a hole. It also fails if an inline
`<script>` reappears, if `script-src` acquires `'unsafe-inline'` or
`'unsafe-eval'`, if `form-action`/`base-uri` open up, or if the `<meta>` stops
preceding the first subresource, which is the one placement mistake that makes
the whole thing silently inert.

## Not in scope

Sanitizing the preview — see (b): the condition is recorded, and the condition
does not hold yet.
