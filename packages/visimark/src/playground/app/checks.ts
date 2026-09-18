/**
 * The fixed, reviewed vocabulary of things a quest step is allowed to detect.
 *
 * scenarios.json is plain JSON — it can name a check, it can never supply one.
 * Every predicate here takes the same context (see EvalContext): the fresh
 * eval result, the snapshot taken when the file was loaded, and whether the
 * document reports STALE findings now versus then.
 */

import type { EvalContext } from "./types.js";

function evalChanged(ctx: EvalContext): boolean {
  return JSON.stringify(ctx.evalResult) !== ctx.baselineJson;
}

/** For a document with no vmark rules (a plain table, e.g. 01-tables.md)
 *  pgEval's result never changes no matter what you type — there's no formula
 *  for it to recompute. "value-changed" is blind to that case; this checks the
 *  raw source text directly instead. */
function sourceChanged(ctx: EvalContext): boolean {
  return ctx.sourceChanged;
}

function chartsPresent(ctx: EvalContext): boolean {
  return ((ctx.evalResult.charts ?? []) as { svg?: string }[]).some((c) => Boolean(c.svg));
}

function chartsRegenerated(ctx: EvalContext): boolean {
  return chartsPresent(ctx) && evalChanged(ctx);
}

/** `pgEval`'s computed values are always fresh — a STALE cell is a mismatch
 *  between a formula's result and the literal text already sitting in the
 *  document, which eval never exposes. Detecting "the drift got fixed" needs
 *  check()'s findings directly, not eval's. */
function staleFixed(ctx: EvalContext): boolean {
  return ctx.baselineHasStale && !ctx.hasStale;
}

function assertionsFailing(ctx: EvalContext): boolean {
  return ((ctx.evalResult.assertions ?? []) as { holds?: boolean | null }[]).some(
    (a) => a.holds === false,
  );
}

function assertionsPassing(ctx: EvalContext): boolean {
  const list = (ctx.evalResult.assertions ?? []) as { holds?: boolean | null }[];
  return list.length > 0 && list.every((a) => a.holds === true);
}

/** pgEval flattens each sheet's columns/scalars into top-level keys named
 *  "sheetId.columnName" — a bare `column` name is matched against either the
 *  whole key or that suffix, so scenario data doesn't need to know the sheet
 *  id. */
function hasColumn(evalResult: Record<string, unknown>, column: string): boolean {
  const suffix = `.${column}`;
  return Object.keys(evalResult).some((key) => key === column || key.endsWith(suffix));
}

function columnAdded(ctx: EvalContext, column: string): boolean {
  const baseline = JSON.parse(ctx.baselineJson) as Record<string, unknown>;
  return !hasColumn(baseline, column) && hasColumn(ctx.evalResult, column);
}

/** Checks a scenario step names on its own, with no extra field. */
export const CHECKS: Record<string, (ctx: EvalContext) => boolean> = {
  "value-changed": evalChanged,
  "source-changed": sourceChanged,
  "charts-regenerated": chartsRegenerated,
  "stale-fixed": staleFixed,
  "assertion-failing": assertionsFailing,
  "assertion-passing": assertionsPassing,
};

/**
 * Checks that need one more field off the step.
 *
 * Kept apart from CHECKS rather than widening every predicate's signature: the
 * argument is not optional for these, and a separate map is what lets
 * normalizeStep refuse `{"kind":"eval","check":"column-added"}` with no
 * `column` instead of silently matching nothing.
 */
export const PARAMETRIC_CHECKS: Record<string, (ctx: EvalContext, arg: string) => boolean> = {
  "column-added": columnAdded,
};
