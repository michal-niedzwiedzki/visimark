/**
 * docs/mcp-server.html — `mcp-server.md` rendered with a contents dialog over
 * it. A copy of ci-page.ts pointed at a different source file; see
 * docs/design/playground-site-modules-plan.md for why the pages share this
 * shape rather than each carrying its own copy.
 */

import { byId, slugify } from "./dom.js";
import { createToc, scrollToHash } from "./toc.js";
import { explainFailure, fetchDocument } from "./source-document.js";

const SOURCE = "mcp-server.md";

function render(md: string): void {
  const main = byId("doc");
  if (!main) return;
  const toc = createToc();
  main.innerHTML = marked.parse(md);

  // Headings carry no id of their own, so give each one a slug and build the
  // contents list from the same pass. A duplicate heading text gets a numeric
  // suffix rather than a second element sharing an id, which would make one of
  // the two links unreachable.
  const seen = new Map<string, number>();
  main.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6").forEach((h) => {
    const base = slugify(h.textContent ?? "");
    const taken = seen.get(base) ?? 0;
    const id = taken ? `${base}-${taken}` : base;
    seen.set(base, taken + 1);
    h.id = id;
    toc.add(h.textContent ?? "", id, Number(h.tagName.slice(1)));
  });

  scrollToHash();
}

fetchDocument(SOURCE)
  .then(render)
  .catch((err: unknown) => {
    const main = byId("doc");
    if (main) main.innerHTML = explainFailure(SOURCE, "guide", err);
  });
