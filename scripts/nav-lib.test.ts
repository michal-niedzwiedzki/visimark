import { describe, expect, test } from "bun:test";
import { NAV_LINKS, renderNav } from "./nav-lib.js";

const links = [
  { href: "ci.html", label: "CI" },
  { href: "examples.html", label: "Examples", covers: "examples/" },
  { href: "https://example.com/x", label: "Off site" },
];

describe("renderNav", () => {
  test("marks only the link for the current page", () => {
    const html = renderNav("", "ci.html", links);
    expect(html).toContain('<a href="ci.html" aria-current="page">CI</a>');
    expect(html).toContain('<a href="examples.html">Examples</a>');
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });

  test("a page below a covered prefix marks the section link", () => {
    const html = renderNav("../../", "examples/invoice/", links);
    expect(html).toContain('<a href="../../examples.html" aria-current="page">Examples</a>');
  });

  test("an off-site link keeps its URL and is never current", () => {
    const html = renderNav("../../", "https://example.com/x", links);
    expect(html).toContain('<a href="https://example.com/x" rel="noopener">Off site</a>');
    expect(html).not.toContain("aria-current");
  });

  test("docs/nav.json lists every generated docs page", () => {
    const hrefs = NAV_LINKS.map((l) => l.href);
    for (const page of ["tutorial.html", "ci.html", "mcp-server.html", "simulate.html"]) {
      expect(hrefs).toContain(page);
    }
  });
});
