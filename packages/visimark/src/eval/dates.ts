import { Decimal } from "decimal.js";

export type IsoResult =
  | { ok: true; iso: string }
  | {
      ok: false;
      reason: string;
      decidable?: string;
      ambiguous?: { a: string; b: string; daysApart: number };
    };

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NON_ISO_RE = /^(\d{1,4})([./-])(\d{1,4})\2(\d{1,4})$/;

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    m - 1
  ]!;
}

function validYmd(y: number, m: number, d: number): boolean {
  return (
    y >= 1 &&
    y <= 9999 &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= daysInMonth(y, m)
  );
}

const iso = (y: number, m: number, d: number): string =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(
    d,
  ).padStart(2, "0")}`;

export function parseIsoDate(text: string): IsoResult {
  const isoMatch = ISO_RE.exec(text);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (validYmd(+y!, +m!, +d!)) return { ok: true, iso: text };
    return { ok: false, reason: "not a valid calendar date" };
  }

  const m = NON_ISO_RE.exec(text);
  if (m) {
    const parts = [m[1]!, m[3]!, m[4]!].map(Number);
    let year: number | undefined;
    let rest: number[];
    if (m[1]!.length === 4) {
      year = parts[0];
      rest = [parts[1]!, parts[2]!];
    } else if (m[4]!.length === 4) {
      year = parts[2];
      rest = [parts[0]!, parts[1]!];
    } else {
      return { ok: false, reason: "not a date VisiMark can read" };
    }
    const [n1, n2] = rest as [number, number];
    const candidates: string[] = [];
    if (validYmd(year!, n2, n1)) candidates.push(iso(year!, n2, n1)); // day = n1
    if (validYmd(year!, n1, n2) && n1 !== n2) {
      candidates.push(iso(year!, n1, n2)); // day = n2
    }
    if (candidates.length === 0) {
      return { ok: false, reason: "not a valid calendar date" };
    }
    if (candidates.length === 1) {
      return {
        ok: false,
        reason: "non-ISO date order",
        decidable: candidates[0],
      };
    }
    const [a, b] = candidates as [string, string];
    return {
      ok: false,
      reason: "ambiguous date order",
      ambiguous: {
        a,
        b,
        daysApart: Math.abs(daysBetween(a, b).toNumber()),
      },
    };
  }

  return { ok: false, reason: "not a date VisiMark can read" };
}

function epochDay(isoStr: string): number {
  const [y, m, d] = isoStr.split("-").map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** a − b, in whole days */
export function daysBetween(a: string, b: string): Decimal {
  return new Decimal(epochDay(a) - epochDay(b));
}

export function addDays(isoStr: string, days: number): string {
  const ms = (epochDay(isoStr) + days) * 86_400_000;
  const dt = new Date(ms);
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
