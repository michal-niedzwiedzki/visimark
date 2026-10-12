import { expect, test } from "bun:test";
import { EDITOR_BACKGROUND, VMARK_PALETTE } from "../../src/playground/app/highlight-palette.js";

/**
 * The playground's colours for vmark tokens (#367 spec §4.5) must each reach
 * WCAG AA, 4.5:1, on the editor's composited background.
 */

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

test("the background is .editor's rgba(0, 0, 0, 0.9) over the page's #1b1b1b", () => {
  expect(EDITOR_BACKGROUND).toBe("#030303");
});

test.each(Object.entries(VMARK_PALETTE))("%s (%s) reaches 4.5:1", (_name, colour) => {
  expect(contrast(colour, EDITOR_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
});
