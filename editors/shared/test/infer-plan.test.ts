import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, check, infer, locate } from "visimark";
import { describePreview, isEmpty, previewInfer } from "../src/infer-plan.js";

/**
 * **Manual test §2.7's pass condition, made machine-checkable.** It says
 * accepting an Infer preview inserts a ```` ```vmark ```` block and rewrites
 * *no existing byte* of the table, and that it is verified with `git diff`
 * rather than by eye. The test below verifies it more strongly than a diff
 * can: it reconstructs the original document out of the result by deleting
 * exactly the inserted ranges, and requires the two to be identical.
 *
 * That property is the whole reason this command is safe to offer to someone
 * who has just pasted a table they care about.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");
const plain = read("example-quote-plain.md");

test("every insertion is an insertion — nothing is overwritten", () => {
  for (const insert of previewInfer(plain).inserts) {
    expect(
      insert.start,
      `${insert.kind} at ${insert.start} replaces ${insert.end - insert.start} bytes`,
    ).toBe(insert.end);
  }
});

test("the original document is still inside the result, byte for byte", () => {
  // §2.7 by reconstruction: delete exactly what was inserted and the note the
  // reader wrote must come back
  const preview = previewInfer(plain);
  const ordered = [...preview.inserts].sort((a, b) => a.start - b.start);
  let rebuilt = "";
  let cursor = 0;
  let shift = 0;
  for (const insert of ordered) {
    const at = insert.start + shift;
    rebuilt += preview.result.slice(cursor, at);
    cursor = at + insert.text.length;
    shift += insert.text.length;
  }
  rebuilt += preview.result.slice(cursor);
  expect(rebuilt).toBe(plain);
  expect(preview.result.length - plain.length).toBe(
    preview.inserts.reduce((n, i) => n + i.text.length, 0),
  );
});

test("accepting it turns the repository's own unwired example into a checked one", () => {
  // `example-quote-plain.md` is the worked example of a document with nothing
  // wired up. The bar is not "fewer findings" — it is zero.
  const before = check(build(locate(plain))).findings;
  expect(before.length).toBeGreaterThan(0);
  const after = check(build(locate(previewInfer(plain).result))).findings;
  expect(after.map((f) => f.code)).toEqual([]);
});

test("a document that is already wired up proposes nothing", () => {
  const preview = previewInfer(read("example-invoice.md"));
  expect(isEmpty(preview)).toBe(true);
  expect(describePreview(preview)).toBe("There is nothing here to work out.");
});

test("the preview counts what it is about to add", () => {
  const preview = previewInfer(plain);
  expect(preview.counts.columns).toBeGreaterThan(0);
  expect(preview.counts.scalars).toBeGreaterThan(0);
  expect(preview.counts.anchors).toBeGreaterThan(0);
  expect(preview.blocks.length).toBeGreaterThan(0);
  for (const block of preview.blocks) expect(block).toContain("```vmark");
});

test("what the reader is told says nothing is changed, because nothing is", () => {
  const sentence = describePreview(previewInfer(plain));
  expect(sentence).toContain("Nothing you have written is changed.");
  expect(sentence).not.toMatch(/\b(STALE|COVERAGE|proposal|infer)\b/i);
});

test("a selection narrows the proposals to the tables it touches", () => {
  const all = previewInfer(plain);
  const proposals = infer(plain);
  const spans = [...new Set(proposals.map((p) => `${p.tableSpan.start}:${p.tableSpan.end}`))];
  expect(
    spans.length,
    "this example should have more than one table to narrow between",
  ).toBeGreaterThan(1);

  const [start, end] = spans[0]!.split(":").map(Number) as [number, number];
  const narrowed = previewInfer(plain, { start, end });
  expect(narrowed.inserts.length).toBeGreaterThan(0);
  expect(narrowed.inserts.length).toBeLessThan(all.inserts.length);
});

test("a selection that touches a table at all asks about the whole table", () => {
  const proposals = infer(plain);
  const span = proposals[0]!.tableSpan;
  // one byte of overlap, at the very end of the table
  const sliver = previewInfer(plain, { start: span.end - 1, end: span.end });
  const whole = previewInfer(plain, { start: span.start, end: span.end });
  expect(sliver.inserts.length).toBe(whole.inserts.length);
});

test("an empty selection means everything, not nothing", () => {
  // the two must not be one keystroke apart
  const all = previewInfer(plain).inserts.length;
  expect(previewInfer(plain, { start: 10, end: 10 }).inserts.length).toBe(all);
  expect(previewInfer(plain, undefined).inserts.length).toBe(all);
});

test("a note with no table at all proposes nothing and says so", () => {
  const preview = previewInfer("# Groceries\n\n- milk\n- bread\n");
  expect(isEmpty(preview)).toBe(true);
});

test("a table with no arithmetic anywhere in the note marks it, unscoped", () => {
  // the CLI's negative result: `infer` found nothing whatsoever
  const preview = previewInfer("| Name | Note |\n|---|---|\n| a | b |\n");
  expect(preview.marker).toBe("<!--vmark:no-formulas-->");
  expect(preview.blocks).toEqual([]);
  expect(isEmpty(preview)).toBe(false);
  expect(describePreview(preview)).toContain("mark this table");
});

test("a stale no-formulas marker is deleted, not left behind, when rules are found", () => {
  const source =
    "| Item | Price | Qty | Total |\n" +
    "|---|---|---|---|\n" +
    "| Pen  | 5     | 2   | 10    |\n" +
    "| Cup  | 3     | 4   | 12    |\n" +
    "| Mug  | 6     | 3   | 18    |\n" +
    "| Bag  | 2     | 5   | 10    |\n" +
    "\n" +
    "<!--vmark:no-formulas-->\n";
  const preview = previewInfer(source);
  expect(preview.removesMarker).toBe(true);
  expect(preview.marker).toBeNull();
  const deletion = preview.inserts.find((i) => i.kind === "marker");
  expect(deletion, "no deletion insert for the stale marker").toBeDefined();
  expect(deletion!.start).toBeLessThan(deletion!.end);
  expect(deletion!.text).toBe("");
  // planInfer's own claim: the marker is gone from `result`, and COVERAGE
  // (the finding a leftover marker on a ruled document would draw) is clean
  expect(preview.result).not.toContain("no-formulas");
  const coverage = check(build(locate(preview.result))).findings.filter(
    (f) => f.code === "COVERAGE",
  );
  expect(coverage).toEqual([]);
});

test("a selection over a table infer found nothing in does not mark the whole document", () => {
  // the other two tables in `plain` do have proposals; a document-wide
  // marker here would be a claim the selection never made
  const extra = `${plain}\n\n| Name | Note |\n|---|---|\n| a | b |\n`;
  const start = extra.indexOf("| Name | Note |");
  const preview = previewInfer(extra, { start, end: extra.length });
  expect(preview.marker).toBeNull();
  expect(isEmpty(preview)).toBe(true);
});
