/**
 * The two tab strips: TERMINAL/BUILD/REFERENCE, and
 * REASONING/KNOWLEDGE/INFERENCE. Each `.diag-tab` carries `data-group` and
 * `data-tab`, each `.diag-view` the matching `data-group`/`data-view`.
 */

export interface Tabs {
  select(group: string, name: string): void;
}

export function createTabs(onSelect: (action: string) => void): Tabs {
  const select = (group: string, name: string): void => {
    document.querySelectorAll<HTMLElement>(`.diag-tab[data-group="${group}"]`).forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === name);
    });
    document.querySelectorAll<HTMLElement>(`.diag-view[data-group="${group}"]`).forEach((view) => {
      view.classList.toggle("active", view.dataset.view === name);
    });
  };

  document.querySelectorAll<HTMLElement>(".diag-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const group = tab.dataset.group;
      const name = tab.dataset.tab;
      if (!group || !name) return;
      select(group, name);
      onSelect(`tab:${group}:${name}`);
    });
  });

  return { select };
}
