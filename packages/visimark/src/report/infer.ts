import { Decimal } from "decimal.js";
import type { Proposal } from "../infer/propose.js";
import { locate, type RawTable } from "../parse/document.js";
import { lineOf } from "./lines.js";
import { build } from "../model/build.js";
import { headerNameList } from "../model/header-name.js";

/** the narrowest column `4/4 rows` sits at; a longer rule pushes it right */
const MIN_FITS_COL = 46;
/** where a scalar's name sits, after the rule that produces it */
const SCALAR_RULE_FIELD = 28;
/** where the reason for a rejected rule sits */
const REASON_FIELD = 26;
/** the narrowest first field; wider names push it out, shorter ones do not */
const MIN_NAME_FIELD = 7;

export function formatInfer(path: string, source: string, proposals: Proposal[]): string {
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

  const model = build(locate(source));
  for (const [sheetId, group] of bySheet) {
    const table = tables.get(group[0]!.tableSpan.start);
    if (lines.length > 0) lines.push("");
    lines.push(
      table
        ? `${path}  table at line ${lineOf(source, group[0]!.tableSpan.start)}` +
            ` — ${table.rows.length} rows, ${table.headers.length} columns`
        : // a unit proposal on a table-less sheet's scalar has no table to name
          `${path}  #${sheetId}  (no table)`,
    );

    section(lines, "column rules", rules(group));
    section(lines, "column aliases", aliases(group));
    section(lines, "units", units(group));
    section(lines, "constants worth naming", constants(group, source));
    section(lines, "scalars matching figures in prose", scalars(group, source));
    const ruled = [...(model.sheets.get(sheetId)?.columns.keys() ?? [])];
    section(lines, "no rule found — treating as inputs", inputs(group, table, source, ruled));
    section(lines, "ambiguous — proposed neither", ambiguous(group));
    section(lines, "near-miss — not proposed", nearMisses(group));
    section(lines, "also fits, not proposed", alsoFits(group));
  }

  section(
    lines,
    "figures matching more than one value — not anchored",
    looseFigures(loose, source),
  );
  section(lines, "units", units(loose));

  const ruleCount = proposals.filter((p) => p.kind === "column" && !p.weak).length;
  const aliasCount = proposals.filter((p) => p.kind === "alias").length;
  const scalarCount = proposals.filter((p) => p.kind === "scalar").length;
  const anchorCount = proposals.filter((p) => p.kind === "scalar" && p.anchorSite).length;
  if (lines.length > 0) lines.push("");
  lines.push(
    `${plural(ruleCount, "rule")}, ${plural(aliasCount, "alias", "aliases")}, ` +
      `${plural(scalarCount, "scalar")}, ${plural(anchorCount, "anchor")}.`,
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
  const heads = ps.map((p) => `    ${p.name.padEnd(w)}= ${p.rule.slice(p.rule.indexOf("=") + 2)}`);
  const col = column(heads, MIN_FITS_COL);
  return ps.map((p, i) => {
    const note = p.weak ? "2 rows — weak, not written" : `${p.fits}/${p.rows} rows`;
    return heads[i]!.padEnd(col) + note;
  });
}

function units(group: Proposal[]): string[] {
  const ps = group.filter((p) => p.kind === "unit" && p.unit);
  const w = field(ps.map((p) => p.name));
  const uw = field(ps.map((p) => `[${p.unit!.text}]`));
  return ps.map((p) => `    ${p.name.padEnd(w)}${`[${p.unit!.text}]`.padEnd(uw)}${p.unit!.target}`);
}

function aliases(group: Proposal[]): string[] {
  const ps = group.filter((p) => p.kind === "alias");
  const w = field(ps.map((p) => p.name));
  return ps.map((p) => `    ${p.name.padEnd(w)}for "${p.header}"`);
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
    value: p.anchorSite ? source.slice(p.anchorSite.start, p.anchorSite.end) : "",
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

function headerSource(h: RawTable["headers"][number], source: string): string {
  const span = h.cellSpan ?? h;
  return source.slice(span.start, span.end);
}

function inputs(
  group: Proposal[],
  table: RawTable | undefined,
  source: string,
  alreadyRuled: string[],
): string[] {
  if (!table) return [];
  // A column with a near-miss is not an input either: the tool has an opinion
  // about it, and listing it here would bury the finding. Nor is one the
  // document already gives a rule.
  const ruled = new Set([
    ...alreadyRuled,
    ...group.filter((p) => p.kind === "column" || p.kind === "near-miss").map((p) => p.name),
  ]);
  // filtered by name, shown as written, so a unit clause stays visible
  const names = headerNameList(table, source);
  const left = table.headers
    .map((h, i) => ({ name: names[i]!, shown: headerSource(h, source) }))
    .filter((h) => !ruled.has(h.name))
    .map((h) => h.shown);
  return left.length === 0 ? [] : [`    ${left.join(", ")}`];
}

function ambiguous(group: Proposal[]): string[] {
  const ps = group.filter((p) => p.kind === "ambiguous");
  const w = field(ps.map((p) => p.name));
  return ps.flatMap((p) =>
    (p.alternatives ?? []).map((alt, i) => `    ${(i === 0 ? p.name : "").padEnd(w)}${alt}`),
  );
}

function nearMisses(group: Proposal[]): string[] {
  const ps = group.filter((x) => x.kind === "near-miss");
  const heads = ps.flatMap((p) => [
    `    ${p.rule}`,
    `      cell ${p.disagreement!.stored}, rule gives ${p.disagreement!.computed}`,
  ]);
  const col = column(heads, MIN_FITS_COL);
  const out: string[] = [];
  ps.forEach((p, i) => {
    const d = p.disagreement!;
    out.push(heads[i * 2]!.padEnd(col) + `${p.fits}/${p.rows} rows`);
    out.push(`      row ${d.rowIndex + 1}  ${d.rowLabel}`);
    out.push(heads[i * 2 + 1]!.padEnd(col) + `differs by ${difference(d.stored, d.computed)}`);
  });
  return out;
}

function alsoFits(group: Proposal[]): string[] {
  const ps = group.filter((p) => p.kind === "alternative");
  const heads = ps.map((p) => `    ${p.rule}`);
  const col = column(heads, 4 + REASON_FIELD);
  return ps.map((p, i) => heads[i]!.padEnd(col) + (p.reason ?? ""));
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
  const a = new Decimal(stored.replace(/[^\d.-]/g, ""));
  const b = new Decimal(computed.replace(/[^\d.-]/g, ""));
  const places = Math.max(decimals(stored), decimals(computed));
  return b.minus(a).abs().toFixed(places);
}

const decimals = (t: string): number => /\.(\d+)/.exec(t)?.[1]!.length ?? 0;

function field(values: string[]): number {
  return Math.max(MIN_NAME_FIELD, ...values.map((v) => v.length + 2));
}

/** the column a trailing field starts at: never before `min`, never abutting */
function column(heads: string[], min: number): number {
  return Math.max(min, ...heads.map((h) => h.length + 2));
}

function plural(n: number, what: string, many = `${what}s`): string {
  return `${n} ${n === 1 ? what : many}`;
}
