import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, check, locate } from "visimark";
import { decorationsFor, decorationsIn } from "../src/decorations.js";
import { readNote } from "../src/snapshot.js";

/**
 * **Row 2's acceptance is a person looking at a screen, and this is the half
 * that is not.** Where a mark goes, and which mark it is, are questions about
 * a document; what a mark looks like is not. Splitting them this way means
 * the thing that can be silently wrong — a mark on an input column, a value
 * called computed when it disagrees — fails here rather than in someone's
 * vault.
 *
 * The property that matters most is the negative one: **nothing is marked that
 * the document did not compute.** A plugin that decorated an input column
 * would be claiming authorship of text a person typed, and they would have no
 * way to tell it was wrong.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");
const analyse = (source: string) => {
  const model = build(locate(source));
  return { source, model, result: check(model), all: decorationsFor(model, check(model)) };
};

const clean = analyse(read("example-invoice.md"));
const drift = analyse(read("example-invoice-drift.md"));

/** what the document actually says at a decoration */
const textAt = (a: typeof clean, i: number): string =>
  a.source.slice(a.all[i]!.span.start, a.all[i]!.span.end);

test("a clean note marks every computed value as computed, and nothing as wrong", () => {
  expect(clean.all.length).toBeGreaterThan(20);
  expect(clean.all.every((d) => d.mark === "computed")).toBe(true);
});

test("a drifted note marks exactly the values that disagree", () => {
  const disagreeing = drift.all.filter((d) => d.mark === "disagrees");
  expect(disagreeing.length).toBeGreaterThan(0);
  // every one of them is a value the engine reported STALE at that exact span
  const staleSpans = new Set(
    drift.result.findings
      .filter((f) => f.code === "STALE" && f.span !== undefined)
      .map((f) => `${f.span!.start}:${f.span!.end}`),
  );
  for (const d of disagreeing) {
    expect(staleSpans.has(`${d.span.start}:${d.span.end}`)).toBe(true);
  }
});

test("nothing is marked that the document did not compute", () => {
  // the negative property, and the one a reader cannot check for themselves
  const computedColumns = new Set<string>();
  for (const sheet of clean.model.sheets.values()) {
    for (const name of sheet.columns.keys()) computedColumns.add(`${sheet.id}.${name}`);
  }
  const anchored = new Set(
    clean.model.located.anchors.map((a) => (a.sheetId === "" ? a.name : `${a.sheetId}.${a.name}`)),
  );
  for (const d of clean.all) {
    const known = d.kind === "cell" ? computedColumns.has(d.name) : anchored.has(d.name);
    expect(known, `${d.kind} ${d.name} is marked and is neither computed nor anchored`).toBe(true);
  }
});

test("an input column is never marked", () => {
  // `Item`, `Unit`, `Qty` and `Rate` are typed by a human and never overwritten
  const inputs = new Set<string>();
  for (const sheet of clean.model.sheets.values()) {
    for (const name of sheet.inputColumns) inputs.add(`${sheet.id}.${name}`);
  }
  expect(inputs.size).toBeGreaterThan(0);
  for (const d of clean.all) expect(inputs.has(d.name)).toBe(false);
});

test("a cell decoration carries the same grid index the engine used", () => {
  // reading-mode.ts addresses rows[row].cells[column] directly; a row/column
  // that disagrees with sheet.columnIndex or the row's position in
  // table.rows would silently mark the wrong cell with no test noticing
  for (const sheet of clean.model.sheets.values()) {
    if (sheet.table === null) continue;
    for (const name of sheet.columns.keys()) {
      const column = sheet.columnIndex.get(name);
      if (column === undefined) continue;
      const cells = clean.all.filter((d) => d.kind === "cell" && d.name === `${sheet.id}.${name}`);
      expect(cells.length).toBeGreaterThan(0);
      for (const d of cells) {
        expect(d.column, `${d.name} at row ${d.row}`).toBe(column);
        expect(d.row).toBeGreaterThanOrEqual(0);
        expect(d.row).toBeLessThan(sheet.table.rows.length);
      }
    }
  }
});

test("an anchor decoration carries the markup kind it was found in", () => {
  const byName = new Map(clean.model.located.anchors.map((a) => [a.name, a]));
  for (const d of clean.all) {
    if (d.kind !== "anchor") continue;
    const anchor = byName.get(
      d.name.includes(".") ? d.name.slice(d.name.indexOf(".") + 1) : d.name,
    );
    if (anchor?.value === null || anchor?.value === undefined) continue;
    expect(d.anchorKind).toBe(anchor.value.kind);
  }
  // the worked invoice has at least one bold-numeral anchor
  expect(clean.all.some((d) => d.kind === "anchor" && d.anchorKind === "strong")).toBe(true);
});

