/**
 * docs/index.html — the landing page.
 *
 * 578 lines of inline `<script>` until the follow-up review's §2.3, which is
 * larger than any module in ../playground/app/ and is the page the README
 * sends people to first. See docs/design/playground-site-modules-plan.md.
 *
 * The four blocks it used to be are four sections here, in the same order:
 * the mermaid diagrams, the source/preview demos, the Explore section's
 * interactive bits, and the preview cards.
 */

import { wireArticlesCarousel } from "./articles-carousel.js";
import { byId } from "./dom.js";
import { renderDemo } from "./demo-panes.js";
import { fillPreviewCards, wireSwipers } from "./preview-cards.js";

/**
 * Explore's small structural diagrams (dependency flow, CI pass/fail, the
 * verified state transition), rendered from text instead of hand-drawn ASCII
 * art. Theme matches the card: light, monospace, the same red accent used
 * elsewhere on the page.
 */
function initDiagrams(): void {
  if (typeof mermaid === "undefined") return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: "14px",
      primaryColor: "#f0f0f0",
      primaryTextColor: "#1b1b1b",
      primaryBorderColor: "#1b1b1b",
      lineColor: "#1b1b1b",
      secondaryColor: "#f0f0f0",
      tertiaryColor: "#ffffff",
    },
    flowchart: { curve: "linear" },
  });
  mermaid.run({ querySelector: ".mermaid" });
}

/** Chart images (charts/example-charts-*.svg) resolve on their own now that
 *  index.html and docs/charts/ are siblings — the relative `<img>` src the
 *  Markdown already carries just works. */
function renderDemos(): void {
  for (const name of ["chart", "eval", "computes", "drift", "power-chart", "power-import"]) {
    renderDemo(`${name}-source`, `${name}-preview`, `${name}-source-md`);
  }
}

/**
 * "Discover rules in existing tables" — toggles the source/preview pair
 * between the un-annotated table and the same table with infer's proposed rule
 * written in, and reveals the infer transcript.
 */
function wireInferToggle(): void {
  const btn = byId("infer-btn");
  const out = byId("infer-out");
  const title = byId("infer-pane-title");
  let shown = false;
  btn?.addEventListener("click", () => {
    shown = !shown;
    renderDemo("infer-source", "infer-preview", shown ? "infer-after-md" : "infer-before-md");
    if (out) out.hidden = !shown;
    if (title) title.textContent = `quote.md — ${shown ? "after" : "before"}`;
    btn.setAttribute("aria-pressed", String(shown));
    btn.innerHTML = shown
      ? "Show the table before"
      : 'Run <code style="background:none;color:inherit;padding:0">visimark infer</code>';
  });
  // The "before" state on load, same as the static markup would show.
  renderDemo("infer-source", "infer-preview", "infer-before-md");
}

/** "A document can look right and still be wrong" — reveals the check
 *  transcript for the invoice above. */
function wireDriftToggle(): void {
  const btn = byId("drift-check-btn");
  const out = byId("drift-check-out");
  if (!btn || !out) return;
  btn.addEventListener("click", () => {
    const shown = out.hidden;
    out.hidden = !shown;
    btn.setAttribute("aria-pressed", String(shown));
    btn.setAttribute("aria-expanded", String(shown));
  });
}

/**
 * Yellow is the input the reader changed; green is everything VisiMark
 * recalculated because of it. The source pane and the graph use the same
 * pairing, so the eye can carry one to the other.
 */
const DEP_TONES = {
  input: { fill: "#fff8e1", stroke: "#b7791f", text: "#8a6100" },
  derived: { fill: "#eafaf0", stroke: "#1a7f37", text: "#1a7f37" },
};

function paintDepGraph(on: boolean): void {
  const box = byId("dep-diagram");
  if (!box) return;
  box.querySelectorAll<HTMLElement>("g.node").forEach((node) => {
    // mermaid names each node group "…-flowchart-<id>-<n>"
    const parts = (node.id || "").split("-");
    const name = parts[parts.length - 2];
    const tone =
      !on || name === "Rate" ? null : name === "Qty" ? DEP_TONES.input : DEP_TONES.derived;
    node.querySelectorAll<HTMLElement>("rect, polygon, path").forEach((shape) => {
      shape.style.fill = tone ? tone.fill : "";
      shape.style.stroke = tone ? tone.stroke : "";
    });
    node.querySelectorAll<HTMLElement>(".nodeLabel, text, tspan").forEach((label) => {
      label.style.color = tone ? tone.text : "";
      label.style.fill = tone ? tone.text : "";
      label.style.fontWeight = tone ? "700" : "";
    });
  });
}

/** "Change one input, follow every consequence" — swaps the Net/VAT/Gross
 *  figures between the stale (Qty 12) and current (Qty 20) values, the same
 *  numbers as the check transcript above. */
function wireDepToggle(): void {
  const btn = byId("dep-btn");
  const before = byId("dep-before");
  const after = byId("dep-after");
  if (!btn || !before || !after) return;
  let changed = false;
  btn.addEventListener("click", () => {
    changed = !changed;
    before.hidden = changed;
    after.hidden = !changed;
    paintDepGraph(changed);
    btn.textContent = changed ? "Change Qty back: 20 → 12" : "Change Qty: 12 → 20";
    btn.setAttribute("aria-pressed", String(changed));
  });
}

/** Sticky TOC: highlights whichever feature article is currently in the middle
 *  band of the viewport as the reader scrolls past it, and scrolls the
 *  single-line strip so that entry sits in its centre. */
function wireStickyToc(): void {
  const toc = document.querySelector<HTMLElement>("#explore .toc");
  if (!toc || !("IntersectionObserver" in window)) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const links = [...toc.querySelectorAll<HTMLAnchorElement>("a")];
  const byTarget = new Map(links.map((a) => [a.getAttribute("href")!.slice(1), a]));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const link = byTarget.get(entry.target.id);
        if (!link || !entry.isIntersecting) continue;
        for (const l of links) l.classList.remove("active");
        link.classList.add("active");
        toc.scrollTo({
          left: link.offsetLeft - (toc.clientWidth - link.offsetWidth) / 2,
          behavior: reduceMotion.matches ? "auto" : "smooth",
        });
      }
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
  );
  document
    .querySelectorAll("#explore .feature[id]")
    .forEach((article) => observer.observe(article));
}

initDiagrams();
renderDemos();
wireInferToggle();
wireDriftToggle();
wireDepToggle();
wireStickyToc();
void wireArticlesCarousel();
fillPreviewCards();
wireSwipers();
