/**
 * The SIMULATION tab: `visimark simulate FILE`, run on demand.
 *
 * Unlike the other three diagnostics it is not recomputed on every settle —
 * a lattice asks the document dozens of questions — so the visitor starts it.
 * The readings go to the tab, as stdout; what the CLI would say on stderr (how
 * many questions, which sheets could not start, how long it took) goes to
 * TERMINAL, where the other commands' outcomes already live.
 */

import type { VisiMarkApi } from "../browser-entry.js";
import type { FileStore } from "./store.js";
import type { Tabs } from "./tabs.js";
import type { Terminal } from "./terminal.js";
import { byId } from "./dom.js";

export interface SimulatePanel {
  /** Restores the placeholder text — what a file switch shows. */
  reset(): void;
  bodyEl: HTMLElement;
}

export function createSimulatePanel(
  VM: VisiMarkApi,
  cm: CodeMirrorEditor,
  store: FileStore,
  terminal: Terminal,
  tabs: Tabs,
): SimulatePanel {
  const bodyEl = byId("simulate-body");
  const placeholder = bodyEl.textContent ?? "";

  function run(): void {
    const current = store.current();
    terminal.cmd(`visimark simulate ${current}`);
    // The errors belong where the visitor can see them, whichever of
    // TERMINAL/BUILD/REFERENCE was last open.
    tabs.select("term", "terminal");
    try {
      const result = VM.pgSimulate(cm.getValue(), current, store.optsFor(current));
      bodyEl.textContent =
        result.stdout.length > 0 ? result.stdout.join("\n") : "No report statement to read.";
      for (const l of result.stderr) terminal.line(l.text, l.fault ? "err" : undefined);
    } catch (e) {
      bodyEl.textContent = `error: ${(e as Error).message}`;
      terminal.line(`visimark: ${(e as Error).message}`, "err");
    }
  }

  byId("simulate-btn").addEventListener("click", run);

  return {
    reset() {
      bodyEl.textContent = placeholder;
    },
    bodyEl,
  };
}
