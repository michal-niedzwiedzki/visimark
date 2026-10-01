import type { UnitText } from "../lang/ast.js";
import type { RawCell, RawTable, Span } from "../parse/document.js";

/**
 * A header cell split into the column's name and its unit clause. See
 * docs/design/algebraic-unit-maps-on-names-spec.md §2.3.
 *
 * `unit` is the bracket's raw text, not yet parsed: a grammar failure is a
 * `UNIT` finding the caller reports with the bracket's span, and the column
 * keeps its name either way — the bracket never falls back to being part of it.
 * `error` is set when the header is malformed as a whole (an empty stem, or a
 * second unit clause); `name` is still the best name it has, or `null` when it
 * has none at all.
 */
export interface HeaderName {
  name: string | null;
  unit: UnitText | null;
  error?: { message: string; span: Span };
}

export const EMPTY_STEM_MESSAGE = "a header needs a name before its unit";
export const TWO_CLAUSES_MESSAGE = "a header has one unit clause";

/**
 * The trailing unit clause of `source`, if it has one: the unescaped `]` that
 * ends the text and the last unescaped `[` before it. A footnote reference
 * (`[^1]`), a reference link (`[text][ref]`) and an escaped `\[…\]` are not
 * unit clauses. Offsets are into `source`.
 */
function trailingClause(source: string): { open: number; close: number } | null {
  const close = source.length - 1;
  if (close < 0 || source[close] !== "]" || escaped(source, close)) return null;
  let open = -1;
  for (let i = close - 1; i >= 0; i--) {
    if (source[i] === "[" && !escaped(source, i)) {
      open = i;
      break;
    }
  }
  if (open === -1) return null;
  if (source[open + 1] === "^") return null;
  if (open > 0 && source[open - 1] === "]") return null;
  return { open, close };
}

/** whether the character at `i` is preceded by an odd run of backslashes */
function escaped(s: string, i: number): boolean {
  let n = 0;
  for (let j = i - 1; j >= 0 && s[j] === "\\"; j--) n++;
  return n % 2 === 1;
}

/** a stem that is one emphasis, strong or code span names its inner text */
const WRAPPED = /^(\*\*|__|\*|_|`)(.+)\1$/s;

/**
 * Split one header. `source` is the cell's whole trimmed source text, `text`
 * the name the parse layer already gives a header with no unit clause, and
 * `offset` the absolute position of `source[0]`.
 */
export function splitHeader(source: string, text: string, offset: number): HeaderName {
  const clause = trailingClause(source);
  if (!clause) return { name: text, unit: null };
  const unit: UnitText = {
    text: source.slice(clause.open + 1, clause.close),
    start: offset + clause.open,
    end: offset + clause.close + 1,
  };
  const stem = source.slice(0, clause.open).trimEnd();
  if (stem === "") {
    return {
      name: null,
      unit,
      error: { message: EMPTY_STEM_MESSAGE, span: { start: unit.start, end: unit.end } },
    };
  }
  const name = WRAPPED.exec(stem)?.[2] ?? stem;
  if (trailingClause(stem)) {
    return {
      name,
      unit: null,
      error: { message: TWO_CLAUSES_MESSAGE, span: { start: offset, end: unit.end } },
    };
  }
  return { name, unit };
}

/** a header cell of an inline table, read against the document's source */
export function splitHeaderCell(cell: RawCell, source: string): HeaderName {
  const span = cell.cellSpan ?? { start: cell.start, end: cell.end };
  return splitHeader(source.slice(span.start, span.end), cell.text, span.start);
}

const NAMES = new WeakMap<RawTable, HeaderName[]>();

/**
 * Every header of a table, split. A CSV-backed table (an import) has no
 * source of its own — its cells carry the declaration's span — so its header
 * text is split as written, with spans pointing at that declaration.
 */
export function headerNames(table: RawTable, source: string | null): HeaderName[] {
  const cached = NAMES.get(table);
  if (cached) return cached;
  const names = table.headers.map((h) =>
    source === null ? splitHeader(h.text, h.text, h.start) : splitHeaderCell(h, source),
  );
  NAMES.set(table, names);
  return names;
}

/** just the names, in header order; a header with no name contributes `""` */
export function headerNameList(table: RawTable, source: string | null): string[] {
  return headerNames(table, source).map((h) => h.name ?? "");
}
