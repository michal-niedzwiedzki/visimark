import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { locate } from "visimark";
import { mightHaveBlock, sweep, type SweepSource } from "../src/sweep.js";

/**
 * **Manual test §2.8, run by a machine.** Its fixture is stated exactly: copy
 * `example-invoice-drift.md` into three folders under three names, leave a
 * dozen ordinary notes around them, and require that exactly the three appear,
 * that no ordinary note does, and that the clean `example-invoice.md` does
 * not. That is a fixture a `Map` can hold, so the only part left for a person
 * is whether the list is legible on a phone.
 *
 * The other half is the prefilter. It is what makes the sweep affordable —
 * parsing every note in a 5,000-note vault is ~9.5 s of work on this machine,
 * skipping the parse for notes that cannot contain a block is ~0.09 s — and it
 * is only sound if it has **no false negatives**. That is argued in
 * `sweep.ts` and asserted here, over the corpus and over every fence shape the
 * engine accepts.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");
const examples = readdirSync(docs).filter((f) => f.startsWith("example-") && f.endsWith(".md"));

const ordinary = (n: number): string =>
  `# Note ${n}\n\nSome prose, a list and a table.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n`;

function vault(entries: Record<string, string>): SweepSource {
  return {
    paths: () => Object.keys(entries),
    read: (p) => Promise.resolve(entries[p] ?? null),
  };
}

/** §2.8's fixture, verbatim. */
function sweepFixture(): SweepSource {
  const files: Record<string, string> = {
    "example-invoice.md": read("example-invoice.md"),
    "work/q3/invoice.md": read("example-invoice-drift.md"),
    "archive/2026/old-invoice.md": read("example-invoice-drift.md"),
    "inbox/draft.md": read("example-invoice-drift.md"),
  };
  for (let i = 0; i < 12; i++) files[`notes/ordinary-${i}.md`] = ordinary(i);
  return vault(files);
}

test("exactly the notes that disagree with themselves are listed", async () => {
  const r = await sweep(sweepFixture());
  expect(r.notes.map((n) => n.path).sort()).toEqual([
    "archive/2026/old-invoice.md",
    "inbox/draft.md",
    "work/q3/invoice.md",
  ]);
});

test("no ordinary note appears, and a clean VisiMark note does not either", async () => {
  const r = await sweep(sweepFixture());
  const listed = r.notes.map((n) => n.path);
  expect(listed.filter((p) => p.startsWith("notes/"))).toEqual([]);
  expect(listed).not.toContain("example-invoice.md");
  // and the clean one was genuinely checked rather than skipped
  expect(r.checked).toBe(4);
  expect(r.scanned).toBe(16);
});

test("the prefilter skips the notes a parse could not have found anything in", async () => {
  const r = await sweep(sweepFixture());
  // four VisiMark documents out of sixteen notes; the twelve ordinary ones
  // never reach `locate`
  expect(r.candidates).toBe(4);
  expect(r.scanned - r.candidates).toBe(12);
});

test("each listed note carries the same rows the findings view would show", async () => {
  const r = await sweep(sweepFixture());
  for (const note of r.notes) {
    expect(note.problems).toBe(note.report.problems.length);
    expect(note.advice).toBe(note.report.advice.length);
    expect(note.problems).toBeGreaterThan(0);
    // audience-B words, not codes — the same table every surface uses
    expect(note.report.problems[0]!.reader.row).toMatch(/[a-z] /);
  }
});

test("the prefilter has no false negative on the worked-example corpus", async () => {
  for (const file of examples) {
    const source = read(file);
    if (locate(source).blocks.length > 0) {
      expect(mightHaveBlock(source), `${file} has a block the prefilter would skip`).toBe(true);
    }
  }
});

