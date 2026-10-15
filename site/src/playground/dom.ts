/** Element lookup and the two reveal idioms the SCENARIO panel is built on. */

/**
 * `document.getElementById`, but a missing id is a crash here rather than a
 * `null` that surfaces three call sites later as "cannot read properties of
 * null". Every id this application asks for is written in docs/playground.html
 * and shipped with it; a miss means the markup and this bundle disagree, which
 * is a bug to see immediately.
 */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`playground.html is missing #${id}`);
  return el as T;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Un-hides `el` with no transition — the resting state for content that
 *  reflects persisted or already-known state (an earned badge reopened from
 *  localStorage), where a fade would just be noise. */
export function showInstant(el: HTMLElement): void {
  el.hidden = false;
  el.classList.add("show");
}

/** Hides `el` and resets it back to revealFadeIn()'s starting point, so the
 *  next reveal fades in again instead of just appearing. */
export function hideInstant(el: HTMLElement): void {
  el.hidden = true;
  el.classList.remove("show");
}

/** Fades `el` in on its own — the completion-sequence moment (see
 *  revealCompletion() in ./quest.ts), as opposed to showInstant()'s "this was
 *  already true" render. Un-hiding and adding `.show` in the same tick would
 *  collapse into one paint with no transition to animate, since the element
 *  has no rendered opacity:0 frame to transition *from* yet — forcing a reflow
 *  between the two commits that frame before the class change asks the browser
 *  to animate away from it. */
export function revealFadeIn(el: HTMLElement): void {
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;
  requestAnimationFrame(() => {
    el.classList.add("show");
  });
}

/** Returns a flasher bound to `el`: call it with text to show next to a button
 *  for a few seconds, then clear. Parameterized so KNOWLEDGE's, INFERENCE's
 *  and the reward's status lines don't share a timer. */
export function makeStatusFlasher(el: HTMLElement): (text: string) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (text: string) => {
    el.textContent = text;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      el.textContent = "";
    }, 3000);
  };
}
