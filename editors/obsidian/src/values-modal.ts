import { Modal, type App } from "obsidian";
import { valueRows } from "./values.js";
import type { JsonValue } from "visimark";

/**
 * v1 row 4's **Evaluate**: every name in the note and what it works out to.
 *
 * A dialog rather than a pane, because it answers a question asked once. The
 * findings view is the thing that stays open; this is a look.
 */
export class ValuesModal extends Modal {
  constructor(
    app: App,
    private readonly values: Record<string, JsonValue>,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle("What this note works out to");
    const { contentEl } = this;
    const rows = valueRows(this.values);

    if (rows.length === 0) {
      contentEl.createEl("p", { text: "This note names no values yet." });
      return;
    }

    const list = contentEl.createEl("dl", { cls: "visimark-values" });
    for (const row of rows) {
      list.createEl("dt", { cls: "visimark-value-name", text: row.name });
      list.createEl("dd", { cls: "visimark-value-value", text: row.value });
    }
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
