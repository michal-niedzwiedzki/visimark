import type { Decimal } from "decimal.js";
import { closest } from "../report/levenshtein.js";

/**
 * A generated artifact and the engines that build one.
 *
 * An engine receives **resolved data and nothing else** — no document, no AST,
 * no evaluator. Filtering, aggregation and expression semantics are therefore
 * unrepresentable inside an engine rather than merely discouraged, which is
 * what keeps the calculation model in the language.
 *
 * The engine set is closed and built in. A document selects the name `pie`
 * exactly as it selects the name `SUM`; nothing a document can write reaches
 * `registerEngine`.
 */

export interface Series {
  name: string;
  values: Decimal[];
  /** the column's display decoration, re-applied to value labels */
  unit: { text: string; side: "prefix" | "suffix" } | null;
  /** the column's inferred write precision */
  precision: number;
}

export interface EngineInput {
  series: Series[];
  labels: string[];
  aspect: { w: number; h: number };
}

export type EngineResult = { svg: string } | { err: string };
export type Engine = (input: EngineInput) => EngineResult;

const ENGINES = new Map<string, Engine>();

/**
 * Register a built-in engine. Called at module load by the engines themselves
 * and by tests proving a new engine needs no change elsewhere. It is not a
 * plugin point: no document, and no path a document controls, reaches it.
 */
export function registerEngine(name: string, engine: Engine): void {
  ENGINES.set(name, engine);
}

export function engineNames(): string[] {
  return [...ENGINES.keys()].sort();
}

export function hasEngine(name: string): boolean {
  return ENGINES.has(name);
}

/** the closest known engine name, for a did-you-mean on a typo */
export function suggestEngine(name: string): string | null {
  return closest(name, ENGINES.keys(), 3);
}

export function buildArtifact(name: string, input: EngineInput): EngineResult {
  const engine = ENGINES.get(name);
  if (!engine) return { err: "unknown chart type `" + name + "`" };
  return engine(input);
}
