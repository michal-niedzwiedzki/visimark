import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";

const model = (s: string) => build(locate(s));

const doc = (block: string, table = true) =>
  `${
    table
      ? `| Item | Price | Qty |  Net |\n|------|------:|----:|-----:|\n| pen  |  5.00 |   2 | 10.00 |\n\n`
      : ""
  }\`\`\`vmark #order\n${block}\n\`\`\`\n`;

test("a chart is collected onto its sheet", () => {
  const m = model(doc("Net = Price * Qty\nchart cost as pie of Net labelled Item"));
  const charts = m.sheets.get("order")!.charts;
  expect(charts).toHaveLength(1);
  expect(charts[0]!.name).toBe("cost");
  expect(charts[0]!.engine).toBe("pie");
  expect(charts[0]!.series).toEqual(["Net"]);
  expect(charts[0]!.labels).toBe("Item");
  expect(charts[0]!.aspect).toBeNull();
  expect(charts[0]!.id).toMatch(/^order::chart@\d+$/);
});

test("a multi-series chart keeps series order and aspect", () => {
  const m = model(doc("Net = Price * Qty\nchart c as bar of Price, Net labelled Item aspect 16:9"));
  const c = m.sheets.get("order")!.charts[0]!;
  expect(c.series).toEqual(["Price", "Net"]);
  expect(c.aspect).toEqual({ w: 16, h: 9 });
});

test("a chart in a document-scope block is a SHEET finding", () => {
  const m = model("```vmark\nchart c as pie of Net labelled Item\n```\n");
  const f = m.findings.find((x) => x.code === "SHEET");
  expect(f?.message).toBe("`chart` must be in a `#id` sheet block");
});

test("a chart in a table-less sheet is a SHEET finding", () => {
  const m = model(doc("chart c as pie of Net labelled Item", false));
  const f = m.findings.find((x) => x.code === "SHEET");
  expect(f?.message).toBe("a chart needs a table");
  expect(m.sheets.get("order")!.charts).toHaveLength(0);
});

test("a chart name colliding with a column or scalar is DUP", () => {
  const withColumn = model(doc("Net = Price * Qty\nchart Net as pie of Net labelled Item"));
  expect(withColumn.findings.some((f) => f.code === "DUP" && f.name === "Net")).toBe(true);

  const withScalar = model(doc("total = SUM(Price)\nchart total as pie of Price labelled Item"));
  expect(withScalar.findings.some((f) => f.code === "DUP" && f.name === "total")).toBe(true);
});

test("two charts sharing a name is DUP", () => {
  const m = model(
    doc(
      "Net = Price * Qty\nchart c as pie of Net labelled Item\nchart c as bar of Net labelled Item",
    ),
  );
  expect(m.findings.some((f) => f.code === "DUP" && f.name === "c")).toBe(true);
  expect(m.sheets.get("order")!.charts).toHaveLength(1);
});
