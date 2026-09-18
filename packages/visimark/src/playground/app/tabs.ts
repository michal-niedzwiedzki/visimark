/**
 * The two tab strips: TERMINAL/BUILD/REFERENCE, and
 * REASONING/KNOWLEDGE/INFERENCE.
 *
 * They are the WAI-ARIA Authoring Practices tabs pattern, in full (review
 * §2.3). Before it they were two tab sets in every respect except the ones a
 * screen reader can perceive: `grep -c 'role='` over this page returned 0.
 *
 * The split between markup and this module: docs/playground.html carries what
 * is *structural* and never changes — `role="tablist"`, `role="tab"`,
 * `role="tabpanel"`, the ids, `aria-controls` and `aria-labelledby` — so a
 * reviewer reading the page can see the relationships. This module owns what
 * is *stateful*: `aria-selected` and the roving `tabindex`, which have to move
 * whenever the selection does, including when `selectTab` is called from
 * somewhere else entirely (a file switch resets the diagnostics group).
 *
 * **Automatic activation** — arrowing to a tab selects it, rather than
 * requiring a further Enter. The APG recommends that when the panels are
 * already loaded and switching costs nothing, which is the case here: every
 * panel's content is computed by the same pipeline pass whether or not it is
 * on screen.
 */

export interface Tabs {
  select(group: string, name: string): void;
}

function tabsIn(group: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`.diag-tab[data-group="${group}"]`)];
}

export function createTabs(onSelect: (action: string) => void): Tabs {
  const select = (group: string, name: string): void => {
    for (const tab of tabsIn(group)) {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      // Roving tabindex: one stop per tab strip, not one per tab. Tab moves
      // you past the whole group; the arrow keys move you within it.
      tab.tabIndex = active ? 0 : -1;
    }
    document.querySelectorAll<HTMLElement>(`.diag-view[data-group="${group}"]`).forEach((view) => {
      view.classList.toggle("active", view.dataset.view === name);
    });
  };

  /** Selects `tab` and moves focus to it — the arrow-key half of the pattern,
   *  where selection and focus travel together. */
  const activate = (tab: HTMLElement): void => {
    const group = tab.dataset.group;
    const name = tab.dataset.tab;
    if (!group || !name) return;
    select(group, name);
    tab.focus();
    onSelect(`tab:${group}:${name}`);
  };

  for (const tab of document.querySelectorAll<HTMLElement>(".diag-tab")) {
    tab.addEventListener("click", () => activate(tab));

    tab.addEventListener("keydown", (e) => {
      const group = tab.dataset.group;
      if (!group) return;
      const siblings = tabsIn(group);
      const here = siblings.indexOf(tab);
      let next: HTMLElement | undefined;
      // A horizontal tablist, so Left/Right and not Up/Down. Wrapping at both
      // ends is what the APG specifies.
      if (e.key === "ArrowRight") next = siblings[(here + 1) % siblings.length];
      else if (e.key === "ArrowLeft")
        next = siblings[(here - 1 + siblings.length) % siblings.length];
      else if (e.key === "Home") next = siblings[0];
      else if (e.key === "End") next = siblings[siblings.length - 1];
      else return;
      e.preventDefault();
      if (next) activate(next);
    });
  }

  return { select };
}
