/**
 * docs/tutorial.html — side-by-side view mode switching and TOC wiring.
 *
 * The page itself is pre-rendered at build time by gen-docs.ts, so this
 * script only handles interactivity: the TOC dialog and mode switching.
 */

import { createToc, scrollToHash } from "./toc.js";

const MODE_STORAGE_KEY = "visimark-tutorial-mode";

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
createToc();
scrollToHash();
