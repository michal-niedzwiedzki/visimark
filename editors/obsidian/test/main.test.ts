import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A regex over the source, for the one property a real harness call can't
 * cheaply pin down: which DOM phase a listener is attached in. Everything
 * else this file used to check this way — most notably, whether
 * `main.ts` registers a view type twice (PR #214, row 10) — is now
 * `onload.test.ts`'s job: it loads the real class through `test/harness/`
 * and calls the real `onload`, so a regression there fails on the actual
 * behaviour rather than on a string this file happened to still contain.
 */

const source = readFileSync(resolve(import.meta.dir, "../src/main.ts"), "utf8");

test("format-on-save listens on Window in the capture phase", () => {
  // Obsidian's keymap calls stopPropagation during window capture on Ctrl/Cmd+S,
  // so a bubble listener on Document never sees the chord (issue #243).
  expect(source).toContain(
    'this.registerDomEvent(win, "keydown", onSaveKeydown, { capture: true })',
  );
  expect(source).not.toContain('registerDomEvent(doc, "keydown", onSaveKeydown');
});
