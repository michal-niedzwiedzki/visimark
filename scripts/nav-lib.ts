/**
 * The navbar of the generated docs pages, built from docs/nav.json. That file
 * is the one list of site links, as docs/articles/articles.json is for
 * articles. Add a page by adding an entry there and running `bun run gen:docs`
 * and `bun run gen:examples`.
 */

import { escapeHtml } from "../packages/visimark/src/site/dom.js";
import manifest from "../docs/nav.json" with { type: "json" };

export interface NavLink {
  /** A page under docs/, or an absolute URL for a link off the site. */
  href: string;
  label: string;
  /** A path prefix under docs/ this link also stands for: pages below it show
   *  the link as current, as `examples/` does for every example page. */
  covers?: string;
}

export const NAV_LINKS: NavLink[] = manifest.links;

const isExternal = (href: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(href);

/** The `<a>` lines of the navbar. `base` is the path from the page back to
 *  docs/; `current` is the page's own path under docs/ (`ci.html`,
 *  `examples/invoice/`). The link for the current page gets
 *  `aria-current="page"`, which guide.css styles as it does a hovered link. */
export function renderNav(
  base: string,
  current: string,
  links: readonly NavLink[] = NAV_LINKS,
): string {
  return links
    .map((link) => {
      if (isExternal(link.href)) {
        return `          <a href="${escapeHtml(link.href)}" rel="noopener">${escapeHtml(link.label)}</a>`;
      }
      const here = current === link.href || (link.covers && current.startsWith(link.covers));
      const aria = here ? ' aria-current="page"' : "";
      return `          <a href="${base}${escapeHtml(link.href)}"${aria}>${escapeHtml(link.label)}</a>`;
    })
    .join("\n");
}
