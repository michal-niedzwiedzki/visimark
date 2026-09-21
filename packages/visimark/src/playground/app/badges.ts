/**
 * Badges: one per tutorial chapter, awarded the moment every quest step for
 * that chapter is checked off.
 *
 * Name, icon key and (first-person, share-ready) skill text live in
 * scenarios.json's per-chapter "badge" field — this module only supplies the
 * artwork an icon key points at, the localStorage persistence, and the share
 * handoff. Earned badges persist, so revisiting a chapter in a later session
 * still shows the badge it already unlocked.
 *
 * Icons are inline Phosphor Icons (phosphoricons.com, MIT) — "propeller hat",
 * "pillow" and "hacksaw" have no Phosphor equivalent, so those three badges
 * use the closest available icon (beanie / bed / wrench) instead.
 */

import type { Badge, RawScenario, Scenarios } from "./types.js";
import { byId, hideInstant, revealFadeIn, showInstant } from "./dom.js";
import { copyText } from "./clipboard.js";

const BADGE_ICONS: Record<string, string> = {
  beanie:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M224,162.16V144a96.18,96.18,0,0,0-72.34-93,28,28,0,1,0-47.32,0A96.18,96.18,0,0,0,32,144v18.16A16,16,0,0,0,24,176v32a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V176A16,16,0,0,0,224,162.16ZM116,36a12,12,0,1,1,12,12A12,12,0,0,1,116,36Zm12,28a80.09,80.09,0,0,1,80,80v16H48V144A80.09,80.09,0,0,1,128,64Zm-8,112v32H80V176Zm16,0h40v32H136Zm-96,0H64v32H40Zm176,32H192V176h24v32Z"/></svg>',
  plugs:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M237.66,18.34a8,8,0,0,0-11.32,0l-52.4,52.41-5.37-5.38a32.05,32.05,0,0,0-45.26,0L100,88.69l-6.34-6.35A8,8,0,0,0,82.34,93.66L88.69,100,65.37,123.31a32,32,0,0,0,0,45.26l5.38,5.37-52.41,52.4a8,8,0,0,0,11.32,11.32l52.4-52.41,5.37,5.38a32,32,0,0,0,45.26,0L156,167.31l6.34,6.35a8,8,0,0,0,11.32-11.32L167.31,156l23.32-23.31a32,32,0,0,0,0-45.26l-5.38-5.37,52.41-52.4A8,8,0,0,0,237.66,18.34Zm-116.29,161a16,16,0,0,1-22.62,0L76.69,157.25a16,16,0,0,1,0-22.62L100,111.31,144.69,156Zm57.94-57.94L156,144.69,111.31,100l23.32-23.31a16,16,0,0,1,22.62,0l22.06,22A16,16,0,0,1,179.31,121.37ZM88.57,35A8,8,0,0,1,103.43,29l8,20A8,8,0,0,1,96.57,55ZM24.57,93A8,8,0,0,1,35,88.57l20,8A8,8,0,0,1,49,111.43l-20-8A8,8,0,0,1,24.57,93ZM231.43,163a8,8,0,0,1-10.4,4.46l-20-8A8,8,0,1,1,207,144.57l20,8A8,8,0,0,1,231.43,163Zm-64,58.06A8,8,0,0,1,152.57,227l-8-20A8,8,0,0,1,159.43,201Z"/></svg>',
  bed: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M216,72H32V48a8,8,0,0,0-16,0V208a8,8,0,0,0,16,0V176H240v32a8,8,0,0,0,16,0V112A40,40,0,0,0,216,72ZM32,88h72v72H32Zm88,72V88h96a24,24,0,0,1,24,24v48Z"/></svg>',
  anchor:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M216,136a8,8,0,0,0-8,8c0,24.69-13.77,29.64-38.1,36.28-11.36,3.1-24.12,6.6-33.9,14.34V128h32a8,8,0,0,0,0-16H136V87a32,32,0,1,0-16,0v25H88a8,8,0,0,0,0,16h32v66.62c-9.78-7.74-22.54-11.24-33.9-14.34C61.77,173.64,48,168.69,48,144a8,8,0,0,0-16,0c0,38.11,27.67,45.66,49.9,51.72C106.23,202.36,120,207.31,120,232a8,8,0,0,0,16,0c0-24.69,13.77-29.64,38.1-36.28C196.33,189.66,224,182.11,224,144A8,8,0,0,0,216,136ZM112,56a16,16,0,1,1,16,16A16,16,0,0,1,112,56Z"/></svg>',
  wrench:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z"/></svg>',
  hammer:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M251.34,112,183.88,44.08a96.1,96.1,0,0,0-135.77,0l-.09.09L34.25,58.4A8,8,0,0,0,45.74,69.53L59.47,55.35a79.92,79.92,0,0,1,18.71-13.9L124.68,88l-96,96a16,16,0,0,0,0,22.63l20.69,20.69a16,16,0,0,0,22.63,0l96-96,14.34,14.34h0L200,163.3a16,16,0,0,0,22.63,0l28.69-28.69A16,16,0,0,0,251.34,112ZM60.68,216,40,195.31l68-68L128.68,148ZM162.34,114.32,140,136.67,119.31,116l22.35-22.35a8,8,0,0,0,0-11.32L94.32,35a80,80,0,0,1,78.23,20.41l44.22,44.51L188,128.66l-14.34-14.34A8,8,0,0,0,162.34,114.32Zm49,37.66-12-12L228,111.25l12,12Z"/></svg>',
  magnifier:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>',
  wand: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M48,64a8,8,0,0,1,8-8H72V40a8,8,0,0,1,16,0V56h16a8,8,0,0,1,0,16H88V88a8,8,0,0,1-16,0V72H56A8,8,0,0,1,48,64ZM184,192h-8v-8a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0v-8h8a8,8,0,0,0,0-16Zm56-48H224V128a8,8,0,0,0-16,0v16H192a8,8,0,0,0,0,16h16v16a8,8,0,0,0,16,0V160h16a8,8,0,0,0,0-16ZM219.31,80,80,219.31a16,16,0,0,1-22.62,0L36.68,198.63a16,16,0,0,1,0-22.63L176,36.69a16,16,0,0,1,22.63,0l20.68,20.68A16,16,0,0,1,219.31,80Zm-54.63,32L144,91.31l-96,96L68.68,208ZM208,68.69,187.31,48l-32,32L176,100.69Z"/></svg>',
  gradcap:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M251.76,88.94l-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V240a8,8,0,0,0,16,0V199.51a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12ZM128,200c-43.27,0-68.72-21.14-80-33.71V126.4l76.24,40.66a8,8,0,0,0,7.52,0L176,143.47v46.34C163.4,195.69,147.52,200,128,200Zm80-33.75a97.83,97.83,0,0,1-16,14.25V134.93l16-8.53ZM188,118.94l-.22-.13-56-29.87a8,8,0,0,0-7.52,14.12L171,128l-43,22.93L25,96,128,41.07,231,96Z"/></svg>',
  bomb: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M248,32h0a8,8,0,0,0-8,8,52.66,52.66,0,0,1-3.57,17.39C232.38,67.22,225.7,72,216,72c-11.06,0-18.85-9.76-29.49-24.65C176,32.66,164.12,16,144,16c-16.39,0-29,8.89-35.43,25a66.07,66.07,0,0,0-3.9,15H88A16,16,0,0,0,72,72v9.59A88,88,0,0,0,112,248h1.59A88,88,0,0,0,152,81.59V72a16,16,0,0,0-16-16H120.88a46.76,46.76,0,0,1,2.69-9.37C127.62,36.78,134.3,32,144,32c11.06,0,18.85,9.76,29.49,24.65C184,71.34,195.88,88,216,88c16.39,0,29-8.89,35.43-25A68.69,68.69,0,0,0,256,40,8,8,0,0,0,248,32ZM140.8,94a72,72,0,1,1-57.6,0A8,8,0,0,0,88,86.66V72h48V86.66A8,8,0,0,0,140.8,94ZM111.89,209.32A8,8,0,0,1,104,216a8.52,8.52,0,0,1-1.33-.11,57.5,57.5,0,0,1-46.57-46.57,8,8,0,1,1,15.78-2.64,41.29,41.29,0,0,0,33.43,33.43A8,8,0,0,1,111.89,209.32Z"/></svg>',
  megaphone:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M248,120a48.05,48.05,0,0,0-48-48H160.2c-2.91-.17-53.62-3.74-101.91-44.24A16,16,0,0,0,32,40V200a16,16,0,0,0,26.29,12.25c37.77-31.68,77-40.76,93.71-43.3v31.72A16,16,0,0,0,159.12,214l11,7.33A16,16,0,0,0,194.5,212l11.77-44.36A48.07,48.07,0,0,0,248,120ZM48,199.93V40h0c42.81,35.91,86.63,45,104,47.24v65.48C134.65,155,90.84,164.07,48,199.93Zm131,8,0,.11-11-7.33V168h21.6ZM200,152H168V88h32a32,32,0,1,1,0,64Z"/></svg>',
  paintbrush:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M232,32a8,8,0,0,0-8-8c-44.08,0-89.31,49.71-114.43,82.63A60,60,0,0,0,32,164c0,30.88-19.54,44.73-20.47,45.37A8,8,0,0,0,16,224H92a60,60,0,0,0,57.37-77.57C182.3,121.31,232,76.08,232,32ZM92,208H34.63C41.38,198.41,48,183.92,48,164a44,44,0,1,1,44,44Zm32.42-94.45q5.14-6.66,10.09-12.55A76.23,76.23,0,0,1,155,121.49q-5.9,4.94-12.55,10.09A60.54,60.54,0,0,0,124.42,113.55Zm42.7-2.68a92.57,92.57,0,0,0-22-22c31.78-34.53,55.75-45,69.9-47.91C212.17,55.12,201.65,79.09,167.12,110.87Z"/></svg>',
  stamp:
    '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M240,208H229.75A44.05,44.05,0,0,0,192,144h-4a35.91,35.91,0,0,0,4-16,36,36,0,0,0-64.86-21.34A59.81,59.81,0,0,0,100,96a60.09,60.09,0,0,0-59.75,64A44.05,44.05,0,0,0,16,204a4,4,0,0,0,0,4H240a8,8,0,0,0,0-16ZM168,144a8,8,0,0,1,8-8h16a28,28,0,0,1,27.71,24H140.7A43.86,43.86,0,0,1,168,144Zm-68-32a44,44,0,0,1,25.16,7.93A8,8,0,0,0,137,116.4a20,20,0,1,1,18.32,27.6H49A44.05,44.05,0,0,1,100,112ZM32.4,208A28,28,0,0,1,60,184a8,8,0,0,0,4.62-1.47A59.87,59.87,0,0,0,88,192a8,8,0,0,0,0-16,44.08,44.08,0,0,1-15.36-2.75A44.24,44.24,0,0,1,88.68,160h95.4A28,28,0,0,1,213.6,208Z"/></svg>',
};

