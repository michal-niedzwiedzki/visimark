// The two halves of review §2.2 have to agree with each other.
//
// Below 900px docs/playground.html swaps the five-panel layout for an
// interstitial, and src/playground/app/main.ts declines to boot — no fetches,
// no CodeMirror, no engine — until the viewport is wide enough. The breakpoint
// is therefore written twice, in two languages, and nothing but this test
// notices if one of them moves.

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Whether `css` sets `property` to `value` for every one of `selectors`, in
 * one rule.
 *
 * Follow-up review §2.7: these assertions used to be exact-whitespace string
 * matches — `expect(page).toContain(".playground,\n        .boot-overlay {\n
 * display: none;")`. A reindent by `oxfmt`, or one more selector in the list,
 * breaks that; the breakpoint moving does not. The declaration is the thing
 * worth pinning, so the whitespace is what gets ignored.
 */
function declares(css: string, selectors: string[], property: string, value: string): boolean {
  const list = selectors.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(",\\s*");
  return new RegExp(`${list}\\s*\\{[^}]*\\b${property}\\s*:\\s*${value}\\s*;`).test(css);
}

const page = readFileSync(join(import.meta.dir, "../../../../docs/playground.html"), "utf8");
const appDir = join(import.meta.dir, "../../src/playground/app");
const bootModule = readFileSync(join(appDir, "boot.ts"), "utf8");
const main = readFileSync(join(appDir, "main.ts"), "utf8");

test("the CSS breakpoint and the JS breakpoint are the same 900px", () => {
  expect(page).toContain("@media (max-width: 899px)");
  expect(bootModule).toContain('"(min-width: 900px)"');
});

test("below the breakpoint the playground is replaced, not merely narrowed", () => {
  // both the panel layout and the boot overlay go; the interstitial arrives
  const smallScreenBlock = page.slice(page.indexOf("@media (max-width: 899px)"));
  expect(declares(smallScreenBlock, [".playground", ".boot-overlay"], "display", "none")).toBe(
    true,
  );
  expect(declares(smallScreenBlock, [".small-screen"], "display", "flex")).toBe(true);
  // and the interstitial itself exists, with somewhere to go
  expect(page).toContain('<main class="small-screen">');
  expect(page).toContain('href="tutorial.html"');
});

test("the interstitial scrolls, unlike the playground it replaces", () => {
  // `html, body { overflow: hidden }` is what makes the panel layout work and
  // what makes a phone-width page a dead end; the media query undoes it
  const smallScreenBlock = page.slice(page.indexOf("@media (max-width: 899px)"));
  expect(declares(smallScreenBlock, ["html", "body"], "overflow", "auto")).toBe(true);
  expect(declares(smallScreenBlock, ["html", "body"], "height", "auto")).toBe(true);
});

test("nothing boots until the viewport is wide enough", () => {
  expect(main).toContain("await whenWideEnough();");
  // ...and it is awaited before anything is fetched. Review §2.5 gave
  // loadFiles an argument, so this matches the call rather than the old
  // no-arg spelling — and still fails if the fetch moves above the gate.
  const fetchAt = main.indexOf("await loadFiles(");
  expect(fetchAt).toBeGreaterThan(-1);
  expect(main.indexOf("await whenWideEnough();")).toBeLessThan(fetchAt);
});

test("100vh is gone — it is the viewport with the mobile toolbar retracted", () => {
  // the comment above the rule still says "100vh", which is the point of it
  expect(page).not.toContain("height: 100vh");
  expect(page).toContain("height: 100dvh;");
});
