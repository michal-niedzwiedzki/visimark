import type { ColumnCandidate } from "./candidates.js";
import type { InferSheet } from "./context.js";

export interface Ambiguity {
  sheet: InferSheet;
  target: string;
  /** the competing rules, none of them proposed */
  alternatives: string[];
}

export interface AlsoFits {
  candidate: ColumnCandidate;
  reason: string;
}

export interface Selection {
  accepted: ColumnCandidate[];
  /** accepted on two rows only: reported, marked weak, never written */
  weak: ColumnCandidate[];
  nearMisses: ColumnCandidate[];
  ambiguous: Ambiguity[];
  alsoFits: AlsoFits[];
  /** the final dependency graph, binding id -> the ids it reads */
  edges: Map<string, string[]>;
}

const PREFERS_COLUMNS = "prefers a rule over materialised columns";
const OUTRANKED = "another rule for this column ranks higher";

/**
 * The result is a set, not a list. `Gross = Net + VAT` and `Net = Gross - VAT`
 * both fit the same table perfectly, and accepting both emits a document that
 * fails `check` with a `CYCLE`. So selection builds an acyclic set: a
 * candidate that would close a cycle with what is already accepted is never
 * considered again, and among what remains the ranking only ever chooses
 * between candidates that are each already exact.
 */
export function select(
  candidates: ColumnCandidate[],
  edges: Map<string, string[]> = new Map(),
): Selection {
  const graph = new Map(edges);
  const out: Selection = {
    accepted: [],
    weak: [],
    nearMisses: [],
    ambiguous: [],
    alsoFits: [],
    edges: graph,
  };

  const sheetOrder = new Map<InferSheet, number>();
  for (const c of candidates) {
    if (!sheetOrder.has(c.sheet)) sheetOrder.set(c.sheet, sheetOrder.size);
  }

  const usable = candidates.filter(isEvidence);
  const resolved = new Set<string>();
  const winner = new Map<string, ColumnCandidate>();

  for (;;) {
    const pool = usable.filter((c) => !resolved.has(id(c)) && !closesCycle(graph, id(c), c.deps));
    if (pool.length === 0) break;

    const best = Math.min(...pool.map(rank));
    const group = pool.filter((c) => rank(c) === best);
    const at = (c: ColumnCandidate): number =>
      (sheetOrder.get(c.sheet) ?? 0) * 1000 + (c.sheet.index.get(c.target) ?? 0);
    const target = group.reduce((a, b) => (at(a) <= at(b) ? a : b));
    const here = group.filter((c) => id(c) === id(target));
    const rules = [...new Set(here.map((c) => c.rule))];

    resolved.add(id(target));

    if (rules.length > 1) {
      out.ambiguous.push({
        sheet: target.sheet,
        target: target.target,
        alternatives: rules,
      });
      continue;
    }
    const chosen = here[0]!;
    if (chosen.degenerateWith) {
      out.ambiguous.push({
        sheet: chosen.sheet,
        target: chosen.target,
        alternatives: [chosen.rule, chosen.degenerateWith],
      });
      continue;
    }

    graph.set(id(chosen), chosen.deps);
    winner.set(id(chosen), chosen);
    if (chosen.verdict.misses.length > 0) out.nearMisses.push(chosen);
    else if (isWeak(chosen)) out.weak.push(chosen);
    else out.accepted.push(chosen);
  }

  // Everything else that fits exactly. A candidate that would close a cycle
  // with the final set is not an alternative at all — it is the same fact
  // rearranged — so only genuine rivals for a column that did get a rule are
  // worth a reader's attention.
  for (const c of usable) {
    if (c.verdict.misses.length > 0) continue;
    const won = winner.get(id(c));
    if (!won || won === c) continue;
    if (closesCycle(graph, id(c), c.deps)) continue;
    out.alsoFits.push({
      candidate: c,
      reason: stageRank(won) < stageRank(c) ? PREFERS_COLUMNS : OUTRANKED,
    });
  }

  return out;
}

/** section 7: three rows to propose, two to report, one is not evidence */
function isEvidence(c: ColumnCandidate): boolean {
  const { rows, misses } = c.verdict;
  if (misses.length === 0) return rows >= 2;
  return misses.length === 1 && rows >= 3;
}

export function isWeak(c: ColumnCandidate): boolean {
  return c.verdict.rows === 2;
}

const id = (c: ColumnCandidate): string => `${c.sheet.id}.${c.target}`;

/** two materialised columns, then a column and a named scalar, then a literal */
const stageRank = (c: ColumnCandidate): number => (c.stage === 1 ? 0 : c.stage === 4 ? 1 : 2);

/**
 * Ranking, in the order section 6 applies it: an exact rule before a
 * near-miss, strong evidence before weak, a rule over materialised columns
 * before one introducing a constant, and the constructive form of an
 * arithmetic fact before its rearrangement. `Gross = Net + VAT` and
 * `Net = Gross - VAT` state the same thing; the sum is the one a person
 * writes, and taking it fixes the direction the rest of the set builds in.
 */
function rank(c: ColumnCandidate): number {
  const tier = c.verdict.misses.length === 0 ? 0 : 1;
  const weak = isWeak(c) ? 1 : 0;
  const stage = stageRank(c);
  const op = c.op === "*" || c.op === "+" ? 0 : 1;
  return ((tier * 2 + weak) * 3 + stage) * 2 + op;
}

function closesCycle(graph: Map<string, string[]>, target: string, deps: string[]): boolean {
  const seen = new Set<string>();
  const stack = [...deps];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n === target) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(graph.get(n) ?? []));
  }
  return false;
}
