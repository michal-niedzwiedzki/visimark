import type { EngineInput, EngineResult } from "../index.js";
import {
  categoryLabels,
  greys,
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
const POINT_R = 2.5;

/**
 * The line engine: one polyline per series through row-ordered points, on the
 * same value axis and category labels as `bar`.
 *
 * Negative values need no special case here — a line simply passes through
 * the zero baseline rather than stopping at it, unlike a bar.
 */
export function line(input: EngineInput): EngineResult {
  const { series, labels } = input;
  if (series.length === 0) return { err: "a line chart needs a series" };
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

  // points sit at slot centers, exactly where `bar` centers its groups, so a
  // line and a bar of the same data share x positions
  const slot = plotW / Math.max(rows, 1);
  const x = (r: number) => PAD_L + slot * r + slot / 2;

  series.forEach((s, si) => {
    const points = s.values.map((v, r) => `${n2(x(r))},${n2(y(v.toNumber()))}`);
    body.push(
      `<polyline points="${points.join(" ")}" fill="none" stroke="${fills[si]!}" ` +
        `stroke-width="${STROKE_W * 1.5}"/>`,
    );
    s.values.forEach((v, r) => {
      body.push(
        `<circle cx="${n2(x(r))}" cy="${n2(y(v.toNumber()))}" r="${POINT_R}" fill="${fills[si]!}"/>`,
      );
    });
  });

  body.push(...categoryLabels(labels, rows, slot, PAD_L, plotBottom));

  if (series.length > 1) {
    body.push(...legendRow(series, fills, PAD_L, PAD_T));
  }

  if (series.length === 1) {
    const s = series[0]!;
    for (let r = 0; r < rows; r++) {
      const v = s.values[r]!;
      body.push(text(x(r), y(v.toNumber()) - 8, showNumber(v, s), { size: 10 }));
    }
  }

  return { body, height: h };
}
