import type { MarkdownPostProcessorContext } from "obsidian";
import type { AnchorTargetKind } from "visimark";
import { analyse } from "./analysis.js";
import { decorationsIn, type Decoration } from "./decorations.js";
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
 * **A table cell is addressed, not searched.** `Decoration.row` and
 * `Decoration.column` are the same indices `sheet.columnIndex` and
 * `table.rows` gave the engine, and a rendered `<table>`'s `tbody tr`s and
 * their `<td>`s share that grid — one `<td>` per source column, in order — so
 * the cell is `rows[row].cells[column]`. A ragged row is the author's and is
 * never decorated (`decorations.ts`), so this never indexes past a row's own
 * cells. Nothing is matched by text, so two cells with the same digits (an
 * input that happens to equal a computed column) cannot swap marks.
 *
 * **A prose value is matched by text, among elements of its own kind.** An
 * anchor records what it wraps — `strong`, `emphasis`, `inlineCode` or bare
 * text — as `Decoration.anchorKind`, so the search is over `<strong>`
 * elements for a bold number and nothing else, in document order, taking the
 * first whose text is the value and has not been claimed. A bare-text anchor
 * has no wrapping element to search for, so its matched text is wrapped in a
 * `<span>` instead of an existing tag. The one case this still gets wrong is
 * two identical numbers of the *same* kind in one paragraph where only one is
 * anchored: the mark lands on the other. That is cosmetic — both read the
 * same — and the alternative is replacing Obsidian's Markdown parser, which
 * #176's row 2 rules out as a known API limit.
 *
 * **Nothing here writes**, and that is what makes manual test §2.2's pass
 * condition hold: a decoration is a `<span>` wrapped around rendered output,
 * and the note copied out of the vault is untouched.
 */

/** the tag a rendered anchor of each kind becomes, or `null` for bare text */
const ANCHOR_TAG: Partial<Record<AnchorTargetKind, string>> = {
  strong: "strong",
  emphasis: "em",
  inlineCode: "code",
};

export function decorateSection(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
  const info = ctx.getSectionInfo(el);
  if (info === null) return;
  const source = info.text;
  if (!hasVmarkBlock(source)) return;

  const from = offsetOfLine(source, info.lineStart);
  const to = offsetOfLine(source, info.lineEnd + 1);

  // `info.text` is the whole note, the same string for every section of one
  // render — `analyse` runs `locate` + `build` + `check` + `decorationsFor`
  // once per note per render instead of once per section (review row 5)
  const { decorations } = analyse(source);
  const here = decorationsIn(decorations, from, to);
  if (here.length === 0) return;

  decorateCells(el, here, ctx.sourcePath);
  decorateProse(el, source, here, ctx.sourcePath);
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

function decorateCells(el: HTMLElement, here: readonly Decoration[], path: string): void {
  const table = el.querySelector("table");
  if (table === null) return;
  const rows = table.querySelectorAll("tbody tr");
  for (const decoration of here) {
    if (
      decoration.kind !== "cell" ||
      decoration.row === undefined ||
      decoration.column === undefined
    )
      continue;
    const row = rows[decoration.row];
    const cell = row?.querySelectorAll("td")[decoration.column];
    if (cell === undefined) continue;
    apply(cell, decoration, path);
  }
}

function decorateProse(
  el: HTMLElement,
  source: string,
  here: readonly Decoration[],
  path: string,
): void {
  const claimed = new Set<Node>();
  for (const decoration of here) {
    if (decoration.kind !== "anchor") continue;
    const text = source.slice(decoration.span.start, decoration.span.end);
    const tag = decoration.anchorKind !== undefined ? ANCHOR_TAG[decoration.anchorKind] : undefined;
    if (tag !== undefined) {
      const found = Array.from(el.querySelectorAll(tag)).find(
        (node) => !claimed.has(node) && node.textContent?.trim() === text,
      );
      if (found === undefined) continue;
      claimed.add(found);
      apply(found as HTMLElement, decoration, path);
      continue;
    }
    // a bare number has no wrapping element of its own kind to search among,
    // so the matched run of a text node is wrapped in one instead
    const span = wrapText(el, text, claimed);
    if (span !== null) apply(span, decoration, path);
  }
}

/**
 * Find `text` in an unclaimed text node under `el` and wrap the matching run
 * in a `<span>`, so it has something to carry the mark's class and attributes
 * — a bare number in prose is not itself an element.
 */
function wrapText(el: HTMLElement, text: string, claimed: Set<Node>): HTMLElement | null {
  const doc = el.doc;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (claimed.has(node)) continue;
    const content = node.textContent ?? "";
    const at = content.indexOf(text);
    if (at === -1) continue;
    const range = doc.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + text.length);
    const span = doc.createElement("span");
    range.surroundContents(span);
    // `surroundContents` splits `node` into up to three text nodes and
    // leaves the matched run as `span`'s child, a new node distinct from
    // `node` — claiming that child, not `node`, lets a later identical
    // bare-text anchor still match the unmarked remainder of the original
    if (span.firstChild !== null) claimed.add(span.firstChild);
    return span;
  }
  return null;
}

function apply(node: HTMLElement, decoration: Decoration, path: string): void {
  node.addClass("visimark-computed");
  if (decoration.mark === "disagrees") node.addClass("visimark-disagrees");
  node.setAttribute("data-vmark", decoration.name);
  // the note this mark belongs to, so a hover or tap in a background pane
  // explains *this* note rather than whichever one is focused (v1 row 3)
  node.setAttribute("data-vmark-path", path);
  // which row of the column this cell is, so a hover can say what *this* cell
  // comes to rather than what the whole column does (v1 row 3)
  if (decoration.row !== undefined) node.setAttribute("data-vmark-row", String(decoration.row));
  // reachable by keyboard, not only by pointer — main.ts answers Enter/Space
  // on a marked value the same way it answers a click
  node.setAttribute("tabindex", "0");
}
