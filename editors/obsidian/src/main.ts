import {
  MarkdownView,
  Notice,
  Platform,
  Plugin,
  TFile,
  debounce,
  displayTooltip,
  setIcon,
  setTooltip,
  type Editor,
  type WorkspaceLeaf,
} from "obsidian";
import { check, evalValues } from "visimark";
import { FINDINGS_VIEW, FindingsView } from "./findings-view.js";
import { hasVmarkBlock } from "./gate.js";
import { createApi, explainBinding, type VisiMarkApi } from "./api.js";
import { nameAt } from "./at-cursor.js";
import { ExplainModal } from "./explain-modal.js";
import { offerInfer } from "./infer-modal.js";
import { previewInfer } from "./infer-plan.js";
import { reportFor } from "./report.js";
import { readNote } from "./snapshot.js";
import { rowFrom, summaryFor } from "./hover.js";
import { livePreviewMarks } from "./live-preview.js";
import { decorateSection } from "./reading-mode.js";
import { DEFAULT_SETTINGS, type VisiMarkSettings } from "./settings.js";
import { VisiMarkSettingTab } from "./settings-tab.js";
import { HIDDEN, UNKNOWN, statusFor, type Status } from "./status.js";
import { SWEEP_VIEW, SweepView } from "./sweep-view.js";
import { TEMPLATES } from "./templates.js";
import { ValuesModal } from "./values-modal.js";
import { vaultSweepRead } from "./vault.js";

/** the view-header icon for each of `Status`'s non-hidden states (#232) */
const ACTION_ICON: Record<Exclude<Status["kind"], "hidden">, string> = {
  clean: "check-circle-2",
  problems: "alert-circle",
  unknown: "help-circle",
};

