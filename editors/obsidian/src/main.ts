import { MarkdownView, Notice, Plugin, debounce } from "obsidian";
import { hasVmarkBlock } from "./gate.js";
import { TEMPLATES } from "./templates.js";

/**
 * VisiMark for Obsidian — v1 row 1 of #176: the browser bundle, and activation
 * gated on a ```vmark fence.
 *
 * **What this row ships, and what it deliberately does not.** The package, the
 * build that produces one `main.js` with no `node:` specifier in it, the
 * activation gate, and exactly one witness that the gate flipped. Provenance
 * decorations (row 2), the hover popover (row 3), the five commands (row 4),
 * the findings view (row 6) and the ribbon (row 12) are each their own row and
 * are not here. Nothing in this file calls `check`, so nothing here needs a
 * `ReaderPort`; `locate` is the only engine entry point row 1 touches.
 *
 * **The witness.** `docs/design/obsidian-manual-test.md` §2.1 has two halves.
 * The negative half — an ordinary note shows nothing — is satisfied by a
 * plugin that draws nothing at all, which is not worth much. The positive half
 * is one line: "Open `example-invoice.md`. Pass: VisiMark activates." Every
 * surface that could show that belongs to a later row, so this row ships the
 * smallest thing that makes §2.1 runnable whole: a status bar item that reads
 * `VisiMark` when the gate is open and is not rendered when it is not. It
 * reports the gate and nothing else — no verdict, no count, no engine call
 * beyond the gate's own parse. Row 12 adds the ribbon and the checked /
 * findings states on top of this element rather than inventing one.
 *
 * **Why the item is hidden rather than removed.** `addStatusBarItem()` has no
 * inverse, and calling it again on every activation would append a second
 * element and a second registration for the life of the session. So the
 * element is created once and carries `visimark-hidden` while the gate is
 * shut, which `styles.css` renders as `display: none`. The pass condition in
 * §2.1 is that a vault of ordinary notes is *indistinguishable* from one
 * without the plugin; an element that is never rendered meets it.
 */
export default class VisiMarkPlugin extends Plugin {
  private status: HTMLElement | null = null;

  /**
   * `editor-change` fires per keystroke and the gate is a full parse of the
   * note — `locate` runs remark over the whole document. Debounced so that
   * typing costs one parse per pause rather than one per character. `true`
   * is leading-edge: the first keystroke after a pause is answered at once,
   * which is what makes adding a fence feel immediate.
   */
  private readonly refreshSoon = debounce(() => this.refresh(), 400, true);

  override onload(): void {
    this.status = this.addStatusBarItem();
    this.status.addClass("visimark-status");
    this.status.setAttribute("aria-live", "polite");

    // v1 row 10. One command per template rather than a picker: four palette
    // entries are searchable by name, and a modal is UI that nothing can test.
    //
    // **These are deliberately not gated.** Every *reading* surface is gated
    // on the active note containing a ```vmark block (§2.3), but a command
    // whose job is to create the first one cannot be — a person with no
    // VisiMark note could never get one. Constraint 4 is about a vault of
    // ordinary notes being indistinguishable from one without the plugin, and
    // a palette entry is visible only to someone who went looking for it.
    for (const template of TEMPLATES) {
      this.addCommand({
        id: `insert-${template.id}-template`,
        name: `Insert ${template.title.toLowerCase()} template`,
        editorCallback: (editor) => {
          editor.replaceSelection(template.body);
          new Notice(`Inserted the ${template.title.toLowerCase()} template.`);
          this.refresh();
        },
      });
    }

    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.refreshSoon()));

    // the workspace is not ready during onload, and asking before it is gives
    // the wrong answer for the note the vault opens on
    this.app.workspace.onLayoutReady(() => this.refresh());
  }

  /** Re-ask the gate for the active note and show or hide the witness. */
  private refresh(): void {
    if (this.status === null) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const active = view !== null && hasVmarkBlock(view.getViewData());
    this.status.setText(active ? "VisiMark" : "");
    this.status.toggleClass("visimark-hidden", !active);
  }
}
