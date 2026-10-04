/**
 * The pure half of `gen-examples.ts`: no filesystem access, so it is unit-
 * tested directly. The list page shares its shell with the articles list; each
 * example's own page is a `renderDocPage` render of the Markdown file, the
 * same technique as docs/ci.html.
 */
import { escapeHtml } from "../packages/visimark/src/site/dom.js";
import { renderTutorialPage } from "./gen-docs-lib.js";
import { pageShell } from "./gen-articles-lib.js";

export interface Example {
  slug: string;
  title: string;
  tags: string[];
  teaser: string;
  /** A Material Symbols Outlined ligature name, drawn from docs/fonts/. */
  icon?: string;
  /** The example's Markdown file, relative to docs/examples/. */
  path: string;
  /** Data files the Markdown reads (a CSV import), relative to docs/examples/.
   *  Each is appended to the page as a fenced block, so the example can be
   *  read without opening the repository. */
  attachments?: string[];
  /** Who the example is for; a filter on the list page. */
  audience?: string[];
}

const SITE_URL = "https://visimark.dev/";
const DESCRIPTION =
  "Worked VisiMark documents from the repository: charts that cannot drift from their data, and documentation that executes.";
const GENERATED_BY = "`bun run gen:examples` from docs/examples/examples.json";

const exampleHref = (e: Example): string => `examples/${encodeURIComponent(e.slug)}/`;

/** "capacity_planners" -> "Capacity planners". */
export const audienceLabel = (a: string): string => {
  const words = a.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

function filterGroup(
  group: string,
  label: string,
  options: { value: string; text: string }[],
): string {
  const buttons = [{ value: "", text: "All" }, ...options]
    .map(
      (o) =>
        `<button type="button" data-value="${escapeHtml(o.value)}" aria-pressed="${o.value === "" ? "true" : "false"}">${escapeHtml(o.text)}</button>`,
    )
    .join("");
  return `        <div class="examples-filter-group" data-group="${group}" role="group" aria-label="${label}">
          <span class="examples-filter-label">${label}</span>${buttons}
        </div>`;
}

function filterBar(examples: Example[]): string {
  const tags = uniqueSorted(examples.flatMap((e) => e.tags)).map((t) => ({ value: t, text: t }));
  const audiences = uniqueSorted(examples.flatMap((e) => e.audience ?? [])).map((a) => ({
    value: a,
    text: audienceLabel(a),
  }));
  return `        <!-- Shown by examples-filter.js; without it the whole list stays visible. -->
        <div class="examples-filter" id="examples-filter" hidden>
${filterGroup("tags", "Tag", tags)}
${filterGroup("audience", "Audience", audiences)}
        </div>`;
}

function card(e: Example): string {
  const href = escapeHtml(exampleHref(e));
  const icon = e.icon
    ? `<a class="articles-icon" href="${href}" tabindex="-1" aria-hidden="true"><span class="material-symbols-outlined">${escapeHtml(e.icon)}</span></a>`
    : "";
  const audience = e.audience ?? [];
  const attr = (values: string[]): string => escapeHtml(values.join("|"));
  const chips = audience.length
    ? `
            <p class="examples-audience">${audience.map((a) => `<span class="examples-chip">${escapeHtml(audienceLabel(a))}</span>`).join("")}</p>`
    : "";
  return `        <article class="article-card" data-tags="${attr(e.tags)}" data-audience="${attr(audience)}">${icon}<div class="articles-text">
            <h2><a href="${href}">${escapeHtml(e.title)}</a></h2>
            <p class="articles-tags">${e.tags.map(escapeHtml).join(", ")}</p>${chips}
            <p class="articles-teaser">${escapeHtml(e.teaser)}</p>
            <a class="articles-read" href="${href}">See the example &rarr;</a>
          </div></article>`;
}

export function renderExamplesListPage(examples: Example[]): string {
  return pageShell({
    base: "",
    heading: "Examples",
    subtitle: "documents from the repository, worked end to end",
    generatedBy: GENERATED_BY,
    title: "VisiMark examples",
    ogTitle: "VisiMark examples",
    ogUrl: `${SITE_URL}examples.html`,
    description: DESCRIPTION,
    ogType: "website",
    ogImage: `${SITE_URL}og-card.png`,
    ogImageDimensions: { width: 1200, height: 630 },
    script: "examples-filter.js",
    body: `      <main class="articles-list">
${filterBar(examples)}
        <div class="examples-list">
${examples.map(card).join("\n")}
        </div>
      </main>`,
  });
}

export interface Attachment {
  name: string;
  content: string;
}

/** The Markdown with each attachment appended under its own heading. The fence
 *  is one backtick longer than the longest run inside the file. */
export function withAttachments(markdown: string, attachments: Attachment[]): string {
  return attachments.reduce((md, { name, content }) => {
    const longest = Math.max(2, ...(content.match(/`+/g) ?? []).map((run) => run.length));
    const fence = "`".repeat(longest + 1);
    return `${md.trimEnd()}\n\n## Attachment: ${name}\n\n${fence}csv\n${content.trimEnd()}\n${fence}\n`;
  }, markdown);
}

export function renderExamplePage(
  example: Example,
  markdown: string,
  attachments: Attachment[] = [],
): string {
  return renderTutorialPage(withAttachments(markdown, attachments), {
    title: `${example.title} — VisiMark`,
    description: example.teaser,
    ogTitle: example.title,
    navLabel: "examples",
    base: "../../",
    ogPath: `examples/${example.slug}/`,
  });
}