/** The icon keys a scenario's `badge.icon` may name. Exported so the
 *  scenarios.json gate in test/playground/scenarios-data.test.ts can check a
 *  typo that `BADGE_ICONS[...] ?? ""` would otherwise render as nothing at
 *  all, invisibly, until someone earned the badge. */
export const BADGE_ICON_NAMES: readonly string[] = Object.keys(BADGE_ICONS);

const BADGES_STORAGE_KEY = "visimark-playground-badges";

export const SHARE_URL = "https://michal-niedzwiedzki.github.io/visimark/";

/**
 * The skill line is already written first-person and ready to post as-is (see
 * each chapter's "badge" field in scenarios.json), so it — not a generic
 * "I just earned a badge" line — is what pre-fills the share composer's text.
 */
function badgeShareText(badge: Badge): string {
  return badge.skill;
}

/**
 * X's tweet intent is the only one of these that still accepts prefilled text
 * — Facebook's sharer.php and LinkedIn's share-offsite both dropped that years
 * ago (an anti-spam change), and Instagram never had a web share-intent to
 * begin with. Those three all get the clipboard-handoff treatment instead (see
 * shareViaClipboard below).
 */
function buildShareLink(badge: Badge): string {
  const encodedUrl = encodeURIComponent(SHARE_URL);
  const encodedText = encodeURIComponent(badgeShareText(badge));
  return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
}

