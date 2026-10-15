/**
 * The address bar (review §2.8).
 *
 * `?file=` used to be read exactly once, at boot, and never written:
 * `grep -c 'pushState\|replaceState'` over the page returned 0. So switching
 * files left the address bar lying, and nobody could link a colleague to the
 * chapter they were looking at — on a page whose whole purpose is being linked
 * to.
 *
 * **`?file=`, not a hash.** It is the shape that already exists and the one
 * the boot path already reads, so every link written against it keeps working.
 * The review asked for every such link to be checked before the shape changed;
 * a grep of `docs/`, `README.md` and `packages/` for `playground.html?` finds
 * none at all, so there was nothing to break and nothing to migrate — the
 * parameter was documented and never used.
 *
 * **`replaceState`, not `pushState`.** The review put the trade plainly: back
 * walking the chapter history is good for a tutorial and noisy for idle
 * clicking. Idle clicking is what the FILES panel invites — twenty entries,
 * one click each — and a visitor who has clicked through eight of them should
 * get out of the playground with one Back press, the way they could before this
 * existed. The address bar is always shareable either way, which is the thing
 * that was actually broken.
 *
 * **`?file=` can name a file the visitor created, and that link is local.**
 * The parameter and the FILES catalogue have to agree on what a valid name is,
 * and for a while they did not: §2.7 restores created files from
 * `localStorage`, §2.8 writes every current filename here including theirs, and
 * boot resolved the parameter against the bundled catalogue alone — so the page
 * wrote `?file=scratch.md` and then served `demo.md` on reload, rewriting the
 * bar to say so (follow-up review §2.5). Boot now consults both.
 *
 * The honest caveat is that such a link only resolves in the browser that
 * created the file: a created document lives in `localStorage` and travels
 * nowhere. So the invariant this module keeps is still "the address bar always
 * names what is on screen", but the converse — that pasting it elsewhere shows
 * the same thing — holds only for the bundled documents. The alternative was
 * to refuse to write created names at all, which breaks the visitor's *own*
 * reload to protect a share that nobody asked for. See
 * docs/design/playground-file-lifecycle-plan.md for the created-file lifecycle
 * this belongs to.
 *
 * **The diagnostic tab is not in the URL.** It is a view of the current
 * document rather than a place, it resets on every file switch already (see
 * ./files.ts), and serialising it would put two knobs in a link where the
 * person pasting it means one. That is the over-serialisation §2.8 asked to be
 * ruled on rather than left open.
 */

const PARAM = "file";

/** The file named by the current URL, if any. */
export function fileFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM);
}

/**
 * Points the address bar at `name` without adding a history entry.
 *
 * Every other query parameter is preserved: this rewrites one key rather than
 * replacing the query, so a link someone pasted with something else on it
 * still has it after the first file switch.
 */
export function writeFileToUrl(name: string): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get(PARAM) === name) return;
  url.searchParams.set(PARAM, name);
  window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * Calls `onFile` when the visitor navigates within the page.
 *
 * With `replaceState` there is normally nothing to pop — which is the point —
 * but a hash link, a same-document navigation, or a browser restoring session
 * state can still fire it, and the page should then be showing what the
 * address bar says rather than silently disagreeing with it.
 */
export function onUrlFileChange(onFile: (name: string) => void): void {
  window.addEventListener("popstate", () => {
    const name = fileFromUrl();
    if (name) onFile(name);
  });
}
