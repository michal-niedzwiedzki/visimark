import { expect, test } from "bun:test";
import { clean, drift } from "../examples.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import type { Finding } from "../../src/model/types.js";


const run = (src: string) => check(build(locate(src)));
const idOf = (f: Finding) =>
  f.anchorGroup
    ? `anchors:${f.suppressedCount}`
    : `${f.code} ${f.sheetId ?? ""}.${f.name ?? ""}${f.rowLabel ? ` · ${f.rowLabel}` : ""}`;

test("the clean invoice produces zero findings", () => {
  const r = run(clean);
  expect(r.findings).toEqual([]);
  expect(r.exitCode).toBe(0);
});

test("drift: STALE findings in the transcript's order", () => {
  const r = run(drift);
  const stale = r.findings.filter((f) => f.code === "STALE").map(idOf);
  expect(stale).toEqual([
    "STALE lines.Net · On-call support",
    "STALE lines.VAT · On-call support",
    "STALE lines.Gross · On-call support",
    "STALE lines.Gross · Discovery workshop",
    "STALE lines.net_total",
    "STALE lines.vat_total",
    "STALE lines.gross_total",
    "STALE schedule.Amount · Signature",
    "STALE schedule.Amount · Delivery of backend",
    "STALE schedule.Amount · Acceptance",
    "STALE schedule.covered",
    "STALE terms.early_pay_total",
    "STALE terms.early_pay_saved",
    "anchors:8",
  ]);
});

test("drift: stored ≠ computed values match the transcript", () => {
  const r = run(drift);
  const find = (name: string, rowLabel?: string) =>
    r.findings.find(
      (f) => f.code === "STALE" && f.name === name && f.rowLabel === rowLabel,
    )!;
  expect([find("Net", "On-call support").stored, find("Net", "On-call support").computed]).toEqual(["3120.00", "5200.00"]);
  expect([find("Gross", "Discovery workshop").stored, find("Gross", "Discovery workshop").computed]).toEqual(["4428.50", "4428.00"]);
  expect([find("net_total").stored, find("net_total").computed]).toEqual(["23300.00", "25380.00"]);
  expect([find("early_pay_total").stored, find("early_pay_total").computed]).toEqual(["28085.82", "30593.05"]);
  expect([find("early_pay_saved").stored, find("early_pay_saved").computed]).toEqual(["573.18", "624.35"]);
});

test("drift: formula column shown only for column rules and aggregate scalars", () => {
  const r = run(drift);
  const f = (name: string, row?: string) =>
    r.findings.find((x) => x.code === "STALE" && x.name === name && x.rowLabel === row)!;
  expect(f("Net", "On-call support").formula).toBe("Qty * Rate");
  expect(f("net_total").formula).toBe("SUM(Net)");
  expect(f("early_pay_total").formula).toBeUndefined();
});

test("drift: two DATE findings, then the schedule.Days NOTE", () => {
  const r = run(drift);
  const nonStale = r.findings.filter((f) => f.code !== "STALE");
  const codes = nonStale.map((f) => f.code);
  expect(codes).toEqual(["DATE", "DATE", "NOTE", "UNDEF", "VECTOR", "CYCLE"]);

  const [d1, d2, note] = nonStale;
  expect(d1).toMatchObject({ name: "Due", rowLabel: "Delivery of backend", raw: "15.10.2026", isoFix: "2026-10-15" });
  expect(d2).toMatchObject({ name: "Due", rowLabel: "Acceptance", raw: "11/12/2026", altA: "2026-12-11", altB: "2026-11-12", daysApart: 29 });
  expect(d2!.isoFix).toBeUndefined();
  expect(note).toMatchObject({ name: "Days", suppressedCount: 2 });
});

test("drift: UNDEF, VECTOR and CYCLE contents", () => {
  const r = run(drift);
  const undef = r.findings.find((f) => f.code === "UNDEF")!;
  expect(undef).toMatchObject({ sheetId: "terms", name: "eur_total", raw: "fx_rate", suggestion: "fx_eur" });
  const vec = r.findings.find((f) => f.code === "VECTOR")!;
  expect(vec).toMatchObject({ sheetId: "recon", name: "variance", raw: "schedule.Amount" });
  const cyc = r.findings.find((f) => f.code === "CYCLE")!;
  expect(cyc.cyclePath).toEqual([
    "late_fees.base",
    "late_fees.fee",
    "late_fees.total",
    "late_fees.base",
  ]);
});

test("drift: problem tally reconciles to 26 (21 stale, 5 errors)", () => {
  const r = run(drift);
  const stale = r.findings
    .filter((f) => f.code === "STALE")
    .reduce((n, f) => n + (f.anchorGroup ? f.suppressedCount! : 1), 0);
  const errorCodes = new Set(["DATE", "UNDEF", "VECTOR", "CYCLE", "TYPE", "SHEET", "ANCHOR"]);
  const errors = r.findings.filter((f) => errorCodes.has(f.code)).length;
  expect(stale).toBe(21);
  expect(errors).toBe(5);
  expect(stale + errors).toBe(26);
});

test("drift: no double-report of the late_fees cycle members", () => {
  const r = run(drift);
  const late = r.findings.filter((f) => f.sheetId === "late_fees");
  expect(late.map((f) => f.code)).toEqual(["CYCLE"]);
});
