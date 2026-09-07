import type { Decimal } from "decimal.js";
import { applyUnit } from "../eval/units.js";
import type { Series } from "./index.js";
import { marker } from "./stale.js";

/**
 * SVG emit primitives, shared by every engine.
 *
 * Two properties are load-bearing and neither is decorative:
 *
 * **Determinism.** Byte comparison is how staleness is judged, so every number
 * written here is fixed to two decimals and nothing volatile is emitted.
 *
 * **Metric-free layout.** All text is monospace, so advance width is exactly
 * `0.6em x characters` and every position is arithmetic — no embedded font, no
 * bundled metrics table, and no dependence on what the viewer has installed.
 */

/** the viewBox is always this wide; `aspect` sets the height */
export const VIEW_W = 640;
/** one ink colour, legible on a light or a dark page, since a fixed artifact
 *  cannot know its background */
export const INK = "#808080";
export const STROKE_W = 1;
export const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** monospace advance width, in ems */
export const ADVANCE = 0.6;

export function viewHeight(aspect: { w: number; h: number }): number {
  return Math.round((VIEW_W * aspect.h) / aspect.w);
}

/** text width in user units for a monospace run */
export function advance(text: string, fontSize: number): number {
  return text.length * ADVANCE * fontSize;
}

/** two decimals everywhere, so geometry is byte-stable */
export function n2(x: number): string {
  return (Object.is(x, -0) ? 0 : x).toFixed(2);
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The greyscale ramp: equal steps across a **restricted** band, first series
 * darkest. It stops short of white and black on purpose — a fixed artifact
 * cannot know its background, pure white vanishes on a light page and pure
 * black on a dark one, and GitHub sanitizes SVG so an internal
 * `prefers-color-scheme` block cannot be relied on to adapt.
 */
const BAND_DARK = 0x33;
const BAND_LIGHT = 0xcc;

export function greys(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return ["#808080"];
  const step = (BAND_LIGHT - BAND_DARK) / (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const v = Math.round(BAND_DARK + i * step);
    const h = v.toString(16).padStart(2, "0");
    return `#${h}${h}${h}`;
  });
}

export interface TextOpts {
  anchor?: "start" | "middle" | "end";
  size?: number;
  /** force the run into exactly this width, so geometry holds whatever font renders */
  length?: number;
}

export function text(x: number, y: number, s: string, opts: TextOpts = {}): string {
  const size = opts.size ?? 12;
  const anchor = opts.anchor ?? "middle";
  const len = opts.length !== undefined ? ` textLength="${n2(opts.length)}" lengthAdjust="spacingAndGlyphs"` : "";
  return (
    `<text x="${n2(x)}" y="${n2(y)}" font-family="${FONT}" font-size="${size}" ` +
    `text-anchor="${anchor}" fill="${INK}"${len}>${esc(s)}</text>`
  );
}

/** a series value as the document would print it: its own precision, its own unit */
export function showNumber(d: Decimal, s: Series): string {
  return applyUnit(d.toFixed(s.precision), s.unit);
}

export function svgDocument(
  sheetId: string,
  chart: string,
  height: number,
  body: string[],
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${height}" role="img">` +
    marker(sheetId, chart) +
    body.join("") +
    `</svg>\n`
  );
}

/**
 * Axis ticks by the 1 / 2 / 5 x 10^k rule — deterministic given the range, and
 * always including zero so a baseline exists.
 */
export function niceTicks(dataMin: number, dataMax: number, target = 5): number[] {
  const min = Math.min(0, dataMin);
  const max = Math.max(0, dataMax);
  if (min === max) return [0];
  const raw = (max - min) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = mag * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    out.push(Math.abs(v) < step / 1e6 ? 0 : v);
  }
  return out;
}
