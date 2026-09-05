import { Decimal } from "decimal.js";

/**
 * A unit is a display decoration on a number: `$` in `$5.50`, `N` in `12 N`.
 * It is inert — never converted, never propagated through a formula. The
 * engine strips it to do arithmetic and puts it back when it writes.
 */
export interface Unit {
  text: string;
  side: "prefix" | "suffix";
}

export type Decorated =
  | { kind: "number"; num: string; unit: Unit | null }
  | { kind: "both-sides"; pre: string; post: string }
  | { kind: "not-a-number" };

/**
 * A decoration is a run of characters that are not digits, whitespace, `.`,
 * `-` or `%`. Excluding `.` and `-` keeps decimal points and signs with the
 * number; excluding `%` keeps `23%` on the existing percent path, because a
 * unit never scales the value it decorates.
 */
const DECOR = "[^\\d\\s.\\-%]";
const DECORATED = new RegExp(
  `^(?<sign1>-?)\\s*(?<pre>${DECOR}*)\\s*(?<sign2>-?)\\s*` +
    `(?<num>\\d+(?:\\.\\d+)?)\\s*(?<post>${DECOR}*)$`,
);

export function parseDecorated(text: string): Decorated {
  const t = text.trim();
  if (t === "") return { kind: "not-a-number" };
  const m = DECORATED.exec(t);
  if (!m?.groups) return { kind: "not-a-number" };
  const { sign1, pre, sign2, num, post } = m.groups as Record<string, string>;
  if (sign1 && sign2) return { kind: "not-a-number" };
  if (pre && post) return { kind: "both-sides", pre, post };
  const sign = sign1 || sign2 ? "-" : "";
  const unit: Unit | null = pre
    ? { text: pre, side: "prefix" }
    : post
      ? { text: post, side: "suffix" }
      : null;
  return { kind: "number", num: sign + num, unit };
}

export function unitKey(u: Unit | null): string {
  return u ? `${u.side}:${u.text}` : "(none)";
}

export function showUnit(u: Unit | null): string {
  return u ? u.text : "(none)";
}

export function applyUnit(numText: string, unit: Unit | null): string {
  if (!unit) return numText;
  if (unit.side === "suffix") return `${numText} ${unit.text}`;
  return numText.startsWith("-") ? `-${unit.text}${numText.slice(1)}` : `${unit.text}${numText}`;
}

export interface ColumnUnit {
  /** the column's unit when every numeric cell agrees; null when bare or in conflict */
  unit: Unit | null;
  /** true when the numeric cells disagree about their decoration */
  conflict: boolean;
  /** the distinct forms seen, for the error message */
  forms: string[];
  /** row index of the first cell that departs from the first form seen */
  firstDeviantRow: number | null;
}

/**
 * Infer one unit for a column, exactly as write precision is inferred: from
 * the cells that are already there. Cells that are not numbers at all — empty,
 * a date, a word — carry no opinion and are ignored. Where the numeric cells
 * disagree, the column is in conflict and the caller reports it; the tool
 * never decides which decoration was the intended one.
 */
export function inferColumnUnit(cellTexts: (string | undefined)[]): ColumnUnit {
  const seen: { key: string; unit: Unit | null; row: number }[] = [];
  cellTexts.forEach((text, row) => {
    const d = parseDecorated(text ?? "");
    if (d.kind !== "number") return;
    seen.push({ key: unitKey(d.unit), unit: d.unit, row });
  });

  if (seen.length === 0) {
    return { unit: null, conflict: false, forms: [], firstDeviantRow: null };
  }

  const first = seen[0]!;
  const deviant = seen.find((s) => s.key !== first.key);
  if (!deviant) {
    return {
      unit: first.unit,
      conflict: false,
      forms: [showUnit(first.unit)],
      firstDeviantRow: null,
    };
  }

  const forms: string[] = [];
  for (const s of seen) {
    const label = showUnit(s.unit);
    if (!forms.includes(label)) forms.push(label);
  }
  return { unit: null, conflict: true, forms, firstDeviantRow: deviant.row };
}

/**
 * The numeric value of a cell or a prose figure, or `null` when the text is
 * not a number at all. This is the one place that decides what "numeric"
 * means — `check` coerces inputs through it and inference classifies columns
 * through it, so the two can never disagree about which columns are numbers.
 *
 * A date is deliberately not a number: `2026-09-10` fails the decorated shape
 * because `-` is excluded from the decoration class.
 */
export function numericValue(text: string): Decimal | null {
  const t = text.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return new Decimal(t);
  const pm = /^(\d+(?:\.\d+)?)%$/.exec(t);
  if (pm) return new Decimal(pm[1]!).div(100);
  const dec = parseDecorated(t);
  return dec.kind === "number" ? new Decimal(dec.num) : null;
}
