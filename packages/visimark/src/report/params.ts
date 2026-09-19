import type { Binding } from "../model/types.js";

// Listing helpers for `param` statements, shared by `explain` and the
// playground's copy of it. Kept free of Node imports so the browser bundle can
// take them. See docs/design/scenario-params-spec.md §5.3.

/** the bindings that are not `param`s — a param is listed under `params:` */
export function nonParams(bs: Iterable<Binding>): Binding[] {
  return [...bs].filter((b) => b.param === undefined);
}

/** the `param`s among `bs`, in declaration order */
export function params(bs: Iterable<Binding>): Binding[] {
  return [...bs].filter((b) => b.param !== undefined);
}

/**
 * `name   precision N   default TEXT`, the three fields aligned; the default
 * as written. See docs/design/scenario-params-spec.md §5.3.
 */
export function paramLines(bs: Binding[], indent: string): string[] {
  const rows = bs.map((b) => ({
    name: b.name,
    prec: b.precision === undefined ? "precision ?" : `precision ${b.precision}`,
    dflt: `default ${b.param!.text}`,
  }));
  const nw = Math.max(0, ...rows.map((r) => r.name.length));
  const pw = Math.max(0, ...rows.map((r) => r.prec.length));
  return rows.map((r) => `${indent}${r.name.padEnd(nw)}   ${r.prec.padEnd(pw)}   ${r.dflt}`);
}
