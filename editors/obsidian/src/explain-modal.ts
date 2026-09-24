import { Modal, type App } from "obsidian";
import type { Explanation } from "./api.js";

/**
 * One name, what it is worked out from, and what it currently comes to —
 * v1 row 4's **Explain**, and the content v1 row 3's popover will show in
 * place rather than in a dialog.
 *
 * **It is the engine's answer in the engine's own text.** The rule shown is
 * the binding line verbatim out of the note, not a re-rendering of the parsed
 * expression: the reader wrote it, and manual test §2.3's pass condition is
 * that the numbers here match what `visimark explain` prints for the same
 * binding. A paraphrase cannot meet that.
 *
 * What *is* translated is the frame around it — "worked out from", "comes to"
 * — because the reader has never seen a dependency graph and does not need to.
 */
export class ExplainModal extends Modal {
  constructor(
    app: App,
    private readonly explanation: Explanation,
  ) {
    super(app);
  }

  override onOpen(): void {
    const e = this.explanation;
    this.setTitle(e.name);
    const { contentEl } = this;

    contentEl
      .createEl("pre", { cls: "visimark-explain-rule" })
      .createEl("code", { text: e.source });

    const value = Array.isArray(e.value) ? e.value.map((v) => v ?? "?").join(", ") : e.value;
    contentEl.createEl("p", {
      cls: "visimark-explain-value",
      text:
        value === null
          ? "It has no value at the moment — something it reads could not be worked out."
          : `It comes to ${value}.`,
    });

    if (e.inputs.length > 0) {
      contentEl.createEl("p", {
        cls: "visimark-explain-inputs",
        text: `Worked out from ${e.inputs.join(", ")}.`,
      });
    } else {
      contentEl.createEl("p", {
        cls: "visimark-explain-inputs",
        text: "It reads nothing else — it is written down rather than worked out.",
      });
    }

    if (e.precision !== null) {
      contentEl.createEl("p", {
        cls: "visimark-explain-inputs",
        text: `Written to ${e.precision} ${e.precision === 1 ? "decimal place" : "decimal places"}.`,
      });
    }
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
