import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  debounce,
  setTooltip,
  type Editor,
  type WorkspaceLeaf,
} from "obsidian";
import { check } from "visimark";
import { FINDINGS_VIEW, FindingsView } from "./findings-view.js";
import { hasVmarkBlock } from "./gate.js";
import { createApi, type VisiMarkApi } from "./api.js";
import { nameAt } from "./at-cursor.js";
import { ExplainModal } from "./explain-modal.js";
import { offerInfer } from "./infer-modal.js";
import { previewInfer } from "./infer-plan.js";
import { reportFor } from "./report.js";
import { readNote } from "./snapshot.js";
import { rowFrom, summaryFor } from "./hover.js";
import { livePreviewMarks } from "./live-preview.js";
import { decorateSection } from "./reading-mode.js";
import { HIDDEN, UNKNOWN, statusFor } from "./status.js";
import { SWEEP_VIEW, SweepView } from "./sweep-view.js";
import { ValuesModal } from "./values-modal.js";
import { vaultSweepRead } from "./vault.js";

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
   * v1 row 9 — the public API, reached as
   * `app.plugins.plugins["visimark"].api`.
   *
   * A field rather than something built on demand, because that is the shape
   * a caller can hold: a second plugin loading after this one finds it there,
   * and `apiVersion` tells it what it found. `api.ts` has the surface and the
   * reasoning; this is the one line that publishes it.
   */
  readonly api: VisiMarkApi = createApi(
    (path) => vaultSweepRead(this.app.vault)(path),
    (file) => (file instanceof TFile ? file.path : typeof file === "string" ? file : null),
  );

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
      id: "check",
      name: "Check this note",
      callback: () => void this.openFindings(),
    });

    // v1 row 8. **Not gated**, and for a different reason than the template
    // commands: §2.3's gate is a question about the *active note*, and a
    // vault-wide scan does not have one. Refusing to look through the vault
    // because the note in front of you happens to have no block would be the
    // gate answering a question it was not asked.
    // v1 row 4. The five verbs the CLI has, each scoped to the active note.
    // Named "<verb> this note" rather than the bare verb: the palette is
    // searchable by the word someone read in the documentation *and* reads as
    // a sentence to someone who has read none of it.
    this.addCommand({
      id: "format",
      name: "Format this note",
      editorCallback: (editor) => void this.format(editor),
    });
    this.addCommand({
      id: "evaluate",
      name: "Evaluate this note",
      editorCallback: (editor) => void this.evaluate(editor),
    });
    this.addCommand({
      id: "explain",
      name: "Explain this value",
      editorCallback: (editor) => void this.explain(editor),
    });

    // v1 row 5, the on-ramp. **Not gated**, by the creating/reading rule in
    // §2.3: its job is to produce a note's first ```vmark block, and a table
    // someone has just pasted is exactly the note that has none.
    this.addCommand({
      id: "infer",
      name: "Infer the formulas",
      editorCallback: (editor) => {
        const selection = editor.getSelection();
        const span =
          selection.length > 0
            ? {
                start: editor.posToOffset(editor.getCursor("from")),
                end: editor.posToOffset(editor.getCursor("to")),
              }
            : undefined;
        offerInfer(this.app, editor, previewInfer(editor.getValue(), span));
      },
    });

    this.registerView(SWEEP_VIEW, (leaf: WorkspaceLeaf) => new SweepView(leaf));
    this.addCommand({
      id: "sweep",
      name: "Sweep the vault",
      callback: () => void this.openSweep(),
    });

    // v1 row 2 — the moment the product explains itself. Both renderers, per
    // #176's row 2 and manual test §2.2: reading mode is what a reader sees,
    // Live Preview is what an author does. Neither writes; a decoration is a
    // class on rendered output, and the note copied out of the vault is
    // untouched, which is §2.2's pass condition.
    this.registerMarkdownPostProcessor((el, ctx) => decorateSection(el, ctx));
    this.registerEditorExtension(livePreviewMarks());

    // v1 row 3 — what makes row 2's marks legible rather than decorative. One
    // delegated listener rather than one per decoration: the post-processor
    // runs per section and per re-render, and a listener attached there would
    // be attached again every time.
    //
    // Hover answers on the desktop and a tap answers everywhere, because a
    // phone has no hover — and #176's row 3 is "hover / tap" for that reason.
    this.registerDomEvent(document, "pointerover", (event) => {
      const el = target(event);
      if (el === null || el.hasAttribute("data-vmark-hovered")) return;
      el.setAttribute("data-vmark-hovered", "");
      void this.describe(el).then((line) => {
        if (line !== null) setTooltip(el, line, { placement: "top" });
      });
    });
    this.registerDomEvent(document, "click", (event) => {
      const el = target(event);
      if (el === null) return;
      void this.explainElement(el);
    });

    this.status = this.addStatusBarItem();
    this.status.addClass("visimark-status");
    this.status.setAttribute("aria-live", "polite");
    // v1 row 12: the status bar is how the findings view is found at all, so
    // it is the way in rather than only a readout.
    this.status.addClass("mod-clickable");
    this.status.setAttribute("role", "button");
    this.status.setAttribute("tabindex", "0");
    this.registerDomEvent(this.status, "click", () => void this.openFindings());
    this.registerDomEvent(this.status, "keydown", (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void this.openFindings();
    });

    // The ribbon is the other way in, and the only one visible before a note
    // is open. It is not gated: it opens a vault-wide scan, which has no
    // active note to ask about (§2.3).
    this.addRibbonIcon(
      "search-check",
      "Sweep the vault with VisiMark",
      () => void this.openSweep(),
    );

    // v1 row 6. The view owns its own refreshing — it is a Component, so its
    // listeners die with it — which is also why this file keeps no reference
    // to any instance of it.
    this.registerView(FINDINGS_VIEW, (leaf: WorkspaceLeaf) => new FindingsView(leaf));
    this.addCommand({
      id: "check",
      name: "Check this note",
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

  /**
   * **Format** — repair everything `fmt` would repair, artifacts declined.
   *
   * The same plan the findings view offers a row at a time, applied whole.
   * v1 constraint 3: an explicit command, never a keystroke or a timer.
   */
  private async format(editor: Editor): Promise<void> {
    const gated = await this.noteFor(editor);
    if (gated === null) return;
    const { report } = gated;
    if (report.allRepairs.length === 0) {
      new Notice("Everything in this note already agrees with its formulas.");
      return;
    }
    const ordered = [...report.allRepairs].sort((a, b) => b.start - a.start);
    for (const edit of ordered) {
      editor.replaceRange(edit.text, editor.offsetToPos(edit.start), editor.offsetToPos(edit.end));
    }
    const n = ordered.length;
    new Notice(`Repaired ${n} ${n === 1 ? "value" : "values"}. No chart was written.`);
  }

  /** **Evaluate** — every name in the note and what it works out to. */
  private async evaluate(editor: Editor): Promise<void> {
    if ((await this.noteFor(editor)) === null) return;
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (file === null || file === undefined) return;
    new ValuesModal(this.app, await this.api.evaluate(file)).open();
  }

  /** **Explain** — the one name the caret is on. */
  private async explain(editor: Editor): Promise<void> {
    const gated = await this.noteFor(editor);
    if (gated === null) return;
    const name = nameAt(gated.model, editor.posToOffset(editor.getCursor()));
    if (name === null) {
      new Notice("Put the cursor on a value VisiMark works out, and ask again.");
      return;
    }
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (file === null || file === undefined) return;
    const explanation = await this.api.explain(file, name);
    if (explanation === null) {
      new Notice(`Nothing in this note is called ${name}.`);
      return;
    }
    new ExplainModal(this.app, explanation).open();
  }

  /**
   * The gate, the read and the check that every note-scoped command starts
   * with — §2.3, and the notice it answers with when the gate is shut.
   */
  private async noteFor(editor: Editor) {
    const source = editor.getValue();
    if (!hasVmarkBlock(source)) {
      new Notice("This note has no VisiMark block, so there is nothing to check in it yet.");
      return null;
    }
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    const path = file?.path ?? "untitled.md";
    const { model, snapshot } = await readNote(source, path, vaultSweepRead(this.app.vault));
    const doc = { path: snapshot.path, reader: snapshot.reader };
    return { model, report: reportFor(model, check(model, { doc }), doc) };
  }

  /** The one line a hover shows for a marked value, or `null`. */
  private async describe(el: HTMLElement): Promise<string | null> {
    const name = el.getAttribute("data-vmark");
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (name === null || file === null || file === undefined) return null;
    try {
      const explanation = await this.api.explain(file, name);
      return explanation === null
        ? null
        : summaryFor(explanation, rowFrom(el.getAttribute("data-vmark-row")));
    } catch {
      // a hover is not a place to report a failure; the status bar and the
      // findings view both already do, and a tooltip that said so would say it
      // on every pointer move
      return null;
    }
  }

  /** A tap on a marked value opens the same dialog Explain does. */
  private async explainElement(el: HTMLElement): Promise<void> {
    const name = el.getAttribute("data-vmark");
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (name === null || file === null || file === undefined) return;
    const explanation = await this.api.explain(file, name);
    if (explanation !== null) new ExplainModal(this.app, explanation).open();
  }

  /** Open the sweep pane, which starts a scan as it opens. */
  private async openSweep(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(SWEEP_VIEW);
    const leaf = existing[0] ?? this.app.workspace.getRightLeaf(false);
    if (leaf === null) return;
    await leaf.setViewState({ type: SWEEP_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  /**
   * Re-ask the gate, and — v1 row 12 — say what the note's state is.
   *
   * Row 1 shipped this as a witness that reported the gate and nothing else,
   * because every surface that could say more belonged to a later row. This
   * is that row: the element is the same one, and it now carries the state
   * `statusFor` renders.
   *
   * The check is asynchronous because the note may read files (§2.6), so the
   * gate is answered first and synchronously — that is what keeps a vault of
   * ordinary notes showing nothing at all without waiting for anything.
   */
  private refresh(): void {
    if (this.status === null) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const source = view?.getViewData() ?? null;
    if (source === null || !hasVmarkBlock(source)) {
      this.show(HIDDEN);
      return;
    }
    void this.refreshState(view!, source);
  }

  private async refreshState(view: MarkdownView, source: string): Promise<void> {
    const path = view.file?.path ?? "untitled.md";
    try {
      const { model, snapshot } = await readNote(source, path, vaultSweepRead(this.app.vault));
      const doc = { path: snapshot.path, reader: snapshot.reader };
      // the note may have changed while the snapshot was being fetched; the
      // next refresh will be along, and a stale verdict is worse than none
      const current = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (current?.getViewData() !== source) return;
      this.show(statusFor(reportFor(model, check(model, { doc }), doc)));
    } catch {
      this.show(UNKNOWN);
    }
  }

  private show(status: { text: string; detail: string }): void {
    if (this.status === null) return;
    this.status.setText(status.text);
    this.status.setAttribute("aria-label", status.detail);
    this.status.toggleClass("visimark-hidden", status.text === "");
  }
}

/** the marked value a pointer event is on, if it is on one */
function target(event: Event): HTMLElement | null {
  const node = event.target;
  if (!(node instanceof HTMLElement)) return null;
  return node.closest<HTMLElement>("[data-vmark]");
}
