/**
 * The pure half of `gen-docs.ts`: no filesystem access, so it is unit-testable
 * directly. Markdown rendering uses the same remark-parse/remark-gfm/remark-rehype
 * pipeline as the site pages for consistency.
 */

import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { escapeHtml, slugify } from "../packages/visimark/src/site/dom.js";
import { renderNav } from "./nav-lib.js";

export interface TocEntry {
  text: string;
  id: string;
  level: number;
}

/** A slug unique among every id `seen` so far, tracking full ids rather than
 *  per-base counts — a `-1` suffix can itself collide with an earlier base
 *  that happened to end the same way. */
function uniqueSlug(seen: Set<string>, text: string): string {
  const base = slugify(text);
  let id = base;
  for (let n = 1; seen.has(id); n++) id = `${base}-${n}`;
  seen.add(id);
  return id;
}

/** Renders Markdown to safely escaped HTML using the unified pipeline.
 *  rehypeStringify ensures all special characters including < and > are escaped.
 *  Input is Markdown from local .md files (trusted source, not user-supplied). */
export function renderMarkdown(markdown: string): string {
  const renderedAndSafeHtml = String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(markdown),
  );
  return renderedAndSafeHtml;
}

/** Extracts plain text from HTML by stripping all tags.
 *  Input must be from renderMarkdown() which properly escapes &lt;script&gt;.
 *  After tag removal, only entity-encoded special chars remain (&lt; etc). */
function getPlainTextFromHtml(htmlText: string): string {
  let result = htmlText;
  let openIdx = result.indexOf("<");
  while (openIdx !== -1) {
    const closeIdx = result.indexOf(">", openIdx);
    if (closeIdx === -1) break;
    // Remove tag from openIdx to closeIdx inclusive
    result = result.slice(0, openIdx) + result.slice(closeIdx + 1);
    openIdx = result.indexOf("<", openIdx);
  }
  return result;
}

/** Splits Markdown into top-level blocks for tutorial display. */
function splitBlocks(md: string): string[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  let fence: { char: string; len: number } | null = null;

  const flush = (): void => {
    if (cur.join("").trim() !== "") blocks.push(cur.join("\n"));
    cur = [];
  };

  for (const line of lines) {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);

    if (fence) {
      cur.push(line);
      if (m && m[1]![0] === fence.char && m[1]!.length >= fence.len && m[2]!.trim() === "") {
        fence = null;
        flush();
      }
      continue;
    }
    if (m) {
      flush();
      fence = { char: m[1]![0]!, len: m[1]!.length };
      cur.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      cur.push(line);
      flush();
      continue;
    }
    cur.push(line);
  }
  flush();
  return blocks;
}

/** The guide pages that are published as HTML. A link from one guide's
 *  Markdown to another's (`[ci.md](ci.md#21-…)`) reads correctly on GitHub,
 *  and is re-pointed at the generated page here so the site never serves raw
 *  Markdown. */
const HTML_PAGES = ["ci", "mcp-server", "simulate", "tutorial"];

/** Rewrites `href="ci.md"` and `href="ci.md#anchor"` to the `.html` page, for
 *  each of {@link HTML_PAGES}. Runs before {@link withBase}, so a page nested
 *  below docs/ still gets its base prefix. */
export function toHtmlLinks(html: string): string {
  const pages = HTML_PAGES.join("|");
  return html.replace(new RegExp(`(\\shref=")(?:\\./)?(${pages})\\.md(?=[#"])`, "g"), "$1$2.html");
}

/** Re-points every relative `src` and `href` in rendered HTML (a chart SVG, say) so a
 *  Markdown file written to be read from docs/ still resolves from a page
 *  nested `base` below it. */
