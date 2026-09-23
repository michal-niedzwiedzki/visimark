import { Modal, Notice, type App, type Editor } from "obsidian";
import { describePreview, isEmpty, type InferPreview } from "./infer-plan.js";

/**
 * The preview a reader sees before anything is inserted — v1 row 5 of #176,
 * and the half of it that cannot be a test.
 *
 * **Nothing is inserted until this is accepted.** Row 5's whole promise is
 * that `planInfer` only inserts and never rewrites a byte the reader typed,
 * and a promise about someone's pasted table is worth exactly as much as
 * their chance to look at it first. The model behind this — what would be
 * added, and the proof that the original survives inside the result — is
 * `infer-plan.ts`, and it is tested by reconstruction rather than by eye.
 *
 * The text shown is the block as it will appear. Not a summary of it: the
 * reader is about to own these lines, and a paraphrase would be the one thing
 * on screen that is not what happens.
 */
export class InferModal extends Modal {
  constructor(
    app: App,
    private readonly preview: InferPreview,
    private readonly onAccept: () => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle("Work out the formulas");
    const { contentEl } = this;

    contentEl.createEl("p", { cls: "visimark-infer-lead", text: describePreview(this.preview) });

    for (const block of this.preview.blocks) {
      contentEl.createEl("pre", { cls: "visimark-infer-block" }).createEl("code", {
        text: block.trim(),
      });
    }

    const { anchors } = this.preview.counts;
    if (anchors > 0) {
      contentEl.createEl("p", {
        cls: "visimark-infer-note",
        text:
          `${anchors} ${anchors === 1 ? "number" : "numbers"} already in your text ` +
          `${anchors === 1 ? "gets" : "get"} an invisible comment tying ` +
          `${anchors === 1 ? "it" : "them"} to a name, so ` +
          `${anchors === 1 ? "it stays" : "they stay"} checked as the table changes.`,
      });
    }

    const buttons = contentEl.createDiv({ cls: "visimark-infer-buttons" });
    const cancel = buttons.createEl("button", {
      text: "Cancel",
      attr: { type: "button", "aria-label": "Leave the note as it is" },
    });
    cancel.addEventListener("click", () => this.close());

    const accept = buttons.createEl("button", {
      cls: "mod-cta",
      text: "Insert",
      attr: { type: "button", "aria-label": "Insert these formulas into the note" },
    });
    accept.addEventListener("click", () => {
      this.close();
      this.onAccept();
    });
    accept.focus();
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * Show the preview, and insert it if the reader says so.
 *
 * The write goes through the editor and in reverse offset order, for the same
 * two reasons the findings view's repair does: the buffer is what the person
 * is looking at, and earlier offsets stay valid.
 */
export function offerInfer(app: App, editor: Editor, preview: InferPreview): void {
  if (isEmpty(preview)) {
    new Notice("There is nothing here for VisiMark to work out yet.");
    return;
  }
  new InferModal(app, preview, () => {
    const ordered = [...preview.inserts].sort((a, b) => b.start - a.start);
    for (const insert of ordered) {
      const at = editor.offsetToPos(insert.start);
      editor.replaceRange(insert.text, at, at);
    }
    new Notice("Inserted. Nothing you had written was changed.");
  }).open();
}
