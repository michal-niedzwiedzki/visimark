import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `Plugin.registerView` throws `Attempting to register an existing view type`
 * the second time it is called with the same type — Obsidian has no dedup —
 * and the throw happens inside `onload`, which disables the whole plugin.
 * PR #214 pasted the `FINDINGS_VIEW` registration and its `show-findings`
 * command a second time under row 10; nothing caught it because there is no
 * `bun test` harness that can load the real `obsidian` module and call
 * `onload`. This is the cheap static guard instead: every `registerView` call
 * in `main.ts` names a distinct view type.
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

test("main.ts registers each view type at most once", () => {
  const types = [...source.matchAll(/this\.registerView\((\w+),/g)].map((m) => m[1]!);
  expect(types.length, "no registerView call found — has the pattern changed?").toBeGreaterThan(0);
  const seen = new Set<string>();
  const dupes = types.filter((t) => (seen.has(t) ? true : (seen.add(t), false)));
  expect(dupes, `registered twice: ${dupes.join(", ")}`).toEqual([]);
});
