/**
 * The one place in `site/` where a string of HTML becomes DOM nodes, and so
 * the one statement of the site's trust boundary.
 *
 * **What reaches `setTrustedHtml` today is trusted.** Every string passed in
 * is either the visitor's own typing (the playground's CodeMirror buffer, fed
 * to the PREVIEW panel) or markup built from a document committed to this
 * repository and served from this origin: a `<script type="text/plain">`
 * block in a page, a file fetched by name from `docs/`, or this bundle's own
 * constants. Putting content into any of those already takes commit access,
 * so unsanitized Markdown here is self-XSS at worst. Sanitizing would also
 * cost the preview the inline HTML that Markdown legitimately allows. Note
 * that the playground's `?file=` is not an exception: it selects from
 * FILE_SOURCES by name and cannot carry content.
 *
 * **It becomes a real boundary the moment content reaches it from anywhere
 * the reader is not**: a document in the URL, an import from a gist, a paste
 * target, a shared workspace — anything written by one person and rendered
 * for another. The commit that adds such a path puts a sanitizer inside this
 * function, on that same commit. Until then each page's Content-Security-Policy
 * is the second lock: `script-src` admits only this origin and cdnjs, so markup
 * from here cannot run inline script, and index.html grants no `connect-src`
 * at all because it fetches nothing.
 *
 * **This is not a sanitizer, and it is not safer than `innerHTML`.** It
 * exists because the Obsidian community scanner lints this whole repository
 * and flags every `innerHTML` assignment (`no-unsanitized/property`); the
 * nodes `DOMParser` produces carry exactly the markup `innerHTML` would have
 * inserted. What it buys is that every caller is named in one test
 * (`site/test/html-callers.test.ts`), which a new caller has to be added to
 * on purpose.
 *
 * **It parses as `<body>` content**, not in the target element's context the
 * way `innerHTML` does. A fragment that only parses inside a table or a
 * `<select>` — bare `<tr>`, `<td>` or `<option>` — is dropped. Pass whole
 * structures (`<table>…</table>`), never such fragments.
 */

/**
 * `s` with the four characters that change how markup parses replaced.
 *
 * **Including the double quote.** Some callers put the result in *attribute*
 * position (`source-document.ts`'s `<a href="…">`), where an unescaped quote
 * closes the attribute. An escape helper that is safe only in the context its
 * first caller happened to use is a trap for the second. This was two
 * identical copies, one per bundle (`pages/dom.ts`, `playground/dom.ts`),
 * until #402.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replaces `el`'s children with the nodes `html` parses to, as `<body>`
 *  content. Read the module comment before adding a caller. */
export function setTrustedHtml(el: Element, html: string): void {
  el.replaceChildren(...new DOMParser().parseFromString(html, "text/html").body.childNodes);
}
