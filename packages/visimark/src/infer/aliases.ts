import type { InferSheet } from "./context.js";
import type { Proposal } from "./propose.js";

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "per",
  "in",
  "on",
  "for",
  "and",
  "or",
  "to",
  "at",
  "by",
]);

/**
 * A stopword-aware, first-letter acronym of a header. Deterministic and
 * document-independent — no locale, no config. See
 * docs/design/human-readable-column-aliases-spec.md §5.
 */
export function generateAliasName(header: string): string {
  const tokens = header.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const kept = tokens.filter((t) => !STOPWORDS.has(t.toLowerCase()));
  let name = kept.map((t) => t[0]!.toLowerCase()).join("");
  if (name === "" || /^[0-9]/.test(name)) name = `_${name}`;
  return name;
}

/** a header whose generated name was already spoken for, and so was dropped */
export interface AliasCollision {
  header: string;
  name: string;
}

/**
 * Every header in `sheet` that is not already an identifier and has no rule or
 * alias yet, split into the ones whose generated name is free and the ones
 * whose name collides. `taken` is every name already spoken for in this sheet
 * (columns, scalars, existing aliases, builtins, keywords).
 *
 * The split exists because the two halves land in different buckets: a free
 * name becomes an `alias` proposal, a colliding one is reported through
 * `infer`'s existing `ambiguous` bucket — printed, never written (spec §5).
 */
export function aliasCandidates(
  sheet: InferSheet,
  taken: Set<string>,
): { proposals: Proposal[]; collisions: AliasCollision[] } {
  const proposals: Proposal[] = [];
  const collisions: AliasCollision[] = [];
  const seen = new Set(taken);
  for (const header of sheet.table.headers.map((h) => h.text)) {
    if (IDENT_RE.test(header)) continue;
    if (sheet.managed.has(header)) continue; // already has a rule
    if (sheet.aliasedHeaders.has(header)) continue; // already has an alias
    // A literal `"` can never be legally quoted — the lexer's string-literal
    // grammar has no escape sequence (see lang/lexer.ts), so a header with
    // one is unreachable by quoted reference or alias (spec §7). Skip it
    // rather than propose an alias rule that could never parse.
    if (header.includes('"')) continue;
    const name = generateAliasName(header);
    if (seen.has(name)) {
      collisions.push({ header, name });
      continue;
    }
    seen.add(name);
    proposals.push({
      kind: "alias",
      stage: 1,
      sheetId: sheet.id,
      mintedSheetId: sheet.minted || undefined,
      name,
      header,
      rule: `"${header}" is ${name}`,
      fits: 0,
      rows: 0,
      tableSpan: sheet.table.span,
    });
  }
  return { proposals, collisions };
}

/**
 * Proposes an `is` alias for every header in `sheet` that is not already an
 * identifier and has no rule or alias yet. A colliding proposal is dropped
 * rather than emitted; `infer()` reports it through the `ambiguous` bucket.
 */
export function proposeAliases(sheet: InferSheet, taken: Set<string>): Proposal[] {
  return aliasCandidates(sheet, taken).proposals;
}
