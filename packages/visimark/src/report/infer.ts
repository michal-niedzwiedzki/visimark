import { Decimal } from "decimal.js";
import type { Proposal } from "../infer/propose.js";
import { locate, type RawTable } from "../parse/document.js";
import { lineOf } from "./lines.js";

/** where `4/4 rows` sits, measured from the start of the line */
const FITS_COL = 46;
/** where a scalar's name sits, after the rule that produces it */
const SCALAR_RULE_FIELD = 28;
/** where the reason for a rejected rule sits */
const REASON_FIELD = 26;
/** the narrowest first field; wider names push it out, shorter ones do not */
const MIN_NAME_FIELD = 7;

export function formatInfer(
  path: string,
  source: string,
  proposals: Proposal[],
): string {
  const tables = new Map<number, RawTable>();
  for (const t of locate(source).tables) tables.set(t.span.start, t);

  const lines: string[] = [];
  const bySheet = new Map<string, Proposal[]>();
  const loose: Proposal[] = [];
  for (const p of proposals) {
    if (p.sheetId === "") {
      loose.push(p);
      continue;
    }
    const arr = bySheet.get(p.sheetId) ?? [];
    arr.push(p);
    bySheet.set(p.sheetId, arr);
  }

  for (const [, group] of bySheet) {
    const table = tables.get(group[0]!.tableSpan.start);
    if (lines.length > 0) lines.push("");
    lines.push(
      `${path}  table at line ${lineOf(source, group[0]!.tableSpan.start)}` +
        ` — ${table?.rows.length ?? 0} rows, ${table?.headers.length ?? 0} columns`,
    );

    section(lines, "column rules", rules(group));
    section(lines, "constants worth naming", constants(group, source));
    section(lines, "scalars matching figures in prose", scalars(group, source));
    section(lines, "no rule found — treating as inputs", inputs(group, table));
    section(lines, "ambiguous — proposed neither", ambiguous(group));
    section(lines, "near-miss — not proposed", nearMisses(group));
    section(lines, "also fits, not proposed", alsoFits(group));
  }

  section(
    lines,
    "figures matching more than one value — not anchored",
    looseFigures(loose, source),
  );

  const ruleCount = proposals.filter((p) => p.kind === "column" && !p.weak).length;
  const scalarCount = proposals.filter((p) => p.kind === "scalar").length;
  const anchorCount = proposals.filter(
    (p) => p.kind === "scalar" && p.anchorSite,
  ).length;
  if (lines.length > 0) lines.push("");
  lines.push(
    `${plural(ruleCount, "rule")}, ${plural(scalarCount, "scalar")}, ` +
      `${plural(anchorCount, "anchor")}.`,
  );
  return lines.join("\n");
}

function section(out: string[], title: string, body: string[]): void {
  if (body.length === 0) return;
  if (out.length > 0) out.push("");
  out.push(`  ${title}`);
  out.push(...body);
}

function rules(group: Proposal[]): string[] {
  const ps = group.filter((p) => p.kind === "column");
  const w = field(ps.map((p) => p.name));
  return ps.map((p) => {
    const expr = p.rule.slice(p.rule.indexOf("=") + 2);
    const head = `    ${p.name.padEnd(w)}= ${expr}`;
    const note = p.weak ? "2 rows — weak, not written" : `${p.fits}/${p.rows} rows`;
    return pad(head, FITS_COL) + note;
  });
}

function constants(group: Proposal[], source: string): string[] {
  const ps = group.filter((p) => p.kind === "constant" && p.constantEcho);
  const w = field(ps.map((p) => p.name));
  return ps.map((p) => {
    const e = p.constantEcho!;
    return `    ${p.name.padEnd(w)}also appears as "${e.text}" in prose, line ${lineOf(source, e.span.start)}`;
  });
}

