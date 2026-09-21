// Review §2.3's guard.
//
// `grep -c 'role='` over docs/playground.html returned 0, and `grep -c
// '<label'` returned 0: the six .diag-tab buttons were two tab sets in every
// respect except the ones a screen reader can perceive, the editor had no
// accessible name, and neither the eight transitions nor the full-screen
// confetti burst asked whether the visitor wanted movement.
//
// The tab pattern is deliberately split between markup (structure: roles, ids,
// aria-controls) and src/playground/app/tabs.ts (state: aria-selected, the
// roving tabindex). **This file is the markup half only.** It asserts on the
// shipped artifact, which is the thing a screen reader actually sees.
//
// The module half used to be here too, as four greps for source text —
// `expect(tabs).toContain('tab.setAttribute("aria-selected", String(active))')`
// and friends. Follow-up review §2.7: that passes a behaviour change which
// keeps the string and fails a rename which keeps the behaviour, which is a
// change-detector rather than the regression guard §2.3 asked for. It moved to
// app/tabs.test.ts, where the module is driven instead of read.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(import.meta.dir, "../../../../docs/playground.html"), "utf8");
const appDir = join(import.meta.dir, "../../src/playground/app");
const files = readFileSync(join(appDir, "files.ts"), "utf8");
const quest = readFileSync(join(appDir, "quest.ts"), "utf8");

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

const tabTags = [...page.matchAll(/<button[^>]*class="diag-tab[^"]*"[^>]*>/g)].map((m) => m[0]);
const panelTags = [...page.matchAll(/<div[^>]*class="diag-view[^"]*"[^>]*>/g)].map((m) => m[0]);

describe("the tab pattern", () => {
  test("both tab strips are labelled tablists", () => {
    const tablists = [...page.matchAll(/<div class="panel-head" role="tablist"[^>]*>/g)];
    expect(tablists).toHaveLength(2);
    for (const [tag] of tablists) expect(attr(tag, "aria-label")).toBeTruthy();
  });

  test("every tab declares its role and the panel it controls", () => {
    expect(tabTags).toHaveLength(6);
    for (const tag of tabTags) {
      expect(attr(tag, "role")).toBe("tab");
      expect(attr(tag, "id")).toBeTruthy();
      expect(attr(tag, "aria-controls")).toBeTruthy();
      expect(attr(tag, "aria-selected")).toMatch(/^(true|false)$/);
    }
  });

  test("every tab's aria-controls names a real panel, which names it back", () => {
    expect(panelTags).toHaveLength(6);
    const panels = new Map(panelTags.map((tag) => [attr(tag, "id")!, tag]));
    for (const tag of tabTags) {
      const panel = panels.get(attr(tag, "aria-controls")!);
      expect(panel, `${attr(tag, "id")} controls a panel that does not exist`).toBeDefined();
      expect(attr(panel!, "role")).toBe("tabpanel");
      expect(attr(panel!, "aria-labelledby")).toBe(attr(tag, "id"));
      // focusable, so the scrollable content inside can be reached by keyboard
      expect(attr(panel!, "tabindex")).toBe("0");
    }
  });

  test("exactly one tab per group starts selected", () => {
    for (const group of ["term", "diag"]) {
      const inGroup = tabTags.filter((t) => attr(t, "data-group") === group);
      expect(inGroup.filter((t) => attr(t, "aria-selected") === "true")).toHaveLength(1);
      // roving tabindex: the selected one is the strip's only tab stop
      expect(inGroup.filter((t) => attr(t, "tabindex") === "0")).toHaveLength(1);
    }
  });

  // Selection state moving with the selection, arrow-key operation, Home/End,
  // wrapping and automatic activation are all behaviour, and are driven in
  // test/playground/app/tabs.test.ts.
});

describe("the editor's accessible name", () => {
  test("is set on the textarea CodeMirror actually hands to assistive tech", () => {
    expect(files).toContain('cm.getInputField().setAttribute("aria-label"');
  });

  test("tracks the file, in the same place the visible filename does", () => {
    expect(files).toContain("filenameEl.textContent = name;");
    expect(files).toContain("setEditorName(name);");
  });
});

describe("prefers-reduced-motion", () => {
  test("the page collapses its transitions", () => {
    expect(page).toContain("@media (prefers-reduced-motion: reduce)");
    expect(page).toContain("transition-duration: 0.01ms !important;");
  });

  test("the confetti burst is suppressed, since CSS cannot reach a canvas", () => {
    expect(quest).toContain("if (prefersReducedMotion()) return;");
    // ...and the reveal is not held back 1.4s waiting for stars that never flew
    expect(quest).toContain("confettiFired ? CONFETTI_SETTLE_MS : 0");
  });
});
