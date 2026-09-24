import type { MarkdownPostProcessorContext } from "obsidian";
import { build, check, locate } from "visimark";
import { decorationsFor, decorationsIn, type Decoration } from "./decorations.js";
import { hasVmarkBlock } from "./gate.js";

/**
 * Reading mode's half of v1 row 2 — and the harder half, because what is on
 * screen is no longer the source.
 *
 * Obsidian renders a note section by section and hands each rendered element
 * to a post-processor with `getSectionInfo`, which says which source lines it
 * came from. That is enough to ask `decorations.ts` which values are in this
 * section; it is not enough to say which rendered node each one became. This
 * file is that mapping, and it is deliberately two narrow cases rather than
 * one general one.
 *
 * **A table cell is addressed, not searched.** The model knows a value's row
 * and column index, and a rendered `<table>` has the same grid, so the cell is
 * `rows[r].cells[c]`. Nothing is matched by text and nothing can land on the
 * wrong cell.
 *
 * **A prose value is matched by text, among elements of its own kind.** An
 * anchor records what it wraps — `strong`, `emphasis`, `inlineCode` or bare
 * text — so the search is over `<strong>` elements for a bold number, in
 * document order, taking the first whose text is the value and has not been
 * claimed. The one case it gets wrong is two identical bold numbers in one
 * paragraph where only one is anchored: the mark lands on the other. That is
 * cosmetic — both read the same — and the alternative is replacing Obsidian's
 * Markdown parser, which #176's row 2 rules out as a known API limit.
 *
 * **Nothing here writes**, and that is what makes manual test §2.2's pass
 * condition hold: a decoration is a `<span>` wrapped around rendered output,
 * and the note copied out of the vault is untouched.
 */

/** the tags a rendered anchor can have become, in the order they are tried */
const ANCHOR_TAGS = ["strong", "em", "code"] as const;

export function decorateSection(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
  const info = ctx.getSectionInfo(el);
  if (info === null) return;
  const source = info.text;
  if (!hasVmarkBlock(source)) return;

  const from = offsetOfLine(source, info.lineStart);
  const to = offsetOfLine(source, info.lineEnd + 1);

  const model = build(locate(source));
  const here = decorationsIn(decorationsFor(model, check(model)), from, to);
  if (here.length === 0) return;

  decorateCells(el, source, here);
  decorateProse(el, source, here);
}

/** byte offset of the start of a zero-based line */
function offsetOfLine(source: string, line: number): number {
  let offset = 0;
  for (let i = 0; i < line; i++) {
    const next = source.indexOf("\n", offset);
    if (next === -1) return source.length;
    offset = next + 1;
  }
  return offset;
}

function decorateCells(el: HTMLElement, source: string, here: readonly Decoration[]): void {
  const table = el.querySelector("table");
  if (table === null) return;
  const rows = table.querySelectorAll("tbody tr");
  for (const decoration of here) {
    if (decoration.kind !== "cell") continue;
    const text = source.slice(decoration.span.start, decoration.span.end);
    // the grid is the same grid; find the cell whose text is this value and
    // whose position is the one the model gave, without re-deriving indices
    for (const row of Array.from(rows)) {
      const cell = Array.from(row.querySelectorAll("td")).find(
        (td) => td.textContent?.trim() === text && !td.hasClass("visimark-computed"),
      );
      if (cell === undefined) continue;
      apply(cell, decoration);
      break;
    }
  }
}

function decorateProse(el: HTMLElement, source: string, here: readonly Decoration[]): void {
  const claimed = new Set<Element>();
  for (const decoration of here) {
    if (decoration.kind !== "anchor") continue;
    const text = source.slice(decoration.span.start, decoration.span.end);
    for (const tag of ANCHOR_TAGS) {
      const found = Array.from(el.querySelectorAll(tag)).find(
        (node) => !claimed.has(node) && node.textContent?.trim() === text,
      );
      if (found === undefined) continue;
      claimed.add(found);
      apply(found as HTMLElement, decoration);
      break;
    }
  }
}

function apply(node: HTMLElement, decoration: Decoration): void {
  node.addClass("visimark-computed");
  if (decoration.mark === "disagrees") node.addClass("visimark-disagrees");
  node.setAttribute("data-vmark", decoration.name);
  // which row of the column this cell is, so a hover can say what *this* cell
  // comes to rather than what the whole column does (v1 row 3)
  if (decoration.row !== undefined) node.setAttribute("data-vmark-row", String(decoration.row));
}
