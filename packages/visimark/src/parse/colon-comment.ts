/**
 * The `<!--vmark:` comment family — `<!--vmark:no-formulas-->` and the report
 * comment `<!--vmark:report #id …-->`. See
 * `docs/design/declare-a-sheet-s-report-statements-spec.md` §2 and §4.1.
 *
 * Every comment that opens with the colon prefix is either one of the two
 * known forms or a problem `build` reports. None is ever an ordinary,
 * silently ignored comment.
 */

export type ColonProblem =
  | "unknown-word"
  | "nested"
  | "malformed-marker"
  | "unclosed"
  | "trailing"
  | "no-id";

export type ColonParse =
  | { kind: "marker" }
  | { kind: "report"; sheetId: string; body: string; bodyStart: number }
  | { kind: "problem"; problem: ColonProblem; word: string };

/** any colon-family comment */
export const COLON_RE = /^<!--\s*vmark\s*:\s*/;
/** a word character, or a `-` that does not start the closing `-->` */
const WORD_RE = /^(?:[A-Za-z0-9_]|-(?!->))*/;
/** a report comment, well-formed or not: the word `report` and then a
 *  character that does not continue the word */
export const REPORT_LOOSE_RE = /^<!--\s*vmark\s*:\s*report(?![A-Za-z0-9_]|-(?!->))/;
const NO_FORMULAS_RE = /^<!--\s*vmark\s*:\s*no-formulas\s*-->$/;
/** spaces or tabs, `#`, and the id: everything up to whitespace (the caller
 *  has already cut the text at the first `-->`) */
const ID_RE = /^[ \t]+#(\S+)/;

/**
 * Classify one `html` node's value, which starts at absolute offset `start`.
 * `null` when it is not a colon comment at all.
 */
export function parseColonComment(
  value: string,
  start: number,
  topLevel: boolean,
): ColonParse | null {
  const lead = value.length - value.trimStart().length;
  const text = value.slice(lead);
  const prefix = COLON_RE.exec(text);
  if (!prefix) return null;
  const word = WORD_RE.exec(text.slice(prefix[0].length))![0];
  const problem = (p: ColonProblem): ColonParse => ({ kind: "problem", problem: p, word });

  if (word !== "no-formulas" && word !== "report") return problem("unknown-word");
  if (!topLevel) return problem("nested");
  if (word === "no-formulas") {
    return NO_FORMULAS_RE.test(text.trim()) ? { kind: "marker" } : problem("malformed-marker");
  }

  const close = text.indexOf("-->", 4);
  if (close === -1) return problem("unclosed");
  if (text.slice(close + 3).trim() !== "") return problem("trailing");
  const wordEnd = prefix[0].length + word.length;
  const segment = text.slice(wordEnd, close);
  const id = ID_RE.exec(segment);
  if (!id) return problem("no-id");
  return {
    kind: "report",
    sheetId: id[1]!,
    body: segment.slice(id[0].length),
    bodyStart: start + lead + wordEnd + id[0].length,
  };
}
