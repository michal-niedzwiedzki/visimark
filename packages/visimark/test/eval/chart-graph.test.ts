import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { topoOrder } from "../../src/eval/graph.js";

const TABLE = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |
`;

const doc = (block: string, extra = "") =>
  `${TABLE}\n\`\`\`vmark #order\n${block}\n\`\`\`\n${extra}`;
const IMG = "\n![c](charts/c.svg)<!--vmark=order.cost-->\n";

test("a chart is a graph node ordered after the columns it reads", () => {
  const m = build(locate(doc("Net = Price * Qty\nchart cost as pie of Net labelled Item")));
  const { order, chartIds } = topoOrder(m);
  expect(chartIds.size).toBe(1);
  const ids = order.map((b) => b.id);
  const chartId = [...chartIds][0]!;
  expect(ids.indexOf("order.Net")).toBeLessThan(ids.indexOf(chartId));
});

test("a chart naming an unknown column is UNDEF", () => {
  const r = check(build(locate(doc("chart cost as pie of Nope labelled Item", IMG))));
  const f = r.findings.find((x) => x.code === "UNDEF");
  expect(f?.raw).toBe("Nope");
  expect(f?.name).toBe("cost");
});

test("a chart naming a foreign column is VECTOR", () => {
  const src = `${TABLE}
\`\`\`vmark #order
Net = Price * Qty
\`\`\`

| Amount |
|-------:|
|  10.00 |

\`\`\`vmark #other
chart cost as pie of order.Net labelled Amount
\`\`\`
`;
  const r = check(build(locate(src)));
  expect(r.findings.some((x) => x.code === "VECTOR")).toBe(true);
});

test("a chart reading an unevaluable column produces no arithmetic finding", () => {
  // `Net` is a CYCLE; the chart must not add TYPE noise of its own
  const r = check(build(locate(doc("Net = Net + 1\nchart cost as pie of Net labelled Item", IMG))));
  expect(r.findings.some((x) => x.code === "CYCLE")).toBe(true);
  expect(r.findings.some((x) => x.code === "TYPE")).toBe(false);
});

test("a valid chart's synthetic expression is never evaluated as arithmetic", () => {
  // `Item` is a string column; a real `Net + Item` would be a TYPE error
  const r = check(
    build(locate(doc("Net = Price * Qty\nchart cost as pie of Net labelled Item", IMG))),
  );
  expect(r.findings.some((x) => x.code === "TYPE")).toBe(false);
});
