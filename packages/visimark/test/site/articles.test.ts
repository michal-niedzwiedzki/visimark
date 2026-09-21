// docs/articles/articles.json is the one list of articles: the landing page's
// carousel and articles.html both read it. These tests keep it honest.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  articleHref,
  articlePublishedUrl,
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

  test("every entry has an author, and its Markdown names the same one", () => {
    for (const a of articles) {
      expect(a.author.trim(), a.slug).not.toBe("");
      expect(readFileSync(join(dir, a.path), "utf8"), a.slug).toContain(`\nAuthor: ${a.author}\n`);
    }
  });

  test("every entry has a title, a teaser and tags", () => {
    for (const a of articles) {
      expect(a.title.trim()).not.toBe("");
      expect(a.teaser.trim()).not.toBe("");
      expect(a.tags.length).toBeGreaterThan(0);
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
    expect(articleHref(base)).toBe("article.html?slug=a%20b");
  });

  test("the published url is offered only when it is https", () => {
    expect(articlePublishedUrl({ ...base, url: "https://dev.to/a" })).toBe("https://dev.to/a");
    expect(articlePublishedUrl({ ...base, url: "javascript:alert(1)" })).toBeUndefined();
    expect(articlePublishedUrl(base)).toBeUndefined();
  });
});

describe("stripFrontMatter", () => {
  test("drops the title and the metadata block, keeps the body", () => {
    const md = "# T\n\nTags: A, B\nAuthor: Me\n\nPosted:\nReposted:\n\n## First\n\nText\n";
    expect(stripFrontMatter(md)).toBe("## First\n\nText\n");
  });

  test("leaves a body that has no metadata alone", () => {
    expect(stripFrontMatter("# T\n\nHello\n")).toBe("Hello\n");
  });
});
