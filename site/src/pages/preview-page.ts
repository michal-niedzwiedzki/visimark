/**
 * docs/preview.html — one `docs/*.md` shown as source and preview, for a
 * pasted link to render something.
 *
 * 70 lines of inline `<script>` until the follow-up review's §2.3. The §2.6
 * injection half does not apply here and did not before the move: `?file=` is
 * validated against a bare-filename pattern *before* it is fetched or
 * interpolated, which is what §2.3 credited this page for.
 */

import { byId, escapeHtml } from "./dom.js";

const DEFAULT_FILE = "example-ci-sharding.md";
const REPO_BLOB = "https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/";

/** Only a bare filename in this directory is ever fetched — an arbitrary path
 *  could escape docs/ or point off-site. */
const SAFE_NAME = /^[A-Za-z0-9_-]+\.md$/;

function start(): void {
  const params = new URLSearchParams(window.location.search);
  const file = params.get("file") ?? DEFAULT_FILE;
  const highlight = params.get("highlight") === "1";

  const sourceLabelEl = byId("source-label");
  const sourceLinkEl = byId("source-link");
  const sourceEl = byId("doc-source");
  const previewEl = byId("doc-preview");
  const demoEl = byId("doc-demo");
  const highlightEl = byId("doc-highlight");
  const errorEl = byId("doc-error");
  if (!sourceEl || !previewEl || !errorEl) return;

  const showError = (message: string): void => {
    errorEl.textContent = message;
    errorEl.hidden = false;
  };

  if (!SAFE_NAME.test(file)) {
    showError(`Unrecognised ?file= value: ${file}`);
    return;
  }

  /**
   * With `?highlight=1`, repeat the document's last "## " section — its
   * closing rationale — above the source/preview panes, rendered as a heading
   * and prose rather than shown as raw Markdown.
   */
  const renderHighlight = (raw: string): void => {
    if (!highlightEl) return;
    const lines = raw.split("\n");
    let start = -1;
    lines.forEach((line, i) => {
      if (line.startsWith("## ")) start = i;
    });
    if (start === -1) return;
    const section = lines.slice(start).join("\n").trim();
    highlightEl.innerHTML = typeof marked === "undefined" ? section : marked.parse(section);
    highlightEl.hidden = false;
  };

  if (sourceLabelEl) sourceLabelEl.textContent = `docs/${file}`;
  if (sourceLinkEl) {
    sourceLinkEl.innerHTML =
      `View on GitHub: <a href="${REPO_BLOB}${escapeHtml(file)}" target="_blank" ` +
      `rel="noopener">docs/${escapeHtml(file)}</a>`;
  }

  fetch(file)
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.text();
    })
    .then((raw) => {
      document.title = `VisiMark — ${file}`;
      sourceEl.textContent = raw;
      previewEl.innerHTML = typeof marked === "undefined" ? raw : marked.parse(raw);
      if (highlight) renderHighlight(raw);
      if (demoEl) demoEl.hidden = false;
    })
    .catch((err: unknown) => {
      showError(`Could not load docs/${file} (${(err as Error).message}).`);
    });
}

start();