export interface BadgeBoard {
  /** The badge for `chapter`, or undefined for a file that carries none. */
  forFile(name: string): Badge | undefined;
  earned(name: string): boolean;
  /** Renders (or hides, passing undefined) a badge, always instantly. */
  render(badge: Badge | undefined): void;
  /** Awards `name`'s badge exactly once, revealing it with a fade. */
  award(name: string): void;
}

/**
 * Built from each chapter's scenarios.json "badge" field rather than a
 * hardcoded list — scenarios.json is the single source of truth for scenario,
 * quest, reward and badge data; this module only renders it. A chapter with no
 * "badge" field (there should be none among TUTORIAL_CHAPTERS) is simply
 * awarded no badge.
 */
export function createBadgeBoard(
  scenarios: Scenarios,
  chapters: readonly string[],
  currentFile: () => string,
): BadgeBoard {
  const byChapter: Record<string, Badge> = {};
  chapters.forEach((name, i) => {
    const badge = (scenarios[name] as RawScenario | undefined)?.badge;
    if (badge) byChapter[name] = { id: `badge-${i + 1}`, ...badge };
  });

  const earnedBadges = loadEarned();

  const awardEl = byId("badge-award");
  const iconEl = byId("badge-award-icon");
  const nameEl = byId("badge-award-name");
  const skillEl = byId("badge-award-skill");
  const statusEl = byId("badge-share-status");
  const shareXEl = byId<HTMLAnchorElement>("share-x");

  function fill(badge: Badge): void {
    iconEl.innerHTML = BADGE_ICONS[badge.icon] ?? "";
    nameEl.textContent = badge.name;
    skillEl.textContent = badge.skill;
    shareXEl.href = buildShareLink(badge);
  }

  /**
   * Facebook, Instagram and LinkedIn all get the same handoff: copy the
   * caption to the clipboard, then open the destination for a manual paste —
   * Instagram because it never had a prefill option, Facebook and LinkedIn
   * because their prefill params are dead (see buildShareLink above).
   */
  function shareViaClipboard(shareUrl: string, pastePrompt: string): void {
    const badge = byChapter[currentFile()];
    if (!badge) return;
    const caption = `${badgeShareText(badge)} ${SHARE_URL}`;
    statusEl.hidden = false;
    copyText(caption).then(
      () => {
        statusEl.textContent = `Caption copied — paste it into your ${pastePrompt}`;
      },
      () => {
        statusEl.textContent = caption;
      },
    );
    window.open(shareUrl, "_blank", "noopener");
  }

  byId("share-fb").addEventListener("click", () => {
    shareViaClipboard(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`,
      "Facebook post.",
    );
  });
  byId("share-li").addEventListener("click", () => {
    shareViaClipboard(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SHARE_URL)}`,
      "LinkedIn post.",
    );
  });
  byId("share-ig").addEventListener("click", () => {
    shareViaClipboard("https://www.instagram.com/", "Instagram post.");
  });

  return {
    forFile: (name) => byChapter[name],
    earned: (name) => Boolean(earnedBadges[name]),
    /**
     * Called both right after a badge is newly awarded and whenever a scenario
     * with an already-earned badge is opened. Always instant: the fade for a
     * *newly* earned badge is driven separately by the quest engine's
     * completion sequence, which fills the badge via award() below.
     */
    render(badge) {
      statusEl.hidden = true;
      if (!badge) {
        hideInstant(awardEl);
        return;
      }
      fill(badge);
      showInstant(awardEl);
    },
    /**
     * A no-op for non-tutorial scenarios (no badge) and for a badge already
     * earned in this or an earlier session, in which case it is already
     * showing and needs no reveal here. Confetti is the caller's job — it
     * needs to fire before the reveal, not alongside it.
     */
    award(name) {
      const badge = byChapter[name];
      if (!badge || earnedBadges[name]) return;
      earnedBadges[name] = true;
      saveEarned(earnedBadges);
      fill(badge);
      revealFadeIn(awardEl);
    },
  };
}

