// docs/articles/articles.json is the one list of articles: the landing page's
// carousel and articles.html both read it. These tests keep it honest.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  articleBody,
  articleCanonicalUrl,
  articleHref,
  articlePublishedUrl,
  articleRepostUrls,
  stripFrontMatter,
  type Article,
} from "../../src/site/articles.js";

const dir = join(import.meta.dir, "../../../../docs/articles");
const { articles } = JSON.parse(readFileSync(join(dir, "articles.json"), "utf8")) as {
  articles: Article[];
};

describe("articles.json", () => {
  test("has entries with unique slugs", () => {
    expect(articles.length).toBeGreaterThan(0);
    expect(new Set(articles.map((a) => a.slug)).size).toBe(articles.length);
  });

  test("every entry points at a Markdown file that exists", () => {
    for (const a of articles) {
      expect(existsSync(join(dir, a.path)), `${a.slug}: ${a.path}`).toBe(true);
    }
  });

  test("every icon exists", () => {
    for (const a of articles.filter((x) => x.icon)) {
      expect(existsSync(join(dir, a.icon!)), `${a.slug}: ${a.icon}`).toBe(true);
    }
  });

  test("every banner exists", () => {
    for (const a of articles.filter((x) => x.banner)) {
      expect(existsSync(join(dir, a.banner!)), `${a.slug}: ${a.banner}`).toBe(true);
    }
  });

  test("every entry has a title, an author, a teaser and tags", () => {
    for (const a of articles) {
      expect(a.title.trim(), a.slug).not.toBe("");
      expect(a.author.trim(), a.slug).not.toBe("");
      expect(a.teaser.trim(), a.slug).not.toBe("");
      expect(a.tags.length, a.slug).toBeGreaterThan(0);
    }
  });

  test("no Markdown file repeats the tags or author articles.json already carries", () => {
    for (const a of articles) {
      const md = readFileSync(join(dir, a.path), "utf8");
      expect(md, a.slug).not.toMatch(/^Tags:/m);
      expect(md, a.slug).not.toMatch(/^Author:/m);
    }
  });
});

describe("article links", () => {
  const base: Article = {
    slug: "a b",
    title: "t",
    author: "x",
    tags: ["x"],
    teaser: "y",
    path: "s/s.md",
  };

  test("the reader page is found by slug", () => {
    expect(articleHref(base)).toBe("articles/a%20b/");
  });

  test("a base path is prefixed onto the reader-page link", () => {
    expect(articleHref(base, "../../")).toBe("../../articles/a%20b/");
  });

  test("articleBody prefixes both the icon src and the href with base", () => {
    const withIcon: Article = { ...base, icon: "../assets/x.webp" };
    const html = articleBody(withIcon, "h3", "../../");
    expect(html).toContain('src="../../articles/../assets/x.webp"');
    expect(html).toContain('href="../../articles/a%20b/"');
  });

  test("with no `posted`, the canonical url is this site's own reader page", () => {
    expect(articleCanonicalUrl(base)).toBe("https://visimark.dev/articles/a%20b/");
    expect(articlePublishedUrl(base)).toBeUndefined();
  });

  test("`posted` elsewhere becomes both the canonical url and the published link", () => {
    const a = { ...base, posted: "https://dev.to/a" };
    expect(articleCanonicalUrl(a)).toBe("https://dev.to/a");
    expect(articlePublishedUrl(a)).toBe("https://dev.to/a");
  });

  test("a non-https `posted` is ignored, falling back to this site", () => {
    const a = { ...base, posted: "javascript:alert(1)" };
    expect(articleCanonicalUrl(a)).toBe("https://visimark.dev/articles/a%20b/");
    expect(articlePublishedUrl(a)).toBeUndefined();
  });

  test("`reposted` is filtered to https urls", () => {
    expect(
      articleRepostUrls({ ...base, reposted: ["https://x.example/a", "javascript:alert(1)"] }),
    ).toEqual(["https://x.example/a"]);
    expect(articleRepostUrls(base)).toEqual([]);
  });
});

describe("stripFrontMatter", () => {
  test("drops the title line and the blank lines around it, keeps the body", () => {
    const md = "# T\n\n\n## First\n\nText\n";
    expect(stripFrontMatter(md)).toBe("## First\n\nText\n");
  });

  test("leaves a body that has no title alone", () => {
    expect(stripFrontMatter("# T\n\nHello\n")).toBe("Hello\n");
  });
});
