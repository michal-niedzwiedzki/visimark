/**
 * Fetching the Markdown a page renders, and saying so when it does not arrive.
 *
 * `ci.html` and `tutorial.html` are both a `<dialog>` table of contents over a
 * fetched Markdown file, and both carried their own copy of this — including
 * the `file://` paragraph, word for word, in two places. It is the one piece
 * of copy on these pages a reader is most likely to meet, so it is worth
 * having one of.
 */

import { escapeHtml } from "./dom.js";

/**
 * Fetches `path`, or throws with the path in the message.
 *
 * Nothing here swallows the failure: what to do about it is a property of the
 * page (see `explainFailure`), not of the fetch — the same split
 * ../playground/app/sources.ts makes for the playground's documents.
 */
export async function fetchDocument(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

/**
 * The note a page shows in place of the document it could not load.
 *
 * It names three things, in this order: what failed, that the page needs a
 * server (by far the likeliest cause — `fetch()` of a sibling file is blocked
 * over `file://` by CORS), and that the document itself is plain Markdown and
 * reads perfectly well without this page. The last one matters: this is a
 * presentation layer over a file that is already readable, and a reader who
 * hits this should leave with the content rather than with an apology.
 */
export function explainFailure(path: string, what: string, error: unknown): string {
  const reason = escapeHtml(String((error as Error)?.message ?? error));
  return (
    `<p class="note">Could not load <code>${escapeHtml(path)}</code>: ${reason}.<br><br>` +
    "This page has to be served over http(s) — <code>bun run serve</code> from a clone, " +
    "or GitHub Pages. Opening it from <code>file://</code> is blocked by the browser.<br><br>" +
    `The ${what} itself is plain Markdown and reads fine without this page: ` +
    `<a href="${escapeHtml(path)}">${escapeHtml(path)}</a>.</p>`
  );
}