/**
 * VisiMark for Obsidian — `onload` wires up every row of v1 (#176) that
 * needs a plugin-lifetime registration: the browser bundle and activation
 * gate (row 1), the reading-mode and Live Preview decorations (row 2), the
 * hover/tap listeners (row 3), the five commands (row 4), the templates (row
 * 10), the findings and sweep panes (rows 6, 8), the public API (row 9) and
 * the status bar plus ribbon (row 12). `noteFor`, `refreshState` and
 * `describe`/`explainElement` all call `check`, through a `ReaderPort` from
 * `snapshot.ts` — row 1's "nothing here needs one" stopped being true once
 * the rows that read a document's imports landed.
 *
 * **The status bar item is the witness row 1 shipped, and row 12 grew into a
 * readout.** `docs/design/obsidian-manual-test.md` §2.1 has two halves. The
 * negative half — an ordinary note shows nothing — is satisfied by a plugin
 * that draws nothing at all, which is not worth much. The positive half is
 * one line: "Open `example-invoice.md`. Pass: VisiMark activates." Row 1
 * shipped the smallest thing that makes §2.1 runnable whole: a status bar
 * item that read `VisiMark` when the gate was open and was not rendered when
 * it was not — the gate and nothing else, no verdict, no count. Row 12 kept
 * the same element and gave it the checked / findings states `statusFor`
 * renders, plus the click-through to the findings view; the ribbon is a
 * second, unconditional entry point next to it, not a state of it.
 *
 * **The status bar is desktop-only, which `addStatusBarItem()`'s own
 * typings say plainly — #232.** It was the *only* witness, so a vault on a
 * phone showed an activated note exactly like an ordinary one: worse than
 * §2.1's negative half, since a reader on mobile could not tell the plugin
 * was doing anything at all. `actionFor`/`showAction` add a second witness
 * on `MarkdownView` itself — a view-header icon, which Obsidian renders on
 * every platform — carrying the same four `Status` states and the same
 * click-through to the findings view. Kept alongside the status bar rather
 * than replacing it: desktop keeps both, and nothing that worked before
 * stops working.
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
   * The mobile witness (#232) — a view-header action, one per open
   * `MarkdownView`. `addStatusBarItem` is desktop-only (Obsidian's own
   * typings say so plainly), and the status bar was the *only* UI that ever
   * showed a note had activated, so on a phone an activated note and an
   * ordinary one were indistinguishable — the opposite of what §2.1 requires,
   * and worse than showing nothing, because "worse than nothing" is a plugin
   * mobile users cannot tell is doing anything at all.
   *
   * `addAction` belongs to a *view instance*, not to the plugin, and a
   * `MarkdownView` is reused across a file switch within the same leaf/tab —
   * calling it again on a view that already has one would append a second
   * icon. Keyed by view rather than a single field, because more than one
   * leaf can be open at once and each has its own header.
   *
   * A `Map`, not a `WeakMap`: `onunload` iterates it to remove every action
   * this plugin instance added. A disable/re-enable with the view left open
   * would otherwise leave the old element (and its callback, closing over
   * the unloaded plugin instance) in place, and the new instance would add a
   * second one beside it — `view.addAction` has no dedup of its own.
   *
   * The path travels with the element so `refresh` can tell "this view's
   * action describes the note now open in it" from "this view switched files
   * and the action is still showing the old one" — the two cases where
   * clearing it early matters and where it would only flicker, respectively.
   */
  private readonly actionFor = new Map<MarkdownView, { el: HTMLElement; path: string }>();

  /**
   * Spec §2.5's three real toggles. `Plugin.settings` is Obsidian's own
   * field for this since 1.13.0 ("Assign loaded data here in onload. Declare
   * a concrete type on your subclass to type it") — declared here rather
   * than as a differently-named field, and loaded before `onload` does
   * anything that reads one, so a setting is never asked for before it
   * exists.
   */
  override settings: VisiMarkSettings = DEFAULT_SETTINGS;

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Marked elements a hover fetch is in flight for — separate from
   * `data-vmark-hovered`, which means "answered", not "asked". Without this,
   * the pointer lingering a moment sends a second `describe` before the
   * first resolves.
   */
  private readonly hoverPending = new WeakSet<HTMLElement>();

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
   * typing costs one parse per pause rather than one per character. The
   * third argument is `resetTimer`, not leading-edge: each keystroke resets
   * the 400ms timer, and `refresh` runs once, after typing stops.
   */
  private readonly refreshSoon = debounce(() => this.refresh(), 400, true);

  override async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
    this.addSettingTab(new VisiMarkSettingTab(this.app, this));

    // v1 row 6. The view owns its own refreshing — it is a Component, so its
    // listeners die with it — which is also why this file keeps no reference
    // to any instance of it.
    this.registerView(FINDINGS_VIEW, (leaf: WorkspaceLeaf) => new FindingsView(leaf));
    this.addCommand({
      id: "check",
      name: "Check this note",
      callback: () => void this.openFindings(),
    });

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

    // v1 row 8. **Not gated**, and for a different reason than the template
    // commands: §2.3's gate is a question about the *active note*, and a
    // vault-wide scan does not have one. Refusing to look through the vault
    // because the note in front of you happens to have no block would be the
    // gate answering a question it was not asked.
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
    this.registerEditorExtension(livePreviewMarks(() => this.settings.showProvenanceInLivePreview));

    // v1 row 3 — what makes row 2's marks legible rather than decorative. One
    // delegated listener rather than one per decoration: the post-processor
    // runs per section and per re-render, and a listener attached there would
    // be attached again every time.
    //
    // Hover answers on the desktop and a tap answers everywhere, because a
    // phone has no hover — and #176's row 3 is "hover / tap" for that reason.
    // `pointerover` fires for a touch tap too (as `pointerType: "touch"`), and
    // `click` follows it; without the pointerType check a tap would arm a
    // tooltip nobody can dismiss *and* open the dialog, which the manual test
    // says a tap must not do.
    this.registerDomEvent(document, "pointerover", (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const el = target(event);
      if (el === null || el.hasAttribute("data-vmark-hovered") || this.hoverPending.has(el)) return;
      this.hoverPending.add(el);
      void this.describe(el).then((line) => {
        this.hoverPending.delete(el);
        // a failed or empty answer is retried on the next hover rather than
        // marked as answered — `setTooltip` only primes Obsidian's own
        // mouseover-driven popover for a *future* hover, which is why
        // `displayTooltip` also fires it now, on the hover that fetched it
        if (line === null) return;
        el.setAttribute("data-vmark-hovered", "");
        setTooltip(el, line, { placement: "top" });
        displayTooltip(el, line, { placement: "top" });
      });
    });
    this.registerDomEvent(document, "click", (event) => {
      const el = target(event);
      if (el === null) return;
      // a plain click in Live Preview is placing the caret, not asking a
      // question — `target` doesn't filter CodeMirror, so a click that
      // lands on a mark there would otherwise open the modal and steal the
      // click from caret placement. A modified click (used to open links,
      // never bound to anything of ours in the editor) still asks.
      if (el.closest(".cm-editor") !== null && !(event.metaKey || event.ctrlKey)) return;
      void this.explainElement(el);
    });
    this.registerDomEvent(document, "keydown", (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const el = target(event);
      if (el === null) return;
      event.preventDefault();
      void this.explainElement(el);
    });

    // v1 row 7 — the other half of "an explicit act" (v1 constraint 3). Not
    // preventDefault'd: Obsidian's own save still runs on the same keystroke,
    // unblocked. Obsidian has no event for an explicit save distinct from its
    // own autosave (`vault.on("modify")` fires identically for both), so this
    // is deliberately narrower than "on save" sounds — it answers only the
    // keystroke, not "Save file" from the command palette and not whatever a
    // mobile save gesture turns out to be. `format` runs asynchronously
    // (`noteFor` awaits a vault read), so the very first press can still save
    // the pre-repair bytes to disk; the buffer's own edit fires Obsidian's
    // autosave moments later, which is what actually lands the repaired
    // bytes. Silent: a notice on every save of every note with the setting on
    // is the report's vocabulary creeping back in by another door.
    //
    // Unmodified only (no Shift/Alt) — Ctrl/Cmd+Shift+S and Ctrl/Cmd+Alt+S are
    // other bindings (Obsidian's own "save as a copy" is one), not this one.
    // And only when the keystroke actually came from the editor: the listener
    // checks the event's own target so it also sees a Ctrl/Cmd+S typed into
    // an unrelated focused control (a settings field, the search box) that
    // happens to bubble — which must not format whatever note is merely
    // active behind it.
    //
    // A pop-out window is a separate document with its own global
    // constructors (Obsidian's pop-out-window docs), so `event.target
    // instanceof Node` — which closes over *this* module's `Node` — would
    // silently fail for a keystroke typed there. `nodeType` is checked
    // structurally instead, and the listener is attached to every window's
    // document: the main one now, each pop-out already open, and any that
    // opens later.
    const onSaveKeydown = (event: KeyboardEvent): void => {
      if (!this.settings.formatOnSave) return;
      if (event.shiftKey || event.altKey) return;
      const held = Platform.isMacOS ? event.metaKey : event.ctrlKey;
      if (!held || event.key.toLowerCase() !== "s") return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view === null) return;
      const eventTarget = event.target;
      if (eventTarget === null || typeof (eventTarget as Node).nodeType !== "number") return;
      if (!view.contentEl.contains(eventTarget as Node)) return;
      void this.format(view.editor, { silent: true });
    };
    const seenWindows = new Set<Document>();
    const listenForSaveIn = (doc: Document): void => {
      if (seenWindows.has(doc)) return;
      seenWindows.add(doc);
      this.registerDomEvent(doc, "keydown", onSaveKeydown);
    };
    listenForSaveIn(document);
    this.app.workspace.iterateAllLeaves((leaf) => listenForSaveIn(leaf.view.containerEl.doc));
    this.registerEvent(
      this.app.workspace.on("window-open", (_win, win) => listenForSaveIn(win.document)),
    );

    this.status = this.addStatusBarItem();
    this.status.addClass("visimark-status");
    // hidden from creation: refresh() only runs once onLayoutReady fires, and
    // an empty, unhidden item between now and then is the visible gap §2.1's
    // pass condition rules out on every desktop startup
    this.status.addClass("visimark-hidden");
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
    this.app.workspace.onLayoutReady(() => {
      this.refresh();
      // spec §2.5, off by default: a vault-wide scan is a cost every vault
      // opens with the plugin should not pay unasked
      if (this.settings.sweepOnOpen) void this.openSweep();
    });
  }

  /**
   * `registerView`/`registerEvent`/`registerDomEvent` all die with the
   * plugin automatically (`Component`'s own teardown). A view-header action
   * does not: `view.addAction` attaches the element to the `MarkdownView`
   * itself, which outlives this plugin instance across a disable/re-enable —
   * see `actionFor`'s own comment for what that leaves behind uncleaned.
   */
  override onunload(): void {
    for (const { el } of this.actionFor.values()) el.remove();
    this.actionFor.clear();
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
   * The same plan the findings view offers a row at a time, applied whole,
   * as one `editor.transaction` — the buffer has several non-adjacent edits
   * (cells and anchors sit apart), and a loop of `replaceRange` would be one
   * undo step per edit rather than the one explicit act v1 constraint 3
   * promises.
   *
   * `silent` is row 7's format-on-save path: a notice on every save of every
   * note with the setting on — "no block", "already clean", or the applied
   * count — is the report's vocabulary creeping back in by another door, on
   * a surface the reader did not ask a question of.
   */
  private async format(editor: Editor, opts: { silent?: boolean } = {}): Promise<void> {
    const source = editor.getValue();
    const gated = await this.noteFor(editor, opts);
    if (gated === null) return;
    const { report } = gated;
    if (report.allRepairs.length === 0) {
      if (!opts.silent) {
        new Notice("Everything in this note already agrees with its formulas.");
      }
      return;
    }
    // `noteFor` awaits a vault read; a keystroke in that gap would make these
    // offsets describe a buffer that no longer exists
    if (editor.getValue() !== source) {
      if (!opts.silent) {
        new Notice("This note changed while it was being checked. Try Format again.");
      }
      return;
    }
    editor.transaction({
      changes: report.allRepairs.map((edit) => ({
        from: editor.offsetToPos(edit.start),
        to: editor.offsetToPos(edit.end),
        text: edit.text,
      })),
    });
    if (!opts.silent) {
      // "repair", not "value": allRepairs can carry a splice with no value of
      // its own, such as an import-stamp insert (report.ts)
      const n = report.allRepairs.length;
      new Notice(`Applied ${n} ${n === 1 ? "repair" : "repairs"}. No chart was written.`);
    }
  }

  /** **Evaluate** — every name in the note and what it works out to. */
  private async evaluate(editor: Editor): Promise<void> {
    const gated = await this.noteFor(editor);
    if (gated === null) return;
    new ValuesModal(this.app, evalValues(gated.result)).open();
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
    const explanation = explainBinding(gated.model, gated.result, name);
    if (explanation === null) {
      new Notice(`Nothing in this note is called ${name}.`);
      return;
    }
    new ExplainModal(this.app, explanation).open();
  }

  /**
   * The gate, the read and the check that every note-scoped command starts
   * with — §2.3, and the notice it answers with when the gate is shut.
   *
   * **Built from the live buffer, never re-read from the vault.** Format,
   * Evaluate and Explain all act on what `editor.getValue()` holds right now,
   * which can be ahead of the last save. Routing Evaluate or Explain through
   * `this.api` instead would answer from `vault.cachedRead` — the saved copy
   * — and disagree with the buffer on a dirty note.
   */
  private async noteFor(editor: Editor, opts: { silent?: boolean } = {}) {
    const source = editor.getValue();
    if (!hasVmarkBlock(source)) {
      if (!opts.silent) {
        new Notice("This note has no VisiMark block, so there is nothing to check in it yet.");
      }
      return null;
    }
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    const path = file?.path ?? "untitled.md";
    const { model, snapshot } = await readNote(source, path, vaultSweepRead(this.app.vault));
    const doc = { path: snapshot.path, reader: snapshot.reader };
    const result = check(model, { doc });
    return { model, result, report: reportFor(model, result, doc) };
  }

  /**
   * The file a marked element belongs to.
   *
   * `data-vmark-path` (set at decoration time — `reading-mode.ts`,
   * `live-preview.ts`) names the note the mark is actually about. Falling
   * back to whichever view is globally active would explain the wrong note
   * for a hover or tap in a background pane, a pinned preview, or a second
   * split — the active view has no necessary relation to the element under
   * the pointer.
   */
  private fileFor(el: HTMLElement): TFile | null {
    const path = el.getAttribute("data-vmark-path");
    if (path === null) return this.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  /** The one line a hover shows for a marked value, or `null`. */
  private async describe(el: HTMLElement): Promise<string | null> {
    const name = el.getAttribute("data-vmark");
    const file = this.fileFor(el);
    if (name === null || file === null) return null;
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

  /**
   * A tap (or Enter/Space) on a marked value opens the same dialog Explain
   * does — but scoped to the row that was actually pointed at, when there is
   * one: a phone has no hover, so this is the only place §2.3's cell-versus-
   * column distinction can be honoured there.
   */
  private async explainElement(el: HTMLElement): Promise<void> {
    const name = el.getAttribute("data-vmark");
    const file = this.fileFor(el);
    if (name === null || file === null) return;
    try {
      const explanation = await this.api.explain(file, name);
      if (explanation !== null) {
        new ExplainModal(this.app, explanation, rowFrom(el.getAttribute("data-vmark-row"))).open();
      }
    } catch {
      new Notice("Could not check this value.");
    }
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
   * Bumped at the start of every `refresh`. `refreshState` awaits a vault
   * read, so two requests can be in flight at once — typing during a slow
   * one, or a leaf change that starts a fresh check before the last one
   * settles — and comparing the resolved text against a captured `source`
   * only catches a *later edit to the same note*, not a switch to a
   * different note whose body happens to be byte-identical (a different
   * `path`, so a different import resolution) or a failure that outlives the
   * navigation away from the note that failed. A generation counter, checked
   * in both branches below, catches all three: only the most recent `refresh`
   * call is allowed to paint.
   */
  private renderId = 0;

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
    const id = ++this.renderId;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const source = view?.getViewData() ?? null;
    if (source === null || !hasVmarkBlock(source)) {
      this.show(HIDDEN, view);
      return;
    }
    // A MarkdownView instance is reused across a file switch within the same
    // leaf, so the action `actionFor` has for it can describe a *different*
    // note than the one about to be checked. Clear it before the read only
    // in that case — not on every refresh, or typing (editor-change) would
    // flash the icon away and back on every pause even though the note has
    // not changed, for a check that is usually faster than the flash itself.
    const path = view!.file?.path ?? "untitled.md";
    if (this.actionFor.get(view!)?.path !== path) {
      this.showAction(HIDDEN, view);
    }
    void this.refreshState(view!, source, id);
  }

  private async refreshState(view: MarkdownView, source: string, id: number): Promise<void> {
    const path = view.file?.path ?? "untitled.md";
    try {
      const { model, snapshot } = await readNote(source, path, vaultSweepRead(this.app.vault));
      const doc = { path: snapshot.path, reader: snapshot.reader };
      if (id !== this.renderId) return; // a newer refresh has started; let it paint instead
      this.show(statusFor(reportFor(model, check(model, { doc }), doc)), view);
    } catch {
      if (id !== this.renderId) return;
      this.show(UNKNOWN, view);
    }
  }

  /** `view` is `null` only when there is no active Markdown view at all. */
  private show(status: Status, view: MarkdownView | null): void {
    if (this.status !== null) {
      this.status.setText(status.text);
      this.status.setAttribute("aria-label", status.detail);
      this.status.toggleClass("visimark-hidden", status.text === "");
    }
    this.showAction(status, view);
  }

  /**
   * The mobile witness half of `show` — see `actionFor`'s own comment for
   * why this exists at all. `addAction` sets an icon once at creation; the
   * same element is reused and its icon swapped for every later state, the
   * same "create once, mutate after" shape `this.status` already uses.
   */
  private showAction(status: Status, view: MarkdownView | null): void {
    if (view === null) return;
    if (status.kind === "hidden") {
      this.actionFor.get(view)?.el.remove();
      this.actionFor.delete(view);
      return;
    }
    const icon = ACTION_ICON[status.kind];
    const path = view.file?.path ?? "untitled.md";
    const existing = this.actionFor.get(view);
    if (existing === undefined) {
      const el = view.addAction(icon, status.detail, () => void this.openFindings());
      this.actionFor.set(view, { el, path });
    } else {
      setIcon(existing.el, icon);
      setTooltip(existing.el, status.detail, { placement: "bottom" });
      existing.path = path;
    }
  }
}

/** the marked value an event is on, if it is on one */
function target(event: Event): HTMLElement | null {
  const node = event.target;
  // CodeMirror can surface a text node as the event target (a mark's content
  // rendered directly, with no further wrapping); its element is the parent
  const el = node instanceof HTMLElement ? node : (node as Node | null)?.parentElement;
  if (!(el instanceof HTMLElement)) return null;
  return el.closest<HTMLElement>("[data-vmark]");
}
