import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The application half of the imports chapter's fix (`docs/reviews/2026-09-16.md`
 * §4.3). The engine half, which runs the chapter through `memoryReader` and
 * pins what the panel must say, is
 * `packages/visimark/test/browser/imports-chapter.test.ts`; its header tells
 * the story.
 */
test("the playground app loads the CSV and hands the engine a reader for it", () => {
  // The engine half (packages/visimark/test/browser/imports-chapter.test.ts)
  // passes even when the page forgets the file — which
  // is precisely how the bug shipped. This end reads the application source.
  //
  // It used to read docs/playground.html, where this wiring was 1,535 lines of
  // inline <script>. Review §2.4 moved that to src/playground/, so the needles
  // moved with it; the page itself is now checked only for loading the bundle
  // that carries them.
  const app = (name: string) =>
    readFileSync(join(import.meta.dir, "../../src/playground", name), "utf8");
  const sources = app("sources.ts");
  const store = app("store.ts");
  const pipeline = app("pipeline.ts");
  const html = readFileSync(join(import.meta.dir, "../../../docs/playground.html"), "utf8");

  const missing = [
    // the page loads the application at all
    ["docs/playground.html", html, 'src="./vendor/visimark-playground.js"'],
    // the CSV is fetched into the in-memory store. Matched on the declaration
    // itself, not on the bare filename: the name also appears in READER_FS
    // below, so a looser needle stayed green when TUTORIAL_DATA was emptied —
    // the page would fetch nothing and the reader would serve null.
    ["sources.ts", sources, 'export const TUTORIAL_DATA = ["13-imports.csv"];'],
    // ...and mapped into the synthetic directory the reader serves
    ["store.ts", store, '"/tutorial/13-imports.csv": "13-imports.csv"'],
    ["store.ts", store, '"/tutorial/13-imports.md": "13-imports.md"'],
    // ...through the port, not a hand-rolled copy of it
    ["store.ts", store, "VM.memoryReader("],
    // ...and the check panel is actually given the result
    ["pipeline.ts", pipeline, "store.optsFor(current)"],
  ]
    .filter(([, haystack, needle]) => !(haystack as string).includes(needle as string))
    .map(([file, , needle]) => `${file as string}: ${needle as string}`);

  expect(
    missing,
    `the playground application no longer contains ${missing.join(", ")} — the imports chapter ` +
      "is back to checking with no reader, which reports UNDEF on every column the CSV supplies " +
      "(review §4.3). Restore the wiring in src/playground/ rather than deleting this check.",
  ).toEqual([]);
});
