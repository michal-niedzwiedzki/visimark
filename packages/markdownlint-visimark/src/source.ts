import type { MicromarkToken, RuleParams } from "./types.js";

/** The two token types whose text is a raw HTML run; their children repeat them. */
const HTML_TOKENS: ReadonlySet<string> = new Set(["htmlFlow", "htmlText"]);

function collectHtml(tokens: readonly MicromarkToken[], into: MicromarkToken[]): void {
  for (const token of tokens) {
    if (HTML_TOKENS.has(token.type)) {
      into.push(token);
      continue; // the children repeat this token's own span
    }
    collectHtml(token.children ?? [], into);
  }
}

/**
 * The document as VisiMark must see it.
 *
 * `markdownlint` hands a rule `params.lines` with the *content of every HTML
 * comment replaced by dots*, so that its own rules do not flag prose nobody
 * renders. VisiMark's prose anchors (`<!--vmark=sheet.name-->`) and its
 * `<!--vmark:no-formulas-->` marker are HTML comments, so those lines are not a
 * document `analyze()` can check: anchors vanish, and an opted-out document
 * looks like one that forgot its rules.
 *
 * The micromark token stream is parsed from the document *before* that blanking
 * and carries each comment's original text with exact 1-based positions. The
 * blanking is length-preserving — every non-whitespace character becomes one
 * dot — so writing each token's text back over its own span restores the source
 * byte for byte, and every later span stays valid.
 */
export function sourceFrom(params: RuleParams): string {
  const source = params.lines.join("\n");
  const html: MicromarkToken[] = [];
  collectHtml(params.parsers?.micromark?.tokens ?? [], html);
  if (html.length === 0) return source;

  const lineStart: number[] = [];
  let offset = 0;
  for (const line of params.lines) {
    lineStart.push(offset);
    offset += line.length + 1; // the "\n" the join puts back
  }

  let out = source;
  for (const token of html) {
    const from = lineStart[token.startLine - 1];
    const to = lineStart[token.endLine - 1];
    if (from === undefined || to === undefined) continue;
    const start = from + token.startColumn - 1;
    const end = to + token.endColumn - 1;
    // Length-preserving is the invariant that makes this safe. If a future
    // markdownlint breaks it, leave the span alone rather than corrupt offsets.
    if (end < start || token.text.length !== end - start) continue;
    out = out.slice(0, start) + token.text + out.slice(end);
  }
  return out;
}
