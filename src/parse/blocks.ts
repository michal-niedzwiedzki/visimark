export interface RawBinding {
  /** the binding text with surrounding whitespace and any trailing `#` comment removed */
  raw: string;
  /** absolute byte offset into the source where `raw` begins */
  start: number;
  /** absolute byte offset into the source where `raw` ends */
  end: number;
}

/**
 * Split a `vmark` fence body into bindings. `#` starts a line comment (outside a
 * string). Blank lines are dropped. Offsets are absolute into the source.
 */
export function splitBindings(body: string, bodyStart: number): RawBinding[] {
  const out: RawBinding[] = [];
  let lineStart = 0;
  const lines = body.split("\n");
  for (const line of lines) {
    const codeEnd = commentStart(line);
    const code = line.slice(0, codeEnd);
    const leading = code.length - code.trimStart().length;
    const trimmed = code.trim();
    if (trimmed.length > 0) {
      const start = bodyStart + lineStart + leading;
      out.push({ raw: trimmed, start, end: start + trimmed.length });
    }
    lineStart += line.length + 1; // + newline
  }
  return out;
}

/** index of the `#` that starts a comment, or the line length if there is none */
function commentStart(line: string): number {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') inStr = !inStr;
    else if (c === "#" && !inStr) return i;
  }
  return line.length;
}
