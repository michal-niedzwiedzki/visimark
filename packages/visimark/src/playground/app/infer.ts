/**
 * The INFERENCE tab — the adoption story: drop in a plain, unannotated .md and
 * see the rules/scalars VisiMark would add before committing to anything.
 *
 * "Infer only" mirrors plain `visimark infer FILE` (proposals shown, document
 * untouched); "Infer and write" mirrors `visimark infer FILE --write`
 * (proposals applied back into the editor). TERMINAL only gets the action's
 * one-line outcome, same as every other command.
 */

import type { VisiMarkApi } from "../browser-entry.js";
import type { FileStore } from "./store.js";
import type { Pipeline } from "./pipeline.js";
import type { Quest } from "./quest.js";
import type { Terminal } from "./terminal.js";
import { byId } from "./dom.js";
import { pluralize } from "./pipeline.js";

export interface InferPanel {
  /** Restores the placeholder text — what a file switch shows. */
  reset(): void;
  bodyEl: HTMLElement;
}

export function createInferPanel(
  VM: VisiMarkApi,
  cm: CodeMirrorEditor,
  store: FileStore,
  terminal: Terminal,
  pipeline: Pipeline,
  quest: () => Quest,
): InferPanel {
  const bodyEl = byId("infer-body");
  const placeholder = bodyEl.textContent ?? "";

  function runInfer(write: boolean): void {
    const current = store.current();
    const source = cm.getValue();
    quest().signal("action:infer-run");
    terminal.cmd(`visimark infer ${current}${write ? " --write" : ""}`);
    let proposals;
    try {
      proposals = VM.infer(source);
    } catch (e) {
      bodyEl.textContent = `error: ${(e as Error).message}`;
      terminal.line(`visimark: ${(e as Error).message}`, "err");
      return;
    }
    bodyEl.textContent = VM.formatInfer(current, source, proposals);
    if (!write) return;
    quest().signal("action:infer-write");
    const edits = VM.planInfer(source, proposals);
    if (edits.length === 0) {
      terminal.line(`${current}: nothing to write`);
    } else {
      const updated = VM.applyEdits(source, edits);
      const cursor = cm.getCursor();
      cm.setValue(updated);
      cm.setCursor(cursor);
      store.setText(current, updated);
      // `setText` is memory; `persist` is the reload (review §2.7). Every
      // other writer to the buffer does both — the typing-settle in
      // ./pipeline.ts, `switchTo` and `add` in ./store.ts — and this was the
      // one that did not, so an inferred block was the single edit a reload
      // threw away. `cancelPendingRefresh()` below kills the typing-settle
      // that would otherwise have caught it, and `cm.setValue` fires `change`
      // with origin "setValue", which the handler skips, so nothing else was
      // ever going to save this (follow-up review §2.4).
      store.persist(current);
      const blocks = edits.filter((e) => e.kind === "block").length;
      const anchors = edits.filter((e) => e.kind === "anchor").length;
      const bits: string[] = [];
      if (blocks) bits.push(pluralize(blocks, "block"));
      if (anchors) bits.push(pluralize(anchors, "anchor"));
      terminal.line(`${current}: wrote ${bits.join(", ")}`);
    }
    pipeline.cancelPendingRefresh();
    pipeline.runNow();
  }

  byId("infer-btn").addEventListener("click", () => runInfer(false));
  byId("infer-write-btn").addEventListener("click", () => runInfer(true));

  return {
    reset() {
      bodyEl.textContent = placeholder;
    },
    bodyEl,
  };
}
