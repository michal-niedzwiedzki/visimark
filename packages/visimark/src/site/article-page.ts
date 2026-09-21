/**
 * docs/article.html — one article, chosen by `?slug=` from the catalogue in
 * docs/articles/articles.json, rendered from its Markdown file.
 */

import {
  articlePublishedUrl,
  articleSourceUrl,
  loadArticles,
  stripFrontMatter,
  type Article,
} from "./articles.js";
import { byId, escapeHtml } from "./dom.js";

function notFound(reader: HTMLElement, message: string): void {
  reader.innerHTML = `<div class="reader-inner"><p>${escapeHtml(message)}</p><p><a href="articles.html">&larr; All articles</a></p></div>`;
}

/** Point relative images and links at the article's own folder, since the page
 *  itself lives one level up. */
function rebase(body: HTMLElement, folder: string): void {
  const relative = (v: string | null): v is string => !!v && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(v);
  body.querySelectorAll<HTMLImageElement>("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (relative(src)) img.setAttribute("src", `articles/${folder}${src}`);
  });
  body.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (relative(href)) a.setAttribute("href", `articles/${folder}${href}`);
  });
}

function header(a: Article): string {
  const published = articlePublishedUrl(a);
  return `<header class="reader-head">
      <h1>${escapeHtml(a.title)}</h1>
      <p class="reader-meta">By ${escapeHtml(a.author)} &middot; ${a.tags.map(escapeHtml).join(", ")}</p>
      <p class="reader-links">${
        published ? `<a href="${escapeHtml(published)}">Also published here</a> &middot; ` : ""
      }<a href="${escapeHtml(articleSourceUrl(a))}">Markdown source</a> &middot; <a href="articles.html">All articles</a></p>
    </header>`;
}

async function render(): Promise<void> {
  const reader = byId("reader");
  if (!reader) return;
  const slug = new URLSearchParams(location.search).get("slug");
  if (!slug) return notFound(reader, "No article was asked for.");

  let articles: Article[];
  try {
    articles = await loadArticles();
  } catch (err) {
    return notFound(reader, `Could not load the article list (${(err as Error).message}).`);
  }
  const article = articles.find((a) => a.slug === slug);
  if (!article) return notFound(reader, `There is no article called "${slug}".`);

  document.title = `${article.title} — VisiMark`;
  const res = await fetch(`articles/${article.path}`);
  if (!res.ok) return notFound(reader, `Could not load the article (HTTP ${res.status}).`);
  const md = stripFrontMatter(await res.text());

  reader.innerHTML = `<div class="reader-inner">${header(article)}<div class="reader-body"></div></div>`;
  const body = reader.querySelector<HTMLElement>(".reader-body")!;
  body.innerHTML = marked.parse(md);
  rebase(body, article.path.slice(0, article.path.lastIndexOf("/") + 1));
}

void render();
