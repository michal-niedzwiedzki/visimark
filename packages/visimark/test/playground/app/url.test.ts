// Review §2.8: the address bar.
//
// `?file=` was read once at boot and never written — `grep -c
// 'pushState\|replaceState'` over the page returned 0 — so the address bar
// lied the moment anyone clicked a second chapter, on a page whose whole
// purpose is being linked to.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fileFromUrl, writeFileToUrl } from "../../../src/playground/app/url.js";

const realWindow = (globalThis as { window?: unknown }).window;
let replaced: string[] = [];

/** Stands in for the one thing these functions touch: the current URL and
 *  history.replaceState. */
function at(href: string): void {
  let current = href;
  replaced = [];
  (globalThis as { window?: unknown }).window = {
    get location() {
      return new URL(current);
    },
    history: {
      state: { some: "state" },
      replaceState(state: unknown, _title: string, url: string) {
        replaced.push(url);
        current = url;
      },
    },
    addEventListener: () => {},
  };
}

beforeEach(() => at("https://example.test/playground.html"));
afterEach(() => {
  (globalThis as { window?: unknown }).window = realWindow;
});

describe("reading", () => {
  test("an existing ?file= link still works", () => {
    at("https://example.test/playground.html?file=07-reasoning.md");
    expect(fileFromUrl()).toBe("07-reasoning.md");
  });

  test("no parameter reads as nothing, for the caller to default", () => {
    expect(fileFromUrl()).toBeNull();
  });
});

describe("writing", () => {
  test("names the open file", () => {
    writeFileToUrl("09-units.md");
    expect(replaced).toEqual(["https://example.test/playground.html?file=09-units.md"]);
    expect(fileFromUrl()).toBe("09-units.md");
  });

  test("replaces rather than pushes — back still leaves the playground", () => {
    // pushState would make Back walk the chapters the visitor idly clicked,
    // and twenty entries is what the FILES panel invites.
    writeFileToUrl("01-tables.md");
    writeFileToUrl("02-inference.md");
    expect(replaced).toHaveLength(2);
    expect(fileFromUrl()).toBe("02-inference.md");
  });

  test("rewrites one key and keeps the rest of the query", () => {
    at("https://example.test/playground.html?file=demo.md&utm_source=post");
    writeFileToUrl("03-sheets.md");
    expect(replaced[0]).toContain("utm_source=post");
    expect(fileFromUrl()).toBe("03-sheets.md");
  });

  test("writing the file that is already named costs no history call", () => {
    at("https://example.test/playground.html?file=demo.md");
    writeFileToUrl("demo.md");
    expect(replaced).toEqual([]);
  });

  test("a name needing escaping survives the round trip", () => {
    writeFileToUrl("my notes.md");
    expect(fileFromUrl()).toBe("my notes.md");
  });
});

describe("what is deliberately not in the URL", () => {
  test("the diagnostic tab", () => {
    // It is a view of the current document rather than a place, and it resets
    // on every file switch already — serialising it would put two knobs in a
    // link where the person pasting it means one. §2.8 asked for this to be
    // ruled on rather than left open.
    writeFileToUrl("demo.md");
    expect(replaced[0]).not.toContain("tab");
  });
});
