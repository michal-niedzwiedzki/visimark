/**
 * Exact decimal arithmetic on table cells. A cell is read as a scaled integer
 * — `340.50` at two places is `34050n` — so a sum or a product is compared
 * without a floating-point tolerance, and a "mismatch" cannot be made out of
 * binary rounding.
 */

/**
 * A cell as a number, or null. Strips emphasis, code ticks, currency signs and
 * thousands commas, and refuses anything else, so a cell with a unit, a range,
 * a link or a decimal comma (`1,5`) is never summed.
 */
export function cellNumber(cell: string): { value: number; decimals: number } | null {
  const t = cell
    .replace(/[*_`]/g, "")
    .replace(/[$€£¥￥]/g, "")
    .trim();
  if (!/^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/.test(t) || !/\d/.test(t)) return null;
  const clean = t.replace(/,/g, "");
  return { value: Number(clean), decimals: clean.includes(".") ? clean.split(".")[1]!.length : 0 };
}

export function digits(cell: string): { neg: boolean; int: string; frac: string } | null {
  if (cellNumber(cell) === null) return null;
  const t = cell.replace(/[*_`$€£¥￥,\s]/g, "");
  const neg = t.startsWith("-");
  const body = t.replace(/^[-+]/, "");
  const [int = "0", frac = ""] = body.split(".");
  return { neg, int: int === "" ? "0" : int, frac };
}

/** The cell's decimal places, or null when it is not a number. */
export function places(cell: string): number | null {
  return digits(cell)?.frac.length ?? null;
}

export function scaled(cell: string, at: number): bigint | null {
  const d = digits(cell);
  if (!d || d.frac.length > at) return null;
  const n = BigInt(d.int + d.frac.padEnd(at, "0"));
  return d.neg ? -n : n;
}

export function decimal(n: bigint, at: number): string {
  const neg = n < 0n;
  const s = (neg ? -n : n).toString().padStart(at + 1, "0");
  const body = at === 0 ? s : `${s.slice(0, -at)}.${s.slice(-at)}`;
  return neg ? `-${body}` : body;
}

/** `n`, held at `from` places, re-expressed at `to` places — half away from zero. */
export function roundToPlaces(n: bigint, from: number, to: number): bigint {
  if (to >= from) return n * 10n ** BigInt(to - from);
  const unit = 10n ** BigInt(from - to);
  const half = unit / 2n;
  return n >= 0n ? (n + half) / unit : -((-n + half) / unit);
}

/**
 * The cell's raw text with only its numeric literal replaced by `value`:
 * currency, emphasis and the like stay, and thousands separators are kept
 * when the original used them.
 */
export function rewriteNumber(cellRaw: string, value: string): string {
  const literal = /[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?/g;
  for (const m of cellRaw.matchAll(literal)) {
    if (!/\d/.test(m[0])) continue;
    let next = value;
    if (m[0].includes(",")) {
      const [int = "", frac] = value.split(".");
      const sign = int.startsWith("-") ? "-" : "";
      const grouped = int.replace(/^-/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      next = `${sign}${grouped}${frac === undefined ? "" : `.${frac}`}`;
    }
    return cellRaw.slice(0, m.index) + next + cellRaw.slice(m.index + m[0].length);
  }
  return value;
}