export function withBase(html: string, base: string): string {
  if (base === "") return html;
  return html.replace(/(\s(?:src|href)=")(?![a-z][a-z0-9+.-]*:|\/|#)/gi, `$1${base}`);
}

const TUTORIAL_PAGE: SplitPageOptions = {
  title: "The VisiMark tutorial",
  description:
    "From a plain Markdown table to a checked document and back out to CI, one concept at a time — tables, inference, anchors, aggregates, assertions, charts and imports.",
  ogTitle: "The VisiMark tutorial",
  navLabel: "tutorial",
  ogPath: "tutorial.html",
  base: "",
};

/** The side-by-side page: each Markdown block beside what it renders to.
 *  Without `options` it is docs/tutorial.html; an example passes its own. */
export function renderTutorialPage(
  markdown: string,
  options: SplitPageOptions = TUTORIAL_PAGE,
): string {
  const blocks = splitBlocks(markdown);
  const tocEntries: TocEntry[] = [];
  const seen = new Set<string>();

  let mainHtml = "";
  for (const block of blocks) {
    const head = /^(#{1,6})\s+(.*)$/.exec(block);
    const rendered = renderMarkdown(block);
    let out = rendered;

    if (head) {
      const id = uniqueSlug(seen, head[2]!);
      tocEntries.push({ text: head[2]!, id, level: head[1]!.length });
      out = rendered.replace(/^<h([1-6])>/, `<h$1 id="${escapeHtml(id)}">`);
    }

    const srcHtml = `<pre class="src">${escapeHtml(block)}</pre>`;
    mainHtml += `${srcHtml}<div class="out">${withBase(toHtmlLinks(out), options.base)}</div>`;
  }

  return createTutorialHtml(mainHtml, tocEntries, options);
}

function createTutorialHtml(mainHtml: string, toc: TocEntry[], options: SplitPageOptions): string {
  const { base } = options;
  const tocLinksHtml = toc
    .map((e) => `<a href="#${escapeHtml(e.id)}" data-level="${e.level}">${escapeHtml(e.text)}</a>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />

    <!--
      Generated by \`bun run gen:docs\` — do not hand-edit.

      Follow-up review §2.3. The playground carried a \`default-src 'none'\`
      allowlist and its neighbours carried nothing at all, on a site
      served verbatim by GitHub Pages — which cannot send headers, so a
      <meta> policy is the only content-security control available, and it
      has to come before the first subresource.

      \`style-src 'self'\` covers guide.css, the stylesheet every generated
      guide page shares. Nothing here is inline, so nothing inline is granted.

      \`script-src 'self'\` covers this page's own bundled script
      (vendor/visimark-site-tutorial.js), which the example pages reach through
      their base path.

      \`img-src 'self'\` covers charts rendered in the tutorial
      (charts/c-trend.svg), which is a sibling.

      \`frame-ancestors\` is absent because a <meta> policy cannot carry it; on
      Pages there is nowhere to put it.
    -->
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none';
               script-src 'self';
               style-src 'self';
               img-src 'self';
               base-uri 'none';
               form-action 'none'"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <meta
      name="description"
      content="${escapeHtml(options.description)}"
    />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="VisiMark" />
    <meta property="og:title" content="${escapeHtml(options.ogTitle)}" />
    <meta
      property="og:description"
      content="${escapeHtml(options.description)}"
    />
    <meta
      property="og:url"
      content="https://visimark.dev/${options.ogPath}"
    />
    <meta
      property="og:image"
      content="https://visimark.dev/og-card.png"
    />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta
      property="og:image:alt"
      content="VisiMark: a vmark block computing grand_total = SUM(Total), and the prose value it keeps in step"
    />
    <meta name="twitter:card" content="summary_large_image" />
    <title>${escapeHtml(options.title)}</title>
    <link rel="icon" type="image/webp" href="${base}assets/visimark.webp" />

    <link rel="stylesheet" href="${base}guide.css" />
  </head>

  <body class="split-page" data-mode="split">
    <header class="bar">
      <div class="bar-side">
        <span class="title"><a href="${base}index.html">VisiMark</a> — ${escapeHtml(options.navLabel)}</span>
        <nav class="nav" aria-label="Site">
${renderNav(base, options.ogPath)}
        </nav>
      </div>

      <button class="toc-btn" id="toc-btn" type="button" aria-haspopup="dialog">
        Table of Contents <kbd class="toc-hint">/</kbd>
      </button>

      <div class="bar-side bar-side-end">
        <span class="modes" role="group" aria-label="View mode">
          <button type="button" data-set="split" aria-pressed="true">Side by side</button>
          <button type="button" data-set="rendered" aria-pressed="false">Rendered</button>
          <button type="button" data-set="source" aria-pressed="false">Source</button>
        </span>
      </div>
    </header>

    <dialog class="toc" id="toc" aria-label="Table of contents">
      <div class="toc-inner">
        <div class="toc-head">
          <strong>Table of Contents</strong>
          <input
            type="search"
            id="toc-search"
            class="toc-search"
            placeholder="Search"
            aria-label="Search table of contents"
            autocomplete="off"
          />
          <button class="toc-close" id="toc-close" type="button" aria-label="Close">&times;</button>
        </div>
        <nav class="toc-list" id="toc-list">
${tocLinksHtml}
        </nav>
      </div>
    </dialog>

    <main id="doc">
${mainHtml}
    </main>

    <script src="${base}vendor/visimark-site-tutorial.js"></script>
  </body>
</html>`;
}

export interface SplitPageOptions {
  title: string;
  description: string;
  ogTitle: string;
  navLabel: string;
  /** The page's path under docs/, for `og:url`. */
  ogPath: string;
  /** Path from the page back to docs/, as in {@link DocPageOptions}. */
  base: string;
}

export interface DocPageOptions {
  title: string;
  description: string;
  ogTitle: string;
  navLabel: string;
  scriptName: string;
  /** Path from this page back to docs/ — `""` for a page in docs/ itself,
   *  `"../../"` for one at docs/examples/<slug>/. Prefixes every site link,
   *  the icon, the bundle and any relative image in the Markdown. */
  base?: string;
  /** The page's path under docs/, for `og:url`. Defaults to
   *  `<scriptName>.html`. */
  ogPath?: string;
}

export function renderDocPage(markdown: string, options: DocPageOptions): string {
  const base = options.base ?? "";
  const html = withBase(toHtmlLinks(renderMarkdown(markdown)), base);
  const seen = new Set<string>();
  const toc: TocEntry[] = [];

  // Process headings to add IDs and build TOC
  let processedHtml = html;
  const regex = /<h([1-6])>(.*?)<\/h[1-6]>/g;
  const headings: Array<{ level: string; text: string; originalMatch: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: match[1]!,
      text: match[2]!,
      originalMatch: match[0]!,
    });
  }

  for (const heading of headings) {
    // Extract plain text content safely by removing HTML tags completely
    const plainText = getPlainTextFromHtml(heading.text);
    const id = uniqueSlug(seen, plainText);

    toc.push({
      text: plainText,
      id,
      level: parseInt(heading.level),
    });

    // heading.text already contains properly escaped HTML from renderMarkdown()
    // We only need to escape the id attribute
    const newHeading = `<h${heading.level} id="${escapeHtml(id)}">${heading.text}</h${heading.level}>`;
    processedHtml = processedHtml.replace(heading.originalMatch, newHeading);
  }

  // Disable checkboxes
  processedHtml = processedHtml.replace(
    /<input type="checkbox"(?!\s+disabled)/g,
    '<input type="checkbox" disabled',
  );

  const tocLinksHtml = toc
    .map((e) => `<a href="#${escapeHtml(e.id)}" data-level="${e.level}">${escapeHtml(e.text)}</a>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />

    <!--
      Generated by \`bun run gen:docs\` — do not hand-edit.

      Follow-up review §2.3. The playground carried a \`default-src 'none'\`
      allowlist and its neighbours carried nothing at all, on a site
      served verbatim by GitHub Pages — which cannot send headers, so a
      <meta> policy is the only content-security control available, and it
      has to come before the first subresource.

      \`style-src 'self'\` covers guide.css, the stylesheet every generated
      guide page shares. Nothing here is inline, so nothing inline is granted.

      \`script-src 'self'\` covers this page's own bundled script under
      vendor/, which is a sibling.

      \`img-src 'self'\` covers charts rendered in documentation.

      \`frame-ancestors\` is absent because a <meta> policy cannot carry it; on
      Pages there is nowhere to put it.
    -->
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none';
               script-src 'self';
               style-src 'self';
               img-src 'self';
               base-uri 'none';
               form-action 'none'"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <meta
      name="description"
      content="${escapeHtml(options.description)}"
    />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="VisiMark" />
    <meta property="og:title" content="${escapeHtml(options.ogTitle)}" />
    <meta
      property="og:description"
      content="${escapeHtml(options.description)}"
    />
    <meta
      property="og:url"
      content="https://visimark.dev/${options.ogPath ?? `${options.scriptName}.html`}"
    />
    <meta
      property="og:image"
      content="https://visimark.dev/og-card.png"
    />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta
      property="og:image:alt"
      content="VisiMark: a vmark block computing grand_total = SUM(Total), and the prose value it keeps in step"
    />
    <meta name="twitter:card" content="summary_large_image" />
    <title>${escapeHtml(options.title)}</title>
    <link rel="icon" type="image/webp" href="${base}assets/visimark.webp" />

    <link rel="stylesheet" href="${base}guide.css" />
  </head>

  <body class="doc-page">
    <header class="bar">
      <div class="bar-side">
        <span class="title"><a href="${base}index.html">VisiMark</a> — ${escapeHtml(options.navLabel)}</span>
        <nav class="nav" aria-label="Site">
${renderNav(base, options.ogPath ?? `${options.scriptName}.html`)}
        </nav>
      </div>

      <button class="toc-btn" id="toc-btn" type="button" aria-haspopup="dialog">
        Table of Contents <kbd class="toc-hint">/</kbd>
      </button>

      <div class="bar-side bar-side-end"></div>
    </header>

    <dialog class="toc" id="toc" aria-label="Table of contents">
      <div class="toc-inner">
        <div class="toc-head">
          <strong>Table of Contents</strong>
          <input
            type="search"
            id="toc-search"
            class="toc-search"
            placeholder="Search"
            aria-label="Search table of contents"
            autocomplete="off"
          />
          <button class="toc-close" id="toc-close" type="button" aria-label="Close">&times;</button>
        </div>
        <nav class="toc-list" id="toc-list">
${tocLinksHtml}
        </nav>
      </div>
    </dialog>

    <main id="doc">
${processedHtml}
    </main>

    <script src="${base}vendor/visimark-site-${escapeHtml(options.scriptName)}.js"></script>
  </body>
</html>`;
}
