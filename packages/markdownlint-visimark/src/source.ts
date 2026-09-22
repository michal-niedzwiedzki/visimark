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
/**
 * One entry, keyed on the `lines` array's identity. `markdownlint` freezes that
 * array once per document and spreads the same reference into each rule's
 * `params`, so all seventeen rules for one document share a key — the same
 * shape as the `analyze()` cache in `findings.ts`, one layer down. Without it
 * the seventeen rules each rebuild the source, which on a document with two
 * thousand prose anchors is most of the run's wall time.
 */
let memo: { lines: readonly string[]; source: string } | undefined;

/** Real reconstructions, for the test that pins the one-rebuild property. */
let reconstructions = 0;

export function sourceFrom(params: RuleParams): string {
  if (memo?.lines === params.lines) return memo.source;
  const source = rebuild(params);
  memo = { lines: params.lines, source };
  return source;
}

/** Test-only. Not re-exported from the package root, so it is not published surface. */
export function reconstructCount(): number {
  return reconstructions;
}

/** Test-only. */
export function resetSourceCache(): void {
  memo = undefined;
  reconstructions = 0;
}

function rebuild(params: RuleParams): string {
  reconstructions += 1;
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

  // Built as segments and joined once. Splicing each comment into a growing
  // string copies the whole document per comment, which is quadratic in the
  // number of anchors — and an anchor-heavy document is exactly the case this
  // code exists for.
  const parts: string[] = [];
  let cursor = 0;
  for (const token of html) {
    const from = lineStart[token.startLine - 1];
    const to = lineStart[token.endLine - 1];
    if (from === undefined || to === undefined) continue;
    const start = from + token.startColumn - 1;
    const end = to + token.endColumn - 1;
    // Length-preserving is the invariant that makes this safe. If a future
    // markdownlint breaks it, leave the span alone rather than corrupt offsets.
    // A CRLF document's multi-line comment lands here too: micromark's text
    // keeps the \r that `lines.join("\n")` dropped, so the lengths disagree.
    if (start < cursor || end < start || token.text.length !== end - start) continue;
    parts.push(source.slice(cursor, start), token.text);
    cursor = end;
  }
  parts.push(source.slice(cursor));
  return parts.join("");
}
