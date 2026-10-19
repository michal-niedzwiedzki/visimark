/**
 * Reading the `docs/` HTML pages as text, for the tests that check what those
 * pages declare (the CSP, the social cards, the shared type stacks).
 */

/**
 * `source` with its HTML comments removed.
 *
 * Every page in `docs/` explains itself in comments, and several of them
 * quote the markup they are discussing — the `<script>` review §2.4 took out,
 * the `og:` keys, the `unescape` call §2.12 replaced. A grep that cannot tell
 * an explanation from the thing it describes reads those as the thing coming
 * back.
 *
 * **Applied until it stops changing**, rather than once. A single pass leaves
 * `<!--` behind whenever a comment's text contains one — which these
 * comments, being about markup, can — and that is CodeQL's
 * `js/incomplete-multi-character-sanitization`. Nothing here is a sanitizer
 * (the input is a file in this repository and the output is only ever matched
 * against, never rendered), but "strip until there are none left" is both the
 * fix and what the callers actually mean.
 */
export function withoutComments(source: string): string {
  let out = source;
  for (;;) {
    const next = out.replace(/<!--[\s\S]*?-->/g, "");
    if (next === out) return out;
    out = next;
  }
}
