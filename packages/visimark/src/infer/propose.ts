import { check } from "../eval/check.js";
import { FUNCTIONS } from "../eval/functions.js";
import { formatUnit } from "../lang/unit-expr.js";
import type { Binding } from "../model/types.js";
import { cellPrecision, numericValue } from "../eval/units.js";
import type { AnchorTargetKind, ProseFigure, Span } from "../parse/document.js";
import { aliasCandidates } from "./aliases.js";
import { type ColumnCandidate, columnCandidates, crossSheetCandidates } from "./candidates.js";
import {
  buildContext,
  type InferContext,
  type InferSheet,
  makeBinding,
  provisional,
} from "./context.js";
import { type Ambiguity, select, type Selection } from "./select.js";
import { type Accepted, verifyScalar, withPrecision } from "./verify.js";

export type ProposalKind =
  | "column"
  | "scalar"
  | "constant"
  | "near-miss"
  | "ambiguous"
  /** a rule that fits but lost to a better one for the same column */
  | "alternative"
  /** `"Header" is symbol` — a name for a header no identifier can reach */
  | "alias"
  /** a missing derived unit, added to a computed column's header or a scalar's head */
  | "unit";

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
  /** alias: the header text `name` stands for */
  header?: string;
  /** unit: the normalised unit, where it goes, and the offset it is inserted at */
  unit?: { text: string; target: "header" | "head"; at: number };
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
  /** false when no width follows from the rule — the proposal must declare one */
  derivable: boolean;
  /** true when this value is already written in prose the way `fmt` writes it */
  writes(figure: string): boolean;
}

/** the decimals a prose figure shows, which is the width it states */
function figurePrecision(text: string): number {
  return cellPrecision(text) ?? 2;
}

interface ScalarPick {
  candidate: ScalarCandidate;
  figure: ProseFigure;
}

export function infer(source: string): Proposal[] {
  const ctx = buildContext(source);
  const { picks, ambiguousFigures } = inferScalars(ctx);

  // A reduce that divides — `AVG` — has no derivable width, so the rule as
  // proposed would be anchored and then reported. The figure it is claiming is
  // the evidence for a width, so the proposal declares that: inference never
  // writes a rule `check` rejects.
  for (const p of picks) {
    if (p.candidate.derivable) continue;
    p.candidate.rule = withPrecision(p.candidate.rule, figurePrecision(p.figure.text));
  }

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
    candidates.push(...crossSheetCandidates(ctx, sheet, scalarNames, scalarAccepted));
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
  const out = assemble(ctx, selection, picks, ambiguousFigures);
  out.push(...aliasProposals(ctx, out));
  out.push(...unitProposals(source, ctx, out));
  return out;
}

// ---------------------------------------------------------------------------
// units

/**
 * A missing derived unit for every computed binding that has none: a column
 * rule gets a ` [unit]` suffix on its header, a scalar one after its name.
 * Never an input column, never a declaration already there, never a binding
 * whose units disagree. Units are read off the document as it will be after
 * this run's own rules are written, so one `--write` is idempotent: a scalar
 * this run adds carries its unit in its rule, and a column rule it adds gets
 * its header suffix in the same pass. See
 * docs/design/algebraic-unit-maps-on-names-spec.md §5.3.
 */