test("a mark covers the value as the document wrote it, and nothing around it", () => {
  // the span is what a renderer will wrap; one byte wide of it eats a pipe
  for (const a of [clean, drift]) {
    for (let i = 0; i < a.all.length; i++) {
      const text = a.source.slice(a.all[i]!.span.start, a.all[i]!.span.end);
      expect(text, `${a.all[i]!.name}`).not.toContain("|");
      expect(text.trim(), `${a.all[i]!.name}`).toBe(text);
      expect(text.length).toBeGreaterThan(0);
    }
  }
  expect(textAt(clean, 0)).toBe("3600.00");
});

test("an image anchor is not marked — it names a file, not a value", () => {
  const charts = analyse(read("example-charts.md"));
  const images = charts.model.located.anchors.filter((a) => a.value?.kind === "image");
  expect(images.length, "example-charts.md should have image anchors").toBeGreaterThan(0);
  for (const image of images) {
    expect(charts.all.some((d) => d.span.start === image.value!.start)).toBe(false);
  }
});

test("marks come in document order, so a renderer can walk them once", () => {
  const starts = drift.all.map((d) => d.span.start);
  expect([...starts].sort((a, b) => a - b)).toEqual(starts);
});

test("a name anchored twice is marked at each site, and each judged on its own", () => {
  // matching by span rather than by name is what makes this possible: one
  // site can have drifted while the other has not
  const byName = drift.all.filter((d) => d.name === "lines.gross_total" && d.kind === "anchor");
  expect(byName.length).toBeGreaterThan(1);
});

test("a section's decorations are the ones inside it", () => {
  const table = clean.model.sheets.get("lines")!.table!;
  const inside = decorationsIn(clean.all, table.span.start, table.span.end);
  expect(inside.length).toBeGreaterThan(0);
  expect(inside.every((d) => d.kind === "cell")).toBe(true);
  expect(decorationsIn(clean.all, 0, 0)).toEqual([]);
});

test("a note with no block is decorated nowhere", () => {
  const plain = analyse("# Groceries\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
  expect(plain.all).toEqual([]);
});

/**
 * Review row 6, the regression this file pins. `benchmark.csv`'s `Time`
 * column averages 12.4667 (rounds to 12.47) — an anchor asserting `1.00`
 * disagrees with it, but only a `check` that actually read the CSV can say
 * so. This is what makes both renderers wrong to decorate from a reader-less
 * `check`: `decorationsFor` is pure and correct either way, but a
 * reader-less `result` has no `STALE` finding to hand it, and it renders the
 * disagreeing value as `computed`. `main.ts`, `reading-mode.ts` and
 * `live-preview.ts` are what changed; this is the property that made the bug
 * visible in the first place, so it stays pinned here regardless of which
 * module calls `decorationsFor`.
 */
test("decorationsFor calls a value disagrees once check has actually read the import it depends on", async () => {
  const csv = readFileSync(
    join(import.meta.dir, "../../../packages/visimark/test/fixtures/import/benchmark.csv"),
    "utf8",
  );
  const source =
    "```vmark #benchmark from benchmark.csv labelled Id, Time " +
    "at sha256:c4e418b2a0f4bdc584b99007dcfd39e200b51ff3555e66ae5d42694e0bbd19ee\n" +
    "Mean precision 2 = AVG(benchmark.Time)\n" +
    "```\n\n" +
    "The mean is **1.00**<!--vmark=benchmark.Mean-->.\n";

  const readerLess = decorationsFor(build(locate(source)), check(build(locate(source))));
  const readerLessMark = readerLess.find((d) => d.name === "benchmark.Mean");
  expect(readerLessMark?.mark).toBe("computed"); // the bug, pinned: wrong, but what happens with no reader

  const { model, snapshot } = await readNote(source, "note.md", (p) =>
    Promise.resolve(p === "benchmark.csv" ? csv : null),
  );
  const doc = { path: snapshot.path, reader: snapshot.reader };
  const readerBacked = decorationsFor(model, check(model, { doc }));
  const readerBackedMark = readerBacked.find((d) => d.name === "benchmark.Mean");
  expect(readerBackedMark?.mark).toBe("disagrees"); // the right answer, once check has read the CSV
});