function scalars(group: Proposal[], source: string): string[] {
  const ps = group.filter((p) => p.kind === "scalar");
  const shown = ps.map((p) => ({
    p,
    value: p.anchorSite
      ? source.slice(p.anchorSite.start, p.anchorSite.end)
      : "",
    line: p.anchorSite ? `line ${lineOf(source, p.anchorSite.start)}` : "",
  }));
  const vw = field(shown.map((s) => s.value));
  const lw = field(shown.map((s) => s.line));
  return shown.map(({ p, value, line }) => {
    const rule = `= ${p.rule.slice(p.rule.indexOf("=") + 2)}`;
    const head = `    ${value.padEnd(vw)}${line.padEnd(lw)}${rule.padEnd(SCALAR_RULE_FIELD)}${p.name}`;
    return p.reason ? `${head}\n      ${p.reason}` : head;
  });
}

function inputs(group: Proposal[], table: RawTable | undefined): string[] {
  if (!table) return [];
  // A column with a near-miss is not an input either: the tool has an opinion
  // about it, and listing it here would bury the finding.
  const ruled = new Set(
    group
      .filter((p) => p.kind === "column" || p.kind === "near-miss")
      .map((p) => p.name),
  );
  const left = table.headers.map((h) => h.text).filter((h) => !ruled.has(h));
  return left.length === 0 ? [] : [`    ${left.join(", ")}`];
}

function ambiguous(group: Proposal[]): string[] {
  const ps = group.filter((p) => p.kind === "ambiguous");
  const w = field(ps.map((p) => p.name));
  return ps.flatMap((p) =>
    (p.alternatives ?? []).map((alt, i) =>
      `    ${(i === 0 ? p.name : "").padEnd(w)}${alt}`,
    ),
  );
}

function nearMisses(group: Proposal[]): string[] {
  const out: string[] = [];
  for (const p of group.filter((x) => x.kind === "near-miss")) {
    out.push(pad(`    ${p.rule}`, FITS_COL) + `${p.fits}/${p.rows} rows`);
    const d = p.disagreement!;
    out.push(`      row ${d.rowIndex + 1}  ${d.rowLabel}`);
    out.push(
      pad(
        `      cell ${d.stored}, rule gives ${d.computed}`,
        FITS_COL,
      ) + `differs by ${difference(d.stored, d.computed)}`,
    );
  }
  return out;
}

function alsoFits(group: Proposal[]): string[] {
  return group
    .filter((p) => p.kind === "alternative")
    .map((p) => pad(`    ${p.rule}`, 4 + REASON_FIELD) + (p.reason ?? ""));
}

function looseFigures(loose: Proposal[], source: string): string[] {
  const ps = loose.filter((p) => p.kind === "ambiguous");
  const vw = field(ps.map((p) => p.name));
  const lines = ps.map((p) => ({
    p,
    line: `line ${lineOf(source, p.tableSpan.start)}`,
  }));
  const lw = field(lines.map((l) => l.line));
  return lines.flatMap(({ p, line }) =>
    (p.alternatives ?? []).map((alt, i) =>
      i === 0
        ? `    ${p.name.padEnd(vw)}${line.padEnd(lw)}${alt}`
        : `    ${"".padEnd(vw)}${"".padEnd(lw)}${alt}`,
    ),
  );
}

function difference(stored: string, computed: string): string {
  const a = new Decimal(stored.replace(/[^\d.\-]/g, ""));
  const b = new Decimal(computed.replace(/[^\d.\-]/g, ""));
  const places = Math.max(decimals(stored), decimals(computed));
  return b.minus(a).abs().toFixed(places);
}

const decimals = (t: string): number => /\.(\d+)/.exec(t)?.[1]!.length ?? 0;

function field(values: string[]): number {
  return Math.max(MIN_NAME_FIELD, ...values.map((v) => v.length + 2));
}

function pad(text: string, to: number): string {
  return text.length >= to ? `${text} ` : text.padEnd(to);
}

function plural(n: number, what: string): string {
  return `${n} ${what}${n === 1 ? "" : "s"}`;
}
