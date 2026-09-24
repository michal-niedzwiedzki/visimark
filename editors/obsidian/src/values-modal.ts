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
      // The button's own window, not the global — `Modal.open` can show on
      // an Obsidian pop-out `Window` (since 0.15), and the Clipboard API
      // checks user activation against the window that owns `navigator`.
      // Writing through the main window's `navigator` from a pop-out click
      // has no activation and the promise rejects, or `clipboard` is
      // `undefined` there and the property access throws before `.then` ever
      // runs. Route both into the one failure Notice.
      try {
        const clipboard = copy.win.navigator.clipboard as Clipboard | undefined;
        if (clipboard === undefined) throw new Error("no Clipboard API on this window");
        void clipboard.writeText(valuesJson(this.values)).then(
          () => new Notice("Copied. This is what `visimark eval --json` reports."),
          () => new Notice("Could not reach the clipboard."),
        );
      } catch {
        new Notice("Could not reach the clipboard.");
      }
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
