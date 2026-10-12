import { decorationsFor, type Decoration } from "../../codemirror-visimark/src/decorations.js";
import type { Pass } from "./pass.js";
import type { Attr, Token, TokenCtor } from "./types.js";

/**
 * Apply the marks `decorationsFor` lists to a **copy** of a token stream
 * (spec §2.4, §2.6). The host's array and tokens are never written: a touched
 * `inline` token is cloned with a new `children` array, a touched child is
 * cloned with its own `attrs`, and the wrapping `<span>`s are new
 * `visimark_open` / `visimark_close` tokens that markdown-it's default
 * `renderToken` renders.
 *
 * A decoration is placed only where the rendered text equals the source text
 * of its span. Anything else — a value another plugin rewrote, a table the
 * engine read from a CSV — is skipped, never placed on a neighbour.
 */

interface Span {
  start: number;
  end: number;
}

function lineStarts(source: string): number[] {
  const out = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") out.push(i + 1);
  return out;
}

function lineOf(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function clone(t: Token): Token {
  const c = Object.assign(Object.create(Object.getPrototypeOf(t) as object), t) as Token;
  c.attrs = t.attrs ? t.attrs.map((a): Attr => [a[0], a[1]]) : null;
  return c;
}

function mark(t: Token, d: Decoration, path: string | null): void {
  t.attrSet(
    "class",
    d.mark === "disagrees" ? "visimark-computed visimark-disagrees" : "visimark-computed",
  );
  t.attrSet("data-vmark", d.name);
  if (d.kind === "cell") t.attrSet("data-vmark-row", String(d.row));
  if (path !== null) t.attrSet("data-vmark-path", path);
}

function wrap(Tok: TokenCtor, d: Decoration, path: string | null): [Token, Token] {
  const open = new Tok("visimark_open", "span", 1);
  mark(open, d, path);
  return [open, new Tok("visimark_close", "span", -1)];
}

export function place(
  tokens: Token[],
  source: string,
  pass: Pass,
  path: string | null,
  Tok: TokenCtor,
): Token[] {
  const decorations = decorationsFor(pass.model, pass.result).filter(
    (d) => !pass.withheld.has(d.name),
  );
  if (decorations.length === 0) return tokens;

  const starts = lineStarts(source);
  const text = (s: Span): string => source.slice(s.start, s.end);

  // Anchors, in document order, each still waiting for its comment token.
  const byValue = new Map<number, Decoration>();
  for (const d of decorations) if (d.kind === "anchor") byValue.set(d.span.start, d);
  // Every located anchor takes part in matching, marked or not (spec §2.4:
  // the kth comment is the kth located anchor), so a refused or image anchor
  // consumes its own comment instead of a later one with the same text.
  const anchors = pass.model.located.anchors.map((a) => ({
    comment: text(a.commentSpan),
    line: lineOf(starts, a.commentSpan.start),
    d: a.value === null ? undefined : byValue.get(a.value.start),
    done: false,
  }));

  // Cells, by the source line of the document table they sit in. A sheet
  // whose table came from a CSV is not in `located.tables` and is skipped.
  const documentTables = new Set(pass.model.located.tables);
  const cellsAt = new Map<number, { d: Decoration; source: string }[]>();
  for (const sheet of pass.model.sheets.values()) {
    const table = sheet.table;
    if (table === null || !documentTables.has(table)) continue;
    const line = lineOf(starts, table.span.start);
    const list = cellsAt.get(line) ?? [];
    for (const d of decorations) {
      if (d.kind !== "cell") continue;
      const cell = table.rows[d.row!]?.cells[d.column!];
      if (cell === undefined || cell.start !== d.span.start || cell.cellSpan === undefined)
        continue;
      list.push({ d, source: text(cell.cellSpan) });
    }
    cellsAt.set(line, list);
  }

  const out = tokens.slice();
  let range: [number, number] | null = null;
  let cells: { d: Decoration; source: string }[] | null = null;
  let inBody = false;
  let row = -1;
  let column = -1;

  for (let i = 0; i < out.length; i++) {
    const t = out[i]!;
    if (t.map !== null && t.nesting === 1) range = t.map;
    switch (t.type) {
      case "table_open":
        cells = t.map === null ? null : (cellsAt.get(t.map[0]) ?? null);
        inBody = false;
        row = -1;
        continue;
      case "table_close":
        cells = null;
        continue;
      case "tbody_open":
        inBody = true;
        continue;
      case "tr_open":
        if (inBody) row++;
        column = -1;
        continue;
      case "td_open":
      case "th_open":
        column++;
        continue;
      case "inline":
        break;
      default:
        continue;
    }

    let owned: Token | null = null;
    const own = (): Token => {
      if (owned === null) {
        owned = clone(t);
        owned.children = (t.children ?? []).slice();
        out[i] = owned;
      }
      return owned;
    };

    if (cells !== null && inBody && out[i - 1]?.type === "td_open") {
      const hit = cells.find((c) => c.d.row === row && c.d.column === column);
      if (hit !== undefined && hit.source === t.content.trim()) {
        const c = own();
        const [open, close] = wrap(Tok, hit.d, path);
        c.children = [open, ...c.children!, close];
      }
    }

    if (range === null) continue;
    const [from, to] = range;
    for (const comment of t.children ?? []) {
      if (comment.type !== "html_inline") continue;
      const a = anchors.find(
        (x) => !x.done && x.comment === comment.content && x.line >= from && x.line < to,
      );
      if (a === undefined) continue;
      a.done = true;
      if (a.d === undefined) continue;
      const want = text(a.d.span);
      const children = own().children!;
      let j = children.indexOf(comment) - 1;
      while (j >= 0 && children[j]!.type === "text" && children[j]!.content === "") j--;
      const prev = children[j];
      if (prev === undefined) continue;
      const kind = a.d.anchorKind;
      if (
        (kind === "strong" && prev.type === "strong_close") ||
        (kind === "emphasis" && prev.type === "em_close")
      ) {
        const openType = kind === "strong" ? "strong_open" : "em_open";
        let o = j - 1;
        while (o >= 0 && children[o]!.type !== openType) o--;
        if (o < 0) continue;
        const inner = children
          .slice(o + 1, j)
          .map((x) => x.content)
          .join("");
        if (inner !== want) continue;
        const opened = clone(children[o]!);
        mark(opened, a.d, path);
        children[o] = opened;
      } else if (kind === "inlineCode" && prev.type === "code_inline") {
        if (prev.content !== want) continue;
        const code = clone(prev);
        mark(code, a.d, path);
        children[j] = code;
      } else if (kind === "text" && prev.type === "text" && prev.content.endsWith(want)) {
        const before = clone(prev);
        before.content = prev.content.slice(0, prev.content.length - want.length);
        const value = clone(prev);
        value.content = want;
        const [open, close] = wrap(Tok, a.d, path);
        children.splice(j, 1, ...(before.content === "" ? [] : [before]), open, value, close);
      }
    }
  }
  return out;
}
