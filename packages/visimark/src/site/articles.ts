/**
 * The article table of contents, docs/articles/articles.json, and the markup
 * both pages that show it build from it: the landing page's carousel and the
 * full list on articles.html.
 *
 * An entry links to the reader page, articles/<slug>/, which finds it by slug —
 * so adding an article is one entry in the JSON, and filling in `posted` only
 * if the article was published somewhere else first.
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
  /** A cover image shown at the top of this article's own reader page,
   *  relative to docs/articles/ — same base path as `icon` and `path`.
   *  Optional; an article with no banner renders without one. */
  banner?: string;
  /** The Markdown file, relative to docs/articles/. */
  path: string;
  /** The article's canonical URL. Empty (the usual case) means the article's
   *  own reader page on this site is canonical — {@link articleCanonicalUrl}
   *  assembles that from `slug`. Set this only when the article was posted
   *  somewhere else *first*, so that syndicated copies point back at the
   *  original instead of competing with it for search ranking. Once set, it
   *  is never overwritten by tooling — a person decided where the original
   *  lives. */
  posted?: string;
  /** Other places this article was reposted, in addition to wherever
   *  `posted` points. Shown on the reader page as further "also at" links. */
  reposted?: string[];
  /** Shown in the landing page's carousel. Defaults to true. */
  featured?: boolean;
}

const SOURCE_BASE = "https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/articles/";
const SITE_URL = "https://visimark.dev/";

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

/** The article's canonical URL: `posted` when set, otherwise this site's own
 *  reader page for `slug`. This is what a reader page's `og:url` and
 *  `rel="canonical"` should carry, so a syndicated copy never competes with
 *  the original it was posted from. */
export function articleCanonicalUrl(a: Article): string {
  const posted = a.posted?.trim();
  return posted && posted.startsWith("https://") ? posted : `${SITE_URL}${articleHref(a)}`;
}

/** The place the article was first published, when that is somewhere other
 *  than this site itself — the case the reader page's "Also published here"
 *  link is for. `undefined` both when `posted` is unset (this site is
 *  canonical) and when it names this site explicitly. */
export function articlePublishedUrl(a: Article): string | undefined {
  const canonical = articleCanonicalUrl(a);
  return canonical.startsWith(SITE_URL) ? undefined : canonical;
}

/** Other places the article was reposted, https-only. */
export function articleRepostUrls(a: Article): string[] {
  return (a.reposted ?? []).filter((u) => u.startsWith("https://"));
}

/**
 * The article body without what the reader page shows itself: the leading
 * `# title` line, which `pageShell` already renders as the page's own `<h1>`.
 * Title, tags and author all live in `articles.json` now; the Markdown file
 * is body copy only.
 */
export function stripFrontMatter(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (lines[i]?.startsWith("# ")) i++;
  while (i < lines.length && lines[i]!.trim() === "") i++;
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
