import { MarkdownView, Notice, Plugin, debounce, type WorkspaceLeaf } from "obsidian";
import { FINDINGS_VIEW, FindingsView } from "./findings-view.js";
import { hasVmarkBlock } from "./gate.js";

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
    // v1 row 6. The view owns its own refreshing — it is a Component, so its
    // listeners die with it — which is also why this file keeps no reference
    // to any instance of it.
    this.registerView(FINDINGS_VIEW, (leaf: WorkspaceLeaf) => new FindingsView(leaf));
    this.addCommand({
      id: "show-findings",
      name: "Show findings",
      callback: () => void this.openFindings(),
    });

    this.status = this.addStatusBarItem();
    this.status.addClass("visimark-status");
    this.status.setAttribute("aria-live", "polite");

    // v1 row 6. The view owns its own refreshing — it is a Component, so its
    // listeners die with it — which is also why this file keeps no reference
    // to any instance of it.
    this.registerView(FINDINGS_VIEW, (leaf: WorkspaceLeaf) => new FindingsView(leaf));
    this.addCommand({
      id: "show-findings",
      name: "Show findings",
      callback: () => void this.openFindings(),
    });

    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.refreshSoon()));

    // the workspace is not ready during onload, and asking before it is gives
    // the wrong answer for the note the vault opens on
    this.app.workspace.onLayoutReady(() => this.refresh());
  }

  /**
   * Open the findings pane, gated like every other reading surface (§2.3).
   *
   * The command stays in the palette on a note with no block and answers with
   * a notice rather than hiding, because a palette that changes as the active
   * note changes is worse than one that explains itself.
   */
  private async openFindings(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view === null || !hasVmarkBlock(view.getViewData())) {
      new Notice("This note has no VisiMark block, so there is nothing to check in it yet.");
      return;
    }
    const existing = this.app.workspace.getLeavesOfType(FINDINGS_VIEW);
    const leaf = existing[0] ?? this.app.workspace.getRightLeaf(false);
    if (leaf === null) return;
    await leaf.setViewState({ type: FINDINGS_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
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
