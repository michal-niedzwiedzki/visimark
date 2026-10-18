// Follow-up review §2.3: what moving 943 lines out of four pages buys.
//
// "Introduce a syntax error into index.html's script and run all four gates:
// they pass." That is no longer true of any of them — the scripts are
// TypeScript under src/pages/, so oxlint, tsc and oxfmt see them, and the
// pieces with actual logic in them can be tested at all, which is this file.
//
// It is deliberately about the three non-trivial functions rather than the
// wiring. `splitBlocks` implements a CommonMark fence rule by hand and was
// the largest untested thing on the site; `dedent` is the reason every demo
// on the landing page is not one giant code block; the preview cards lay out
// a Markdown table with padding arithmetic. The button handlers around them
// are three lines each and are exercised by the browser, not here.

import { describe, expect, test } from "bun:test";
import { escapeHtml } from "../../src/html.js";
import { slugify } from "../../src/pages/dom.js";
import { dedent } from "../../src/pages/demo-panes.js";
import { SLIDE_COUNT, slideAt } from "../../src/pages/tour.js";
import { explainFailure } from "../../src/pages/source-document.js";
import { splitBlocks } from "../../src/pages/blocks.js";

describe("splitting the tutorial into blocks", () => {
  test("a blank line ends a block", () => {
    expect(splitBlocks("one\ntwo\n\nthree\n")).toEqual(["one\ntwo", "three"]);
  });

  test("a heading is its own block, whatever surrounds it", () => {
    expect(splitBlocks("intro\n# Title\nbody\n")).toEqual(["intro", "# Title", "body"]);
  });

  test("a blank line inside a fence does not end it", () => {
    const md = "```vmark #s\nNet = Qty * Rate\n\ntotal = SUM(Net)\n```\n";
    expect(splitBlocks(md)).toEqual([md.trimEnd()]);
  });

  test("a fence nests inside a longer one, which is why this exists", () => {
    // The tutorial shows ```vmark blocks inside ````markdown examples. A
    // closing fence has to match the character and be at least as long.
    const md = "````markdown\n```vmark #s\nx = 1\n```\n````\n";
    expect(splitBlocks(md)).toEqual([md.trimEnd()]);
  });

  test("a fence is not closed by a different character", () => {
    expect(splitBlocks("```\na\n~~~\nb\n```\n")).toEqual(["```\na\n~~~\nb\n```"]);
  });

  test("a closing fence carries no info string", () => {
    // "```ts" in the middle of a ```-fenced block opens nothing and closes
    // nothing; it is content.
    expect(splitBlocks("```\na\n```ts\nb\n```\n")).toEqual(["```\na\n```ts\nb\n```"]);
  });

  test("CRLF is normalised, since the file may be checked out either way", () => {
    expect(splitBlocks("one\r\n\r\ntwo\r\n")).toEqual(["one", "two"]);
  });

  test("a whitespace-only block is dropped rather than rendered empty", () => {
    expect(splitBlocks("\n\n   \n\none\n")).toEqual(["one"]);
  });
});

describe("dedenting an embedded snippet", () => {
  test("strips the common indent the formatter added", () => {
    // Without this every demo on the landing page renders as one code block,
    // because Markdown reads 4+ leading spaces that way.
    expect(dedent("      | A |\n      |---|\n")).toBe("| A |\n|---|\n");
  });

  test("measures the shallowest line, not the first", () => {
    expect(dedent("    a\n  b\n")).toBe("  a\nb\n");
  });

  test("ignores blank lines when measuring", () => {
    expect(dedent("    a\n\n    b")).toBe("a\n\nb");
  });

  test("leaves text that starts at column 0 alone", () => {
    expect(dedent("a\n  b")).toBe("a\n  b");
  });

  test("handles a snippet that is entirely blank", () => {
    expect(dedent("\n\n")).toBe("\n\n");
  });
});

describe("heading slugs", () => {
  test("lowercase, punctuation dropped, spaces hyphenated", () => {
    expect(slugify("What `check` Actually Does!")).toBe("what-check-actually-does");
  });

  test("collapses runs of whitespace", () => {
    expect(slugify("  Two   words  ")).toBe("two-words");
  });

  test("keeps existing hyphens", () => {
    expect(slugify("Write-back")).toBe("write-back");
  });
});

describe("escaping", () => {
  test("covers the four characters that change how markup parses", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  test("escapes the quote, so an attribute cannot be closed from inside it", () => {
    // The four pages' own copies did not, and moving them here gave the
    // function callers in attribute position.
    expect(escapeHtml('" onerror="alert(1)')).not.toContain('"');
  });

  test("the load-failure note escapes the path and the reason", () => {
    const html = explainFailure("ci.md", "guide", new Error("<script>"));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  test("...and still points the reader at the Markdown, which reads fine", () => {
    expect(explainFailure("tutorial.md", "tutorial", new Error("HTTP 404"))).toContain(
      '<a href="tutorial.md">tutorial.md</a>',
    );
  });
});

describe("the landing page's guided tour", () => {
  const text = (n: number): string =>
    slideAt(n)
      .html.replace(/<span class="pill.*?<\/span><\/span>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

  test("has ten slides, and the last has no button", () => {
    expect(SLIDE_COUNT).toBe(10);
    for (let n = 1; n < SLIDE_COUNT; n++) expect(slideAt(n).next, `slide ${n}`).toBeTruthy();
    expect(slideAt(SLIDE_COUNT).next).toBeUndefined();
  });

  test("the order sums to what the corrected slides say", () => {
    // 4 * 12.50 + 2 * 30.00 + 6 * 8.00 = 50 + 60 + 48
    expect(text(1)).toContain("**148.00**");
    expect(text(4)).toContain("**158.00**");
  });

  test("the stale pill appears once, on slide three", () => {
    expect(slideAt(3).html).toContain("STALE - run fmt to recalculate");
    expect(slideAt(4).html).not.toContain("STALE");
  });

  test("the unit arrives on slide five, with its display rule", () => {
    expect(text(4)).not.toContain("USD");
    expect(text(5)).toContain("Price [USD]");
    expect(text(5)).toContain("**158.00 USD**<!--vmark=order.order_total|unit-->");
  });

  test("the assertion is added, then parametrized and failing", () => {
    expect(text(5)).not.toContain("assert");
    expect(text(6)).toContain("assert order_total < 150");
    expect(text(8)).toContain("param budget [USD] = default 150");
    expect(text(8)).toContain("assert order_total < budget");
    expect(slideAt(8).html).toContain("assertion failed");
  });

  test("slides seven, nine and ten are terminal output", () => {
    for (const n of [7, 9, 10]) expect(slideAt(n).tab, `slide ${n}`).toBe("terminal");
    expect(text(7)).toContain("ASSERT");
    expect(text(10)).toContain("--get limits.budget");
  });

  test("lines the table's columns up", () => {
    const rows = text(5)
      .split("\n")
      .filter((l) => l.startsWith("|"));
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
  });
});
