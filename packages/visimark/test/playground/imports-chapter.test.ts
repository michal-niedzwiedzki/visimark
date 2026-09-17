import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../../src/eval/check.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";
import { memoryReader } from "../../src/playground/memory-reader.js";

/**
 * **Why this file exists.** The playground shipped the tutorial's final
 * chapter reporting `UNDEF order.grand_total — unknown name \`Total\`, did you
 * mean \`grand_total\`?` on a document the CLI passes clean: a suggestion that
 * `grand_total` refer to itself, on the chapter carrying the "Data Importer"
 * badge (`docs/reviews/2026-09-16.md` §3.1 row 4 / §4.3). The cause was that
 * `docs/playground.html` never loaded `13-imports.csv`, so the import was
 * `skipped` and every column the CSV supplies resolved to nothing.
 *
 * These tests hold both halves of the fix. The first two run the real chapter
 * and the real CSV through `memoryReader` — the same port the playground
 * builds — and pin what the panel must say. The third reads the playground
 * application's own source, because the engine half can be perfectly correct
 * while the page forgets to hand it the file, which is exactly the bug that
 * shipped.
 *
 * **If one of these fails, the playground's imports chapter is broken again.**
 * The wiring lives in `src/playground/app/` (`TUTORIAL_DATA` in `sources.ts`,
 * `READER_FS` and `optsFor` in `store.ts`) and `src/playground/memory-reader.ts`.
 * Fix the wiring; deleting the check just puts the spurious error back in
 * front of every visitor.
 */

const tutorial = join(import.meta.dir, "../../../../docs/playground/tutorial");
const chapter = readFileSync(join(tutorial, "13-imports.md"), "utf8");
const csv = readFileSync(join(tutorial, "13-imports.csv"), "utf8");

/** the synthetic directory `playground.html` keys its in-memory store by */
const DIR = "/tutorial";
const CHAPTER_PATH = `${DIR}/13-imports.md`;
const CSV_PATH = `${DIR}/13-imports.csv`;

function checkChapter(files: Record<string, string>) {
  const doc = { path: CHAPTER_PATH, reader: memoryReader((p) => files[p]) };
  return check(build(locate(chapter)), { doc });
}

test("the imports chapter checks clean through an in-memory reader", () => {
  const result = checkChapter({ [CHAPTER_PATH]: chapter, [CSV_PATH]: csv });

  // `WARN order.grand_total defined and never read` is what the CLI prints on
  // this file too, above its `0 problems (0 stale, 0 errors)` line — it is
  // advice, not a problem, so it is excluded here exactly as the report
  // excludes it from the count.
  const problems = result.findings.filter((f) => f.code !== "WARN" && f.code !== "NOTE");
  expect(
    problems.map((f) => `${f.code} ${f.message ?? ""}`.trim()),
    "the playground's imports chapter must report what the CLI reports — nothing. See the " +
      "module note above: this is review §4.3's regression, and the wiring to fix is in " +
      "docs/playground.html and src/playground/memory-reader.ts, not this test.",
  ).toEqual([]);
  expect(result.exitCode).toBe(0);
  // the import actually resolved: the stamp verified, and the sheet's one rule ran
  expect(result.imports.get("order")?.state).toBe("ok");
  const total = result.values.get("order.grand_total");
  expect(total?.t).toBe("num");
  expect(String(total?.t === "num" ? total.d : total)).toBe("110");
});

test("a CSV whose bytes no longer match the stamp reports STALE", () => {
  // what a visitor editing 13-imports.csv in the playground's file list does:
  // the digest is recomputed from the bytes the store holds, so this can only
  // pass if the hashing is real
  const edited = csv.replace("50.00", "5000.00");
  expect(edited).not.toBe(csv);
  const result = checkChapter({ [CHAPTER_PATH]: chapter, [CSV_PATH]: edited });

  const stale = result.findings.filter((f) => f.code === "STALE");
  expect(
    stale.length,
    "editing the imported CSV must make the stamp stop matching — that demonstration is the " +
      "imports chapter's third quest step (docs/playground/scenarios.json). If this is empty, " +
      "the digest is no longer computed from the bytes the store holds.",
  ).toBe(1);
  expect(result.imports.get("order")?.state).toBe("stale");
});

