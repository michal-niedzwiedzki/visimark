// Follow-up review §2.3: what moving 943 lines out of four pages buys.
//
// "Introduce a syntax error into index.html's script and run all four gates:
// they pass." That is no longer true of any of them — the scripts are
// TypeScript under src/site/, so oxlint, tsc and oxfmt see them, and the
// pieces with actual logic in them can be tested at all, which is this file.
//
// It is deliberately about the three non-trivial functions rather than the
// wiring. `splitBlocks` implements a CommonMark fence rule by hand and was
// the largest untested thing on the site; `dedent` is the reason every demo
// on the landing page is not one giant code block; the preview cards lay out
// a Markdown table with padding arithmetic. The button handlers around them
// are three lines each and are exercised by the browser, not here.

import { describe, expect, test } from "bun:test";
import { escapeHtml, slugify } from "../../src/site/dom.js";
import { dedent } from "../../src/site/demo-panes.js";
import { buildSlots } from "../../src/site/preview-cards.js";
import { explainFailure } from "../../src/site/source-document.js";
import { splitBlocks } from "../../src/site/blocks.js";

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

describe("the landing page's preview cards", () => {
  const slots = buildSlots({
    slug: "order",
    file: "figures.md",
    cols: ["Item", "Price", "Qty", "Net"],
    dp: [null, 2, 0, 2],
    rows: [
      ["pen", 2.0, 10],
      ["paper", 0.15, 100],
    ],
    agg: "total",
    label: "Total",
    unit: "",
    edits: [
      [0, 1, 2.2],
      [1, 2, 150],
    ],
  });

  test("fills every slot the markup declares", () => {
    expect(Object.keys(slots).sort()).toEqual([
      "adopt-base",
      "adopt-fixed",
      "adopt-out",
      "author-base",
      "author-edit",
      "author-fixed",
      "enforce-out",
    ]);
  });

  test("computes the derived column and the aggregate", () => {
    // pen 2.00 × 10 = 20.00, paper 0.15 × 100 = 15.00, total 35.00
    expect(slots["author-base"]).toContain("20.00");
    expect(slots["author-base"]).toContain("15.00");
    expect(slots["author-base"]).toContain("Total: **35.00**");
  });

  test("marks the inputs the reader changed, and only those", () => {
    // Slide two shows the edited inputs against the *old* derived values —
    // the document before `fmt` catches up with it.
    expect(slots["author-edit"]).toContain("<em>2.20</em>");
    expect(slots["author-edit"]).toContain("<em>150</em>");
    expect(slots["author-edit"]).toContain("Total: **35.00**");
  });

  test("marks what `fmt` recalculated on the slide after it", () => {
    // 2.20 × 10 = 22.00, 0.15 × 150 = 22.50, total 44.50
    expect(slots["author-fixed"]).toContain("<em>22.00</em>");
    expect(slots["author-fixed"]).toContain("<em>22.50</em>");
    expect(slots["author-fixed"]).toContain("<em>44.50</em>");
  });

  test("pads the three slides of a card to the same height", () => {
    // Fade stacks the slides; a card whose slides differ in row count jumps
    // as the reader steps through it.
    const lines = (s: string): number => s.split("\n").length;
    expect(lines(slots["author-edit"]!)).toBe(lines(slots["author-base"]!));
    expect(lines(slots["author-fixed"]!)).toBe(lines(slots["author-base"]!));
    expect(lines(slots["adopt-out"]!)).toBe(lines(slots["adopt-base"]!));
    expect(lines(slots["adopt-fixed"]!)).toBe(lines(slots["adopt-base"]!));
  });

  test("keeps the closing prompt on the last line of every slide", () => {
    // The padding goes *above* the last line for exactly this reason.
    for (const key of ["author-base", "author-edit", "author-fixed", "adopt-base"]) {
      expect(slots[key]!.split("\n").at(-1), key).toContain('<span class="p">$</span>');
    }
  });

  test("lines the table's columns up", () => {
    const rows = slots["author-base"]!.split("\n").filter((l) => l.startsWith("|"));
    // Every row is the same width once the `<em>` markup is out of the way.
    const widths = new Set(rows.map((r) => r.replace(/<\/?em>/g, "").length));
    expect(widths.size).toBe(1);
  });

  test("names the sheet in the fence and in the anchor comment", () => {
    expect(slots["author-base"]).toContain("```vmark #order");
    expect(slots["author-base"]).toContain("&lt;!--vmark=order.total--&gt;");
  });
});
