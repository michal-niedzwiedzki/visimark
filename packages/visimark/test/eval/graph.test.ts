import { expect, test } from "bun:test";
import { clean, drift } from "../examples.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { dependencies, resolve, topoOrder } from "../../src/eval/graph.js";

const cleanModel = () => build(locate(clean));
const driftModel = () => build(locate(drift));

test("bare and qualified name resolution", () => {
  const m = cleanModel();
  expect(resolve(m, "lines", { name: "vat" }).kind).toBe("doc-scalar");
  expect(resolve(m, "lines", { name: "Qty" }).kind).toBe("input-column");
  expect(resolve(m, "lines", { name: "Net" }).kind).toBe("column");
  const g = resolve(m, "schedule", { qualifier: "lines", name: "gross_total" });
  expect(g.kind).toBe("scalar");
  if (g.kind === "scalar") expect(g.sheetId).toBe("lines");
});

test("unknown name yields the closest suggestion", () => {
  const m = driftModel();
  const r = resolve(m, "terms", { name: "fx_rate" });
  expect(r.kind).toBe("unknown");
  if (r.kind === "unknown") expect(r.suggestion).toBe("fx_eur");
});

test("foreign bare column outside an aggregate is a vector ref", () => {
  const m = driftModel();
  const variance = m.sheets.get("recon")!.scalars.get("variance")!;
  const info = dependencies(m, variance);
  expect(info.vectorRefs.map((r) => `${r.qualifier}.${r.name}`)).toEqual(["schedule.Amount"]);
});

test("foreign column inside an aggregate is a legal dependency", () => {
  const m = cleanModel();
  const scheduled = m.sheets.get("recon")!.scalars.get("scheduled")!;
  const info = dependencies(m, scheduled);
  expect(info.vectorRefs).toEqual([]);
  expect(info.deps.has("schedule.Amount")).toBe(true);
});

const aliasDoc = () => `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
peak = bpu
\`\`\`
`;

test("a bare alias resolves as an input-column, same as its header would", () => {
  const model = build(locate(aliasDoc()));
  const r = resolve(model, "network", { name: "bpu" });
  expect(r).toMatchObject({
    kind: "input-column",
    sheetId: "network",
    column: "Bandwidth per Unit (TB/s, full-duplex)",
  });
});

test("a foreign reference through an alias is a vector outside an aggregate", () => {
  const twoSheets = `
${aliasDoc()}
\`\`\`vmark #other
x = network.bpu
\`\`\`
`;
  const r = build(locate(twoSheets));
  const checkResult = check(r);
  expect(checkResult.findings.some((f) => f.code === "VECTOR" && f.raw === "network.bpu")).toBe(
    true,
  );
});

test("a typo'd alias suggests the real alias via did-you-mean", () => {
  const model = build(locate(aliasDoc()));
  const r = resolve(model, "network", { name: "bpuu" });
  expect(r.kind).toBe("unknown");
  if (r.kind === "unknown") expect(r.suggestion).toBe("bpu");
});

test("the late_fees cycle is reported with a full data-flow path", () => {
  const m = driftModel();
  const { cycles } = topoOrder(m);
  expect(cycles.length).toBe(1);
  expect(cycles[0]!.map((b) => b.id)).toEqual([
    "late_fees.base",
    "late_fees.fee",
    "late_fees.total",
    "late_fees.base",
  ]);
});

test("clean example topo-sorts with sheets in dependency order and no cycles", () => {
  const m = cleanModel();
  const { order, cycles } = topoOrder(m);
  expect(cycles).toEqual([]);
  const pos = (id: string) => order.findIndex((b) => b.id === id);
  expect(pos("lines.gross_total")).toBeLessThan(pos("schedule.Amount"));
  expect(pos("schedule.Amount")).toBeLessThan(pos("recon.scheduled"));
  expect(pos("lines.Net")).toBeLessThan(pos("lines.VAT"));
  expect(pos("lines.VAT")).toBeLessThan(pos("lines.Gross"));
  // every non-cycle binding is placed
  expect(order.length).toBeGreaterThanOrEqual(15);
});

// ---- assertions in the graph -----------------------------------------

import { assertionNode } from "../../src/eval/graph.js";

const planWith = (assertLine: string) =>
  build(
    locate(
      [
        "| M | Share |",
        "|---|------:|",
        "| a |   50% |",
        "| b |   50% |",
        "",
        "```vmark #plan",
        "total = SUM(Share)",
        assertLine,
        "```",
        "",
      ].join("\n"),
    ),
  );

test("topoOrder lists assertion nodes, ordered after their dependencies", () => {
  const m = planWith("assert total == 1");
  const t = topoOrder(m);
  const a = m.sheets.get("plan")!.assertions[0]!;
  expect(t.assertionIds.has(a.id)).toBe(true);
  const ids = t.order.map((n) => n.id);
  expect(ids.indexOf(a.id)).toBeGreaterThan(ids.indexOf("plan.total"));
});

test("a bare foreign/own column in an assertion is a vector reference", () => {
  const m = planWith("assert Share == 1");
  const a = m.sheets.get("plan")!.assertions[0]!;
  const info = dependencies(m, assertionNode(a));
  expect(info.vectorRefs.map((r) => r.name)).toEqual(["Share"]);
});

test("an aggregate over a column in an assertion is a clean dependency", () => {
  const m = planWith("assert SUM(Share) == 1");
  const a = m.sheets.get("plan")!.assertions[0]!;
  const info = dependencies(m, assertionNode(a));
  expect(info.vectorRefs).toEqual([]);
});

test("NPV gates the flows argument and not the rate", () => {
  const src = `
| Cash |
|-----:|
|   10 |

\`\`\`vmark #flow
Cash = 10
\`\`\`

| Rate |
|-----:|
| 0.08 |

\`\`\`vmark #here
hurdle = 0.08
present = NPV(hurdle, flow.Cash)
bad = NPV(Rate, flow.Cash)
\`\`\`
`;
  const model = build(locate(src));
  const present = model.sheets.get("here")!.scalars.get("present")!;
  const presentInfo = dependencies(model, present);
  expect(presentInfo.vectorRefs).toEqual([]);
  expect(presentInfo.callErrors).toEqual([]);
  expect(presentInfo.deps.has("flow.Cash")).toBe(true);

  const bad = model.sheets.get("here")!.scalars.get("bad")!;
  const badInfo = dependencies(model, bad);
  expect(badInfo.vectorRefs.map((r) => r.name)).toEqual(["Rate"]);
  expect(badInfo.callErrors).toEqual([]);
  expect(badInfo.deps.has("flow.Cash")).toBe(true);
});
