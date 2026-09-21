// Review §2.13: the values docs/ repeats, and the drift it was worried about.
//
// The finding as written — "topbar CSS exists twice" — does not reproduce at
// this commit: only playground.html has a `.topbar`. index.html and
// preview.html share a `.masthead` out of the stylesheet they both link, and
// tutorial.html has a `.bar` of its own in a deliberately different, light
// visual language. There is no duplicated component to extract. See
// docs/design/playground-shared-tokens-plan.md.
//
// What IS repeated is a short list of scalars: three font stacks, the brand
// red, the two neutrals and the page gradient. Extracting ten declarations
// into a stylesheet costs every page a render-blocking round trip — the one
// §2.5 just spent effort removing — to save a few hundred bytes. So they stay
// where they are, and this is the thing the review actually asked for that
// was missing: something that compares them, so they cannot drift silently.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const docs = join(import.meta.dir, "../../../docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");

const SHEET = "styles.css";
/** Pages with their own CSS, which is where a second copy can appear. */
const SELF_STYLED = ["playground.html", "preview.html"];

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace';
const HAND = '"Caveat", "Bradley Hand", "Comic Sans MS", cursive';

/** Every font stack a file declares, with the whitespace oxfmt may have
 *  wrapped it across collapsed away. */
function stacks(source: string): string[] {
  return [...source.matchAll(/font-family:\s*([^;}]+)[;}]/g)]
    .map((m) => m[1]!.replace(/\s+/g, " ").trim())
    .filter((s) => s !== "inherit" && s.length > 0);
}

describe("the type stacks", () => {
  test("styles.css declares the three the site uses", () => {
    const sheet = stacks(read(SHEET));
    expect(sheet).toContain(SANS);
    expect(sheet).toContain(MONO);
    expect(sheet).toContain(HAND);
  });

  test.each(SELF_STYLED)("%s repeats them verbatim or not at all", (page) => {
    // A page is free to use only some of them; what it may not do is use a
    // *different* one, which is how "the same font, almost" happens.
    for (const stack of stacks(read(page))) {
      expect([SANS, MONO, HAND]).toContain(stack);
    }
  });
});

describe("the brand palette", () => {
  // Named here rather than derived, so a change has to be made on purpose in
  // two places instead of drifting in one.
  const RED = "#ff453a";
  const INK = "#1b1b1b";
  const PAPER = "#f4f4f4";
  const BACKDROP = "linear-gradient(180deg, #252422 0%, #403d39 100%)";

  test("styles.css is where they are defined", () => {
    const sheet = read(SHEET);
    for (const value of [RED, INK, PAPER, BACKDROP]) expect(sheet).toContain(value);
  });

  test("playground.html's copies are the same values", () => {
    // It is one self-contained file on purpose — no FOUC, one fewer request
    // on a page that already makes thirty — so it holds copies. They have to
    // be copies rather than approximations.
    const page = read("playground.html");
    for (const value of [RED, INK, PAPER, BACKDROP]) expect(page).toContain(value);
  });

  test("no near-miss copies of the brand red", () => {
    // The specific drift this guards: #ff453a becoming #ff473a in one file.
    // A different colour is a design choice; a colour one channel away from
    // this one is a typo, and nothing but a side-by-side comparison catches
    // it. So: every hex in docs/ is either far from the brand red or exactly
    // it.
    const channels = (hex: string): number[] =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const target = channels(RED);
    for (const page of [SHEET, "index.html", "preview.html", "tutorial.html", ...SELF_STYLED]) {
      for (const [hex] of read(page).matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const distance = channels(hex.toLowerCase()).reduce(
          (sum, c, i) => sum + Math.abs(c - target[i]!),
          0,
        );
        if (distance > 0 && distance < 48) {
          throw new Error(`${page}: ${hex} is a near-miss for the brand red ${RED}`);
        }
      }
    }
  });
});

describe("what is not shared, and is not supposed to be", () => {
  test("only the playground has a topbar", () => {
    // The §2.13 finding as written. Recorded so that the next person reading
    // the review does not go looking for the second copy.
    expect(read("playground.html")).toContain('<header class="topbar">');
    for (const page of ["index.html", "preview.html", "tutorial.html"]) {
      expect(read(page)).not.toContain('class="topbar"');
    }
  });

  test("index.html and preview.html get their chrome from one stylesheet", () => {
    for (const page of ["index.html", "preview.html"]) {
      expect(read(page)).toContain('<link rel="stylesheet" href="styles.css" />');
      expect(read(page)).not.toContain(".masthead {");
    }
    expect(read(SHEET)).toContain(".masthead {");
  });
});
