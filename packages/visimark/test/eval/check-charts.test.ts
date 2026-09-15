import { expect, test } from "bun:test";
import { build } from "../../src/model/build.js";
import { checkCharts } from "../../src/eval/check-charts.js";
import { newCheckState } from "../../src/eval/check-state.js";
import type { Entry } from "../../src/eval/check-state.js";
import { topoOrder } from "../../src/eval/graph.js";
import { locate } from "../../src/parse/document.js";

const TABLE = `| Item | Price |
|------|------:|
| pen  |  5.00 |
| ink  |  3.00 |
`;

const doc = (block: string, extra = "") =>
  `${TABLE}\n\`\`\`vmark #order\n${block}\n\`\`\`\n${extra}`;
const IMG = "\n![c](charts/c.svg)<!--vmark=order.cost-->\n";

/**
 * The point of the extraction: the chart pass runs on its own, off a state the
 * binding loop never touched. A chart over input columns needs no evaluated
 * cells, so `buildableCharts` is the only handoff that has to be faked.
 */
function runCharts(src: string) {
  const model = build(locate(src));
  const entries: Entry[] = [];
  const st = newCheckState(model, {}, 2, entries);
  for (const id of topoOrder(model).chartIds) st.buildableCharts.add(id);
  const charts = checkCharts(st);
  return { charts, findings: entries.map((e) => e.f) };
}

test("a chart over input columns builds without the binding loop", () => {
  const { charts, findings } = runCharts(doc("chart cost as pie of Price labelled Item", IMG));
  expect(charts).toHaveLength(1);
  expect(charts[0]!.name).toBe("cost");
  expect(charts[0]!.path).toBe("charts/c.svg");
  // no docPath, so staleness is unknown but the SVG still rendered
  expect(charts[0]!.state).toBe("skipped");
  expect(charts[0]!.svg).toContain("<svg");
  expect(findings).toHaveLength(0);
});

test("an unknown engine is an ARTIFACT finding, and the chart does not build", () => {
  const { charts, findings } = runCharts(doc("chart cost as pi of Price labelled Item", IMG));
  expect(charts[0]!.state).toBe("error");
  expect(charts[0]!.svg).toBeUndefined();
  expect(findings[0]?.code).toBe("ARTIFACT");
  expect(findings[0]?.message).toBe("unknown chart type `pi`");
  expect(findings[0]?.suggestion).toBe("pie");
});

test("a chart with no image line cannot know where to write", () => {
  const { charts, findings } = runCharts(doc("chart cost as pie of Price labelled Item"));
  expect(charts[0]!.state).toBe("error");
  expect(findings[0]?.code).toBe("ARTIFACT");
  expect(findings[0]?.message).toContain("no image reference for this chart");
});

test("a label column that is not a column of the sheet is refused", () => {
  const { charts, findings } = runCharts(doc("chart cost as pie of Price labelled Nope", IMG));
  expect(charts[0]!.state).toBe("error");
  expect(findings[0]?.message).toBe("`Nope` is not a column of this sheet");
});

test("two charts claiming one path is an error on the second", () => {
  const src = `${TABLE}
\`\`\`vmark #order
chart a as pie of Price labelled Item
chart b as pie of Price labelled Item
\`\`\`

![a](charts/c.svg)<!--vmark=order.a-->
![b](charts/c.svg)<!--vmark=order.b-->
`;
  const { charts, findings } = runCharts(src);
  expect(charts[0]!.state).toBe("skipped");
  expect(charts[1]!.state).toBe("error");
  expect(findings[0]?.message).toBe("two charts write to `charts/c.svg`");
});

test("a chart the binding loop could not build is skipped, once per sheet", () => {
  const model = build(locate(doc("chart cost as pie of Price labelled Item", IMG)));
  const entries: Entry[] = [];
  const st = newCheckState(model, {}, 2, entries);
  // buildableCharts deliberately left empty — the upstream-failure handoff
  const charts = checkCharts(st);
  expect(charts[0]!.state).toBe("skipped");
  expect(charts[0]!.path).toBeNull();
  expect(entries).toHaveLength(1);
  expect(entries[0]!.f.code).toBe("NOTE");
  expect(entries[0]!.f.message).toBe("1 chart not built (upstream errors)");
});
