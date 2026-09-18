# How a chart SVG reaches the preview — Implementation Plan

**Source:** `docs/reviews/2026-09-17-playground.md` §2.12 (row 12, Low).
Paired with [§2.6](playground-csp-plan.md), which grants the scheme this
picks.

**Goal:** drop the deprecated `unescape()` from the chart path, and make the
payload smaller rather than larger while doing it.

---

## What it looked like before

```js
img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
```

`unescape` is Annex B legacy — specified only for web compatibility, and
present here purely as the old idiom for getting UTF-8 bytes into `btoa`.
Base64 then costs a third of the payload, inside an attribute, on a path that
re-runs from `refreshDerived()` every 500 ms of typing.

## The decision, and the measurement that changed it

The review suggested `data:image/svg+xml,` + `encodeURIComponent` as the
smallest change. **Measured, that is worse than what it replaces.** An SVG is
mostly `<`, `>`, `"`, `/` and spaces, and `encodeURIComponent` spends three
bytes on each of them. On 12-charts.md's `order-spend.svg`, 2,770 bytes raw:

| encoding | data URI length |
|---|---|
| `btoa(unescape(…))` — before | 3,720 |
| `encodeURIComponent(svg)` — as suggested | 4,167 |
| escape only what must be escaped — shipped | **2,829** |

So `svgDataUri()` in `src/playground/app/pipeline.ts` percent-encodes exactly
three classes of character and passes the rest through verbatim:

- `%`, or an escape that is not there gets read as one;
- `#`, or the remainder of the document becomes a fragment identifier;
- anything outside printable ASCII. Control characters because the URL parser
  strips ASCII newlines and tabs out of a URL — harmless between tags, but it
  would silently run two words of a chart label together — and non-ASCII
  because a data URI has no charset parameter with which to interpret those
  bytes.

**Not a `blob:` URL.** It would be smaller still, and the review named the
reason not to: every blob URL has to be handed back with
`URL.revokeObjectURL`, this runs on a 500 ms debounce over a document that can
carry several charts, and a missed revoke there is a leak that grows while you
type rather than a theoretical one. A data URI is owned by the `<img>` and dies
with it.

That choice is what `img-src 'self' data:` in the page's CSP grants — `data:`
and `blob:` are separate grants, so the two have to move together, and both
the code comment and `test/playground/csp.test.ts` say so.

## Verification

Rendered `?file=12-charts.md` in headless Chromium: the `<img>` carries
`data:image/svg+xml,<svg xmlns=…`, decodes to 240 × 150, and the URI is 2,831
characters against base64's 3,720. No CSP violation and no console output.

`test/playground/csp.test.ts` pins the escaping in both directions — that `#`,
`%`, a newline and non-ASCII are escaped, that `<`, `>`, `"` and spaces are
not, that `unescape` and `btoa` are gone from the module, and that the result
is shorter than the base64 form on a real committed chart.
