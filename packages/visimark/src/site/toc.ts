/**
 * The `<dialog>` table of contents `ci.html`, `tutorial.html` and
 * `mcp-server.html` share.
 *
 * All three pages had their own copy, identical down to the two comments
 * explaining why the backdrop click works and why the dialog closes before
 * it scrolls. One copy now, which is the point of the scripts being
 * somewhere a module boundary exists at all. The `/` shortcut and the
 * incremental search box live here too, for the same reason — a fourth page
 * that wants a TOC gets both for free by wiring up the same three ids
 * (`toc-btn`, `toc`/`toc-list`, `toc-close`) plus `toc-search`.
 */

import { byId } from "./dom.js";

export interface Toc {
  /** Appends a link for a heading the renderer has just given an id to. */
  add(text: string, id: string, level: number): void;
}

/**
 * Wires the TOC button, the dialog, its link list, the `/` shortcut and the
 * search box that filters the list.
 *
 * A page with no `#toc` gets an inert `Toc` rather than an error: the wiring
 * is optional in the same way `byId` returning null is. `#toc-search` is
 * optional on top of that — a page could carry the dialog without it.
 */
export function createToc(): Toc {
  const toc = byId<HTMLDialogElement>("toc");
  const list = byId("toc-list");
  const openBtn = byId("toc-btn");
  const closeBtn = byId("toc-close");
  const search = byId<HTMLInputElement>("toc-search");
  if (!toc || !list) return { add: () => {} };

  const filter = (query: string): void => {
    const q = query.trim().toLowerCase();
    for (const link of list.querySelectorAll<HTMLAnchorElement>("a")) {
      link.hidden = q !== "" && !(link.textContent ?? "").toLowerCase().includes(q);
    }
  };

  // The search box always starts empty and focused — whether the dialog was
  // opened by the button, by `/`, or (in principle) by anything else that
  // calls showModal on it.
  const open = (): void => {
    toc.showModal();
    if (search) {
      search.value = "";
      filter("");
      search.focus();
    }
  };

  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", () => toc.close());
  search?.addEventListener("input", () => filter(search.value));

  // `/` opens the TOC from anywhere on the page, the way it does on GitHub —
  // except while the reader is already typing into a form field, where `/`
  // means a literal slash, and except while the dialog is already open,
  // where `showModal()` would throw.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || toc.open) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    e.preventDefault();
    open();
  });

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
