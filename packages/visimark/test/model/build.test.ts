import { expect, test } from "bun:test";
import { clean, drift } from "../examples.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";

const model = () => build(locate(clean));

test("#lines sheet: column rules, scalars, input columns", () => {
  const m = model();
  const lines = m.sheets.get("lines")!;
  expect([...lines.columns.keys()]).toEqual(["Net", "VAT", "Gross"]);
  expect([...lines.scalars.keys()]).toEqual(["net_total", "vat_total", "gross_total"]);
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
  expect([...terms.scalars.keys()]).toEqual(["early_pay_total", "early_pay_saved", "eur_total"]);
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

test("a hyphenated sheet id is a SHEET finding naming the hyphen", () => {
  const src = [
    "| Item | Price | Qty | Net |",
    "|------|-----:|----:|----:|",
    "| pen  | 2.00 |  10 | 20.00 |",
    "",
    "```vmark #cost-centre",
    "Net = Price * Qty",
    "total = SUM(Net)",
    "```",
    "",
  ].join("\n");
  const m = build(locate(src));
  const sheet = m.findings.filter((f) => f.code === "SHEET");
  expect(sheet.length).toBe(1);
  expect(sheet[0]!.sheetId).toBe("cost-centre");
  expect(sheet[0]!.message).toBe(
    "sheet id `cost-centre` is not a valid identifier — invalid character `-`",
  );
  // the sheet still builds and evaluates despite the bad id
  const s = m.sheets.get("cost-centre")!;
  expect(s.scalars.has("total")).toBe(true);
});

test("a sheet id with multiple bad characters names each once", () => {
  const src = ["```vmark #a/b..c", "y = 1", "```", ""].join("\n");
  const m = build(locate(src));
  const sheet = m.findings.filter((f) => f.code === "SHEET");
  expect(sheet.length).toBe(1);
  expect(sheet[0]!.message).toBe(
    "sheet id `a/b..c` is not a valid identifier — invalid characters `/`, `.`",
  );
});

test("a leading digit in a sheet id is a SHEET finding", () => {
  const src = ["```vmark #1abc", "y = 1", "```", ""].join("\n");
  const m = build(locate(src));
  const sheet = m.findings.filter((f) => f.code === "SHEET");
  expect(sheet.length).toBe(1);
  expect(sheet[0]!.message).toBe(
    "sheet id `1abc` is not a valid identifier — invalid character `1`",
  );
});

test("a malformed vmark= anchor comment is an ANCHOR finding with no sheetId/name", () => {
  const src = "Total: **999.00**<!--vmark=cost-centre.total-->\n";
  const m = build(locate(src));
  const anchor = m.findings.filter((f) => f.code === "ANCHOR");
  expect(anchor.length).toBe(1);
  expect(anchor[0]!.message).toBe("malformed anchor comment — expected `<!--vmark=sheet.name-->`");
  expect(anchor[0]!.sheetId).toBeUndefined();
  expect(anchor[0]!.name).toBeUndefined();
});

test("a bad sheet id repeated across two merged blocks fires once per block", () => {
  const src = [
    "```vmark #bad-id",
    "x = 1",
    "```",
    "",
    "```vmark #bad-id",
    "y = 2",
    "```",
    "",
  ].join("\n");
  const m = build(locate(src));
  expect(m.findings.filter((f) => f.code === "SHEET").length).toBe(2);
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

// ---- assert statements ------------------------------------------------

test("an `assert` line in a #id block is collected on the sheet", () => {
  const src = [
    "| M | Share |",
    "|---|------:|",
    "| a |   50% |",
    "",
    "```vmark #plan",
    "total = SUM(Share)",
    "assert total == 1",
    "```",
    "",
  ].join("\n");
  const m = build(locate(src));
  const plan = m.sheets.get("plan")!;
  expect(plan.assertions.length).toBe(1);
  expect(plan.assertions[0]!.source).toBe("assert total == 1");
  expect(plan.assertions[0]!.sheetId).toBe("plan");
  expect(plan.assertions[0]!.id).toContain("plan::assert@");
  // expr offsets are absolute into the source
  const e = plan.assertions[0]!.expr;
  expect(src.slice(e.start, e.end)).toBe("total == 1");
  expect(m.findings.filter((f) => f.code === "SHEET")).toEqual([]);
});

test("an `assert` line in a document-scope block is a SHEET finding", () => {
  const src = ["```vmark", "assert 1 == 1", "```", ""].join("\n");
  const m = build(locate(src));
  const sheet = m.findings.filter((f) => f.code === "SHEET");
  expect(sheet.length).toBe(1);
  expect(sheet[0]!.message).toBe("`assert` must be in a `#id` sheet block");
});

test("`assert` as a binding name is a TYPE finding", () => {
  const src = ["```vmark #s", "assert = 1", "```", ""].join("\n");
  const m = build(locate(src));
  const t = m.findings.filter((f) => f.code === "TYPE");
  expect(t.length).toBe(1);
  expect(t[0]!.message).toBe("`assert` is a keyword");
});
