/**
 * The Material Symbols the site draws, and the committed font that holds them.
 *
 * docs/fonts/material-symbols-outlined.ttf is a subset: a ligature name that
 * is not in it renders as its own text, so an icon added anywhere is invisible
 * until the font is rebuilt. `bun run gen:fonts` rebuilds it; the manifest it
 * writes beside it is what lets a test (icons-lib.test.ts) notice, offline,
 * that someone forgot.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** `<span class="material-symbols-outlined">NAME</span>`, in HTML or in a TS string. */
const LIGATURE = /material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*</g;

/** Ligature names in `text`: every span drawn with the icon font. */
export function ligaturesIn(text: string): string[] {
  return [...text.matchAll(LIGATURE)].map((m) => m[1]!);
}

/** The `icon` of each entry in a catalogue (`examples.json`). */
export function catalogueIcons(json: string, key: "examples"): string[] {
  const entries = (JSON.parse(json) as Record<string, { icon?: string }[]>)[key] ?? [];
  return entries.flatMap((e) => (e.icon ? [e.icon] : []));
}

function walk(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path, keep);
    return keep(name) ? [path] : [];
  });
}

/** Every icon the repository draws, sorted. Reads the catalogues, the
 *  hand-written pages and the TypeScript that builds markup. */
export function usedIcons(root: string): string[] {
  const names = new Set<string>();
  const read = (path: string) => readFileSync(join(root, path), "utf8");
  for (const n of catalogueIcons(read("docs/examples/examples.json"), "examples")) names.add(n);
  const pages = readdirSync(join(root, "docs")).filter((f) => f.endsWith(".html"));
  for (const f of pages) for (const n of ligaturesIn(read(join("docs", f)))) names.add(n);
  const sources = [
    ...walk(join(root, "packages/visimark/src"), (f) => f.endsWith(".ts")),
    ...walk(join(root, "scripts"), (f) => f.endsWith(".ts") && !f.endsWith(".test.ts")),
  ];
  for (const f of sources) for (const n of ligaturesIn(readFileSync(f, "utf8"))) names.add(n);
  return [...names].sort();
}

/** The Google Fonts CSS request for a subset holding exactly `names`. */
export function subsetUrl(names: string[]): string {
  const sorted = [...names].sort();
  return `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${sorted.join(",")}`;
}

export const MANIFEST_PATH = "docs/fonts/material-symbols-outlined.icons.json";

export const FONT_PATH = "docs/fonts/material-symbols-outlined.ttf";

/** The two files that name the font in an `@font-face`. Every generated page
 *  reaches it through docs/styles.css; the playground carries its own copy. */
export const FONT_REFERENCES = ["docs/styles.css", "docs/playground.html"];

const FONT_URL = /(material-symbols-outlined\.ttf)(?:\?v=[0-9a-f]+)?(?=")/g;

/** Eight hex digits of the font's SHA-256: a URL that changes when the bytes do. */
export function fontVersion(font: Uint8Array): string {
  return createHash("sha256").update(font).digest("hex").slice(0, 8);
}

/** `text` with every font URL pointing at `?v=<version>`, so a browser that
 *  cached the previous subset under the same URL asks for the new one. */
export function withFontVersion(text: string, version: string): string {
  return text.replace(FONT_URL, `$1?v=${version}`);
}

/** The versions `text` names, one per font URL (`[]` when it names none). */
export function fontVersionsIn(text: string): (string | undefined)[] {
  return [...text.matchAll(FONT_URL)].map((m) => /\?v=([0-9a-f]+)/.exec(m[0])?.[1]);
}
