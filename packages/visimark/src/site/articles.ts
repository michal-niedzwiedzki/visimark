/**
 * The article table of contents, docs/articles/articles.json, and the markup
 * both pages that show it build from it: the landing page's carousel and the
 * full list on articles.html.
 *
 * An entry links to the reader page, articles/<slug>/, which finds it by slug —
 * so adding an article is one entry in the JSON, and filling in `url` once it
 * goes out elsewhere.
 */

import { escapeHtml } from "./dom.js";

export interface Article {
  slug: string;
  title: string;
  author: string;
  tags: string[];
  teaser: string;
  /** A 400x400 icon, relative to docs/articles/. */
  icon?: string;
  /** The Markdown file, relative to docs/articles/. */
  path: string;
  /** Where the article was published, once it has been. */
  url?: string;
  /** Shown in the landing page's carousel. Defaults to true. */
  featured?: boolean;
}

const SOURCE_BASE = "https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/articles/";

/** Where an article's title and "Read" link go: its own reader page,
 *  `articles/<slug>/`. `base` is the relative path from the current page back
 *  to `docs/` — `""` for a page that lives in `docs/` itself (the landing
 *  page's carousel, `articles.html`), `"../../"` for a page that lives at
 *  `docs/articles/<slug>/` (another article's own reader page, linking to
 *  this one from its "More to read" section). */
export function articleHref(a: Article, base = ""): string {
  return `${base}articles/${encodeURIComponent(a.slug)}/`;
}

/** The Markdown source on GitHub. */
export function articleSourceUrl(a: Article): string {
  return SOURCE_BASE + a.path;
}

/** The place the article was first published, when it has been. A `url` that
 *  is not https is ignored rather than trusted into an `href`. */
export function articlePublishedUrl(a: Article): string | undefined {
  return a.url?.startsWith("https://") ? a.url : undefined;
}

/**
 * The article body without what the reader page shows itself: the leading
 * `# title` and the metadata block under it (`Tags:`, `Author:`, `Posted:`,
 * `Reposted:`).
 */
export function stripFrontMatter(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (lines[i]?.startsWith("# ")) i++;
  while (i < lines.length && /^(\s*|(Tags|Author|Posted|Reposted):.*)$/.test(lines[i]!)) i++;
  return lines.slice(i).join("\n");
}

export async function loadArticles(): Promise<Article[]> {
  const res = await fetch("articles/articles.json");
  if (!res.ok) throw new Error(`articles.json: HTTP ${res.status}`);
  const data = (await res.json()) as { articles: Article[] };
  return data.articles;
}

/** The icon, title, tags, teaser and read link, shared by a carousel slide,
 *  a list card, and a "More to read" column. `heading` is the tag the title
 *  is set in; `base` is as in {@link articleHref}. */
export function articleBody(a: Article, heading: "h2" | "h3", base = ""): string {
  const href = escapeHtml(articleHref(a, base));
  const icon = a.icon
    ? `<a class="articles-icon" href="${href}" tabindex="-1" aria-hidden="true"><img src="${base}articles/${escapeHtml(a.icon)}" width="400" height="400" alt="" /></a>`
    : "";
  return `${icon}<div class="articles-text">
            <${heading}><a href="${href}">${escapeHtml(a.title)}</a></${heading}>
            <p class="articles-tags">${a.tags.map(escapeHtml).join(", ")}</p>
            <p class="articles-teaser">${escapeHtml(a.teaser)}</p>
            <a class="articles-read" href="${href}">Read the article &rarr;</a>
          </div>`;
}
