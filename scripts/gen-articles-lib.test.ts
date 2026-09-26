import { describe, expect, test } from "bun:test";
import type { Article } from "../packages/visimark/src/site/articles.js";
import {
  nextArticle,
  relatedArticle,
  renderArticlePage,
  renderArticlesListPage,
  renderMarkdown,
} from "./gen-articles-lib.js";

function article(slug: string, tags: string[]): Article {
  return {
    slug,
    title: `Title of ${slug}`,
    author: "Author",
    tags,
    teaser: "Teaser.",
    path: `${slug}/${slug}.md`,
  };
}

describe("renderMarkdown", () => {
  test("renders inline emphasis", () => {
    expect(renderMarkdown("**bold**\n")).toContain("<strong>bold</strong>");
  });

  test("renders a GFM table", () => {
    const md = "| A | B |\n| - | - |\n| 1 | 2 |\n";
    const html = renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  test("renders a fenced code block with its language as a class", () => {
    const html = renderMarkdown("```vmark\nNet = Qty * Rate\n```\n");
    expect(html).toContain('<pre><code class="language-vmark">');
  });

  test("escapes HTML found inside the source text", () => {
    expect(renderMarkdown("<script>alert(1)</script>\n")).not.toContain(
      "<script>alert(1)</script>",
    );
  });
});

describe("nextArticle", () => {
  const articles = [article("a", ["X"]), article("b", ["X"]), article("c", ["X"])];

  test("is the following entry in file order", () => {
    expect(nextArticle(articles, 0).slug).toBe("b");
    expect(nextArticle(articles, 1).slug).toBe("c");
  });

  test("wraps from the last entry to the first", () => {
    expect(nextArticle(articles, 2).slug).toBe("a");
  });
});

describe("relatedArticle", () => {
  test("picks the article sharing the most tags, excluding self and next", () => {
    const articles = [
      article("a", ["Markdown", "CI", "AI", "GitHub"]),
      article("b", ["Markdown", "Spreadsheets", "CI", "AI"]),
      article("c", ["AI", "Agents", "Markdown", "CI"]),
      article("d", ["Excel", "Markdown", "Git", "CI"]),
    ];
    // next(a) = b (3 tags shared with a), so the related pick must come from {c, d}.
    // c shares 3 tags with a (AI, Markdown, CI); d shares 2 (Markdown, CI).
    const next = nextArticle(articles, 0);
    expect(relatedArticle(articles, 0, next)?.slug).toBe("c");
  });

  test("never picks self or the article already picked as next", () => {
    const articles = [article("a", ["X"]), article("b", ["X"]), article("c", ["X"])];
    const next = nextArticle(articles, 0);
    const related = relatedArticle(articles, 0, next);
    expect(related?.slug).not.toBe("a");
    expect(related?.slug).not.toBe(next.slug);
  });

  test("is undefined when no second candidate exists", () => {
    const articles = [article("a", ["X"]), article("b", ["X"])];
    const next = nextArticle(articles, 0);
    expect(relatedArticle(articles, 0, next)).toBeUndefined();
  });

  test("still picks something when no candidate shares any tag", () => {
    const articles = [article("a", ["X"]), article("b", ["Y"]), article("c", ["Z"])];
    const next = nextArticle(articles, 0);
    expect(relatedArticle(articles, 0, next)).toBeDefined();
  });

  test("is deterministic: the same input always ties to the same pick", () => {
    const articles = [
      article("a", ["X"]),
      article("b", ["X"]),
      article("c", ["X"]),
      article("d", ["X"]),
    ];
    const next = nextArticle(articles, 0);
    const first = relatedArticle(articles, 0, next)?.slug;
    const second = relatedArticle(articles, 0, next)?.slug;
    expect(second).toBe(first);
  });
});

describe("renderArticlesListPage", () => {
  const articles = [article("a", ["X"]), article("b", ["X"])];

  test("renders one card per article, in file order, linking at docs/ depth", () => {
    const html = renderArticlesListPage(articles);
    expect(html.indexOf("Title of a")).toBeLessThan(html.indexOf("Title of b"));
    expect(html).toContain('href="articles/a/"');
    expect(html).not.toContain("../../articles/");
  });

  test("has no script tag left to grant in the Content-Security-Policy", () => {
    expect(renderArticlesListPage(articles)).not.toMatch(/<script\b/i);
  });
});

describe("renderArticlePage", () => {
  const articles = [article("a", ["X", "Y"]), article("b", ["X"]), article("c", ["Y"])];
  const next = nextArticle(articles, 0);
  const related = relatedArticle(articles, 0, next);

  test("carries the article's own title and body", () => {
    const html = renderArticlePage(articles[0]!, "<p>Body.</p>", next, related);
    expect(html).toContain("Title of a — VisiMark");
    expect(html).toContain("<p>Body.</p>");
  });

  test("links back to articles.html and the More-to-read cards two directories up", () => {
    const html = renderArticlePage(articles[0]!, "<p>Body.</p>", next, related);
    expect(html).toContain('href="../../articles.html"');
    expect(html).toContain(`href="../../articles/${next.slug}/"`);
  });

  test("never recommends the article itself", () => {
    const html = renderArticlePage(articles[0]!, "<p>Body.</p>", next, related);
    expect(html).not.toContain(`href="../../articles/a/"`);
  });

  test("omits the second column when there is no related pick", () => {
    const two = [article("a", ["X"]), article("b", ["X"])];
    const html = renderArticlePage(two[0]!, "<p>Body.</p>", nextArticle(two, 0), undefined);
    const cardCount = (html.match(/class="article-card"/g) ?? []).length;
    expect(cardCount).toBe(1);
  });

  test("escapes a title containing markup", () => {
    const dangerous = article("d", ["X"]);
    dangerous.title = '<img src=x onerror="alert(1)">';
    const html = renderArticlePage(dangerous, "<p>Body.</p>", next, related);
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
  });

  test("renders the banner image at the top of the page when the article has one", () => {
    const withBanner = { ...articles[0]!, banner: "a/cover.webp" };
    const html = renderArticlePage(withBanner, "<p>Body.</p>", next, related);
    expect(html).toContain('<img class="reader-banner" src="../a/cover.webp" alt="" />');
    expect(html.indexOf("reader-banner")).toBeLessThan(html.indexOf("reader-head"));
  });

  test("renders no banner element when the article has none", () => {
    const html = renderArticlePage(articles[0]!, "<p>Body.</p>", next, related);
    expect(html).not.toContain("reader-banner");
  });
});
