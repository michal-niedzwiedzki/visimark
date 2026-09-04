import { Decimal } from "decimal.js";
import { numericValue } from "../eval/units.js";
import type { InferContext, InferSheet } from "./context.js";
import { type Accepted, type ColumnVerdict, verifyColumn } from "./verify.js";

/**
 * A constant solved from one row and carrying more decimals than this is not a
 * constant anybody wrote; it is the residue of a division that happened to
 * land. Refusing them keeps the search from proposing rules no reader would
 * recognise, and costs nothing real: every rate, discount and tax fraction a
 * document states fits well inside it.
 */
const MAX_CONSTANT_PLACES = 6;

const COMMUTATIVE = ["*", "+"] as const;
const DIRECTED = ["-", "/"] as const;

export interface ColumnCandidate {
  sheet: InferSheet;
  stage: 1 | 2 | 4;
  target: string;
  /** the binding as source text: `Net = Qty * Rate` */
  rule: string;
  op: string;
  /** columns of this sheet the rule reads */
  operands: string[];
  /** binding ids the rule depends on, for cycle rejection */
  deps: string[];
  /** stage 2: the literal the rule introduces */
  constant?: string;
  verdict: ColumnVerdict;
  /**
   * The rule that survives dropping a constant operand, when that rule fits
   * too. Its presence means the data cannot choose between the two.
   */
  degenerateWith?: string;
}

/** stages 1 and 2 for one table: binary column rules and constant multipliers */
export function columnCandidates(
  ctx: InferContext,
  sheet: InferSheet,
  accepted: Accepted[],
): ColumnCandidate[] {
  const out: ColumnCandidate[] = [];
  for (const target of targets(sheet)) {
    const others = sheet.numeric.filter((c) => c !== target);

    for (const op of COMMUTATIVE) {
      for (let i = 0; i < others.length; i++) {
        for (let j = i + 1; j < others.length; j++) {
          add(out, ctx, sheet, accepted, 1, target, others[i]!, op, others[j]!);
        }
      }
    }
    for (const op of DIRECTED) {
      for (const a of others) {
        for (const b of others) {
          if (a === b) continue;
          add(out, ctx, sheet, accepted, 1, target, a, op, b);
        }
      }
    }

    for (const a of others) {
      const k = solveMultiplier(sheet, target, a);
      if (!k) continue;
      add(out, ctx, sheet, accepted, 2, target, a, "*", k);
    }
  }
  return out;
}

/** stage 4: a column times a scalar named by stage 3, here or in another sheet */
export function crossSheetCandidates(
  ctx: InferContext,
  sheet: InferSheet,
  scalars: { sheetId: string; name: string }[],
  accepted: Accepted[],
): ColumnCandidate[] {
  const out: ColumnCandidate[] = [];
  for (const target of targets(sheet)) {
    for (const a of sheet.numeric) {
      if (a === target) continue;
      for (const s of scalars) {
        const ref = s.sheetId === sheet.id ? s.name : `${s.sheetId}.${s.name}`;
        add(out, ctx, sheet, accepted, 4, target, a, "*", ref, `${s.sheetId}.${s.name}`);
      }
    }
  }
  return out;
}

function targets(sheet: InferSheet): string[] {
  return sheet.numeric.filter((c) => !sheet.managed.has(c));
}

function add(
  out: ColumnCandidate[],
  ctx: InferContext,
  sheet: InferSheet,
  accepted: Accepted[],
  stage: 1 | 2 | 4,
  target: string,
  left: string,
  op: string,
  right: string,
  scalarDep?: string,
): void {
  const rule = `${target} = ${left} ${op} ${right}`;
  const verdict = verifyColumn(ctx, sheet, rule, accepted);
  if (!verdict.usable || verdict.fits === 0) return;

  const operands = [left, right].filter((x) => sheet.index.has(x));
  const deps = operands.map((c) => `${sheet.id}.${c}`);
  if (scalarDep) deps.push(scalarDep);

  const candidate: ColumnCandidate = {
    sheet,
    stage,
    target,
    rule,
    op,
    operands,
    deps,
    constant: stage === 2 ? right : undefined,
    verdict,
  };
  candidate.degenerateWith = droppedRule(ctx, sheet, accepted, candidate, left, right);
  out.push(candidate);
}

/**
 * A rule is ambiguous when dropping a constant operand yields another rule
 * that fits. If `Qty` were `1` on every row, `Net = Qty * Rate` and
 * `Net = Rate` are both exact and the data cannot separate them. Excluding
 * constant columns outright would lose the genuine case, so the test fires
 * only where the evidence really is incapable of choosing.
 */
function droppedRule(
  ctx: InferContext,
  sheet: InferSheet,
  accepted: Accepted[],
  candidate: ColumnCandidate,
  left: string,
  right: string,
): string | undefined {
  if (candidate.op !== "*") return undefined;
  const keep = sheet.constant.has(left)
    ? right
    : sheet.constant.has(right)
      ? left
      : null;
  if (keep === null) return undefined;
  const dropped = `${candidate.target} = ${keep}`;
  const v = verifyColumn(ctx, sheet, dropped, accepted);
  return v.usable && v.misses.length === 0 && v.rows > 0 ? dropped : undefined;
}

/**
 * Solve `k` in `T = A * k` from the first row that can determine it, then hand
 * the candidate to the evaluator like any other. A `k` that only satisfies the
 * row it came from is not a finding, and verification is what says so.
 */
function solveMultiplier(
  sheet: InferSheet,
  target: string,
  a: string,
): string | null {
  const ti = sheet.index.get(target)!;
  const ai = sheet.index.get(a)!;
  for (const row of sheet.table.rows) {
    const t = numericValue(row.cells[ti]?.text ?? "");
    const d = numericValue(row.cells[ai]?.text ?? "");
    if (t === null || d === null || d.isZero()) continue;
    const k = t.div(d);
    if (!k.isFinite() || k.isZero() || k.equals(1)) return null;
    if (k.decimalPlaces() > MAX_CONSTANT_PLACES) return null;
    return k.toString();
  }
  return null;
}

