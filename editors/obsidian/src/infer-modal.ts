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

    // the CLI's negative result, shown rather than asserted: the comment
    // Insert is about to write, not a summary of it
    if (this.preview.marker !== null) {
      contentEl.createEl("pre", { cls: "visimark-infer-block" }).createEl("code", {
        text: this.preview.marker,
      });
    }

    if (this.preview.removesMarker) {
      contentEl.createEl("p", {
        cls: "visimark-infer-note",
        text: "This table already said it had no formulas to check. That comment will be removed, since it now does.",
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
 * The write goes through the editor, as one `transaction`: the buffer is what
 * the person is looking at, and a single dispatch is one undo step for a plan
 * that can be several non-adjacent edits — a fence after each table, plus an
 * anchor comment per bound number. Each edit uses both its endpoints, not
 * just `start`: most are zero-width insertions, but the one exception — a
 * stale `<!--vmark:no-formulas-->` this same plan makes false — is a real
 * deletion (`infer-plan.ts`'s header), and applying it at a zero-width point
 * would leave the marker behind for `check` to flag as `COVERAGE`.
 */
export function offerInfer(app: App, editor: Editor, preview: InferPreview): void {
  if (isEmpty(preview)) {
    new Notice("There is nothing here for VisiMark to work out yet.");
    return;
  }
  new InferModal(app, preview, () => {
    editor.transaction({
      changes: preview.inserts.map((insert) => ({
        from: editor.offsetToPos(insert.start),
        to: editor.offsetToPos(insert.end),
        text: insert.text,
      })),
    });
    new Notice(
      preview.marker !== null
        ? "Marked. Nothing you had written was changed."
        : "Inserted. Nothing you had written was changed.",
    );
  }).open();
}
