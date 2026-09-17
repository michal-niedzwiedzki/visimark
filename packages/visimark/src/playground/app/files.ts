/**
 * The FILES panel, and the one path by which a file becomes current.
 *
 * `switchTo` used to exist twice — once in `selectFile` and once inline in the
 * "+ New" handler — and the two copies had already diverged over whether the
 * terminal gets trimmed (review §2.11). One function now serves both, and the
 * trim happens on every switch, which is the stricter of the two behaviours
 * and the one the cap exists for.
 */

import type { FileStore } from "./store.js";
import type { Pipeline } from "./pipeline.js";
import type { Quest } from "./quest.js";
import type { Tabs } from "./tabs.js";
import type { Terminal } from "./terminal.js";
import type { InferPanel } from "./infer.js";
import { byId } from "./dom.js";

const NEW_FILE_TEMPLATE = "# Untitled\n\nWrite your VisiMark document here.\n";

export interface FilesPanel {
  /** Makes `name` current: flushes the outgoing buffer, loads the new one,
   *  and re-runs every panel that depends on which file is open. */
  switchTo(name: string): void;
  render(): void;
}

export function createFilesPanel(
  cm: CodeMirrorEditor,
  store: FileStore,
  terminal: Terminal,
  pipeline: Pipeline,
  tabs: Tabs,
  inferPanel: InferPanel,
  quest: () => Quest,
): FilesPanel {
  const listEl = byId("file-list");
  const filenameEl = byId("editor-filename");

  function render(): void {
    listEl.innerHTML = "";
    for (const name of store.names()) {
      const b = document.createElement("button");
      b.className = `file-btn${name === store.current() ? " active" : ""}`;
      b.type = "button";
      b.textContent = name;
      b.addEventListener("click", () => switchTo(name));
      listEl.appendChild(b);
    }
  }

  function switchTo(name: string): void {
    if (name === store.current()) return;
    store.switchTo(name);
    cm.setValue(store.text(name) ?? "");
    filenameEl.textContent = name;
    render();
    inferPanel.reset();
    quest().render(name);
    tabs.select("diag", "reasoning");
    pipeline.runFmt();
    pipeline.refreshDerived();
    terminal.trim();
  }

  byId("new-file-btn").addEventListener("click", () => {
    const raw = window.prompt("New file name", "untitled.md");
    if (!raw) return;
    let name = raw.trim();
    if (!name) return;
    if (!/\.md$/i.test(name)) name += ".md";
    store.flush();
    if (!store.add(name, NEW_FILE_TEMPLATE)) {
      window.alert(`${name} already exists.`);
      return;
    }
    switchTo(name);
  });

  return { switchTo, render };
}
