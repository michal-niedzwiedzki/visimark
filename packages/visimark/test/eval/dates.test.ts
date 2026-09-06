import { expect, test } from "bun:test";
import { daysBetween, eomonth, parseIsoDate } from "../../src/eval/dates.js";
import { DateError } from "../../src/eval/value.js";

test("accepts ISO calendar dates", () => {
  expect(parseIsoDate("2026-09-03")).toEqual({ ok: true, iso: "2026-09-03" });
  expect(parseIsoDate("2024-02-29")).toEqual({ ok: true, iso: "2024-02-29" });
});

test("rejects an ISO-shaped but invalid date, not decidable", () => {
  const r = parseIsoDate("2026-13-01");
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.decidable).toBeUndefined();
});

test("15.10.2026 is decidable — 15 cannot be a month", () => {
  const r = parseIsoDate("15.10.2026");
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.decidable).toBe("2026-10-15");
});

test("11/12/2026 is ambiguous — 29 days apart, no fix", () => {
  const r = parseIsoDate("11/12/2026");
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.decidable).toBeUndefined();
    expect(r.ambiguous).toEqual({
      a: "2026-12-11",
      b: "2026-11-12",
      daysApart: 29,
    });
  }
});

test("2029-02-29 is not a valid calendar date", () => {
  expect(parseIsoDate("2029-02-29").ok).toBe(false);
});

test("daysBetween is a − b in whole days", () => {
  expect(daysBetween("2026-09-10", "2026-09-03").toNumber()).toBe(7);
  expect(daysBetween("2026-03-01", "2026-02-01").toNumber()).toBe(28);
});

test("eomonth — the spec §3 table", () => {
  expect(eomonth("2026-01-15", 1)).toBe("2026-02-28"); // non-leap
  expect(eomonth("2024-01-31", 1)).toBe("2024-02-29"); // leap; input day irrelevant
  expect(eomonth("2026-01-15", 0)).toBe("2026-01-31"); // end of own month
  expect(eomonth("2026-01-15", -1)).toBe("2025-12-31"); // backward across the year
  expect(eomonth("2026-01-15", 2)).toBe("2026-03-31"); // issue #6
  expect(eomonth("2026-11-10", 3)).toBe("2027-02-28"); // forward year carry
  expect(eomonth("2026-03-31", -15)).toBe("2024-12-31"); // large negative carry
  expect(eomonth("2026-01-31", 1)).toBe("2026-02-28"); // input day past target length
  expect(eomonth("2026-01-15", 3)).toBe("2026-04-30"); // 30-day target month
});

test("eomonth — month 13 and month 0 carries both directions", () => {
  expect(eomonth("2026-12-01", 1)).toBe("2027-01-31"); // month 13 → Jan next year
  expect(eomonth("2026-01-01", -1)).toBe("2025-12-31"); // month 0 → Dec prev year
  expect(eomonth("2026-06-15", -18)).toBe("2024-12-31");
  expect(eomonth("2026-06-15", 18)).toBe("2027-12-31");
});

test("eomonth — February in a leap and a non-leap year", () => {
  expect(eomonth("2024-02-10", 0)).toBe("2024-02-29");
  expect(eomonth("2026-02-10", 0)).toBe("2026-02-28");
  expect(eomonth("2100-02-10", 0)).toBe("2100-02-28"); // century, not a leap year
  expect(eomonth("2000-02-10", 0)).toBe("2000-02-29"); // 400-divisible, leap year
});

test("eomonth — the year-range boundaries", () => {
  expect(eomonth("0001-01-15", 0)).toBe("0001-01-31");
  expect(() => eomonth("0001-01-15", -1)).toThrow(DateError);
  expect(eomonth("9999-12-01", 0)).toBe("9999-12-31");
  expect(() => eomonth("9999-12-01", 1)).toThrow(DateError);
});
