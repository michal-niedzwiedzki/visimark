import { hasVmarkBlock } from "./gate.js";

/**
 * Where a template lands in a note, and what it takes with it — review row
 * 21. `editor.replaceSelection(template.body)` inserted at the caret
 * literally: mid-line, the template's own `# Invoice 001` heading and its
 * opening fence landed on a line that already had text on it, so neither one
 * was a block by the Markdown grammar's own rules — the review's own
 * example, docs/example-invoice.md, only passes `check` with zero findings
 * in an *empty* note, which no caret position outside of one actually is.
 *
 * **Pure and Obsidian-free on purpose.** `main.ts` has no runtime test yet
 * (row 12) — nothing here can load the real `obsidian` module under
 * `bun test` — so this is factored out precisely so the placement logic
 * itself is not stuck behind that gap. It takes an offset, not an `Editor`,
 * and `main.ts` is the one line that bridges `editor.posToOffset` to it.
 * `gate.ts` has no `obsidian` import in its own chain either, which is what
 * keeps that true even after `safeTemplateInsertion` below started using it.
 */
export interface TemplateInsertion {
  /** offset to insert at — never inside an existing line's text */
  readonly at: number;
  /** what to insert there, blank-line-padded against whatever it lands next to */
  readonly text: string;
}

/**
 * `at` is always the start of an empty line, or a position that becomes one
 * once `text`'s own leading blank line is inserted.
 *
 * **The line the caret is on decides where, not how much padding.** An empty
 * line (blank, or only whitespace) is where the template lands — whatever
 * precedes it may or may not already be a full blank line away, which is
 * why padding isn't decided here. Any other line — mid-word, mid-sentence,
 * anywhere with real text on it — gets pushed past entirely: the insertion
 * point becomes the end of that line, so the template never shares a line
 * with existing prose.
 *
 * **Padding is decided once, by what is actually there before `at`,** not by
 * which of the two cases above chose it. A single blank line between two
 * paragraphs (`"A.\n\nB."`) and the caret sitting on it is exactly the case a
 * first version of this function got wrong (CodeRabbit review of PR #267):
 * inserting at that blank line's own start consumes it, and "whatever
 * precedes it already separates it" turns out false the moment the gap is
 * only one line wide. Counting the newlines already immediately before `at`
 * and adding only what's missing to make a full blank line — never adding to
 * two or more that are already there — is what makes this correct regardless
 * of which branch chose `at`.
 *
 * The other side needs no matching logic: the line being pushed past (the
 * non-empty branch) or the rest of the document after the consumed blank
 * line (the empty branch) still has its own trailing newline sitting exactly
 * where `body`'s own trailing newline meets it, and two newlines in a row is
 * one blank line, the same way Markdown always renders it.
 */
export function templateInsertion(
  source: string,
  cursorOffset: number,
  body: string,
): TemplateInsertion {
  const lineStart = source.lastIndexOf("\n", cursorOffset - 1) + 1;
  const nextBreak = source.indexOf("\n", cursorOffset);
  const lineEnd = nextBreak === -1 ? source.length : nextBreak;
  const currentLine = source.slice(lineStart, lineEnd);
  const atEmptyLine = currentLine.trim() === "";

  const at = atEmptyLine ? lineStart : lineEnd;
  const before = source.slice(0, at);
  const prefix = at === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  return { at, text: prefix + body };
}

/**
 * `templateInsertion`, verified against the one question that actually
 * matters: does the note that results **have** a VisiMark block afterwards?
 *
 * **A caret inside another fence swallows the template as literal text**
 * (CodeRabbit review of PR #267). `gate.test.ts` already pins that a
 * ```vmark fence inside a fenced code block does not open the gate — the
 * same rule that keeps the gate honest also means a caret on a blank line
 * *inside* someone's existing ~~~ or ``` block would insert the template
 * there, `locate` would never find it, and the command would report success
 * over a note with no working block at all.
 *
 * Rather than teach this module to recognise fence nesting itself — a
 * second parser for "is this position inside a fence", which is exactly the
 * kind of second definition `gate.ts`'s own header warns can disagree with
 * the engine's — this asks the engine's own gate whether the candidate
 * result actually has a block, and falls back to the end of the document
 * (never inside anything that closed before it) if it does not. `null`
 * means even that failed — an unclosed fence already swallowing the rest of
 * the note — and the caller should refuse rather than claim success.
 */
export function safeTemplateInsertion(
  source: string,
  cursorOffset: number,
  body: string,
): TemplateInsertion | null {
  const candidate = templateInsertion(source, cursorOffset, body);
  if (hasVmarkBlock(source.slice(0, candidate.at) + candidate.text + source.slice(candidate.at))) {
    return candidate;
  }
  if (cursorOffset === source.length) return null; // already tried the end; nothing left to fall back to
  const fallback = templateInsertion(source, source.length, body);
  const result = source.slice(0, fallback.at) + fallback.text + source.slice(fallback.at);
  return hasVmarkBlock(result) ? fallback : null;
}
