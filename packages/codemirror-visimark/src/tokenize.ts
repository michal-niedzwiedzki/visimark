/**
 * A forgiving line tokenizer for the body of a `vmark` fence (#367). It
 * imports nothing — the CodeMirror adapter is `highlight.ts` — and never
 * throws: a character it does not know gets no span, and an unclosed string or
 * unit bracket runs to the end of the line.
 *
 * The word tables below are this file's own copy of the engine's. The drift
 * test (`test/tokenize-drift.test.ts`) pins them to `lang/lexer.ts`,
 * `lang/parser.ts`, `lang/notation.ts` and `lang/ast.ts`. The spec is
 * docs/design/syntax-highlighting-for-vmark-blocks-spec.md; §3.1 is the
 * kind table and §3.2 the statement rules.
 */

export type Kind =
  | "keyword"
  | "wordOperator"
  | "domainPreset"
  | "atom"
  | "function"
  | "definition"
  | "name"
  | "assign"
  | "operator"
  | "paren"
  | "bracket"
  | "domainBracket"
  | "brace"
  | "separator"
  | "deref"
  | "punctuation"
  | "number"
  | "date"
  | "string"
  | "unit"
  | "comment";

export interface Span {
  from: number;
  to: number;
  kind: Kind;
}

/** The word tables, exported for the drift test only. */
export const WORDS = {
  reserved: new Set(["assert", "chart", "precision", "is"]),
  wordOps: new Set(["and", "or", "not"]),
  symbolOps: ["==", "!=", "<=", ">=", "^", "*", "/", "+", "-", "<", ">", "="] as readonly string[],
  paramWords: new Set(["param", "in", "lattice", "default"]),
  paramPresets: new Set(["integer", "positive", "natural"]),
  chartWords: new Set(["chart", "as", "of", "labelled", "aspect"]),
  reportWords: new Set(["report", "assertions", "broken", "on", "among", "scalar", "direction"]),
  reportAtoms: new Set([
    "ledger",
    "deltas",
    "gates",
    "best",
    "forbidden",
    "feasible",
    "infeasible",
    "all",
    "max",
    "min",
  ]),
  glyphs: {
    Σ: "function",
    "∑": "function",
    "√": "function",
    "∈": "in",
    ℤ: "preset",
    ℕ: "preset",
  } as Readonly<Record<string, "function" | "in" | "preset">>,
  positiveInteger: "ℤ⁺",
  delims: new Set(["|", "⌊", "⌋", "⌈", "⌉"]),
};

/** `true` when a fence's info string opens a `vmark` block: its first word is `vmark`. */
export function isVmarkFence(info: string): boolean {
  return info.trim().split(/\s+/)[0] === "vmark";
}

type Raw =
  | { t: "word"; text: string; from: number; to: number }
  | { t: "glyph"; text: string; from: number; to: number }
  | { t: "fixed"; kind: Kind; text: string; from: number; to: number };

const PUNCT: Readonly<Record<string, Kind>> = {
  "(": "paren",
  ")": "paren",
  "{": "brace",
  "}": "brace",
  ",": "separator",
  ".": "deref",
  ":": "punctuation",
  "⋅": "operator",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}(?!\d)/;
const isDigit = (c: string) => c >= "0" && c <= "9";
const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_]/.test(c);

/** Pass 1: one walk over the line, as the engine's lexer walks it. */
function scan(line: string): Raw[] {
  const out: Raw[] = [];
  const n = line.length;
  let i = 0;
  const fixed = (kind: Kind, to: number) => {
    out.push({ t: "fixed", kind, text: line.slice(i, to), from: i, to });
    i = to;
  };
  while (i < n) {
    const c = line[i]!;
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === "#") {
      fixed("comment", n);
      continue;
    }
    if (c === '"') {
      const close = line.indexOf('"', i + 1);
      fixed("string", close === -1 ? n : close + 1);
      continue;
    }
    if (c === "[") {
      // after `in` (or `∈`, which lexes as `in`) a bracket opens a domain
      // interval; everywhere else it is a unit — lexer.ts, the `[` branch
      const prev = out[out.length - 1];
      if (
        prev &&
        (prev.t === "word" || prev.t === "glyph") &&
        (prev.text === "in" || prev.text === "∈")
      ) {
        fixed("domainBracket", i + 1);
      } else {
        const close = line.indexOf("]", i + 1);
        fixed("unit", close === -1 ? n : close + 1);
      }
      continue;
    }
    if (c === "]") {
      fixed("domainBracket", i + 1);
      continue;
    }
    if (isDigit(c)) {
      const date = DATE_RE.exec(line.slice(i));
      if (date) {
        fixed("date", i + date[0].length);
        continue;
      }
      let j = i;
      while (j < n && isDigit(line[j]!)) j++;
      if (line[j] === "." && isDigit(line[j + 1] ?? "")) {
        j++;
        while (j < n && isDigit(line[j]!)) j++;
      }
      if (line[j] === "%") j++;
      fixed("number", j);
      continue;
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentPart(line[j]!)) j++;
      out.push({ t: "word", text: line.slice(i, j), from: i, to: j });
      i = j;
      continue;
    }
    if (line.startsWith(WORDS.positiveInteger, i)) {
      const to = i + WORDS.positiveInteger.length;
      out.push({ t: "glyph", text: WORDS.positiveInteger, from: i, to });
      i = to;
      continue;
    }
    if (WORDS.glyphs[c] !== undefined) {
      out.push({ t: "glyph", text: c, from: i, to: i + 1 });
      i++;
      continue;
    }
    if (WORDS.delims.has(c)) {
      fixed("bracket", i + 1);
      continue;
    }
    const punct = PUNCT[c];
    if (punct !== undefined) {
      fixed(punct, i + 1);
      continue;
    }
    const sym = WORDS.symbolOps.find((s) => line.startsWith(s, i));
    if (sym !== undefined) {
      fixed(sym === "=" ? "assign" : "operator", i + sym.length);
      continue;
    }
    // unknown: no span; step over a whole code point
    i += (line.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
  }
  return out;
}

