import type { EngineInput, EngineResult } from "../index.js";
import {
  advance,
  greys,
  INK,
  legendRow,
  n2,
  niceTicks,
  showNumber,
  STROKE_W,
  text,
  valueAxis,
  VIEW_W,
  viewHeight,
} from "../svg.js";

const PAD_L = 70;
const PAD_R = 16;
const PAD_T = 18;
const LABEL_H = 26;

/**
 * The bar engine: vertical bars, grouped for several series, in row order.
 *
 * A zero baseline is always drawn and negatives extend below it — unlike a
 * pie, a negative bar is perfectly well defined, so it is not refused.
 * Several series draw a legend, which is a rendering necessity rather than a
 * styling option: without it the bars cannot be told apart.
 */
export function bar(input: EngineInput): EngineResult {
  const { series, labels } = input;
  if (series.length === 0) return { err: "a bar chart needs a series" };
  const rows = series[0]!.values.length;

  const h = viewHeight(input.aspect);
  const legendH = series.length > 1 ? 20 : 0;
  const plotTop = PAD_T + legendH;
  const plotBottom = h - LABEL_H;
  const plotH = plotBottom - plotTop;
  const plotW = VIEW_W - PAD_L - PAD_R;

  const all = series.flatMap((s) => s.values.map((v) => v.toNumber()));
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const span = hi - lo || 1;
  const y = (v: number) => plotBottom - ((v - lo) / span) * plotH;

  const fills = greys(series.length);
  const body: string[] = [];

  body.push(...valueAxis(ticks, y, PAD_L, VIEW_W - PAD_R));

  // grouped bars
  const slot = plotW / Math.max(rows, 1);
  const groupW = slot * 0.7;
  const barW = groupW / series.length;
  for (let r = 0; r < rows; r++) {
    const x0 = PAD_L + slot * r + (slot - groupW) / 2;
    series.forEach((s, si) => {
      const v = s.values[r]?.toNumber() ?? 0;
      const top = Math.min(y(v), y(0));
      const height = Math.abs(y(v) - y(0));
      body.push(
        `<rect x="${n2(x0 + barW * si)}" y="${n2(top)}" width="${n2(barW)}" ` +
          `height="${n2(height)}" fill="${fills[si]!}" stroke="${INK}" ` +
          `stroke-width="${STROKE_W}"/>`,
      );
    });
    const label = labels[r] ?? "";
    body.push(
      text(PAD_L + slot * r + slot / 2, plotBottom + 16, label, {
        size: 11,
        length: Math.min(advance(label, 11), slot - 4),
      }),
    );
  }

  // a legend only where it is needed to tell series apart
  if (series.length > 1) {
    body.push(...legendRow(series, fills, PAD_L, PAD_T));
  }

  // a single series carries its values directly, since there is no legend
  if (series.length === 1) {
    const s = series[0]!;
    for (let r = 0; r < rows; r++) {
      const v = s.values[r]!;
      const vy = y(v.toNumber());
      body.push(text(PAD_L + slot * r + slot / 2, vy - 5, showNumber(v, s), { size: 10 }));
    }
  }

  return { body, height: h };
}
