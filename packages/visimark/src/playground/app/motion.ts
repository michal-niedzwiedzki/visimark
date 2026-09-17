/**
 * Whether this visitor has asked for less movement.
 *
 * The CSS half of `prefers-reduced-motion` lives in docs/playground.html and
 * collapses every transition on the page. This is the half CSS cannot do: a
 * full-screen confetti burst is a `<canvas>` painted by JavaScript, so the
 * only way to respect the preference is not to fire it (review §2.3).
 *
 * Read per call rather than cached, because the preference can change mid
 * session — a visitor who turns it on in their OS should not have to reload to
 * be taken at their word.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
