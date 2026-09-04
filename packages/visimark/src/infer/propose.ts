import { numericValue } from "../eval/units.js";
import type {
  AnchorTargetKind,
  ProseFigure,
  Span,
} from "../parse/document.js";
import {
  type ColumnCandidate,
  columnCandidates,
  crossSheetCandidates,
} from "./candidates.js";
import { buildContext, type InferContext, type InferSheet } from "./context.js";
import { type Ambiguity, select, type Selection } from "./select.js";
import { type Accepted, verifyScalar } from "./verify.js";

export type ProposalKind =
  | "column"
  | "scalar"
  | "constant"
  | "near-miss"
  | "ambiguous"
  /** a rule that fits but lost to a better one for the same column */
  | "alternative";

export interface Proposal {
  kind: ProposalKind;
  stage: 1 | 2 | 3 | 4;
  sheetId: string;
  /** true when `sheetId` was minted for a table that had none */
  mintedSheetId?: boolean;
  name: string;
  /** the binding as source text: `Net = Qty * Rate` */
  rule: string;
  fits: number;
  rows: number;
  tableSpan: Span;
  /** stage 3: the prose figure this would anchor */
  anchorSite?: Span & { kind: AnchorTargetKind };
  /** near-miss: the row that disagrees */
  disagreement?: {
    /** 0-based index of the row in the table body */
    rowIndex: number;
    rowLabel: string;
    stored: string;
    computed: string;
    span: Span;
  };
  /** ambiguous: the competing rules, none proposed */
  alternatives?: string[];
  /** stage 2: the same value, written another way, in prose */
  constantEcho?: { text: string; span: Span };
  /** two rows of evidence: reported, never written */
  weak?: boolean;
  /** why a fitting rule was not proposed */
  reason?: string;
}

/**
 * The other form a constant can be written in. `23%` and `0.23` are the same
 * value; `Q23` and `#unnamed23` are tokens that happen to contain one.
 */
const PLAIN_FIGURE_RE = /^-?\d+(?:\.\d+)?%?$/;

/** the reduces stage 3 searches, in the order they are reported */
const REDUCES = ["SUM", "AVG", "MIN", "MAX", "COUNT"] as const;
const SUFFIX: Record<string, string> = {
  SUM: "_total",
  AVG: "_avg",
  MIN: "_min",
  MAX: "_max",
  COUNT: "_count",
};

interface ScalarCandidate {
  sheet: InferSheet;
  column: string;
  reduce: string;
  name: string;
  rule: string;
  /** true when this value is already written in prose the way `fmt` writes it */
  writes(figure: string): boolean;
}

interface ScalarPick {
  candidate: ScalarCandidate;
  figure: ProseFigure;
}

export function infer(source: string): Proposal[] {
  const ctx = buildContext(source);
  const { picks, ambiguousFigures } = inferScalars(ctx);

  const scalarAccepted: Accepted[] = picks.map((p) => ({
    sheet: p.candidate.sheet,
    rule: p.candidate.rule,
  }));
  const scalarNames = picks.map((p) => ({
    sheetId: p.candidate.sheet.id,
    name: p.candidate.name,
  }));

  const candidates: ColumnCandidate[] = [];
  for (const sheet of ctx.sheets) {
    candidates.push(...columnCandidates(ctx, sheet, scalarAccepted));
    candidates.push(
      ...crossSheetCandidates(ctx, sheet, scalarNames, scalarAccepted),
    );
  }

  // Stage 3's names are fixed before the columns are chosen, so their edges
  // seed the graph selection rejects cycles against: without them
  // `Amount = Share * amount_total` would look acyclic and fit perfectly.
  const edges = new Map<string, string[]>();
  for (const p of picks) {
    edges.set(`${p.candidate.sheet.id}.${p.candidate.name}`, [
      `${p.candidate.sheet.id}.${p.candidate.column}`,
    ]);
  }

  const selection = select(candidates, edges);
  return assemble(ctx, selection, picks, ambiguousFigures);
}

// ---------------------------------------------------------------------------
// stage 3

function inferScalars(ctx: InferContext): {
  picks: ScalarPick[];
  ambiguousFigures: { figure: ProseFigure; alternatives: string[] }[];
} {
  const all: ScalarCandidate[] = [];
  for (const sheet of ctx.sheets) {
    if (sheet.table.rows.length < 2) continue;
    const taken = new Set(ctx.base.sheets.get(sheet.id)?.scalars.keys() ?? []);
    for (const column of sheet.numeric) {
      for (const reduce of REDUCES) {
        const name = column.toLowerCase() + SUFFIX[reduce]!;
        if (taken.has(name)) continue;
        const rule = `${name} = ${reduce}(${column})`;
        const v = verifyScalar(ctx, sheet, rule, [], column);
        if (!v.usable) continue;
        all.push({ sheet, column, reduce, name, rule, writes: v.writes });
      }
    }
  }

  const picks: ScalarPick[] = [];
  const ambiguousFigures: { figure: ProseFigure; alternatives: string[] }[] = [];
  const claimed = new Set<ScalarCandidate>();

  for (const figure of ctx.doc.figures) {
    if (figure.anchored) continue;

    const matching = all.filter((c) => c.writes(figure.text));
    if (matching.length === 0) continue;
    const available = matching.filter(
      (c) => !claimed.has(c) && c.sheet.table.span.end < figure.value.start,
    );
    if (available.length === 1) {
      claimed.add(available[0]!);
      picks.push({ candidate: available[0]!, figure });
      continue;
    }
    if (matching.length >= 2) {
      ambiguousFigures.push({
        figure,
        alternatives: matching.map((c) => qualified(c)),
      });
    }
  }

  return { picks, ambiguousFigures };
}

