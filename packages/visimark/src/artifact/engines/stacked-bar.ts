import type { EngineInput, EngineResult } from "../index.js";
import {
  categoryLabels,
  greys,
  INK,
  legendRow,
  n2,
  niceTicks,
  STROKE_W,
  valueAxis,
  VIEW_W,
  viewHeight,
} from "../svg.js";

const PAD_L = 70;
const PAD_R = 16;
const PAD_T = 18;
const LABEL_H = 26;

/**
 * The stacked-bar engine: one bar per row, its series stacked in declared
 * order. Positives stack upward from zero and negatives stack downward,
 * independently, so a row mixing signs still has a well-defined baseline —
 * the same split a plain running total would use.
 */
export function stackedBar(input: EngineInput): EngineResult {
  const { series, labels } = input;
  if (series.length === 0) return { err: "a stacked-bar chart needs a series" };
  const rows = series[0]!.values.length;

  const h = viewHeight(input.aspect);
  const legendH = series.length > 1 ? 20 : 0;
  const plotTop = PAD_T + legendH;
  const plotBottom = h - LABEL_H;
  const plotH = plotBottom - plotTop;
  const plotW = VIEW_W - PAD_L - PAD_R;

  // per-row running totals, split by sign, to find the cumulative extremes
  const posTotals: number[] = [];
  const negTotals: number[] = [];
  for (let r = 0; r < rows; r++) {
    let pos = 0;
    let neg = 0;
    for (const s of series) {
      const v = s.values[r]?.toNumber() ?? 0;
      if (v >= 0) pos += v;
      else neg += v;
    }
    posTotals.push(pos);
    negTotals.push(neg);
  }
  const ticks = niceTicks(Math.min(...negTotals, 0), Math.max(...posTotals, 0));
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const span = hi - lo || 1;
  const y = (v: number) => plotBottom - ((v - lo) / span) * plotH;

  const fills = greys(series.length);
  const body: string[] = [];

  body.push(...valueAxis(ticks, y, PAD_L, VIEW_W - PAD_R));

  const slot = plotW / Math.max(rows, 1);
  const barW = slot * 0.7;
  for (let r = 0; r < rows; r++) {
    const x0 = PAD_L + slot * r + (slot - barW) / 2;
    let posOffset = 0;
    let negOffset = 0;
    series.forEach((s, si) => {
      const v = s.values[r]?.toNumber() ?? 0;
      const base = v >= 0 ? posOffset : negOffset;
      const top = Math.min(y(base + v), y(base));
      const height = Math.abs(y(base + v) - y(base));
      body.push(
        `<rect x="${n2(x0)}" y="${n2(top)}" width="${n2(barW)}" ` +
          `height="${n2(height)}" fill="${fills[si]!}" stroke="${INK}" ` +
          `stroke-width="${STROKE_W}"/>`,
      );
      if (v >= 0) posOffset += v;
      else negOffset += v;
    });
  }
  body.push(...categoryLabels(labels, rows, slot, PAD_L, plotBottom));

  if (series.length > 1) {
    body.push(...legendRow(series, fills, PAD_L, PAD_T));
  }

  return { body, height: h };
}
