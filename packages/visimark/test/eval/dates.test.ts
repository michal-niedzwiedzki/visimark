import { expect, test } from "bun:test";
import { daysBetween, parseIsoDate } from "../../src/eval/dates.js";

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
