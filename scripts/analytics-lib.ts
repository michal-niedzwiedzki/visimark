/**
 * Page analytics: GoatCounter, cookieless, counted from the generated pages.
 *
 * The counter script is vendored at docs/vendor/goatcounter-count.js (ISC,
 * https://gc.zgo.at/count.js, copied unmodified) rather than loaded from
 * gc.zgo.at, so every page's `script-src` stays `'self'` and no third-party
 * script origin is ever granted. The only grant is the collector itself: the
 * script reports a hit with `navigator.sendBeacon` (governed by `connect-src`)
 * and falls back to a 1×1 image request (`img-src`).
 *
 * docs/playground.html is deliberately not counted; it keeps its own policy.
 * The hand-written pages (index, preview) carry the same tag and grants by
 * hand; packages/visimark/test/site/csp.test.ts keeps all of them honest.
 */
export const GOATCOUNTER_ORIGIN = "https://visimark.goatcounter.com";

/** The `<script>` that loads the vendored counter, for a page at `base`
 *  (`""` at the docs root, `"../"` one level down, and so on). */
export function analyticsScriptTag(base: string): string {
  return `<script data-goatcounter="${GOATCOUNTER_ORIGIN}/count" async src="${base}vendor/goatcounter-count.js"></script>`;
}
