// Review §2.12: what `svgDataUri` actually emits.
//
// The chart path used to be `btoa(unescape(encodeURIComponent(svg)))`.
// `unescape` is Annex B legacy, and the review's suggested replacement —
// plain `encodeURIComponent` — measured *larger* than the base64 it was
// meant to shrink, because an SVG is mostly characters it escapes. So the
// escaping is deliberately minimal, and minimal escaping is exactly the kind
// of thing that is one forgotten character away from a broken image.
//
// The other half of this — that the CSP grants `data:` and not `blob:` — is
// in test/playground/csp.test.ts, which reads the page as text and so lives
// in the program without the DOM lib.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { svgDataUri } from "../../../src/playground/app/pipeline.js";

describe("svgDataUri", () => {
  test("escapes the two characters that would break the URI", () => {
    // `#` would start a fragment and truncate the document at the first
    // colour literal; `%` would be read as an escape that is not there.
    expect(svgDataUri('<svg fill="#333"/>')).toBe('data:image/svg+xml,<svg fill="%23333"/>');
    expect(svgDataUri("<text>100%</text>")).toBe("data:image/svg+xml,<text>100%25</text>");
  });

  test("leaves the bulk of an SVG alone, which is the whole saving", () => {
    expect(svgDataUri('<svg viewBox="0 0 1 1"/>')).toBe(
      'data:image/svg+xml,<svg viewBox="0 0 1 1"/>',
    );
  });

  test("escapes control characters the URL parser would otherwise strip", () => {
    // Newlines and tabs are removed from a URL rather than rejected — between
    // tags that is harmless, but inside a chart label it runs two words
    // together, silently and only sometimes.
    expect(svgDataUri("<text>a\nb\tc</text>")).toBe("data:image/svg+xml,<text>a%0Ab%09c</text>");
  });

  test("escapes non-ASCII as UTF-8, since a data URI carries no charset", () => {
    expect(svgDataUri("<text>café €</text>")).toBe(
      "data:image/svg+xml,<text>caf%C3%A9 %E2%82%AC</text>",
    );
    // beyond the BMP: one code point, not two lone surrogates
    expect(svgDataUri("📈")).toBe("data:image/svg+xml,%F0%9F%93%88");
  });

  test("survives a round trip through the URL parser", () => {
    const svg = readFileSync(
      join(import.meta.dir, "../../../../../docs/charts/example-charts-sales.svg"),
      "utf8",
    );
    const url = new URL(svgDataUri(svg));
    expect(decodeURIComponent(url.pathname.slice("image/svg+xml,".length))).toBe(svg);
  });

  test("is smaller than the base64 form it replaced", () => {
    const svg = readFileSync(
      join(import.meta.dir, "../../../../../docs/charts/example-charts-sales.svg"),
      "utf8",
    );
    const base64Uri = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
    expect(svgDataUri(svg).length).toBeLessThan(base64Uri.length);
  });
});
