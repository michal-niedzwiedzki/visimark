/**
 * The landing page's three-slide "Author / Adopt / Enforce" cards.
 *
 * The markup ships the `order` dataset hardcoded, so crawlers and no-JS
 * visitors see real content. On load one of four datasets is picked at random
 * and every slot re-rendered from it — each dataset is two rows, one column
 * rule plus one aggregate, and one prose anchor, so the shape of the demo is
 * fixed and only the subject changes.
 */

import { escapeHtml } from "./dom.js";

interface Dataset {
  slug: string;
  file: string;
  /** Item / unit / count / derived, in that order. */
  cols: [string, string, string, string];
  /** Decimal places per column; null for the text one. */
  dp: [null, number, number, number];
  rows: [string, number, number][];
  agg: string;
  label: string;
  unit: string;
  /** `[row, column, newValue]` — what the reader "changes" on slide two. */
  edits: [number, number, number][];
}

const DATASETS: Dataset[] = [
  {
    slug: "order",
    file: "figures.md",
    cols: ["Item", "Price", "Qty", "Net"],
    dp: [null, 2, 0, 2],
    rows: [
      ["pen", 2.0, 10],
      ["paper", 0.15, 100],
    ],
    agg: "total",
    label: "Total",
    unit: "",
    edits: [
      [0, 1, 2.2],
      [1, 2, 150],
    ],
  },
  {
    slug: "power",
    file: "figures.md",
    cols: ["Load", "mA", "Qty", "Draw"],
    dp: [null, 0, 0, 0],
    rows: [
      ["radio", 120, 1],
      ["LED", 15, 4],
    ],
    agg: "total",
    label: "Peak draw",
    unit: " mA",
    edits: [
      [0, 1, 140],
      [1, 2, 8],
    ],
  },
  {
    slug: "mass",
    file: "figures.md",
    cols: ["Part", "Unit", "Qty", "Mass"],
    dp: [null, 0, 0, 0],
    rows: [
      ["bar", 45, 4],
      ["clip", 6, 16],
    ],
    agg: "total",
    label: "Total mass",
    unit: " g",
    edits: [
      [0, 2, 6],
      [1, 1, 8],
    ],
  },
  {
    slug: "latency",
    file: "figures.md",
    cols: ["Hop", "ms", "n", "Total"],
    dp: [null, 1, 0, 1],
    rows: [
      ["edge", 4.0, 2],
      ["api", 12.0, 3],
    ],
    agg: "budget",
    label: "Budget",
    unit: " ms",
    edits: [
      [0, 1, 6.0],
      [1, 2, 4],
    ],
  },
];

const rep = (ch: string, n: number): string => (n > 0 ? ch.repeat(n) : "");
const padL = (s: string, w: number): string => rep(" ", w - s.length) + s;
const padR = (s: string, w: number): string => s + rep(" ", w - s.length);
const fmt = (v: number, dp: number | null): string => (dp == null ? String(v) : v.toFixed(dp));

const editedRows = (d: Dataset): [string, number, number][] => {
  const rows = d.rows.map((r) => [...r] as [string, number, number]);
  for (const [row, col, value] of d.edits) rows[row]![col] = value as never;
  return rows;
};

const derived = (rows: [string, number, number][]): number[] => rows.map((r) => r[1] * r[2]);
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);

/** The Markdown table, with `<em>` around whichever cells changed. `em` holds
 *  `"row,column"` keys, because a cell is the only thing addressed twice. */
function table(
  d: Dataset,
  rows: [string, number, number][],
  derivedVals: number[],
  em: string[],
): string {
  const col = [
    [d.cols[0], ...rows.map((r) => String(r[0]))],
    [d.cols[1], ...rows.map((r) => fmt(r[1], d.dp[1]))],
    [d.cols[2], ...rows.map((r) => fmt(r[2], d.dp[2]))],
    [d.cols[3], ...derivedVals.map((v) => fmt(v, d.dp[3]))],
  ];
  const w = col.map((c) => Math.max(...c.map((s) => s.length)));

  const cell = (txt: string, width: number, right: boolean, mark: boolean): string => {
    const pad = rep(" ", width - txt.length);
    const body = mark ? `<em>${escapeHtml(txt)}</em>` : escapeHtml(txt);
    return right ? pad + body : body + pad;
  };

  const out = [
    `| ${padR(d.cols[0], w[0]!)} | ${padL(d.cols[1], w[1]!)} | ` +
      `${padL(d.cols[2], w[2]!)} | ${padL(d.cols[3], w[3]!)} |`,
    `|${rep("-", w[0]! + 2)}|${rep("-", w[1]! + 1)}:|` +
      `${rep("-", w[2]! + 1)}:|${rep("-", w[3]! + 1)}:|`,
  ];
  for (let i = 0; i < rows.length; i++) {
    out.push(
      `| ${cell(col[0]![i + 1]!, w[0]!, false, false)} | ` +
        `${cell(col[1]![i + 1]!, w[1]!, true, em.includes(`${i},1`))} | ` +
        `${cell(col[2]![i + 1]!, w[2]!, true, em.includes(`${i},2`))} | ` +
        `${cell(col[3]![i + 1]!, w[3]!, true, em.includes(`${i},3`))} |`,
    );
  }
  return out.join("\n");
}

