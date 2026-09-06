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
    r.findings.find((f) => f.code === "STALE" && f.name === name && f.rowLabel === rowLabel)!;
  expect([find("Net", "On-call support").stored, find("Net", "On-call support").computed]).toEqual([
    "3120.00",
    "5200.00",
  ]);
  expect([
    find("Gross", "Discovery workshop").stored,
    find("Gross", "Discovery workshop").computed,
  ]).toEqual(["4428.50", "4428.00"]);
  expect([find("net_total").stored, find("net_total").computed]).toEqual(["23300.00", "25380.00"]);
  expect([find("early_pay_total").stored, find("early_pay_total").computed]).toEqual([
    "28085.82",
    "30593.05",
  ]);
  expect([find("early_pay_saved").stored, find("early_pay_saved").computed]).toEqual([
    "573.18",
    "624.35",
  ]);
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
  expect(d1).toMatchObject({
    name: "Due",
    rowLabel: "Delivery of backend",
    raw: "15.10.2026",
    isoFix: "2026-10-15",
  });
  expect(d2).toMatchObject({
    name: "Due",
    rowLabel: "Acceptance",
    raw: "11/12/2026",
    altA: "2026-12-11",
    altB: "2026-11-12",
    daysApart: 29,
  });
  expect(d2!.isoFix).toBeUndefined();
  expect(note).toMatchObject({ name: "Days", suppressedCount: 2 });
});

test("drift: UNDEF, VECTOR and CYCLE contents", () => {
  const r = run(drift);
  const undef = r.findings.find((f) => f.code === "UNDEF")!;
  expect(undef).toMatchObject({
    sheetId: "terms",
    name: "eur_total",
    raw: "fx_rate",
    suggestion: "fx_eur",
  });
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

const NO_FORMULAS = `
| Item  | Price | Qty |
|-------|------:|----:|
| pen   |  5.00 |  10 |
`;

const PROSE_ONLY = `# Notes

Nothing here but words, and a stray 42 in a sentence.
`;

test("a table with no rules is a finding, with no flag to remember", () => {
  const r = run(NO_FORMULAS);
  expect(r.findings).toHaveLength(1);
  expect(r.findings[0]).toMatchObject({ code: "COVERAGE" });
  expect(r.exitCode).toBe(1);
});

test("a document with no table has nothing to require rules of", () => {
  expect(run(PROSE_ONLY).findings).toEqual([]);
});

test("the no-formulas marker answers the coverage finding", () => {
  expect(run(`${NO_FORMULAS}\n<!--vmark:no-formulas-->\n`).findings).toEqual([]);
});

test("a marked document that grew rules is reported, so the marker cannot rot", () => {
  const coverage = run(`${clean}\n<!--vmark:no-formulas-->\n`).findings.filter(
    (f) => f.code === "COVERAGE",
  );
  expect(coverage).toHaveLength(1);
  expect(coverage[0]!.message).toContain("no-formulas");
});

test("a document with at least one rule is unaffected", () => {
  expect(run(clean).findings.some((f) => f.code === "COVERAGE")).toBe(false);
});

const WARN_ONLY = `
| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  |  5.00 |  10 | 50.00 |

\`\`\`vmark #order
Net    = Price * Qty
unused = SUM(Net)
\`\`\`
`;

test("an advisory finding is reported without failing the run", () => {
  // The report calls this document `0 problems`, so the exit code has to
  // agree with it. WARN and NOTE are advice, not disagreements.
  const r = run(WARN_ONLY);
  expect(r.findings.map((f) => f.code)).toEqual(["WARN"]);
  expect(r.exitCode).toBe(0);
});

// ---- EOMONTH (issue #6) ---------------------------------------------

test("EOMONTH: a clean net-EOM payment term", () => {
  const src = `
Payment is due **2026-03-31**<!--vmark=terms.due-->.

\`\`\`vmark #terms
issued = 2026-01-15
due    = EOMONTH(issued, 2)
\`\`\`
`;
  const r = run(src);
  expect(r.findings).toEqual([]);
  expect(r.exitCode).toBe(0);
});

test("EOMONTH: a result outside the date range is one DATE finding, not TYPE", () => {
  const src = `
**9999-12-31**<!--vmark=terms.far-->

\`\`\`vmark #terms
edge = 9999-12-01
far  = EOMONTH(edge, 1)
\`\`\`
`;
  const r = run(src);
  const errs = r.findings.filter((f) => f.code === "DATE" || f.code === "TYPE");
  expect(errs.map((f) => f.code)).toEqual(["DATE"]);
  expect(errs[0]!.name).toBe("far");
});

test("EOMONTH: an out-of-range row is a DATE finding plus a NOTE, other rows still verified", () => {
  const src = `
| Job | Start      | End        |
|-----|------------|------------|
| a   | 2026-01-10 | 2026-02-28 |
| b   | 9999-12-10 | 9999-12-31 |

\`\`\`vmark #jobs
End = EOMONTH(Start, 1)
\`\`\`
`;
  const r = run(src);
  const codes = r.findings.map((f) => f.code).sort();
  expect(codes).toEqual(["DATE", "NOTE"]);
  const date = r.findings.find((f) => f.code === "DATE")!;
  expect(date).toMatchObject({ name: "End", rowLabel: "b" });
  const note = r.findings.find((f) => f.code === "NOTE")!;
  expect(note).toMatchObject({ name: "End", suppressedCount: 1 });
});

test("EOMONTH: wrong arity is still a static TYPE finding", () => {
  const src = `
\`\`\`vmark #terms
issued = 2026-01-15
due    = EOMONTH(issued)
\`\`\`
`;
  const ts = run(src).findings.filter((f) => f.code === "TYPE");
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("EOMONTH() takes 2 arguments, got 1");
});

test("EOMONTH: a non-integer months is a TYPE finding on the binding", () => {
  const src = `
| Job | Start      | End        |
|-----|------------|------------|
| a   | 2026-01-10 | 2026-02-28 |

\`\`\`vmark #jobs
half = 1.5
End  = EOMONTH(Start, half)
\`\`\`
`;
  const ts = run(src).findings.filter((f) => f.code === "TYPE");
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("EOMONTH expects a whole number of months");
});
