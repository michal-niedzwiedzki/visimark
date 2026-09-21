// Follow-up review §2.7: what the greps in a11y.test.ts were standing in for.
//
// The old guard was `expect(tabs).toContain('tab.setAttribute("aria-selected",
// String(active))')`. Rename `active` to `isActive` — behaviour identical —
// and it failed. Change `tab.tabIndex = active ? 0 : -1` to `tab.tabIndex = 0`
// — the roving tabindex is gone, the APG pattern is broken — and it passed,
// because the string it greps for is on a different line.
//
// So the four module-level assertions moved here, where they assert on what
// the module does. The markup-level assertions stayed in a11y.test.ts: those
// check the shipped artifact, which is the thing a screen reader sees.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { FakeDocument, FakeElement } from "../../support/fake-dom.js";
import { installFakeDom } from "../../support/fake-dom.js";
import { createTabs } from "../../../src/playground/app/tabs.js";

/** The two strips docs/playground.html ships, in its order. */
const STRIPS: Record<string, string[]> = {
  term: ["terminal", "build", "reference"],
  diag: ["reasoning", "knowledge", "inference"],
};

let dom: ReturnType<typeof installFakeDom>;
let doc: FakeDocument;
let signals: string[];

/** One tab strip's buttons, plus the views they control. */
function fixture(): Record<string, FakeElement[]> {
  const byGroup: Record<string, FakeElement[]> = {};
  for (const [group, names] of Object.entries(STRIPS)) {
    byGroup[group] = names.map((name, i) => {
      const view = doc.add("div", `${group}-view-${name}`, "diag-view");
      view.dataset.group = group;
      view.dataset.view = name;
      const tab = doc.add("button", `${group}-tab-${name}`, "diag-tab");
      tab.dataset.group = group;
      tab.dataset.tab = name;
      // The markup ships the first tab of each strip selected.
      tab.setAttribute("aria-selected", String(i === 0));
      tab.tabIndex = i === 0 ? 0 : -1;
      return tab;
    });
  }
  return byGroup;
}

const selected = (tabs: FakeElement[]): string[] =>
  tabs.filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.dataset.tab!);

const stops = (tabs: FakeElement[]): string[] =>
  tabs.filter((t) => t.tabIndex === 0).map((t) => t.dataset.tab!);

beforeEach(() => {
  dom = installFakeDom();
  doc = dom.document;
  signals = [];
});
afterEach(() => dom.restore());

describe("selecting a tab", () => {
  test("moves aria-selected to exactly one tab in that strip", () => {
    const tabs = fixture();
    createTabs((a) => signals.push(a));
    tabs.diag![1]!.click();
    expect(selected(tabs.diag!)).toEqual(["knowledge"]);
  });

  test("leaves the other strip alone", () => {
    const tabs = fixture();
    createTabs((a) => signals.push(a));
    tabs.diag![2]!.click();
    expect(selected(tabs.term!)).toEqual(["terminal"]);
    expect(stops(tabs.term!)).toEqual(["terminal"]);
  });

  test("shows that tab's view and no other", () => {
    fixture();
    createTabs((a) => signals.push(a));
    doc.querySelectorAll('.diag-tab[data-group="term"]')[1]!.click();
    const shown = doc
      .querySelectorAll('.diag-view[data-group="term"]')
      .filter((v) => v.classList.contains("active"))
      .map((v) => v.dataset.view);
    expect(shown).toEqual(["build"]);
  });

  test("signals the quest engine with the tab that was chosen", () => {
    const tabs = fixture();
    createTabs((a) => signals.push(a));
    tabs.term![2]!.click();
    expect(signals).toEqual(["tab:term:reference"]);
  });

  test("`select()` from elsewhere moves the strip the same way a click does", () => {
    // A file switch calls this; before §2.3 it moved the class and not the
    // ARIA state, so the strip looked right and announced the old tab.
    const tabs = fixture();
    const api = createTabs((a) => signals.push(a));
    api.select("diag", "inference");
    expect(selected(tabs.diag!)).toEqual(["inference"]);
    expect(stops(tabs.diag!)).toEqual(["inference"]);
    // ...and it is not a click, so it reports nothing to the quest engine
    expect(signals).toEqual([]);
  });
});

describe("the roving tabindex", () => {
  test("leaves exactly one tab stop per strip after every operation", () => {
    const tabs = fixture();
    const api = createTabs((a) => signals.push(a));
    for (const step of [
      () => tabs.diag![1]!.click(),
      () => api.select("diag", "reasoning"),
      () => tabs.diag![0]!.dispatch("keydown", { key: "End" }),
      () => tabs.diag![2]!.dispatch("keydown", { key: "ArrowRight" }),
    ]) {
      step();
      expect(stops(tabs.diag!)).toHaveLength(1);
      expect(stops(tabs.diag!)).toEqual(selected(tabs.diag!));
    }
  });
});

describe("keyboard operation, per the APG", () => {
  const press = (tab: FakeElement, key: string): void => tab.dispatch("keydown", { key });

  test("ArrowRight from the last tab wraps to the first", () => {
    const tabs = fixture();
    createTabs((a) => signals.push(a));
    press(tabs.term![2]!, "ArrowRight");
    expect(selected(tabs.term!)).toEqual(["terminal"]);
  });

  test("ArrowLeft from the first tab wraps to the last", () => {
    const tabs = fixture();
    createTabs((a) => signals.push(a));
    press(tabs.term![0]!, "ArrowLeft");
    expect(selected(tabs.term!)).toEqual(["reference"]);
  });

  test("Home and End land at the ends", () => {
    const tabs = fixture();
    createTabs((a) => signals.push(a));
    press(tabs.diag![1]!, "End");
    expect(selected(tabs.diag!)).toEqual(["inference"]);
    press(tabs.diag![2]!, "Home");
    expect(selected(tabs.diag!)).toEqual(["reasoning"]);
  });

  test("selection and focus travel together — automatic activation", () => {
    const tabs = fixture();
    createTabs((a) => signals.push(a));
    press(tabs.diag![0]!, "ArrowRight");
    expect(doc.activeElement).toBe(tabs.diag![1]!);
    expect(signals).toEqual(["tab:diag:knowledge"]);
  });

  test("a key the pattern does not claim is left to the browser", () => {
    const tabs = fixture();
    createTabs((a) => signals.push(a));
    let prevented = false;
    tabs.diag![0]!.dispatch("keydown", { key: "Tab", preventDefault: () => (prevented = true) });
    expect(prevented).toBe(false);
    expect(selected(tabs.diag!)).toEqual(["reasoning"]);
  });
});
