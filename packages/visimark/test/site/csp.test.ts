// Follow-up review §2.3, the half that is a gate rather than a decision.
//
// The review's count: `grep -c Content-Security-Policy docs/*.html` → 1 of 5.
// The playground carried a `default-src 'none'` allowlist and its four
// neighbours carried nothing at all — including index.html, which is the page
// the README sends people to first, and which held 578 lines of inline
// `<script>`, larger than any module in src/playground/app/.
//
// test/playground/csp.test.ts stays where it is: it checks the playground's
// own policy against the things only that page does (the chart `data:` grant,
// §2.12). This file is the sweep — every page in docs/, on the terms all seven
// now share.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withoutComments } from "../support/markup.js";

const docs = join(import.meta.dir, "../../../../docs");
const pages = readdirSync(docs)
  .filter((f) => f.endsWith(".html"))
  .sort();

const source = (page: string): string => readFileSync(join(docs, page), "utf8");

/** The page with its comments removed. Several of them quote the markup they
 *  are discussing, including the `<script>` this work took out. */
const markup = (page: string): string => withoutComments(source(page));

function policyOf(page: string): string {
  const found = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(source(page));
  if (!found) throw new Error(`${page} carries no Content-Security-Policy`);
  return found[1]!.replace(/\s+/g, " ").trim();
}

/** One directive's source list, e.g. "script-src" → ["'self'", "https://…"].
 *  An absent directive is an empty list, because `default-src 'none'` is what
 *  it then falls back to. */
function directive(page: string, name: string): string[] {
  const found = policyOf(page)
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  return found === undefined ? [] : found.slice(name.length).trim().split(/\s+/).filter(Boolean);
}

test("there are six pages, so this sweep is sweeping something", () => {
  expect(pages).toEqual([
    "articles.html",
    "ci.html",
    "index.html",
    "playground.html",
    "preview.html",
    "tutorial.html",
  ]);
});

describe.each(pages)("%s", (page) => {
  test("carries a policy, in force before the first subresource", () => {
    expect(policyOf(page)).toBeTruthy();
    const m = markup(page);
    const metaAt = m.indexOf('http-equiv="Content-Security-Policy"');
    // A <meta> policy governs only what is fetched after it.
    for (const match of m.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="/g)) {
      expect(match.index, `a subresource is declared above the policy`).toBeGreaterThan(metaAt);
    }
  });

  test("falls back to a closed default", () => {
    expect(directive(page, "default-src")).toEqual(["'none'"]);
  });

  test("closes base-uri and form-action", () => {
    expect(directive(page, "base-uri")).toEqual(["'none'"]);
    expect(directive(page, "form-action")).toEqual(["'none'"]);
  });

  test("grants no inline or evaluated script", () => {
    expect(directive(page, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(page, "script-src")).not.toContain("'unsafe-eval'");
  });

  test("has no inline script left to grant", () => {
    // The §2.3 half that is not about the policy: 943 lines across four pages
    // that no linter, typechecker, formatter or test could see. A `<script>`
    // with a non-JS `type` is a data block — the browser never executes it and
    // CSP never sees it — so index.html's eight Markdown snippets are not this.
    // Case-insensitive, because `<SCRIPT>` is a script: HTML tag names are
    // not case-sensitive, and a gate that only catches the lower-case
    // spelling is a gate with a documented way round it.
    for (const [tag] of markup(page).matchAll(/<script\b[^>]*>/gi)) {
      const executable = !/\bsrc=/i.test(tag) && !/\btype="text\/plain"/i.test(tag);
      expect(executable, `inline <script> in ${page}: ${tag}`).toBe(false);
    }
  });

  test("grants every origin it loads from, and no others", () => {
    const granted = new Set(
      ["script-src", "style-src", "font-src", "img-src", "connect-src"]
        .flatMap((d) => directive(page, d))
        .filter((s) => s.startsWith("https://")),
    );
    const referenced = new Set(
      [...markup(page).matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(https:\/\/[^/"]+)/g)]
        .map((m) => m[1]!)
        // preconnect is a hint, not a fetch, and the host it names is always
        // reached through one of the tags below it.
        .filter((origin) => origin !== "https://fonts.gstatic.com"),
    );
    for (const origin of referenced) {
      expect([...granted], `${page} loads from ${origin} without granting it`).toContain(origin);
    }
    // ...and nothing is granted that nothing uses — a stale grant is a hole.
    for (const origin of granted) {
      if (origin === "https://fonts.gstatic.com") continue;
      expect([...referenced], `${page} grants ${origin}, which it never loads`).toContain(origin);
    }
  });

  test("grants a font host only when it asks a stylesheet for fonts", () => {
    // Matched as a `<link href>` rather than as a substring of the whole page:
    // "the text appears somewhere" is true of a URL mentioned in a comment, in
    // a `<a href>` pointing at an unrelated host, or as the tail of an
    // attacker-shaped origin. What the grant has to track is a stylesheet this
    // page actually loads.
    const wantsFonts = /<link\b[^>]*\bhref="https:\/\/fonts\.googleapis\.com\/css2[^"]*"/i.test(
      markup(page),
    );
    // `some(=== …)` rather than `includes(…)`: `directive()` returns the
    // policy's source list, so this is membership in a list of exact tokens,
    // and the explicit equality says that rather than leaving it to be read as
    // a substring test over a URL.
    const grantsFonts = directive(page, "font-src").some(
      (src) => src === "https://fonts.gstatic.com",
    );
    expect(grantsFonts).toBe(wantsFonts);
  });
});
