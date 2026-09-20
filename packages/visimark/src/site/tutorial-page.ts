/**
 * docs/tutorial.html — `tutorial.md` shown as source and rendered output, side
 * by side, one top-level block at a time.
 *
 * 183 lines of inline `<script>` until the follow-up review's §2.3. See
 * docs/design/playground-site-modules-plan.md.
 */

import { byId, escapeHtml, slugify } from "./dom.js";
import { createToc, scrollToHash } from "./toc.js";
import { explainFailure, fetchDocument } from "./source-document.js";
import { splitBlocks } from "./blocks.js";

const SOURCE = "tutorial.md";
const MODE_STORAGE_KEY = "visimark-tutorial-mode";

function render(md: string): void {
  const main = byId("doc");
  if (!main) return;
  const toc = createToc();
  main.textContent = "";

  for (const block of splitBlocks(md)) {
    const head = /^(#{1,6})\s+(.*)$/.exec(block);
    let id: string | null = null;
    if (head) {
      id = slugify(head[2]!);
      toc.add(head[2]!, id, head[1]!.length);
    }

    const src = document.createElement("pre");
    src.className = "src";
    src.innerHTML = escapeHtml(block);

    const out = document.createElement("div");
    out.className = "out";
    out.innerHTML = marked.parse(block);
    if (id && out.firstElementChild) out.firstElementChild.id = id;

    main.appendChild(src);
    main.appendChild(out);
  }

  scrollToHash();
}

/** Source-only / rendered-only / both, remembered per visitor. */
function wireModes(): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(".modes button")];
  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      document.body.dataset.mode = btn.dataset.set;
      for (const b of buttons) b.setAttribute("aria-pressed", String(b === btn));
      try {
        localStorage.setItem(MODE_STORAGE_KEY, btn.dataset.set ?? "");
      } catch {
        // Private mode, blocked storage — the default view is fine.
      }
    });
  }

  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    if (saved) buttons.find((b) => b.dataset.set === saved)?.click();
  } catch {
    // As above: the preference is a convenience, not a requirement.
  }
}

wireModes();

fetchDocument(SOURCE)
  .then(render)
  .catch((err: unknown) => {
    const main = byId("doc");
    if (main) main.innerHTML = explainFailure(SOURCE, "tutorial", err);
  });
