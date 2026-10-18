/**
 * The landing page's guided tour: ten scripted slides that walk one order
 * from unverifiable Markdown to a document that fails the build when it
 * disagrees with itself.
 *
 * Scripted on purpose: every document and every line of terminal output below
 * is hand-written text, not the engine's output. Each slide is a pure function
 * of its number, so the tour is testable without a DOM.
 */

import { escapeHtml, setTrustedHtml } from "../html.js";

type Kind =
  | "gray"
  | "input"
  | "computed"
  | "formula"
  | "stale"
  | "anchor"
  | "assert"
  | "param"
  | "fail";

interface Pill {
  kind: Kind;
  icon: string;
  text: string;
}

export interface Slide {
  title: string;
  /** The button under the editor; absent on the last slide. */
  next?: string;
  /** The editor tab: the document, or the terminal. */
  tab: "order.md" | "terminal";
  html: string;
}

const QUESTION = (text: string): Pill => ({ kind: "gray", icon: "?", text });
const INPUT = (text: string): Pill => ({ kind: "input", icon: "i", text });
const COMPUTED = (text: string): Pill => ({ kind: "computed", icon: "±", text });
const FORMULA = (text: string): Pill => ({ kind: "formula", icon: "±", text });

/** A pill sits on the corner of the span it annotates. `level` staggers
 *  neighbours so expanded pills do not all land on one line. */
function withPill(
  inner: string,
  pill: Pill | undefined,
  edge: "top" | "bottom" | "end",
  level = 0,
): string {
  if (!pill) return `<span class="cell">${inner}</span>`;
  return (
    `<span class="cell">${inner}` +
    `<span class="pill k-${pill.kind} at-${edge} lv${level}" tabindex="0" role="note">` +
    `<b aria-hidden="true">${pill.icon}</b><span class="t">${escapeHtml(pill.text)}</span></span></span>`
  );
}

const padL = (s: string, w: number): string => " ".repeat(Math.max(0, w - s.length)) + s;
const padR = (s: string, w: number): string => s + " ".repeat(Math.max(0, w - s.length));

const ROWS: [string, string, string, string][] = [
  ["Widgets", "4", "12.50", "50.00"],
  ["Gadgets", "2", "30.00", "60.00"],
  ["Sprockets", "6", "8.00", "48.00"],
];

function table(slide: number): string {
  const head = ["Item", "Qty", slide >= 5 ? "Price [USD]" : "Price", "Net"];
  const w = head.map((h, c) => Math.max(h.length, ...ROWS.map((r) => r[c]!.length)));

  const headPills: (Pill | undefined)[] =
    slide === 1
      ? [
          QUESTION("a column"),
          QUESTION("column with numbers"),
          QUESTION("another column"),
          QUESTION("yet another column"),
        ]
      : [
          INPUT("input column"),
          INPUT("input column"),
          INPUT("input column"),
          COMPUTED("computed column"),
        ];
  const bodyPills: (Pill | undefined)[] =
    slide === 1
      ? [
          QUESTION("some text"),
          QUESTION("some number"),
          QUESTION("a value"),
          QUESTION("unknown property"),
        ]
      : [undefined, undefined, undefined, undefined];

  const cellText = (txt: string, c: number): string =>
    c === 0 ? padR(txt, w[c]!) : padL(txt, w[c]!);
  // The pill goes on the text, the padding stays outside it.
  const cell = (txt: string, c: number, pill: Pill | undefined, edge: "top" | "bottom"): string => {
    const pad = " ".repeat(w[c]! - txt.length);
    const body = withPill(escapeHtml(txt), pill, edge, c % 2);
    return c === 0 ? body + pad : pad + body;
  };

  const lines = [
    "| " + head.map((h, c) => cell(h, c, headPills[c], "top")).join(" | ") + " |",
    "|" + w.map((n, c) => "-".repeat(n + (c === 0 ? 2 : 1)) + (c === 0 ? "" : ":")).join("|") + "|",
  ];
  ROWS.forEach((r, i) => {
    const last = i === ROWS.length - 1;
    lines.push(
      "| " +
        r
          .map((t, c) => (last ? cell(t, c, bodyPills[c], "bottom") : escapeHtml(cellText(t, c))))
          .join(" | ") +
        " |",
    );
  });
  return lines.join("\n");
}

/** A line of the vmark block, optionally annotated. */
const stmt = (code: string, pill?: Pill): string =>
  pill
    ? withPill(`<span class="s">${escapeHtml(code)}</span>`, pill, "end", 0)
    : `<span class="s">${escapeHtml(code)}</span>`;

function fence(slide: number): string {
  if (slide < 2) return "";
  const out = ['<span class="k">```vmark #order</span>'];
  if (slide >= 8)
    out.push(
      stmt("param budget [USD] = default 150", {
        kind: "param",
        icon: "#",
        text: "parametrized value with default",
      }),
    );
  out.push(stmt("Net = Price * Qty", FORMULA("computed column formula")));
  if (slide >= 3) out.push(stmt("order_total = SUM(Net)", FORMULA("computed value formula")));
  if (slide >= 8) {
    out.push(
      stmt("assert order_total < budget", { kind: "fail", icon: "!", text: "assertion failed" }),
    );
  } else if (slide >= 6) {
    out.push(
      stmt("assert order_total < 150", {
        kind: "assert",
        icon: "!",
        text: "this must hold for document to be valid",
      }),
    );
  }
  out.push('<span class="k">```</span>');
  return out.join("\n");
}

