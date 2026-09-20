/**
 * Element lookup and the two text helpers every page in `docs/` needs.
 *
 * Deliberately *not* ../playground/app/dom.ts. That module's `byId` throws on
 * a miss, which is right for the playground — it is one page, every id it asks
 * for is in that page's markup, and a miss means the bundle and the markup
 * disagree. These pages are the opposite case: much of what they reach for is
 * optional (a diagram that only index.html carries, a TOC that only the long
 * documents have), so a miss is a page that does not have that feature rather
 * than a bug, and the shape that suits them is one that returns null.
 */

/** `document.getElementById`, typed, returning null for a page that does not
 *  carry the element. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * `s` with the four characters that change how markup parses replaced.
 *
 * **Including the double quote**, which the four pages' own copies of this did
 * not — they only covered `&`, `<` and `>`, because every one of them was
 * written for text content. Moving them here gave the function callers in
 * *attribute* position (`source-document.ts`'s `<a href="…">`,
 * `preview-page.ts`'s GitHub link), where an unescaped quote closes the
 * attribute. Neither is reachable today — one path is a module constant and
 * the other is validated against a bare-filename pattern first — but an
 * escape helper that is safe only in the context its first caller happened to
 * use is a trap for the second. ../playground/app/dom.ts has escaped the
 * quote since it was written; this now matches it.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A heading's text as an anchor fragment. Both long-document pages built
 *  their own copy of this before the scripts moved here. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
