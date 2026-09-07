import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { fmt } from "../../src/write/fmt.js";

const TABLE = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |
`;

const withChart = `${TABLE}
\`\`\`vmark #order
Net = Price * Qty
chart cost as pie of Net labelled Item
\`\`\`

![cost](charts/cost.svg)<!--vmark=order.cost-->
`;

const scalarOnImage = `${TABLE}
\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

![t](charts/t.svg)<!--vmark=order.total-->
`;

const chartOnBold = `${TABLE}
\`\`\`vmark #order
Net = Price * Qty
chart cost as pie of Net labelled Item
\`\`\`

Total: **10.00**<!--vmark=order.cost-->
`;

test("an anchor following an image is recorded with its URL", () => {
  const doc = locate(withChart);
  const a = doc.anchors.find((x) => x.name === "cost")!;
  expect(a.value?.kind).toBe("image");
  expect(a.imageUrl).toBe("charts/cost.svg");
});

test("an image anchor naming a chart is not an ANCHOR finding", () => {
  const r = check(build(locate(withChart)));
  expect(r.findings.filter((f) => f.code === "ANCHOR")).toHaveLength(0);
});

test("an image anchor naming a scalar is an ANCHOR finding", () => {
  const r = check(build(locate(scalarOnImage)));
  const f = r.findings.find((x) => x.code === "ANCHOR");
  expect(f?.message).toBe("an image anchor must name a chart");
});

test("a chart anchored to bold text is an ANCHOR finding", () => {
  const r = check(build(locate(chartOnBold)));
  const f = r.findings.find((x) => x.code === "ANCHOR");
  expect(f?.message).toBe("a chart must be anchored to an image");
});

test("fmt never splices an image anchor", () => {
  const out = fmt(withChart);
  expect(out.output).toBe(withChart);
  expect(out.changed).toBe(false);
});

test("an ordinary bold anchor still works", () => {
  const doc = locate(`${TABLE}
\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **10.00**<!--vmark=order.total-->
`);
  const a = doc.anchors.find((x) => x.name === "total")!;
  expect(a.value?.kind).toBe("strong");
  expect(a.imageUrl).toBeUndefined();
});