function unitProposals(source: string, ctx: InferContext, sofar: Proposal[]): Proposal[] {
  const sheetById = new Map(ctx.sheets.map((s) => [s.id, s]));
  const adding = sofar.filter(
    (p) =>
      !p.weak &&
      sheetById.has(p.sheetId) &&
      (p.kind === "column" || (p.kind === "scalar" && p.anchorSite !== undefined)),
  );
  const extra: Binding[] = [];
  for (const p of adding) {
    try {
      extra.push(makeBinding(sheetById.get(p.sheetId)!, p.rule));
    } catch {
      // a rule that does not parse on its own is not one this pass can read
    }
  }
  const model = provisional(ctx, extra);
  const result = check(model);
  const derived = (id: string): string | null => {
    const u = result.unitMaps.get(id);
    return u && u.source === "derived" ? formatUnit(u.map) : null;
  };

  // a scalar this run adds carries its unit in its own head
  for (const p of adding) {
    if (p.kind !== "scalar") continue;
    const unit = derived(`${p.sheetId}.${p.name}`);
    if (unit !== null) p.rule = p.rule.replace(/^(\S+)/, `$1 [${unit}]`);
  }

  const out: Proposal[] = [];
  const headOffset = (b: Binding): number => {
    const line = source.slice(b.span.start, b.span.end);
    const lead = line.length - line.trimStart().length;
    return b.span.start + lead + b.name.length;
  };
  const existingScalar = (b: Binding, tableSpan: Span): void => {
    const unit = derived(b.id);
    if (unit === null || b.unitText || b.param) return;
    out.push({
      kind: "unit",
      stage: 1,
      sheetId: b.sheetId,
      name: b.name,
      rule: `${b.name} [${unit}]`,
      fits: 0,
      rows: 0,
      tableSpan,
      unit: { text: unit, target: "head", at: headOffset(b) },
    });
  };

  for (const b of ctx.base.docScope.values()) existingScalar(b, b.span);
  for (const sheet of ctx.sheets) {
    const base = ctx.base.sheets.get(sheet.id);
    if (base?.imported) continue;
    const ruled = new Set([
      ...(base?.columns.keys() ?? []),
      ...adding.filter((p) => p.kind === "column" && p.sheetId === sheet.id).map((p) => p.name),
    ]);
    for (const name of ruled) {
      if (base?.headerUnits.has(name)) continue;
      const unit = derived(`${sheet.id}.${name}`);
      const idx = sheet.index.get(name);
      const cell = idx === undefined ? undefined : sheet.table.headers[idx];
      if (unit === null || !cell) continue;
      const end = (cell.cellSpan ?? cell).end;
      // a header that already ends in a bracket would read as a second clause
      if (source[end - 1] === "]") continue;
      out.push({
        kind: "unit",
        stage: 1,
        sheetId: sheet.id,
        mintedSheetId: sheet.minted || undefined,
        name,
        rule: `${name} [${unit}]`,
        fits: 0,
        rows: sheet.table.rows.length,
        tableSpan: sheet.table.span,
        unit: { text: unit, target: "header", at: end },
      });
    }
    for (const b of base?.scalars.values() ?? []) existingScalar(b, sheet.table.span);
  }
  // a sheet with a block but no table still has scalars
  for (const sheet of ctx.base.sheets.values()) {
    if (sheet.table || sheetById.has(sheet.id)) continue;
    for (const b of sheet.scalars.values()) existingScalar(b, b.span);
  }
  return out;
}

// ---------------------------------------------------------------------------
// aliases

/** names the language itself owns, and so no alias may take */
const RESERVED = new Set<string>([
  "is",
  "assert",
  "chart",
  ...FUNCTIONS.keys(),
  ...[...FUNCTIONS.keys()].map((f) => f.toLowerCase()),
]);

/**
 * An `is` alias for every header no identifier can reach. Run last, so that
 * `taken` can include the names this same run already proposed: a column rule
 * and an alias competing for one name is the collision the spec drops, not a
 * pair of proposals that cannot both be adopted.
 */
function aliasProposals(ctx: InferContext, sofar: Proposal[]): Proposal[] {
  const out: Proposal[] = [];
  for (const sheet of ctx.sheets) {
    const existing = ctx.base.sheets.get(sheet.id);
    const taken = new Set<string>([
      ...RESERVED,
      ...sheet.index.keys(),
      ...(existing?.scalars.keys() ?? []),
      ...(existing?.aliases.keys() ?? []),
      ...sofar.filter((p) => p.sheetId === sheet.id).map((p) => p.name),
    ]);
    const { proposals, collisions } = aliasCandidates(sheet, taken);
    out.push(...proposals);
    for (const c of collisions) {
      out.push({
        kind: "ambiguous",
        stage: 1,
        sheetId: sheet.id,
        mintedSheetId: sheet.minted || undefined,
        name: c.header,
        rule: "",
        fits: 0,
        rows: sheet.table.rows.length,
        tableSpan: sheet.table.span,
        alternatives: [`"${c.header}" is ${c.name} — \`${c.name}\` is already taken`],
      });
    }
  }
  return out;
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
        all.push({ sheet, column, reduce, name, rule, derivable: v.derivable, writes: v.writes });
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
          p.figure.anchorAt === null ? "no anchorable inline node holds this figure" : undefined,
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

    for (const a of selection.ambiguous.filter((x: Ambiguity) => x.sheet === sheet)) {
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

    for (const { candidate, reason } of selection.alsoFits.filter((x) => here(x.candidate))) {
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
function echo(ctx: InferContext, constant: string): { text: string; span: Span } | undefined {
  const k = numericValue(constant);
  if (!k) return undefined;
  for (const f of ctx.doc.figures) {
    if (f.text === constant || !PLAIN_FIGURE_RE.test(f.text)) continue;
    const v = numericValue(f.text);
    if (v && v.equals(k)) return { text: f.text, span: f.value };
  }
  return undefined;
}
