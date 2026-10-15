/**
 * The landing page's featured-articles panel: a vertical carousel that steps
 * up every five seconds, holds while the pointer or keyboard focus is inside
 * it, and is also driven by the numbered dots.
 *
 * Slides are built from docs/articles/articles.json.
 *
 * The track carries a clone of the first slide at the end. Advancing from the
 * last article scrolls up onto the clone, and once that transition ends the
 * track snaps back to the real first slide without animating, so the motion
 * never runs backwards.
 */

import { articleBody, loadArticles } from "./articles.js";
import { byId } from "./dom.js";

const INTERVAL_MS = 5000;

export async function wireArticlesCarousel(): Promise<void> {
  const root = byId("articles");
  const track = root?.querySelector<HTMLElement>(".articles-track");
  const dotsBox = root?.querySelector<HTMLElement>(".articles-dots");
  if (!root || !track || !dotsBox) return;

  let articles;
  try {
    articles = (await loadArticles()).filter((a) => a.featured !== false);
  } catch {
    root.hidden = true;
    return;
  }
  if (articles.length === 0) {
    root.hidden = true;
    return;
  }
  track.innerHTML = articles
    .map((a) => `<article class="articles-slide">${articleBody(a, "h3")}</article>`)
    .join("\n");
  dotsBox.innerHTML = articles
    .map((_, i) => `<button type="button" aria-label="Show article ${i + 1}">${i + 1}</button>`)
    .join("");
  const dots = [...dotsBox.querySelectorAll<HTMLButtonElement>("button")];
  if (dots.length < 2) {
    dotsBox.hidden = true;
    return;
  }

  const slides = [...track.children] as HTMLElement[];
  const count = slides.length;
  const clone = slides[0]!.cloneNode(true) as HTMLElement;
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  track.append(clone);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let index = 0;
  let held = false;

  const paint = (): void => {
    const real = index % count;
    slides.forEach((s, i) => {
      s.inert = i !== real;
      s.setAttribute("aria-hidden", String(i !== real));
    });
    dots.forEach((d, i) => {
      if (i === real) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
  };

  const show = (next: number, animate: boolean): void => {
    index = next;
    track.classList.toggle("no-anim", !animate || reduceMotion.matches);
    track.style.transform = `translateY(-${(index / (count + 1)) * 100}%)`;
    paint();
    if (index === count && (!animate || reduceMotion.matches)) show(0, false);
  };

  track.addEventListener("transitionend", (e) => {
    if (e.target === track && index === count) {
      // Force the current position to be committed before the snap.
      void track.offsetHeight;
      show(0, false);
    }
  });

  dots.forEach((d, i) => d.addEventListener("click", () => show(i, true)));

  const hold = (on: boolean): void => {
    held = on;
  };
  root.addEventListener("mouseenter", () => hold(true));
  root.addEventListener("mouseleave", () => hold(false));
  root.addEventListener("focusin", () => hold(true));
  root.addEventListener("focusout", () => hold(false));

  setInterval(() => {
    if (!held && !document.hidden && index < count) show(index + 1, true);
  }, INTERVAL_MS);

  paint();
}
