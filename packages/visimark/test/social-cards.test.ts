// Review §2.9: what the four badge-share buttons actually produce.
//
// `shareViaClipboard()` opens Facebook, LinkedIn, Instagram and X with
// https://michal-niedzwiedzki.github.io/visimark/ — and every page under that
// URL had no og:title, no og:description, no og:image and not even a
// <meta name="description">, so every badge a visitor was prompted to share
// rendered as a bare blue link. The feature's own success case was broken.
//
// Two things here are the sort that break silently and are only noticed by
// someone else's scraper: a relative og:image (which resolves against the
// scraper, not the page) and a third copy of the tagline drifting away from
// the first two.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withoutComments } from "./support/markup.js";

const root = join(import.meta.dir, "../../..");
const docs = join(root, "docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");

const SITE = "https://michal-niedzwiedzki.github.io/visimark/";

/** The one source of truth for how this product describes itself — also what
 *  npm and the VS Code Marketplace show. */
const { description } = JSON.parse(
  readFileSync(join(root, "packages/visimark/package.json"), "utf8"),
) as { description: string };

const PAGES = ["index.html", "playground.html", "tutorial.html", "preview.html"];

/**
 * `content` of the first <meta> whose property/name is `key`.
 *
 * Comments are stripped first — each page's block carries prose that names
 * these keys — and the attributes are matched across line breaks, because
 * oxfmt wraps a <meta> whose content is long enough onto three lines.
 */
function meta(page: string, key: string): string | undefined {
  const markup = withoutComments(read(page));
  const tag = new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`);
  return tag.exec(markup)?.[1];
}

describe.each(PAGES)("%s", (page) => {
  test("has a description, an Open Graph title and a card type", () => {
    expect(meta(page, "description")).toBeTruthy();
    expect(meta(page, "og:title")).toBeTruthy();
    expect(meta(page, "og:description")).toBe(meta(page, "description"));
    expect(meta(page, "twitter:card")).toBe("summary_large_image");
  });

  test("every URL it publishes is absolute", () => {
    // A relative og:image is fetched relative to the scraper and silently
    // yields nothing — the same class of bug as the vsix-readme-image-urls
    // note.
    expect(meta(page, "og:image")).toBe(`${SITE}og-card.png`);
    expect(meta(page, "og:url")).toStartWith(SITE);
  });

  test("declares the image's real dimensions and an alt text", () => {
    expect(meta(page, "og:image:width")).toBe("1200");
    expect(meta(page, "og:image:height")).toBe("630");
    expect(meta(page, "og:image:alt")).toBeTruthy();
  });

  test("its og:url names itself, so a share cannot point at the wrong page", () => {
    expect(meta(page, "og:url")).toBe(page === "index.html" ? SITE : `${SITE}${page}`);
  });
});

describe("the tagline has one source of truth", () => {
  test("index.html's description is package.json's, verbatim", () => {
    expect(meta("index.html", "description")).toBe(description);
  });

  test("index.html's subtitle is that description's first clause", () => {
    // Same words, the page's own capitalisation: the subtitle is set
    // lowercase as a styling choice, which is the one difference allowed.
    const claim = description.split(":")[0]!;
    const subtitle = /<p class="subtitle">([^<]*)<\/p>/.exec(read("index.html"))?.[1]?.trim();
    expect(subtitle?.toLowerCase()).toBe(claim.toLowerCase());
  });

  test("the image exists at the size the tags promise", () => {
    // PNG IHDR: width and height are big-endian uint32s at bytes 16 and 20.
    // A card whose real size disagrees with og:image:width gets cropped or
    // rejected, differently on each network.
    const png = readFileSync(join(docs, "og-card.png"));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  test("the share image is generated from the same field", () => {
    const generator = readFileSync(join(root, "scripts/gen-og-image.mjs"), "utf8");
    expect(generator).toContain("packages/visimark/package.json");
    expect(generator).toContain('description.split(":")[0]');
  });
});

describe("the badge share buttons", () => {
  test("open the URL the cards are attached to", () => {
    const badges = readFileSync(
      join(root, "packages/visimark/src/playground/app/badges.ts"),
      "utf8",
    );
    expect(badges).toContain(`export const SHARE_URL = "${SITE}"`);
  });
});