/**
 * Reads the earned-badge record out of whatever `localStorage` is holding.
 *
 * **Anything at all may be in there, and none of it may reach the boot
 * chain.** This used to be a bare `JSON.parse(... ?? "{}")` with no shape
 * check, so a stored `"null"` — or `"[]"`, or `"7"` — made `earnedBadges[name]`
 * throw a `TypeError` inside `createBadgeBoard`, which review §2.1 placed
 * *inside* the boot chain: the whole page died on the fatal overlay, for a
 * record of which badges had already been shown (follow-up review §2.6).
 *
 * `buffers.ts` had established the house pattern for exactly this reason —
 * validate the shape, and discard rather than migrate, because the worst case
 * is losing scratch state. Badges are cheaper to lose than buffers, so the
 * same answer applies with less hesitation. Split out from the `localStorage`
 * read so the parsing can be tested without a browser.
 */
export function parseEarned(raw: string | null): Record<string, boolean> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const earned: Record<string, boolean> = {};
  // Built entry by entry rather than returned as-is: the values have to be
  // booleans too, or `earned(name)` starts answering with whatever a
  // hand-edited store put there.
  for (const [name, value] of Object.entries(parsed)) {
    if (value === true) earned[name] = true;
  }
  return earned;
}

function loadEarned(): Record<string, boolean> {
  try {
    return parseEarned(window.localStorage.getItem(BADGES_STORAGE_KEY));
  } catch {
    // Reading `localStorage` at all throws when storage is disabled.
    return {};
  }
}

function saveEarned(earned: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(earned));
  } catch {
    // Private browsing / storage disabled — the badge still shows for the rest
    // of this session, it just won't survive a reload.
  }
}
