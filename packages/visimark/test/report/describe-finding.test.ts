import { expect, test } from "bun:test";
import { describeFinding } from "../../src/report/format.js";
import type { Finding } from "../../src/model/types.js";

test("STALE, plain cell, with formula", () => {
  const f: Finding = {
    code: "STALE",
    sheetId: "lines",
    name: "Net",
    stored: "3120.00",
    computed: "5200.00",
    formula: "Qty * Rate",
  };
  expect(describeFinding(f)).toBe("lines.Net: stored 3120.00 ≠ computed 5200.00 (Qty * Rate)");
});

test("STALE, plain cell, no formula", () => {
  const f: Finding = { code: "STALE", sheetId: "s", name: "n", stored: "1", computed: "2" };
  expect(describeFinding(f)).toBe("s.n: stored 1 ≠ computed 2");
});

test("STALE, table-row cell with a row label", () => {
  const f: Finding = {
    code: "STALE",
    sheetId: "lines",
    name: "Net",
    rowLabel: "pen",
    stored: "9.99",
    computed: "10.00",
    formula: "Qty * Rate",
  };
  expect(describeFinding(f)).toBe("lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)");
});

test("STALE, artifact — f.message verbatim", () => {
  const f: Finding = {
    code: "STALE",
    artifact: "chart.svg",
    message: "chart.svg is stale; run `visimark fmt`",
  };
  expect(describeFinding(f)).toBe("chart.svg is stale; run `visimark fmt`");
});

test("ASSERT", () => {
  const f: Finding = {
    code: "ASSERT",
    sheetId: "calls",
    source: "assert spent <= rates.budget",
    message: "0.4266 <= 0.01",
  };
  expect(describeFinding(f)).toBe("assert spent <= rates.budget: 0.4266 <= 0.01 is false");
});

test("DATE, unambiguous fix", () => {
  const f: Finding = { code: "DATE", raw: "15.10.2026", isoFix: "2026-10-15" };
  expect(describeFinding(f)).toBe(
    '"15.10.2026" is not an ISO 8601 date (YYYY-MM-DD); unambiguous fix is 2026-10-15',
  );
});

test("DATE, ambiguous", () => {
  const f: Finding = {
    code: "DATE",
    raw: "03/04/2026",
    altA: "2026-03-04",
    altB: "2026-04-03",
    daysApart: 30,
  };
  expect(describeFinding(f)).toBe(
    '"03/04/2026" is not an ISO 8601 date (YYYY-MM-DD); ambiguous: 2026-03-04 or 2026-04-03, 30 days apart',
  );
});

test("UNDEF, with suggestion", () => {
  const f: Finding = { code: "UNDEF", raw: "rats.budget", suggestion: "rates.budget" };
  expect(describeFinding(f)).toBe("unknown name `rats.budget`; did you mean `rates.budget`?");
});

test("UNDEF, no suggestion", () => {
  const f: Finding = { code: "UNDEF", raw: "nope" };
  expect(describeFinding(f)).toBe("unknown name `nope`");
});

test("DUP", () => {
  const f: Finding = { code: "DUP", name: "Net" };
  expect(describeFinding(f)).toBe("`Net` is already defined in this scope");
});

test("VECTOR", () => {
  const f: Finding = { code: "VECTOR", raw: "Cost" };
  expect(describeFinding(f)).toBe("`Cost` is a column, not a value — wrap it in an aggregate");
});

test("CYCLE", () => {
  const f: Finding = { code: "CYCLE", cyclePath: ["a", "b", "a"] };
  expect(describeFinding(f)).toBe("a → b → a");
});

test("WARN, with suggestion", () => {
  const f: Finding = { code: "WARN", sheetId: "s", name: "unused", suggestion: "used" };
  expect(describeFinding(f)).toBe("s.unused is defined and never read — did you mean `used`?");
});

test("WARN, no suggestion", () => {
  const f: Finding = { code: "WARN", sheetId: "s", name: "unused" };
  expect(describeFinding(f)).toBe("s.unused is defined and never read");
});

test("codes that reuse f.message verbatim", () => {
  for (const code of [
    "UNIT",
    "SHEET",
    "IMPORT",
    "COVERAGE",
    "ARTIFACT",
    "TYPE",
    "ANCHOR",
    "NOTE",
  ] as const) {
    const f: Finding = { code, message: "a full sentence already" };
    expect(describeFinding(f)).toBe("a full sentence already");
  }
});

test("PRECISION, with message", () => {
  const f: Finding = { code: "PRECISION", message: "no precision declared" };
  expect(describeFinding(f)).toBe("no precision declared");
});

test("PRECISION, fallback with raw", () => {
  const f: Finding = { code: "PRECISION", raw: "3.14159" };
  expect(describeFinding(f)).toBe("`3.14159` has no derivable precision");
});

test("PRECISION, fallback with no raw", () => {
  const f: Finding = { code: "PRECISION" };
  expect(describeFinding(f)).toBe("no precision declared and none follows from the formula");
});
