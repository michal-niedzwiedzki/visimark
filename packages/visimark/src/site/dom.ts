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

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
