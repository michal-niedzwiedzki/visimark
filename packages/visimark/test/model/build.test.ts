import { expect, test } from "bun:test";
import { clean, drift } from "../examples.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";


const model = () => build(locate(clean));

test("#lines sheet: column rules, scalars, input columns", () => {
  const m = model();
  const lines = m.sheets.get("lines")!;
  expect([...lines.columns.keys()]).toEqual(["Net", "VAT", "Gross"]);
  expect([...lines.scalars.keys()]).toEqual([
    "net_total",
    "vat_total",
    "gross_total",
  ]);
  for (const c of ["Item", "Unit", "Qty", "Rate"]) {
    expect(lines.inputColumns.has(c)).toBe(true);
  }
  expect(lines.columnIndex.get("Net")).toBe(4);
});

test("document scope holds the id-less constants", () => {
  const m = model();
  expect([...m.docScope.keys()]).toEqual(["vat", "early_pay_disc", "fx_eur"]);
  const vat = m.docScope.get("vat")!;
  expect(vat.expr).toMatchObject({ type: "num", value: "0.23" });
  expect(vat.kind).toBe("scalar");
  expect(vat.sheetId).toBe("");
});

test("table-less sheet: all bindings are scalars, no SHEET finding", () => {
  const m = model();
  const terms = m.sheets.get("terms")!;
  expect(terms.table).toBeNull();
  expect(terms.columns.size).toBe(0);
  expect([...terms.scalars.keys()]).toEqual([
    "early_pay_total",
    "early_pay_saved",
    "eur_total",
  ]);
  expect(m.findings.filter((f) => f.code === "SHEET")).toEqual([]);
});

test("a detached table produces exactly one SHEET finding", () => {
  const src = [
    "| A | B |",
    "|--:|--:|",
    "| 1 | 2 |",
    "",
    "prose in the way",
    "",
    "```vmark #x",
    "B = A",
    "```",
    "",
  ].join("\n");
  const m = build(locate(src));
  expect(m.findings.filter((f) => f.code === "SHEET").length).toBe(1);
});

test("a syntax error in a binding is reported and skipped", () => {
  const src = ["```vmark #x", "y = 1 +", "```", ""].join("\n");
  const m = build(locate(src));
  expect(m.findings.some((f) => f.code === "TYPE")).toBe(true);
  expect(m.sheets.get("x")!.scalars.has("y")).toBe(false);
});

test("expr offsets are absolute into the source", () => {
  const m = model();
  const net = m.sheets.get("lines")!.columns.get("Net")!;
  expect(clean.slice(net.expr.start, net.expr.end)).toBe("Qty * Rate");
});

test("drift: schedule sheet owns a Days column rule", () => {
  const m = build(locate(drift));
  const sch = m.sheets.get("schedule")!;
  expect([...sch.columns.keys()]).toEqual(["Amount", "Days"]);
  expect(sch.inputColumns.has("Due")).toBe(true);
});
