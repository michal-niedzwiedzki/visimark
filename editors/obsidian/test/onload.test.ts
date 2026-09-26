import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { App } from "obsidian";
import { FINDINGS_VIEW } from "../src/findings-view.js";
import { SWEEP_VIEW } from "../src/sweep-view.js";
import { harnessApp, harnessManifest } from "./harness/app.js";
import { MarkdownView, notices, type HarnessEditor } from "./harness/obsidian.js";

/**
 * A `bun test` harness for the Obsidian glue, at last — review row 12.
 * `main.test.ts`'s own comment explained why it was a regex over the source
 * instead of a real test: nothing could load the real `obsidian` module and
 * call `onload`. `test/harness/` is the stub that changes that, and this
 * file is the first thing it makes possible: constructing the real plugin
 * class, calling its real `onload`, and driving `refresh` end to end.
 *
 * Each test here is one past defect from the branch's own commit history,
 * chosen so it would have failed before its fix:
 * - a double `registerView` disabled the whole plugin (#214);
 * - `refresh` must tell an ordinary note from `example-invoice.md`.
 */

async function loadedPlugin() {
  const VisiMarkPlugin = (await import("../src/main.js")).default;
  const app = harnessApp();
  // `Plugin`'s real constructor signature (from `obsidian.d.ts`) is what
  // `tsc` checks this against; the harness app satisfies what the plugin
  // actually calls, not that interface's every member, so this cast is the
  // harness's own documented trade-off (see app.ts's header).
  const plugin = new VisiMarkPlugin(app as unknown as App, harnessManifest as never);
  await plugin.onload();
  return { plugin, app };
}

test("onload succeeds and registers each view type once", async () => {
  const { plugin } = await loadedPlugin();
  // `Plugin.registerView` (the harness's own, matching the real one) throws
  // synchronously on a repeat type — onload resolving at all is the proof
  // #214's defect (a pasted second registerView call) is gone
  const registered = [
    ...(plugin as unknown as { registeredViews: Map<string, unknown> }).registeredViews.keys(),
  ];
  expect(registered.sort()).toEqual([FINDINGS_VIEW, SWEEP_VIEW].sort());
});

test("refresh shows the hidden state for an ordinary note", async () => {
  const { plugin, app } = await loadedPlugin();
  const view = new MarkdownView("# Groceries\n\n- milk\n- bread\n");
  app.workspace.setActiveView(view);

  (plugin as unknown as { refresh(): void }).refresh();
  // refreshState is async even for the hidden path's synchronous branch, so
  // give its microtask a turn before reading the status bar
  await Promise.resolve();
  await Promise.resolve();

  const status = (plugin as unknown as { status: HTMLElement | null }).status;
  expect(status?.textContent ?? "").toBe("");
});

test("refresh shows the clean state for example-invoice.md", async () => {
  const source = readFileSync(resolve(import.meta.dir, "../../../docs/example-invoice.md"), "utf8");

  const { plugin, app } = await loadedPlugin();
  app.vault.setFile("example-invoice.md", source);
  const view = new MarkdownView(source, app.vault.getAbstractFileByPath("example-invoice.md"));
  app.workspace.setActiveView(view);

  (plugin as unknown as { refresh(): void }).refresh();
  // the clean path awaits a vault read (`analyseWithSnapshot`) before it can
  // paint; a handful of microtask turns is enough for an in-memory read with
  // nothing left to await after it settles
  for (let i = 0; i < 10; i++) await Promise.resolve();

  const status = (plugin as unknown as { status: HTMLElement | null }).status;
  expect(status?.textContent).toBe("VisiMark ✓");
});

test("notice log stays clean across a successful load", async () => {
  const before = notices.length;
  await loadedPlugin();
  expect(notices.length).toBe(before);
});

test("format refuses a repair if the buffer changed while it was being checked", async () => {
  // `format` awaits a vault read (`noteFor` -> `readNote`) before it can
  // apply anything; a keystroke landing in that gap must not corrupt the
  // buffer with offsets that describe a document which no longer exists
  const source = readFileSync(
    resolve(import.meta.dir, "../../../docs/example-invoice-drift.md"),
    "utf8",
  );
  const { plugin } = await loadedPlugin();
  const view = new MarkdownView(source);
  const editor = view.editor;

  const formatCommand = (
    plugin as unknown as {
      commands: { id: string; editorCallback?: (editor: HarnessEditor) => void }[];
    }
  ).commands.find((c) => c.id === "format");
  expect(formatCommand?.editorCallback).toBeDefined();

  const before = notices.length;
  formatCommand!.editorCallback!(editor);
  // the command's own `readNote` await has not settled yet — this is the gap
  editor.setValue(source + "\n<!-- edited during the check -->\n");
  // let every microtask the in-flight read still owes it run to completion
  for (let i = 0; i < 10; i++) await Promise.resolve();

  expect(notices.slice(before)).toContain(
    "This note changed while it was being checked. Try Format again.",
  );
  // the repair was refused, so the buffer holds exactly the edit the test
  // made and none of `fmt`'s own repairs
  expect(editor.getValue()).toBe(source + "\n<!-- edited during the check -->\n");
});

test("a hover on a mark explains the note data-vmark-path names, not the active one", async () => {
  // v1 row 3: `data-vmark-path` is what lets a hover in a background pane
  // explain *that* note rather than whichever one is focused
  const backgroundSource = readFileSync(
    resolve(import.meta.dir, "../../../docs/example-invoice.md"),
    "utf8",
  );
  const { app } = await loadedPlugin();
  app.vault.setFile("background-note.md", backgroundSource);

  // the active view is a different, ordinary note — a hover that answered
  // from it instead of the mark's own data-vmark-path would find nothing
  const activeView = new MarkdownView("# Groceries\n\n- milk\n- bread\n");
  app.workspace.setActiveView(activeView);

  const mark = document.createElement("span");
  mark.setAttribute("data-vmark", "lines.net_total");
  mark.setAttribute("data-vmark-path", "background-note.md");
  document.body.appendChild(mark);

  mark.dispatchEvent(new PointerEvent("pointerover", { pointerType: "mouse", bubbles: true }));
  for (let i = 0; i < 10; i++) await Promise.resolve();

  expect(mark.hasAttribute("data-vmark-hovered")).toBe(true);
  expect(mark.getAttribute("data-tooltip")).toContain("23300");
});
