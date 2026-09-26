/**
 * Regenerates docs/articles.html and one docs/articles/<slug>/index.html per
 * entry in docs/articles/articles.json, from that catalogue and each
 * article's own Markdown file.
 *
 * Run with `bun run gen:articles`. CI re-runs it and fails on a diff (see
 * .github/workflows/ci.yml, job articles-pages).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripFrontMatter, type Article } from "../packages/visimark/src/site/articles.js";
import {
  nextArticle,
  relatedArticle,
  renderArticlePage,
  renderArticlesListPage,
  renderMarkdown,
} from "./gen-articles-lib.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_DIR = join(ROOT, "docs/articles");

const { articles } = JSON.parse(readFileSync(join(ARTICLES_DIR, "articles.json"), "utf8")) as {
  articles: Article[];
};

writeFileSync(join(ROOT, "docs/articles.html"), renderArticlesListPage(articles));

for (const [index, article] of articles.entries()) {
  const markdown = readFileSync(join(ARTICLES_DIR, article.path), "utf8");
  const bodyHtml = renderMarkdown(stripFrontMatter(markdown));
  const next = nextArticle(articles, index);
  const related = relatedArticle(articles, index, next);
  const outDir = join(ARTICLES_DIR, article.slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), renderArticlePage(article, bodyHtml, next, related));
}

console.log(`Generated docs/articles.html and ${articles.length} article page(s).`);
