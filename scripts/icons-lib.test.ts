import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  catalogueIcons,
  FONT_PATH,
  FONT_REFERENCES,
  fontVersion,
  fontVersionsIn,
  ligaturesIn,
  MANIFEST_PATH,
  subsetUrl,
  usedIcons,
  withFontVersion,
} from "./icons-lib.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("ligaturesIn", () => {
  test("finds the icon spans in HTML, across a line break", () => {
    const html = `<span class="ico material-symbols-outlined" aria-hidden="true">science</span
      >Simulation <span class="material-symbols-outlined">tune</span>`;
    expect(ligaturesIn(html)).toEqual(["science", "tune"]);
  });

  test("ignores a span that is not an icon", () => {
    expect(ligaturesIn('<span class="chip">tune</span>')).toEqual([]);
  });
});

describe("catalogueIcons", () => {
  test("reads each entry's icon and skips an entry with none", () => {
    const json = JSON.stringify({ examples: [{ icon: "tune" }, {}, { icon: "cookie" }] });
    expect(catalogueIcons(json, "examples")).toEqual(["tune", "cookie"]);
  });
});

test("the subset request lists the names sorted, as Google Fonts requires", () => {
  expect(subsetUrl(["tune", "cookie"])).toEndWith("icon_names=cookie,tune");
});

test("the committed font was built for every icon the site draws — run `bun run gen:fonts`", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST_PATH), "utf8")) as string[];
  const used = usedIcons(ROOT);
  const missing = used.filter((n) => !manifest.includes(n));
  expect(missing, `not in docs/fonts/material-symbols-outlined.ttf: ${missing}`).toEqual([]);
  expect(manifest, "the manifest lists icons nothing draws any more").toEqual(used);
});

describe("the font's cache-busting version", () => {
  const css = 'src: url("fonts/material-symbols-outlined.ttf") format("truetype");';

  test("is added to a bare URL and replaced on a versioned one", () => {
    const once = withFontVersion(css, "aaaa1111");
    expect(once).toContain('material-symbols-outlined.ttf?v=aaaa1111")');
    expect(withFontVersion(once, "bbbb2222")).toContain('.ttf?v=bbbb2222")');
    expect(withFontVersion(once, "bbbb2222")).not.toContain("aaaa1111");
  });

  test("changes when the bytes do", () => {
    expect(fontVersion(new Uint8Array([1]))).not.toBe(fontVersion(new Uint8Array([2])));
  });

  test("every file that names the font names the committed bytes — run `bun run gen:fonts`", () => {
    const version = fontVersion(readFileSync(join(ROOT, FONT_PATH)));
    for (const path of FONT_REFERENCES) {
      const found = fontVersionsIn(readFileSync(join(ROOT, path), "utf8"));
      expect(found.length, `${path} names no font`).toBeGreaterThan(0);
      expect(found, `${path} points at a stale font`).toEqual(found.map(() => version));
    }
  });
});
