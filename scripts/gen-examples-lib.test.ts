import { describe, expect, test } from "bun:test";
import {
  renderExamplePage,
  renderExamplesListPage,
  relativeToDocs,
  withAttachments,
  type Example,
} from "./gen-examples-lib.js";
import { withBase } from "./gen-docs-lib.js";

const example: Example = {
  slug: "charts",
  title: "A <chart> example",
  tags: ["Charts", "CI"],
  teaser: "Teaser.",
  icon: "receipt_long",
  path: "../example-charts.md",
};

describe("renderExamplesListPage", () => {
  const html = renderExamplesListPage([example]);

  test("links each card to its own page and draws the icon as a Material Symbols ligature", () => {
    expect(html).toContain('href="examples/charts/"');
    expect(html).toContain('<span class="material-symbols-outlined">receipt_long</span>');
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
    expect(html).toContain('<a href="../../examples.html" aria-current="page">Examples</a>');
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

  test("rebases a relative href as well as a src", () => {
    expect(withBase('<a href="a.md">x</a><a href="#t">y</a>', "../../")).toBe(
      '<a href="../../a.md">x</a><a href="#t">y</a>',
    );
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

describe("relativeToDocs", () => {
  test("leaves a file that already sits in docs/ alone", () => {
    expect(relativeToDocs("[a](x.md) ![c](charts/a.svg)", "")).toBe("[a](x.md) ![c](charts/a.svg)");
  });

  test("resolves links and images against the file's own directory", () => {
    expect(relativeToDocs("[t](../tutorial.md#top) ![c](img/a.svg)", "simulate")).toBe(
      "[t](tutorial.md#top) ![c](simulate/img/a.svg)",
    );
  });

  test("leaves URLs, anchors and root-relative links alone", () => {
    const md = "[a](https://x.dev/y) [b](#c) [d](/e) [f](mailto:a@b.c)";
    expect(relativeToDocs(md, "tutorial")).toBe(md);
  });
});