const qualified = (c: ScalarCandidate): string =>
  `${c.sheet.id}.${c.name} = ${c.reduce}(${c.column})`;

// ---------------------------------------------------------------------------
// assembly

function assemble(
  ctx: InferContext,
  selection: Selection,
  picks: ScalarPick[],
  ambiguousFigures: { figure: ProseFigure; alternatives: string[] }[],
): Proposal[] {
  const out: Proposal[] = [];

  for (const sheet of ctx.sheets) {
    const here = (c: ColumnCandidate): boolean => c.sheet === sheet;
    const base = {
      sheetId: sheet.id,
      mintedSheetId: sheet.minted || undefined,
      tableSpan: sheet.table.span,
    };

    const accepted = orderByDependency(
      [...selection.accepted, ...selection.weak].filter(here),
      selection.edges,
    );
    for (const c of accepted) {
      const e = c.constant ? echo(ctx, c.constant) : undefined;
      out.push({
        ...base,
        kind: "column",
        stage: c.stage,
        name: c.target,
        rule: c.rule,
        fits: c.verdict.fits,
        rows: c.verdict.rows,
        weak: selection.weak.includes(c) || undefined,
        constantEcho: e,
      });
      if (c.constant) {
        if (e) {
          out.push({
            ...base,
            kind: "constant",
            stage: 2,
            name: c.constant,
            rule: c.rule,
            fits: c.verdict.fits,
            rows: c.verdict.rows,
            constantEcho: e,
          });
        }
      }
    }

    for (const p of picks.filter((x) => x.candidate.sheet === sheet)) {
      out.push({
        ...base,
        kind: "scalar",
        stage: 3,
        name: p.candidate.name,
        rule: p.candidate.rule,
        fits: sheet.table.rows.length,
        rows: sheet.table.rows.length,
        anchorSite: p.figure.anchorAt === null ? undefined : p.figure.value,
        reason:
          p.figure.anchorAt === null
            ? "no anchorable inline node holds this figure"
            : undefined,
      });
    }

    for (const c of selection.nearMisses.filter(here)) {
      const miss = c.verdict.misses[0]!;
      out.push({
        ...base,
        kind: "near-miss",
        stage: c.stage,
        name: c.target,
        rule: c.rule,
        fits: c.verdict.fits,
        rows: c.verdict.rows,
        disagreement: {
          rowIndex: miss.rowIndex,
          rowLabel: miss.rowLabel,
          stored: miss.stored,
          computed: miss.computed,
          span: miss.span,
        },
      });
    }

    for (const a of selection.ambiguous.filter(
      (x: Ambiguity) => x.sheet === sheet,
    )) {
      out.push({
        ...base,
        kind: "ambiguous",
        stage: 1,
        name: a.target,
        rule: "",
        fits: 0,
        rows: sheet.table.rows.length,
        alternatives: a.alternatives,
      });
    }

    for (const { candidate, reason } of selection.alsoFits.filter((x) =>
      here(x.candidate),
    )) {
      out.push({
        ...base,
        kind: "alternative",
        stage: candidate.stage,
        name: candidate.target,
        rule: candidate.rule,
        fits: candidate.verdict.fits,
        rows: candidate.verdict.rows,
        reason,
      });
    }
  }

  for (const { figure, alternatives } of ambiguousFigures) {
    out.push({
      kind: "ambiguous",
      stage: 3,
      sheetId: "",
      name: figure.text,
      rule: "",
      fits: 0,
      rows: 0,
      tableSpan: figure.value,
      anchorSite: figure.anchorAt === null ? undefined : figure.value,
      alternatives,
    });
  }

  return out;
}

/**
 * Bindings are emitted in dependency order, so the block reads top to bottom
 * the way it evaluates.
 */
function orderByDependency(
  cands: ColumnCandidate[],
  edges: Map<string, string[]>,
): ColumnCandidate[] {
  const byId = new Map(cands.map((c) => [`${c.sheet.id}.${c.target}`, c]));
  const out: ColumnCandidate[] = [];
  const done = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    done.add(id);
    for (const d of edges.get(id) ?? []) if (byId.has(d)) visit(d);
    const c = byId.get(id);
    if (c) out.push(c);
  };
  for (const c of cands) visit(`${c.sheet.id}.${c.target}`);
  return out;
}

/**
 * The same value, written another way, somewhere in prose. Detection without
 * the guess: the report says `0.23` also appears as `23%` and stops there,
 * because concluding that the constant is therefore *called* `vat` is a guess
 * about meaning.
 */
function echo(
  ctx: InferContext,
  constant: string,
): { text: string; span: Span } | undefined {
  const k = numericValue(constant);
  if (!k) return undefined;
  for (const f of ctx.doc.figures) {
    if (f.text === constant || !PLAIN_FIGURE_RE.test(f.text)) continue;
    const v = numericValue(f.text);
    if (v && v.equals(k)) return { text: f.text, span: f.value };
  }
  return undefined;
}

