import { Modal, Notice, type App } from "obsidian";
import { valueRows, valuesJson } from "./values.js";
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

    // v1 row 11. It is here rather than behind its own command because the
    // question it answers — "give me these numbers" — is the one already on
    // screen, and #176 rates it as making the plugin API discoverable to a
    // person: this is what `api.evaluate` returns, in a form they can paste.
    const actions = contentEl.createDiv({ cls: "visimark-values-actions" });
    const copy = actions.createEl("button", {
      cls: "mod-cta",
      text: "Copy as JSON",
      attr: { type: "button", "aria-label": "Copy these values to the clipboard as JSON" },
    });
    copy.addEventListener("click", () => {
      void navigator.clipboard.writeText(valuesJson(this.values)).then(
        () => new Notice("Copied. This is what `visimark eval --json` reports."),
        () => new Notice("Could not reach the clipboard."),
      );
    });

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
