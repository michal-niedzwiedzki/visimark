/**
 * The view of a Markdown file the heuristic rules read: the same text with
 * every region that is not the document's own prose or tables blanked out —
 * fenced and indented code, HTML comments, front matter and blockquote lines
 * (spec §3.6). Every masked character becomes a space except `\n`, so the
 * masked text has the same length and the same line breaks as the original,
 * and an offset or a line number found in one view points at the same
 * characters in the other.
 *
 * The engine rules never read this view: `vmark` blocks are fenced code.
 */

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const BLOCKQUOTE = /^ {0,3}>/;
const INDENTED = /^( {4}|\t)/;
const BLANK = /^\s*$/;

export function maskMarkdown(text: string): string {
  const out = text.split("");
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to; i++) if (out[i] !== "\n") out[i] = " ";
  };

  // Lines with their offsets; a line's text excludes its `\n` but keeps a `\r`.
  const lines: { from: number; to: number; text: string }[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      lines.push({ from: start, to: i, text: text.slice(start, i).replace(/\r$/, "") });
      start = i + 1;
    }
  }

  let i = 0;
  // Front matter: a `---` first line, up to the next `---` or `...` line.
  if (lines[0]?.text === "---") {
    const end = lines.findIndex((l, k) => k > 0 && (l.text === "---" || l.text === "..."));
    if (end > 0) {
      blank(lines[0].from, lines[end]!.to);
      i = end + 1;
    }
  }

  let previousBlank = true;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const fence = FENCE_OPEN.exec(line.text);
    if (fence) {
      const marker = fence[1]!;
      const close = new RegExp(`^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`);
      let end = lines.length - 1; // an unclosed fence runs to the end of the file
      for (let k = i + 1; k < lines.length; k++) {
        if (close.test(lines[k]!.text)) {
          end = k;
          break;
        }
      }
      blank(line.from, lines[end]!.to);
      i = end;
      previousBlank = false;
      continue;
    }
    if (BLOCKQUOTE.test(line.text)) {
      blank(line.from, line.to);
    } else if (previousBlank && INDENTED.test(line.text) && !BLANK.test(line.text)) {
      // An indented code block runs while lines stay indented or blank.
      let end = i;
      for (let k = i; k < lines.length; k++) {
        const t = lines[k]!.text;
        if (INDENTED.test(t) || BLANK.test(t)) end = k;
        else break;
      }
      blank(line.from, lines[end]!.to);
      i = end;
    }
    previousBlank = BLANK.test(line.text);
  }

  // HTML comments, anywhere outside what is already masked.
  const masked = out.join("");
  const comment = /<!--[\s\S]*?(-->|$)/g;
  for (const m of masked.matchAll(comment)) blank(m.index, m.index + m[0].length);
  return out.join("");
}