type Statement = "param" | "chart" | "report" | "other";

/**
 * Which statement a line is, decided as `parser.ts` decides it (the statement
 * dispatch): `report` only on a line with no `=`, `param` only when a name or a
 * string follows it, `chart` always (it is reserved).
 */
function statementOf(raw: Raw[]): Statement {
  const first = raw[0];
  if (first?.t !== "word") return "other";
  if (first.text === "chart") return "chart";
  if (first.text === "param") {
    const second = raw[1];
    // an identifier, so not a reserved word: `param precision 2 = 5` binds
    const named =
      (second?.t === "word" &&
        !WORDS.reserved.has(second.text) &&
        !WORDS.wordOps.has(second.text)) ||
      (second?.t === "fixed" && second.kind === "string");
    return named ? "param" : "other";
  }
  if (first.text === "report") {
    const assigns = raw.some((r) => r.t === "fixed" && r.kind === "assign");
    return assigns ? "other" : "report";
  }
  return "other";
}

/** The index of the token a line binds, or -1. */
function definitionAt(raw: Raw[], stmt: Statement): number {
  if (stmt === "param" || stmt === "chart") return raw[1]?.t === "word" ? 1 : -1;
  if (stmt === "report") return -1;
  const first = raw[0];
  if (first?.t === "fixed" && first.kind === "string") {
    const is = raw[1];
    return is?.t === "word" && is.text === "is" && raw[2]?.t === "word" ? 2 : -1;
  }
  if (first?.t === "word" && !WORDS.reserved.has(first.text) && !WORDS.wordOps.has(first.text)) {
    return raw.some((r) => r.t === "fixed" && r.kind === "assign") ? 0 : -1;
  }
  return -1;
}

/** Spans for one line of a `vmark` fence body, in order, never overlapping. */
export function tokenizeLine(line: string): Span[] {
  const raw = scan(line);
  const stmt = statementOf(raw);
  const def = definitionAt(raw, stmt);
  const out: Span[] = [];
  for (let k = 0; k < raw.length; k++) {
    const r = raw[k]!;
    if (r.t === "fixed") {
      out.push({ from: r.from, to: r.to, kind: r.kind });
      continue;
    }
    if (r.t === "glyph") {
      const g = r.text === WORDS.positiveInteger ? "preset" : WORDS.glyphs[r.text]!;
      const kind: Kind =
        g === "function"
          ? "function"
          : stmt !== "param"
            ? "name"
            : g === "in"
              ? "wordOperator"
              : "domainPreset";
      out.push({ from: r.from, to: r.to, kind });
      continue;
    }
    const w = r.text;
    const next = raw[k + 1];
    // a chart type after `as`, joined with a `-word` written with no spaces,
    // as parser.ts joins `stacked-bar`
    if (stmt === "chart" && k > 0 && raw[k - 1]!.t === "word" && raw[k - 1]!.text === "as") {
      let to = r.to;
      const dash = raw[k + 1];
      const tail = raw[k + 2];
      if (
        dash?.t === "fixed" &&
        dash.text === "-" &&
        dash.from === r.to &&
        tail?.t === "word" &&
        tail.from === dash.to
      ) {
        to = tail.to;
        k += 2;
      }
      out.push({ from: r.from, to, kind: "atom" });
      continue;
    }
    out.push({ from: r.from, to: r.to, kind: wordKind(w, k, stmt, def, next) });
  }
  return out;
}

function wordKind(w: string, k: number, stmt: Statement, def: number, next: Raw | undefined): Kind {
  if (WORDS.reserved.has(w)) return "keyword";
  if (WORDS.wordOps.has(w)) return "wordOperator";
  if (stmt === "param") {
    if (w === "in") return "wordOperator";
    if (k !== def && WORDS.paramWords.has(w)) return "keyword";
    if (k !== def && WORDS.paramPresets.has(w)) return "domainPreset";
  } else if (stmt === "chart") {
    if (k !== def && WORDS.chartWords.has(w)) return "keyword";
  } else if (stmt === "report") {
    if (WORDS.reportWords.has(w)) return "keyword";
    if (WORDS.reportAtoms.has(w)) return "atom";
  }
  if (k === def) return "definition";
  if (next?.t === "fixed" && next.kind === "paren" && next.text === "(") return "function";
  return "name";
}
