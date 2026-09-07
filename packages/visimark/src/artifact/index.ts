import type { Decimal } from "decimal.js";
import { closest } from "../report/levenshtein.js";
import { svgDocument } from "./svg.js";

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

/** what an engine draws: body elements and the height it chose */
export interface EngineOutput {
  body: string[];
  height: number;
}

export type EngineResult = EngineOutput | { err: string };
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

/**
 * Build one artifact. The engine draws; the registry wraps its body in the
 * document scaffold and stamps the identity marker, so no engine can write its
 * own provenance.
 */
export function buildArtifact(
  name: string,
  input: EngineInput,
  id: { sheetId: string; chart: string },
): { svg: string } | { err: string } {
  const engine = ENGINES.get(name);
  if (!engine) return { err: "unknown chart type `" + name + "`" };
  const drawn = engine(input);
  if ("err" in drawn) return drawn;
  return { svg: svgDocument(id.sheetId, id.chart, drawn.height, drawn.body) };
}

// The built-in engine set, registered once at load. It is closed: a document
// selects the name `pie` exactly as it selects the name `SUM`.
import { bar } from "./engines/bar.js";
import { pie } from "./engines/pie.js";

registerEngine("pie", pie);
registerEngine("bar", bar);
