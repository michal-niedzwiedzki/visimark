import { expect, test } from "bun:test";
import { clean, drift } from "../examples.js";
import { locate } from "../../src/parse/document.js";

test("locates blocks and links the immediately preceding table", () => {
  const d = locate(clean);
  const lines = d.blocks.find((b) => b.sheetId === "lines")!;
  expect(lines).toBeDefined();
  const table = d.tableBeforeBlock.get(lines);
  expect(table).not.toBeNull();
  expect(table!.headers.map((h) => h.text)).toEqual([
    "Item",
    "Unit",
    "Qty",
    "Rate",
    "Net",
    "VAT",
    "Gross",
  ]);
  expect(table!.rows.length).toBe(4);
});

test("id-less block has sheetId null", () => {
  const d = locate(clean);
  const docScope = d.blocks.filter((b) => b.sheetId === null);
  expect(docScope.length).toBe(1);
  expect(docScope[0]!.bindings.map((x) => x.raw)).toEqual([
    "vat            = 23%",
    "early_pay_disc = 2%",
    "fx_eur         = 4.2650",
  ]);
});

test("table-less block resolves to no owned table and is not detached", () => {
  const d = locate(clean);
  const terms = d.blocks.find((b) => b.sheetId === "terms")!;
  expect(d.tableBeforeBlock.get(terms)).toBeNull();
  expect(d.detachedTableBlocks.has(terms)).toBe(false);
});

test("a paragraph between a table and its block detaches the table", () => {
  const src = [
    "| A | B |",
    "|--:|--:|",
    "| 1 | 2 |",
    "",
    "some prose here",
    "",
    "```vmark #x",
    "B = A",
    "```",
    "",
  ].join("\n");
  const d = locate(src);
  const x = d.blocks.find((b) => b.sheetId === "x")!;
  expect(d.tableBeforeBlock.get(x)).toBeNull();
  expect(d.detachedTableBlocks.has(x)).toBe(true);
});

test("binding offsets slice back to the binding text", () => {
  const d = locate(clean);
  const lines = d.blocks.find((b) => b.sheetId === "lines")!;
  for (const b of lines.bindings) {
    expect(clean.slice(b.start, b.end)).toBe(b.raw);
  }
  expect(lines.bindings.map((b) => b.raw)).toEqual([
    "Net   = Qty * Rate",
    "VAT   = Net * vat",
    "Gross = Net + VAT",
    "net_total   = SUM(Net)",
    "vat_total   = SUM(VAT)",
    "gross_total = SUM(Gross)",
  ]);
});

test("strong-wrapped prose anchor locates its value span", () => {
  const d = locate(clean);
  const a = d.anchors.find((x) => x.sheetId === "lines" && x.name === "gross_total")!;
  expect(a.value).not.toBeNull();
  expect(a.value!.kind).toBe("strong");
  expect(clean.slice(a.value!.start, a.value!.end)).toBe("28659.00");
});

test("finds every anchor in the clean example", () => {
  const d = locate(clean);
  const ids = d.anchors.map((a) => `${a.sheetId}.${a.name}`);
  expect(ids).toEqual([
    "lines.net_total",
    "lines.vat_total",
    "lines.gross_total",
    "schedule.covered",
    "terms.early_pay_total",
    "terms.early_pay_saved",
    "terms.eur_total",
    "recon.scheduled",
    "lines.gross_total",
    "recon.variance",
  ]);
});

test("bare-number text anchor locates just the trailing number", () => {
  const src = "the total is approximately 6719.58<!--vmark=terms.eur_total--> EUR\n";
  const d = locate(src);
  const a = d.anchors[0]!;
  expect(a.value!.kind).toBe("text");
  expect(src.slice(a.value!.start, a.value!.end)).toBe("6719.58");
});

test("drift example: comment lines and cycle block are parsed", () => {
  const d = locate(drift);
  const late = d.blocks.find((b) => b.sheetId === "late_fees")!;
  expect(late.bindings.map((b) => b.raw)).toEqual([
    "base  = total - fee",
    "fee   = base * 5%",
    "total = base + fee",
  ]);
});

test("the no-formulas marker is located when it stands on its own", () => {
  const src = "| a |\n|---|\n| 1 |\n\n<!--vmark:no-formulas-->\n";
  const d = locate(src);
  expect(d.noFormulas).not.toBeNull();
  expect(src.slice(d.noFormulas!.start, d.noFormulas!.end)).toBe("<!--vmark:no-formulas-->");
});

test("a marker shown inside a fenced example is documentation, not a marker", () => {
  const d = locate("````markdown\n<!--vmark:no-formulas-->\n````\n");
  expect(d.noFormulas).toBeNull();
});
