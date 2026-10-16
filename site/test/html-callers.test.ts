import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every caller of setTrustedHtml is named here, so a new one has to be added
// on purpose — the review the scanner's `no-unsanitized` rule used to force
// on each `innerHTML` write. See the boundary in ../src/html.ts.

const SRC = join(import.meta.dir, "../src");

const CALLERS = [
  "pages/articles-carousel.ts",
  "pages/demo-panes.ts",
  "pages/preview-cards.ts",
  "pages/preview-page.ts",
  "pages/repo-scan.ts",
  "playground/badges.ts",
  "playground/pipeline.ts",
  "playground/reference.ts",
];

function sources(): { file: string; text: string }[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => ({ file: f.split("\\").join("/"), text: readFileSync(join(SRC, f), "utf8") }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

test("setTrustedHtml is called only from the reviewed files", () => {
  const found = sources()
    .filter(({ file, text }) => file !== "html.ts" && text.includes("setTrustedHtml("))
    .map(({ file }) => file);
  for (const file of found) {
    if (!CALLERS.includes(file)) {
      throw new Error(
        `setTrustedHtml has a caller not on the list: ${file}. Add it here only after checking that everything it passes is trusted — see the boundary in site/src/html.ts.`,
      );
    }
  }
  expect(found).toEqual(CALLERS);
});

test("no innerHTML write outside literal clears", () => {
  const writes = sources().flatMap(({ file, text }) =>
    text
      .split("\n")
      .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
      .filter(({ line }) => /\.innerHTML\s*=(?!=)(?!\s*""\s*;)/.test(line))
      .map(({ at }) => at),
  );
  expect(writes).toEqual([]);
});
