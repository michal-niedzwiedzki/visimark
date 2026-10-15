/**
 * Splitting a Markdown document into the top-level blocks tutorial.html shows
 * side by side.
 *
 * Its own module rather than part of ../site/tutorial-page.ts, because that
 * file is an entry point: importing it runs the page. This is the one piece of
 * real parsing on the site — a CommonMark fence rule implemented by hand —
 * and it is worth being able to test without a browser.
 */

interface Fence {
  char: string;
  len: number;
}

/**
 * Splits Markdown into top-level blocks.
 *
 * A block ends at a blank line, except inside a fenced code block — and fences
 * nest here for real, because the tutorial shows ```vmark blocks inside
 * ````markdown examples. A closing fence must use the same character, be at
 * least as long as the opening one, and carry no info string, which is
 * CommonMark's rule.
 */
export function splitBlocks(md: string): string[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  let fence: Fence | null = null;

  const flush = (): void => {
    if (cur.join("").trim() !== "") blocks.push(cur.join("\n"));
    cur = [];
  };

  for (const line of lines) {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);

    if (fence) {
      cur.push(line);
      if (m && m[1]![0] === fence.char && m[1]!.length >= fence.len && m[2]!.trim() === "") {
        fence = null;
        flush();
      }
      continue;
    }
    if (m) {
      flush();
      fence = { char: m[1]![0]!, len: m[1]!.length };
      cur.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      cur.push(line);
      flush();
      continue;
    }
    cur.push(line);
  }
  flush();
  return blocks;
}