test("the reader re-reads the store, so an edit is visible without rebuilding it", () => {
  // playground.html builds one reader at boot and keeps it; the file the
  // visitor is editing lives in the CodeMirror buffer. A reader that had
  // snapshotted the store would keep reporting the CSV's original bytes and
  // the STALE demonstration above would never fire in the actual page.
  const store: Record<string, string> = { [CHAPTER_PATH]: chapter, [CSV_PATH]: csv };
  const doc = { path: CHAPTER_PATH, reader: memoryReader((p) => store[p]) };

  expect(check(build(locate(chapter)), { doc }).imports.get("order")?.state).toBe("ok");
  store[CSV_PATH] = csv.replace("50.00", "5000.00");
  expect(
    check(build(locate(chapter)), { doc }).imports.get("order")?.state,
    "memoryReader must call its lookup on every read — see src/playground/memory-reader.ts",
  ).toBe("stale");
});

test("the playground app loads the CSV and hands the engine a reader for it", () => {
  // The engine half above passes even when the page forgets the file — which
  // is precisely how the bug shipped. This end reads the application source.
  //
  // It used to read docs/playground.html, where this wiring was 1,535 lines of
  // inline <script>. Review §2.4 moved that to src/playground/app/, so the
  // needles moved with it; the page itself is now checked only for loading the
  // bundle that carries them.
  const app = (name: string) =>
    readFileSync(join(import.meta.dir, "../../src/playground/app", name), "utf8");
  const sources = app("sources.ts");
  const store = app("store.ts");
  const pipeline = app("pipeline.ts");
  const html = readFileSync(join(import.meta.dir, "../../../../docs/playground.html"), "utf8");

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
      "(review §4.3). Restore the wiring in src/playground/app/ rather than deleting this check.",
  ).toEqual([]);
});

/**
 * The two below close the *class* rather than the chapter. Preloading the CSV
 * fixes `13-imports.md`, but any document checked with no reader at all still
 * took the cascade — and the playground lets a visitor create a file and write
 * a `from ....csv` declaration of their own, which gets no reader because the
 * store has nothing to serve it. That is the same spurious failure with a
 * different filename, so `check` suppresses the consequence of an import it
 * never attempted (see the note beside `neverAttempted` in `src/eval/check.ts`).
 */
const ORPHAN =
  "```vmark #order from nowhere.csv labelled Item, Total\ngrand_total = SUM(Total)\n```\n";

test("an import that was never attempted suppresses the UNDEF it causes", () => {
  const result = check(build(locate(ORPHAN)), {});

  expect(result.imports.get("order")?.state).toBe("skipped");
  expect(
    result.findings.map((f) => f.code),
    "a `skipped` import means no reader was supplied, so the sheet has no table and every " +
      "UNDEF under it is the consequence of a check that did not run — including a `did you " +
      "mean` suggesting the binding refer to itself. Suppression lives in src/eval/check.ts.",
  ).toEqual([]);
  expect(result.exitCode).toBe(0);
});

test("an import that genuinely failed still reports, cause and consequence", () => {
  // the discriminant is `state`, not the absence of a table: this sheet has no
  // table either, but the import was attempted and lost, which is real news
  const doc = { path: "/d/a.md", reader: memoryReader(() => null) };
  const result = check(build(locate(ORPHAN)), { doc });

  expect(result.imports.get("order")?.state).toBe("error");
  expect(
    result.findings.map((f) => f.code),
    "suppressing a failed import's findings would hide a broken document — only `skipped` is " +
      "suppressed. If this ever goes quiet, the discriminant in src/eval/check.ts has slipped.",
  ).toEqual(["IMPORT", "UNDEF"]);
  expect(result.exitCode).toBe(1);
});
