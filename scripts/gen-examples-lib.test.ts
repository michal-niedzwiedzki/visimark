import { describe, expect, test } from "bun:test";
import {
  renderExamplePage,
  renderExamplesListPage,
  withAttachments,
  type Example,
} from "./gen-examples-lib.js";
import { withBase } from "./gen-docs-lib.js";

const example: Example = {
  slug: "charts",
  title: "A <chart> example",
  tags: ["Charts", "CI"],
  teaser: "Teaser.",
  icon: "../assets/report.webp",
  path: "../example-charts.md",
};

describe("renderExamplesListPage", () => {
  const html = renderExamplesListPage([example]);

  test("links each card to its own page and resolves the icon under examples/", () => {
    expect(html).toContain('href="examples/charts/"');
    expect(html).toContain('src="examples/../assets/report.webp"');
  });

  test("escapes the title", () => {
    expect(html).toContain("A &lt;chart&gt; example");
  });

  test("names its own generator", () => {
    expect(html).toContain("bun run gen:examples");
  });
});

describe("renderExamplePage", () => {
  const html = renderExamplePage(example, "# Title\n\n![c](charts/a.svg)\n");

  test("reaches the site root two directories up", () => {
    expect(html).toContain('href="../../assets/visimark.webp"');
    expect(html).toContain('<script src="../../vendor/visimark-site-tutorial.js">');
    expect(html).toContain('<a href="../../examples.html">Examples</a>');
  });

  test("shows each block beside its rendering", () => {
    expect(html).toContain('<pre class="src">');
    expect(html).toContain('<div class="out">');
    expect(html).toContain('data-set="split"');
  });

  test("re-points a relative image at docs/", () => {
    expect(html).toContain('src="../../charts/a.svg"');
  });

  test("advertises its own URL", () => {
    expect(html).toContain("https://visimark.dev/examples/charts/");
  });
});

describe("withBase", () => {
  test("leaves absolute, root-relative and data URLs alone", () => {
    const html =
      '<img src="https://x/a.png"><img src="/a.png"><img src="data:image/png;base64,AA">';
    expect(withBase(html, "../../")).toBe(html);
  });

  test("is the identity for a page in docs/", () => {
    expect(withBase('<img src="a.svg">', "")).toBe('<img src="a.svg">');
  });
});

describe("withAttachments", () => {
  test("appends the file under a heading, fenced", () => {
    const md = withAttachments("# T\n", [{ name: "a.csv", content: "x,y\n1,2\n" }]);
    expect(md).toBe("# T\n\n## Attachment: a.csv\n\n```csv\nx,y\n1,2\n```\n");
  });

  test("outgrows a fence inside the content", () => {
    const md = withAttachments("", [{ name: "a.csv", content: "```\n" }]);
    expect(md).toContain("````csv");
  });
});
