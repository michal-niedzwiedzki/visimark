import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { dependencies, resolve, topoOrder } from "../../src/eval/graph.js";

const clean = readFileSync("doc/example-invoice.md", "utf8");
const drift = readFileSync("doc/example-invoice-drift.md", "utf8");
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
  expect(info.vectorRefs.map((r) => `${r.qualifier}.${r.name}`)).toEqual([
    "schedule.Amount",
  ]);
});

test("foreign column inside an aggregate is a legal dependency", () => {
  const m = cleanModel();
  const scheduled = m.sheets.get("recon")!.scalars.get("scheduled")!;
  const info = dependencies(m, scheduled);
  expect(info.vectorRefs).toEqual([]);
  expect(info.deps.has("schedule.Amount")).toBe(true);
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