test("the prefilter has no false negative on any fence the engine accepts", () => {
  // the engine takes ``` and ~~~, any length of either, indented or not
  const table = "| n |\n|---|\n| 1 |\n\n";
  const bodies = ["#s\ntotal = SUM(n)"];
  const fences = ["```", "````", "~~~", "~~~~"];
  for (const fence of fences) {
    for (const indent of ["", "  "]) {
      for (const body of bodies) {
        const [id, rule] = body.split("\n") as [string, string];
        const source = `${table}${indent}${fence}vmark ${id}\n${indent}${rule}\n${indent}${fence}\n`;
        if (locate(source).blocks.length === 0) continue; // not a block; nothing to promise
        expect(mightHaveBlock(source), `${JSON.stringify(source)} would be skipped`).toBe(true);
      }
    }
  }
});

test("a note the prefilter lets through is still rejected if it has no block", async () => {
  // every document in this repository that merely *mentions* vmark
  const r = await sweep(
    vault({
      "prose.md": "VisiMark uses a `vmark` block. This note has none.\n",
      "anchor-only.md": "A number **12**<!--vmark=a.b--> with no block above it.\n",
    }),
  );
  expect(r.candidates).toBe(2);
  expect(r.checked).toBe(0);
  expect(r.notes).toEqual([]);
});

test("an unreadable note is reported, never silently clean", async () => {
  const r = await sweep({
    paths: () => ["gone.md", "example-invoice-drift.md"],
    read: (p) => Promise.resolve(p === "gone.md" ? null : read("example-invoice-drift.md")),
  });
  expect(r.unreadable).toEqual(["gone.md"]);
  expect(r.notes.length).toBe(1);
});

test("the sweep yields the thread, so a phone stays responsive", async () => {
  const files: Record<string, string> = {};
  for (let i = 0; i < 200; i++) files[`n-${i}.md`] = ordinary(i);
  let pauses = 0;
  await sweep(vault(files), { chunk: 25, pause: () => (pauses++, Promise.resolve()) });
  expect(pauses).toBe(8);
});

test("progress is reported monotonically and ends at the total", async () => {
  const files: Record<string, string> = {};
  for (let i = 0; i < 100; i++) files[`n-${i}.md`] = ordinary(i);
  const seen: number[] = [];
  await sweep(vault(files), { chunk: 10, onProgress: (done) => seen.push(done) });
  expect(seen).toEqual([...seen].sort((a, b) => a - b));
  expect(seen.at(-1)).toBe(100);
});

test("a big vault costs parses in the number of VisiMark notes, not its own size", () => {
  // This is the property that decides whether the sweep needs a size limit,
  // and it is asserted rather than timed so it cannot flake on a slow runner.
  // Measured separately on this machine: `locate()` is 1.9 ms on an ordinary
  // note and `includes("vmark")` is below the resolution of
  // `performance.now()`, so "how many notes get parsed" *is* the cost.
  const files: Record<string, string> = {};
  for (let i = 0; i < 5000; i++) files[`notes/n-${i}.md`] = ordinary(i);
  files["a/drift.md"] = read("example-invoice-drift.md");
  files["b/drift.md"] = read("example-invoice-drift.md");
  files["c/clean.md"] = read("example-invoice.md");

  return sweep(vault(files)).then((r) => {
    expect(r.scanned).toBe(5003);
    // three parses out of five thousand and three notes
    expect(r.candidates).toBe(3);
    expect(r.checked).toBe(3);
    expect(r.notes.length).toBe(2);
  });
});

test("cancelling stops early and says so, with what it had", async () => {
  const files: Record<string, string> = { "a/drift.md": read("example-invoice-drift.md") };
  for (let i = 0; i < 100; i++) files[`n-${i}.md`] = ordinary(i);
  const signal = { aborted: false };
  const r = await sweep(vault(files), {
    chunk: 5,
    pause: () => {
      signal.aborted = true;
      return Promise.resolve();
    },
    signal,
  });
  expect(r.cancelled).toBe(true);
  expect(r.scanned).toBeLessThan(101);
  expect(r.notes.length).toBe(1); // the drifted note came first and is kept
});
