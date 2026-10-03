import { describe, expect, test } from "bun:test";
import { renderDocPage, renderTutorialPage, toHtmlLinks } from "./gen-docs-lib.js";

describe("toHtmlLinks", () => {
  test("re-points a guide's Markdown link at its page, keeping the anchor", () => {
    expect(toHtmlLinks('<a href="ci.md">x</a>')).toBe('<a href="ci.html">x</a>');
    expect(toHtmlLinks('<a href="ci.md#21-running">x</a>')).toBe(
      '<a href="ci.html#21-running">x</a>',
    );
    expect(toHtmlLinks('<a href="./tutorial.md">x</a>')).toBe('<a href="tutorial.html">x</a>');
  });

  test("leaves every other Markdown link alone", () => {
    for (const href of [
      "mcp.md",
      "example-invoice.md",
      "design/ci.md",
      "simulate/conference.md",
      "cimd",
    ]) {
      expect(toHtmlLinks(`<a href="${href}">x</a>`)).toBe(`<a href="${href}">x</a>`);
    }
  });
});

describe("the generated pages", () => {
  const options = { title: "T", description: "D", ogTitle: "T", navLabel: "t", scriptName: "ci" };

  test("a doc page links guide.css, has no inline style, and grants none", () => {
    const html = renderDocPage("# Hi\n\nSee [ci.md](ci.md).\n", options);
    expect(html).toContain('<link rel="stylesheet" href="guide.css" />');
    expect(html).not.toContain("<style");
    expect(html).not.toContain("'unsafe-inline'");
    expect(html).toContain('<body class="doc-page">');
    expect(html).toContain('href="ci.html"');
  });

  test("a nested split page reaches guide.css and the guides through its base", () => {
    const html = renderTutorialPage("See [the tutorial](tutorial.md).\n", {
      ...options,
      ogPath: "examples/x/",
      base: "../../",
    });
    expect(html).toContain('<link rel="stylesheet" href="../../guide.css" />');
    expect(html).toContain('href="../../tutorial.html"');
    expect(html).toContain('<body class="split-page" data-mode="split">');
  });
});
