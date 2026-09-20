/**
 * The `<dialog>` table of contents `ci.html` and `tutorial.html` share.
 *
 * Both pages had their own copy, identical down to the two comments explaining
 * why the backdrop click works and why the dialog closes before it scrolls.
 * One copy now, which is the point of the scripts being somewhere a module
 * boundary exists at all.
 */

import { byId } from "./dom.js";

export interface Toc {
  /** Appends a link for a heading the renderer has just given an id to. */
  add(text: string, id: string, level: number): void;
}

/**
 * Wires the TOC button, the dialog and its link list.
 *
 * A page with no `#toc` gets an inert `Toc` rather than an error: the wiring
 * is optional in the same way `byId` returning null is.
 */
export function createToc(): Toc {
  const toc = byId<HTMLDialogElement>("toc");
  const list = byId("toc-list");
  const openBtn = byId("toc-btn");
  const closeBtn = byId("toc-close");
  if (!toc || !list) return { add: () => {} };

  openBtn?.addEventListener("click", () => toc.showModal());
  closeBtn?.addEventListener("click", () => toc.close());

  // Clicking the backdrop closes it: a click on the dialog itself lands on
  // .toc-inner, which fills the box, so an event whose target is the dialog
  // came from outside that box.
  toc.addEventListener("click", (e) => {
    if (e.target === toc) toc.close();
  });

  // Close first, then scroll. Letting the hash navigation happen while the
  // dialog is still open scrolls behind it and leaves it covering what the
  // reader just asked to see.
  list.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href^='#']");
    if (!link) return;
    e.preventDefault();
    const id = link.getAttribute("href")!.slice(1);
    toc.close();
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  });

  return {
    add(text, id, level) {
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.dataset.level = String(level);
      link.textContent = text;
      list.appendChild(link);
    },
  };
}

/** Scrolls to whatever the address bar's fragment names, once the document it
 *  names has actually been rendered. */
export function scrollToHash(): void {
  if (!location.hash) return;
  document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
