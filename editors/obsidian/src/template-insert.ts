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
 * **The line the caret is on decides everything.** An empty line (blank, or
 * only whitespace) needs no padding of its own: whatever precedes it already
 * separates it, and the template is inserted right there. Any other line —
 * mid-word, mid-sentence, anywhere with real text on it — gets pushed past
 * entirely: the insertion point becomes the end of that line, preceded by a
 * blank line of its own so the template never shares a line with existing
 * prose. What follows the insertion point needs no matching padding added by
 * hand: the line being pushed past still has its own trailing newline sitting
 * exactly where `body`'s own trailing newline meets it, and two newlines in a
 * row is one blank line, the same way Markdown always renders it.
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
  const prefix = atEmptyLine ? "" : "\n\n";
  return { at, text: prefix + body };
}
