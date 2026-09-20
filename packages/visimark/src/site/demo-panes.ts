/**
 * The landing page's source/preview pairs.
 *
 * Each one renders an inline Markdown snippet with `marked` and keeps the two
 * panes' scroll positions in lockstep. The snippets are curated excerpts and
 * variants for the page's narrative (e.g. the infer before/after pair), not
 * verbatim copies of `docs/*.md`, so they stay in the markup as
 * `<script type="text/plain">` data blocks even though index.html now lives
 * alongside docs/ and could fetch real files — see the chart images, which do.
 */

/**
 * Removes the common leading whitespace from every non-blank line.
 *
 * The formatter indents everything inside a tag by its nesting depth, so an
 * embedded Markdown block never starts at column 0 — and Markdown treats 4+
 * leading spaces as an indented code block. Without this, every demo on the
 * page renders as one giant code block instead of parsed Markdown.
 */
export function dedent(text: string): string {
  const lines = text.split("\n");
  let indent = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    indent = Math.min(indent, /^[ \t]*/.exec(line)![0].length);
  }
  if (!Number.isFinite(indent)) indent = 0;
  return lines.map((line) => line.slice(indent)).join("\n");
}

/** Lockstep scroll: moving either pane scrolls the other by the same fraction
 *  of its own scrollable range. The playground's EDITOR/PREVIEW pair does the
 *  same thing (see pipeline.ts) — CodeMirror just has its own scroll API. */
function link(from: HTMLElement, to: HTMLElement, state: { from: HTMLElement | null }): void {
  from.addEventListener("scroll", () => {
    if (state.from && state.from !== from) return;
    state.from = from;
    const range = from.scrollHeight - from.clientHeight;
    const ratio = range > 0 ? from.scrollTop / range : 0;
    to.scrollTop = ratio * (to.scrollHeight - to.clientHeight);
    requestAnimationFrame(() => {
      state.from = null;
    });
  });
}

/**
 * Fills one source/preview pair from the `<script type="text/plain">` block
 * named by `mdId`.
 *
 * A page missing any of the three elements simply has no such demo, which is
 * how the shared entry point can render every one of them unconditionally.
 */
export function renderDemo(sourceId: string, previewId: string, mdId: string): void {
  const sourceEl = document.getElementById(sourceId);
  const previewEl = document.getElementById(previewId);
  const mdEl = document.getElementById(mdId);
  if (!sourceEl || !previewEl || !mdEl || typeof marked === "undefined") return;

  const raw = dedent((mdEl.textContent ?? "").replace(/^\n/, "")).replace(/\s+$/, "");
  sourceEl.textContent = raw;
  previewEl.innerHTML = marked.parse(raw);

  const state: { from: HTMLElement | null } = { from: null };
  link(sourceEl, previewEl, state);
  link(previewEl, sourceEl, state);
}