function prose(slide: number): string {
  if (slide <= 2) {
    return (
      "Order total: " +
      withPill("**148.00**", QUESTION("not sure where it came from, probably correct"), "bottom")
    );
  }
  const anchorRule = slide >= 5 ? "|unit" : "";
  const comment = `<span class="c">&lt;!--vmark=order.order_total${anchorRule}--&gt;</span>`;
  if (slide === 3) {
    const stale: Pill = { kind: "stale", icon: "≠", text: "STALE - run fmt to recalculate" };
    return "Order total: " + withPill("**148.00**", stale, "bottom") + comment;
  }
  const carries = slide >= 5;
  const anchored: Pill = {
    kind: "anchor",
    icon: "⚓︎",
    text: carries ? "anchored value carrying a unit" : "anchored value",
  };
  const value = carries ? "**158.00 USD**" : "**158.00**";
  const cls = slide === 4 || slide === 5 ? ' class="chg"' : "";
  return "Order total: " + withPill(`<span${cls}>${value}</span>`, anchored, "bottom") + comment;
}

function document_(slide: number): string {
  const parts = [table(slide)];
  const f = fence(slide);
  if (f) parts.push("", f);
  parts.push("", prose(slide));
  return parts.join("\n");
}

const P = '<span class="p">$</span>';
const cm = (t: string): string => `<span class="c">${escapeHtml(t)}</span>`;
const bad = (t: string): string => `<span class="bad">${escapeHtml(t)}</span>`;

const CHECK = [
  `${P} visimark check order.md`,
  "order.md",
  "",
  `  ${bad("ASSERT")}  #order   order_total < 150`,
  "          158.00 USD < 150   is false",
  "",
  "  1 problem (0 stale, 1 assert)",
  `${P} echo $?`,
  "1",
].join("\n");

const SCENARIO_OUT = [
  "order.budget       [USD]  200",
  "order.order_total  [USD]  158",
  "order.Net          50, 60, 48",
  "scenario: -",
  `  order.budget  200  scenario  ${cm("(default 150)")}`,
  `${P} echo $?`,
  "0",
];

const SCENARIO = [
  `${P} echo '{ "budget": "200" }' | visimark eval --scenario - order.md`,
  ...SCENARIO_OUT,
].join("\n");

const EXTRACT = [
  cm("# approvals.md says what the budget is. Read it from there."),
  `${P} BUDGET=$(visimark eval approvals.md --get limits.budget)`,
  `${P} echo "{ \\"budget\\": \\"$BUDGET\\" }" | visimark eval --scenario - order.md`,
  ...SCENARIO_OUT,
].join("\n");

const TITLES: [string, string | undefined][] = [
  ["Let's start with unverifiable Markdown", "Infer formulas from document"],
  ["Inference makes Markdown verifiable", "Sum up and anchor numbers in prose"],
  ["Numbers in prose can be derived, too", "Recalculate stale values"],
  ["Numbers never get stale", "Hang on, 158 of what?"],
  ["Units carry through computation", "Pity the budget is only $150"],
  ["Assertions enforce hard constraints", "What prevents me from committing it?"],
  ["Build fails when the document disagrees with itself", "Can we make the budget a parameter?"],
  ["Markdown can be parametrized", "Is there a different scenario?"],
  ["Running scenarios", "What if the value sits in another Markdown?"],
  ["Knowledge extraction from Markdown documents", undefined],
];

export const SLIDE_COUNT = TITLES.length;

/** Slide `n`, 1-based. */
export function slideAt(n: number): Slide {
  const [title, next] = TITLES[n - 1]!;
  const terminal = n === 7 ? CHECK : n === 9 ? SCENARIO : n === 10 ? EXTRACT : undefined;
  return {
    title,
    ...(next ? { next } : {}),
    tab: terminal ? "terminal" : "order.md",
    html: terminal ?? document_(n),
  };
}

/**
 * Wires the tour markup in index.html. A pill that opens stays open until the
 * slide changes: hovering opens, nothing closes.
 */
export function wireTour(): void {
  const root = document.getElementById("tour");
  if (!root) return;
  const el = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const title = el("#tour-title");
  const step = el("#tour-step");
  const tab = el("#tour-tab");
  const editor = el("#tour-editor");
  const next = el<HTMLButtonElement>("#tour-next");
  const dots = el("#tour-dots");

  const dotEls: HTMLButtonElement[] = [];
  for (let i = 1; i <= SLIDE_COUNT; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i);
    b.setAttribute("aria-label", `Slide ${i} of ${SLIDE_COUNT}`);
    b.addEventListener("click", () => show(i));
    dots.append(b);
    dotEls.push(b);
  }

  let current = 1;
  function show(n: number): void {
    current = n;
    const s = slideAt(n);
    title.textContent = s.title;
    step.textContent = `${n} / ${SLIDE_COUNT}`;
    tab.textContent = s.tab;
    editor.classList.toggle("is-terminal", s.tab === "terminal");
    setTrustedHtml(editor, s.html);
    next.hidden = !s.next;
    next.textContent = s.next ? `${s.next} →` : "";
    dotEls.forEach((d, i) => {
      d.classList.toggle("is-active", i + 1 === n);
      d.setAttribute("aria-current", i + 1 === n ? "step" : "false");
    });
  }

  const open = (e: Event): void => {
    const pill = (e.target as Element).closest?.(".pill");
    if (pill) pill.classList.add("open");
  };
  editor.addEventListener("pointerover", open);
  editor.addEventListener("focusin", open);
  editor.addEventListener("click", open);

  next.addEventListener("click", () => show(current + 1));
  show(1);
}
