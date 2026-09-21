/**
 * The boot overlay: what the visitor sees between navigation and first render,
 * and what they see instead if that render never comes.
 *
 * Before review §2.1 the whole application was one top-level-`await`ing IIFE
 * with no `try`/`catch` and no rejection handler. One 404, one flaky network,
 * one `file://` open, and it rejected into the void: the visitor got the
 * fully-styled dark shell with an empty file list, an empty editor and no
 * message at all.
 *
 * Three states, and the first one is markup rather than code — see the
 * `#boot-overlay` element in docs/playground.html. It is *visible* on load and
 * already says what is happening, because the one failure this module cannot
 * report is its own bundle failing to arrive.
 */

import { byId } from "./dom.js";

export interface BootOverlay {
  /** Boot succeeded — reveal the application. */
  dismiss(): void;
  /**
   * Boot failed. Names the resource and the likely cause; the overlay stays
   * up, because there is nothing behind it worth showing.
   */
  fail(title: string, message: string, detail?: string): void;
}

export function createBootOverlay(): BootOverlay {
  const overlayEl = byId("boot-overlay");
  const titleEl = byId("boot-title");
  const messageEl = byId("boot-message");
  const hintEl = byId("boot-hint");
  const detailEl = byId("boot-detail");

  return {
    dismiss() {
      overlayEl.hidden = true;
    },
    fail(title, message, detail) {
      overlayEl.classList.add("failed");
      titleEl.textContent = title;
      messageEl.textContent = message;
      // The static hint is about the bundle not arriving. By now it plainly
      // did, so it would only be misdirection.
      hintEl.hidden = true;
      detailEl.textContent = detail ?? "";
    },
  };
}

/**
 * `fetch()` of a sibling file is blocked by CORS on `file://`, so every one of
 * the 22 documents fails at once and the page cannot work at all. It is a
 * distinct, predictable, recoverable failure — and the most likely way a new
 * contributor first opens this file — so it gets its own message rather than
 * 22 identical network errors.
 */
export function isFileProtocol(): boolean {
  return window.location.protocol === "file:";
}

export const FILE_PROTOCOL_MESSAGE =
  "This page is open from disk (file://), where the browser blocks it from " +
  "reading the tutorial documents next to it. Serve the docs/ directory over " +
  "http instead.";

export const FILE_PROTOCOL_DETAIL =
  "bun run serve\n\nthen open http://localhost:8080/playground.html";

/**
 * The width at which the playground becomes the playground.
 *
 * Paired with `@media (max-width: 899px)` in docs/playground.html, which is
 * what actually swaps the five-panel layout for the interstitial. This query
 * is the other half: below it there is nothing on screen to fill, so the
 * application does not fetch 22 documents, does not build a CodeMirror
 * instance, and does not run the engine (review §2.2).
 */
const WIDE_ENOUGH = "(min-width: 900px)";

export function isWideEnough(): boolean {
  return window.matchMedia(WIDE_ENOUGH).matches;
}

/**
 * Resolves as soon as the viewport is wide enough — immediately on a desktop,
 * and on the first resize past the breakpoint if a window was dragged narrow.
 * Without this, widening a narrow window would reveal a playground that had
 * never booted, which is worse than the interstitial it replaced.
 */
export function whenWideEnough(): Promise<void> {
  const query = window.matchMedia(WIDE_ENOUGH);
  if (query.matches) return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = (e: MediaQueryListEvent): void => {
      if (!e.matches) return;
      query.removeEventListener("change", onChange);
      resolve();
    };
    query.addEventListener("change", onChange);
  });
}
