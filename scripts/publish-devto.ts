/**
 * Publishes one article from docs/articles/articles.json to dev.to via the
 * Forem API (POST /api/articles) and records the resulting URL in that
 * entry's `reposted` array.
 *
 * Posts as a draft (`published: false`) by default so the result can be
 * reviewed on dev.to before going live — pass --publish to publish
 * immediately instead. Refuses to re-post a slug that already has a dev.to
 * URL in `reposted`, unless --force.
 *
 * Usage: `bun run publish:devto <slug> [--publish] [--force]`
 *
 * Requires DEVTO_API_KEY in the environment (Bun loads .env automatically).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  articleCanonicalUrl,
  stripFrontMatter,
  type Article,
} from "../packages/visimark/src/site/articles.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_DIR = join(ROOT, "docs/articles");
const ARTICLES_JSON = join(ARTICLES_DIR, "articles.json");
const SITE_URL = "https://visimark.dev/";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const publish = args.includes("--publish");
const force = args.includes("--force");

if (!slug) {
  console.error("Usage: bun run publish:devto <slug> [--publish] [--force]");
  process.exit(1);
}

const apiKey = process.env.DEVTO_API_KEY;
if (!apiKey) {
  console.error("DEVTO_API_KEY is not set (expected in .env).");
  process.exit(1);
}

/** dev.to tags: up to 4, alphanumeric only, no spaces or punctuation. */
function devtoTags(tags: string[]): string[] {
  return tags
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 4);
}

async function main() {
  const catalogue = JSON.parse(readFileSync(ARTICLES_JSON, "utf8")) as { articles: Article[] };
  const article = catalogue.articles.find((a) => a.slug === slug);
  if (!article) {
    console.error(`No article with slug "${slug}" in docs/articles/articles.json.`);
    process.exit(1);
  }

  const existingDevto = (article.reposted ?? []).find((u) => u.includes("dev.to/"));
  if (existingDevto && !force) {
    console.error(
      `"${slug}" was already posted to dev.to: ${existingDevto}\nPass --force to post again.`,
    );
    process.exit(1);
  }

  const markdown = readFileSync(join(ARTICLES_DIR, article.path), "utf8");
  const body_markdown = stripFrontMatter(markdown);

  const payload = {
    article: {
      title: article.title,
      body_markdown,
      published: publish,
      tags: devtoTags(article.tags),
      description: article.teaser,
      canonical_url: articleCanonicalUrl(article),
      main_image: article.banner ? `${SITE_URL}articles/${article.banner}` : null,
    },
  };

  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`dev.to API error: HTTP ${res.status}\n${await res.text()}`);
    process.exit(1);
  }

  const created = (await res.json()) as { url: string };

  if (!publish) {
    console.log(
      `Drafted: ${created.url}\n` +
        "Not recorded in docs/articles/articles.json — dev.to draft URLs are not the final " +
        "published URL. Re-run with --publish once it's live, or record the published URL by hand.",
    );
    return;
  }

  article.reposted = [...(article.reposted ?? []), created.url];
  writeFileSync(ARTICLES_JSON, `${JSON.stringify(catalogue, null, 2)}\n`);

  console.log(
    `Published: ${created.url}\n` +
      "Recorded in docs/articles/articles.json — run `bun run gen:articles` to regenerate the site pages.",
  );
}

main().catch((error: unknown) => {
  console.error(`dev.to publishing failed for "${slug}":`, error);
  process.exitCode = 1;
});
