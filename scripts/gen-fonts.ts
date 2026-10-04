/**
 * Rebuilds docs/fonts/material-symbols-outlined.ttf: the subset of Material
 * Symbols Outlined holding exactly the icons the site draws, and the manifest
 * naming them.
 *
 * Run with `bun run gen:fonts` after adding or changing an icon, in
 * docs/examples/examples.json, a page or a
 * `<span class="material-symbols-outlined">`. It asks Google Fonts, so it needs
 * the network and is not part of `gen:examples`, which CI re-runs and diffs.
 * icons-lib.test.ts fails, offline, when the manifest and the icons in use
 * disagree.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FONT_PATH,
  FONT_REFERENCES,
  MANIFEST_PATH,
  fontVersion,
  subsetUrl,
  usedIcons,
  withFontVersion,
} from "./icons-lib.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const names = usedIcons(ROOT);

const css = await fetch(subsetUrl(names));
if (!css.ok) throw new Error(`Google Fonts refused the icon list (HTTP ${css.status}): ${names}`);
const url = /url\((https:[^)]+)\)/.exec(await css.text())?.[1];
if (!url) throw new Error("Google Fonts returned no font URL");
const font = await fetch(url);
if (!font.ok) throw new Error(`could not fetch the font (HTTP ${font.status})`);

const bytes = new Uint8Array(await font.arrayBuffer());
mkdirSync(join(ROOT, "docs/fonts"), { recursive: true });
writeFileSync(join(ROOT, FONT_PATH), bytes);
writeFileSync(join(ROOT, MANIFEST_PATH), `${JSON.stringify(names, null, 2)}\n`);

// The URL is the cache key. Put a hash of the bytes in it, so a browser or
// CDN holding the previous subset fetches this one instead of drawing a new
// icon as its own name.
const version = fontVersion(bytes);
for (const path of FONT_REFERENCES) {
  const file = join(ROOT, path);
  writeFileSync(file, withFontVersion(readFileSync(file, "utf8"), version));
}
console.log(`Wrote ${FONT_PATH} with ${names.length} icons, as ?v=${version}.`);
