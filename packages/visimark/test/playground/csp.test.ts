// Review §2.6 and §2.12, which are one subject in two places.
//
// docs/playground.html carries a <meta> Content-Security-Policy because
// GitHub Pages serves docs/ verbatim and cannot send headers, so there is no
// other place to put one. A policy is only worth having while it stays a
// closed allowlist, and nothing but this test notices when a new CDN tag,
// a re-inlined script or a switch from `data:` to `blob:` quietly opens it.
//
// The §2.12 half is here rather than in a file of its own because the chart
// encoding and the img-src grant are the same decision written twice.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withoutComments } from "../support/markup.js";

const page = readFileSync(join(import.meta.dir, "../../../../docs/playground.html"), "utf8");
const appDir = join(import.meta.dir, "../../src/playground/app");
const pipelineSource = readFileSync(join(appDir, "pipeline.ts"), "utf8");

/** The module with its comments stripped: svgDataUri's own doc comment names
 *  the `btoa(unescape(...))` it replaced, and a grep that cannot tell an
 *  explanation from a call would read that as the call coming back. */
const pipeline = pipelineSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

/** The page with its comments removed — several of them quote markup that is
 *  being discussed rather than emitted, including the `<script>` §2.4 took
 *  out. */
const markup = withoutComments(page);

const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/
  .exec(page)?.[1]
  ?.replace(/\s+/g, " ")
  .trim();

/** One directive's source list, e.g. "script-src" → ["'self'", "https://…"]. */
function directive(name: string): string[] {
  const found = (policy ?? "")
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  if (found === undefined) throw new Error(`no ${name} directive in the policy`);
  return found.slice(name.length).trim().split(/\s+/).filter(Boolean);
}

describe("the playground's content security policy", () => {
  test("exists, and is in force before the first subresource", () => {
    expect(policy).toBeTruthy();
    const metaAt = markup.indexOf('http-equiv="Content-Security-Policy"');
    // A <meta> policy governs only what is fetched after it, so anything with
    // a URL has to come later in the document than the policy does.
    for (const match of markup.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="/g)) {
      expect(match.index).toBeGreaterThan(metaAt);
    }
  });

  test("everything falls back to a closed default", () => {
    expect(directive("default-src")).toEqual(["'none'"]);
  });

  test("script-src grants no inline script — which is the point of §2.4", () => {
    // Review §2.4 moved 1,535 lines of <script> out to a bundle. If they ever
    // come back, the policy has to be relaxed to run them, and this fails
    // before the relaxation ships.
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
    expect(directive("script-src")).not.toContain("'unsafe-eval'");
    expect(markup).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[^<]*\S/);
  });

  test("every origin the page loads from is granted, and no others are", () => {
    const granted = new Set(
      ["script-src", "style-src", "font-src", "img-src", "connect-src"]
        .flatMap(directive)
        .filter((s) => s.startsWith("https://")),
    );
    // What the markup actually asks for: <script src>, <link href>.
    const referenced = new Set(
      [...markup.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(https:\/\/[^/"]+)/g)].map(
        (m) => m[1]!,
      ),
    );
    for (const origin of referenced) expect([...granted]).toContain(origin);
    // and nothing is granted that nothing uses — a stale grant is a hole
    for (const origin of granted) expect([...referenced]).toContain(origin);
  });

  test("style-src still needs 'unsafe-inline', and says so out loud", () => {
    // Not a regression: the page's own 950 lines of CSS are inline and
    // CodeMirror sets element styles as it lays out. Pinned so that removing
    // the inline CSS one day is noticed as the chance to close this.
    expect(directive("style-src")).toContain("'unsafe-inline'");
    expect(page).toContain("style-src does still carry it");
  });

  test("form-action and base-uri are closed", () => {
    expect(directive("form-action")).toEqual(["'none'"]);
    expect(directive("base-uri")).toEqual(["'none'"]);
  });
});

describe("chart SVGs and the img-src grant that has to match them", () => {
  test("img-src grants data:, which is the scheme svgDataUri emits", () => {
    expect(directive("img-src")).toEqual(["'self'", "data:"]);
    expect(pipeline).toContain("data:image/svg+xml,");
  });

  test("blob: is neither granted nor used — they are separate grants", () => {
    expect(directive("img-src")).not.toContain("blob:");
    expect(pipeline).not.toContain("createObjectURL");
  });

  test("the deprecated unescape() is gone", () => {
    expect(pipeline).not.toMatch(/\bunescape\(/);
    expect(pipeline).not.toMatch(/\bbtoa\(/);
  });

  // What svgDataUri actually emits is exercised in
  // test/playground/app/chart-data-uri.test.ts, which is the program that has
  // the DOM lib and may import from src/playground/app/.
});
