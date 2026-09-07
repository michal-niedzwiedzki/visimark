import type { EngineInput, EngineResult } from "../index.js";
import { greys, INK, n2, showNumber, STROKE_W, text, VIEW_W, viewHeight } from "../svg.js";

/**
 * The pie engine.
 *
 * Refusing is part of the contract: a pie of negative values has no defined
 * slice geometry and a pie summing to zero divides by zero for its angles.
 * Reporting that is the builder's obligation, which is what keeps the core
 * free of per-engine knowledge.
 */
export function pie(input: EngineInput): EngineResult {
  if (input.series.length !== 1) {
    return { err: "a pie takes one series" };
  }
  const s = input.series[0]!;
  const negative = s.values.findIndex((v) => v.isNegative());
  if (negative !== -1) {
    return {
      err:
        "pie of `" + s.name + "` contains a negative value (" +
        s.values[negative]!.toFixed(s.precision) + ", row " + (negative + 1) + ")",
    };
  }
  const total = s.values.reduce((a, b) => a.plus(b), s.values[0]!.mul(0));
  if (total.isZero()) {
    return { err: "pie of `" + s.name + "` sums to zero" };
  }

  const h = viewHeight(input.aspect);
  const cx = VIEW_W / 2;
  const cy = h / 2;
  const r = Math.min(VIEW_W, h) * 0.34;
  const fills = greys(s.values.length);
  const body: string[] = [];

  // slices in row order, from 12 o'clock, clockwise
  let angle = -90;
  s.values.forEach((v, i) => {
    const frac = v.div(total);
    const sweep = frac.toNumber() * 360;
    const fill = fills[i]!;
    if (s.values.length === 1) {
      // a single slice is a full circle; an arc back to its own start draws nothing
      body.push(
        `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="${fill}" ` +
          `stroke="${INK}" stroke-width="${STROKE_W}"/>`,
      );
    } else {
      const a0 = (angle * Math.PI) / 180;
      const a1 = ((angle + sweep) * Math.PI) / 180;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const large = sweep > 180 ? 1 : 0;
      body.push(
        `<path d="M ${n2(cx)} ${n2(cy)} L ${n2(x0)} ${n2(y0)} ` +
          `A ${n2(r)} ${n2(r)} 0 ${large} 1 ${n2(x1)} ${n2(y1)} Z" ` +
          `fill="${fill}" stroke="${INK}" stroke-width="${STROKE_W}"/>`,
      );
    }
    // slices are labelled directly, so a pie needs no legend
    const mid = ((angle + sweep / 2) * Math.PI) / 180;
    const lx = cx + r * 1.28 * Math.cos(mid);
    const ly = cy + r * 1.28 * Math.sin(mid);
    const share = frac.mul(100).toFixed(1);
    const label = input.labels[i] ?? "";
    body.push(text(lx, ly, `${label} ${share}%`, { size: 12 }));
    body.push(text(lx, ly + 14, showNumber(v, s), { size: 11 }));
    angle += sweep;
  });

  return { body, height: h };
}