function fence(d: Dataset): string {
  const lhs = Math.max(d.cols[3].length, d.agg.length);
  return (
    `<span class="k">\`\`\`vmark #${d.slug}</span>\n` +
    `${padR(d.cols[3], lhs)} = ${d.cols[1]} * ${d.cols[2]}\n` +
    `${padR(d.agg, lhs)} = SUM(${d.cols[3]})\n` +
    '<span class="k">```</span>'
  );
}

function anchor(d: Dataset, value: number, mark: boolean): string {
  const v = fmt(value, d.dp[3]) + d.unit;
  const shown = mark ? `<em>${escapeHtml(v)}</em>` : escapeHtml(v);
  return `${d.label}: **${shown}**<span class="c">&lt;!--vmark=${d.slug}.${d.agg}--&gt;</span>`;
}

/**
 * Pads every slide in a card to the same row count by inserting blank lines
 * *above the last line* — so the closing prompt stays pinned to the bottom and
 * a trailing "\n" never adds a phantom row.
 */
function padCard(slides: string[]): string[] {
  const rows = slides.map((s) => s.split("\n"));
  const max = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => {
    while (r.length < max) r.splice(r.length - 1, 0, "");
    return r.join("\n");
  });
}

/** Every `pre[data-ex]` slot on the page, keyed by its `data-ex` value. */
export function buildSlots(d: Dataset): Record<string, string> {
  const baseR = d.rows;
  const baseD = derived(baseR);
  const baseT = sum(baseD);
  const edR = editedRows(d);
  const newD = derived(edR);
  const newT = sum(newD);
  const inEm = d.edits.map(([row, col]) => `${row},${col}`);
  const outEm: string[] = [];
  baseD.forEach((v, i) => {
    if (newD[i] !== v) outEm.push(`${i},3`);
  });
  const f = fence(d);

  // Every Author slide ends with a real (non-empty) prompt line so all three
  // render the same number of rows and the box never jumps.
  const authorBase = `${table(d, baseR, baseD, [])}\n${f}\n${anchor(d, baseT, false)}\n<span class="p">$</span>`;
  const authorEdit =
    `${table(d, edR, baseD, inEm)}\n${f}\n${anchor(d, baseT, false)}\n` +
    `<span class="p">$</span> <em>visimark fmt ${d.file}</em>`;
  const authorFixed = `${table(d, edR, newD, outEm)}\n${f}\n${anchor(d, newT, true)}\n<span class="p">$</span>`;

  const plain = `${table(d, baseR, baseD, [])}\nTotal: **${fmt(baseT, d.dp[3])}**`;
  const adoptBase = `${plain}\n<span class="p">$</span> <em>visimark infer ${d.file}</em>`;
  const adoptOut =
    `${plain}\n<span class="p">$</span> visimark infer ${d.file}\n  column rules\n    ` +
    `${d.cols[3]} = ${d.cols[1]} * ${d.cols[2]}    <span class="c">2/2 ok</span>\n` +
    "  1 rule, 1 scalar written.";

  const n = d.rows.length + 2;
  const enforceOut =
    `<span class="p">$</span> visimark check ${d.file}\n<span class="ok">&#10003;</span> ` +
    `${d.file} &mdash; ${n} values agree\n<span class="p">$</span> echo $?\n0`;

  const c1 = padCard([authorBase, authorEdit, authorFixed]);
  const c2 = padCard([adoptBase, adoptOut, authorBase]);
  return {
    "author-base": c1[0]!,
    "author-edit": c1[1]!,
    "author-fixed": c1[2]!,
    "adopt-base": c2[0]!,
    "adopt-out": c2[1]!,
    "adopt-fixed": c2[2]!,
    "enforce-out": enforceOut,
  };
}

/** Picks a dataset and fills the slots. Exported separately from the picking
 *  so the shape of a built card is testable without a coin toss. */
export function fillPreviewCards(pick: number = Math.floor(Math.random() * DATASETS.length)): void {
  const slots = buildSlots(DATASETS[pick % DATASETS.length]!);
  document.querySelectorAll<HTMLElement>("pre[data-ex]").forEach((pre) => {
    const html = slots[pre.getAttribute("data-ex") ?? ""];
    if (html != null) pre.innerHTML = html;
  });
}

/**
 * Locks each card to its tallest slide.
 *
 * The fade effect stacks the slides, so without this the box resizes as the
 * reader steps through it.
 */
export function wireSwipers(): void {
  if (typeof Swiper === "undefined") return;
  document.querySelectorAll<HTMLElement>(".preview").forEach((preview) => {
    const swiperEl = preview.querySelector(".swiper");
    const swiper = new Swiper(swiperEl, {
      effect: "fade",
      fadeEffect: { crossFade: true },
      speed: 400,
      pagination: {
        el: preview.querySelector(".preview-dots"),
        clickable: true,
        renderBullet: (index: number, className: string) =>
          `<span class="${className}"><i>${index + 1}</i></span>`,
      },
    });
    let tallest = 0;
    for (const slide of swiper.slides) tallest = Math.max(tallest, slide.scrollHeight);
    (swiperEl as HTMLElement | null)?.style.setProperty("height", `${tallest}px`);
  });
}

export const DATASET_COUNT = DATASETS.length;
