#!/usr/bin/env bun
// Renders docs/og-card.png — the 1200 × 630 image every social network shows
// when one of this site's URLs is pasted into it (review §2.9).
//
// Run: bun scripts/gen-og-image.mjs   (needs `chromium` on PATH)
//
// Why a generator and not a hand-made image: the card's only words are the
// product name and the tagline, and the tagline has exactly one source of
// truth — packages/visimark/package.json's `description`, which is also what
// npm and the VS Code Marketplace show. Re-running this after editing that
// field is the whole maintenance story.
//
// **The PNG is committed and is NOT checked by CI**, unlike docs/vendor/ and
// docs/function-reference.md. Two headless Chromiums of different versions
// produce different bytes for identical input — font rasterisation and PNG
// encoding both drift — so a `git diff --exit-code` gate here would fail on
// the runner's browser rather than on anything a person changed. The card
// changes about as often as the product name does.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DOCS = join(ROOT, "docs");

const { description } = JSON.parse(
  readFileSync(join(ROOT, "packages/visimark/package.json"), "utf8"),
);
// The card wants the claim, not the whole elevator pitch: `description` is
// "<claim>: <how it works>", and the colon is the seam.
const tagline = description.split(":")[0];

// The logo is inlined as a data URI rather than linked, so the card renders
// the same whether or not the page is being served.
const logo = readFileSync(join(DOCS, "visimark.webp")).toString("base64");

// Deliberately a copy of the site's colours rather than a `<link>` to
// styles.css: styles.css is a page layout with a masthead, cards, a footer and
// four breakpoints, none of which apply to a fixed 1200 × 630 canvas. What has
// to stay in step is the palette, and it is six values.
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap"
    />
    <style>
      * { box-sizing: border-box; margin: 0; }
      body {
        width: 1200px; height: 630px; overflow: hidden;
        display: flex; flex-direction: column; justify-content: center;
        gap: 34px; padding: 0 84px;
        background:
          repeating-linear-gradient(0deg,
            rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px,
            transparent 1px, transparent 5px),
          linear-gradient(180deg, #252422 0%, #403d39 100%);
        color: #f4f4f4;
        font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .head { display: flex; align-items: center; gap: 34px; }
      .head img {
        width: 132px; height: 132px;
        filter: drop-shadow(0 6px 20px rgba(0,0,0,0.5));
      }
      h1 { font-size: 104px; font-weight: 800; letter-spacing: -0.025em; line-height: 1; }
      .tagline { font-size: 38px; color: #d8d6d2; line-height: 1.3; max-width: 1000px; }
      .pitch {
        font-family: "Caveat", cursive; font-weight: 700;
        font-size: 46px; color: #ff453a; transform: rotate(-3deg);
        transform-origin: left center; margin-top: 8px;
        text-shadow: 0 3px 18px rgba(255,69,58,0.35);
      }
      .strip {
        font-family: "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
        font-size: 26px; line-height: 1.5; color: #cfcdc9;
        background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.09);
        border-radius: 12px; padding: 22px 28px; white-space: pre;
      }
      .ok { color: #32d74b; }
      .dim { color: #8a8780; }
      .key { color: #ffb02e; }
    </style>
  </head>
  <body>
    <div class="head">
      <img src="data:image/webp;base64,${logo}" alt="" />
      <h1>VisiMark</h1>
    </div>
    <p class="tagline">${tagline}</p>
    <div class="strip"><span class="dim">\`\`\`vmark #order</span>
grand_total = <span class="key">SUM</span>(Total)
<span class="dim">\`\`\`</span>

The order comes to <span class="ok">**158.00**</span><span class="dim">&lt;!--vmark=order.grand_total--&gt;</span></div>
    <p class="pitch">&hellip;and catches AI arithmetic hallucinations, too!</p>
  </body>
</html>
`;

const tmp = mkdtempSync(join(tmpdir(), "visimark-og-"));
try {
  const page = join(tmp, "card.html");
  writeFileSync(page, html);
  const out = join(DOCS, "og-card.png");
  const res = spawnSync(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--default-background-color=00000000",
      "--force-device-scale-factor=1",
      "--window-size=1200,630",
      // The webfont is fetched over the network; without a virtual-time budget
      // the screenshot can land before Caveat does and the pitch line silently
      // falls back to a sans-serif.
      "--virtual-time-budget=10000",
      `--screenshot=${out}`,
      `file://${page}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (res.status !== 0) {
    process.stderr.write(res.stderr?.toString() ?? "");
    throw new Error(`chromium exited ${res.status}`);
  }
  console.log(`wrote ${out}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
