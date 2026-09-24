import { ItemView, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import { sweep, type SweepResult, type SweptNote } from "./sweep.js";
import { vaultSweepRead } from "./vault.js";
import type { LiveVaultIndex } from "./vault-index.js";

/**
 * The vault sweep's pane — v1 row 8 of #176, and the row that justifies fork B
 * over the VS Code extension. Daily-note people copy numbers between files;
 * this is what catches the copy that stopped being true.
 *
 * **The scan yields and can be cancelled, and that is not a nicety.** A phone
 * has one thread, and a sweep that held it would freeze the app rather than
 * take a while. `sweep()` hands the thread back every chunk; this file is what
 * it hands it back *to*, and what draws a count while it does.
 *
 * **There is no size above which the sweep refuses.** Spec §2.4 asked this row
 * to name that size before it was filed, with the alternative being progress
 * and a cancel. Measured rather than guessed — see `sweep.ts` for the numbers
 * and the issue for the extrapolation — the answer is that the per-note cost
 * is a substring scan and the expensive work is proportional to the number of
 * *VisiMark* notes, not to the size of the vault. A refusal would be a
 * ceremony around a cost that is not there. What there is instead is a count
 * that moves and a button that stops it.
 */

export const SWEEP_VIEW = "visimark-sweep";

export class SweepView extends ItemView {
  private running = false;
  private signal = { aborted: false };
  private unsubscribe: (() => void) | null = null;

  /**
   * `getIndex` rather than the index itself: a leaf that stays open across
   * this view being closed and reopened must see `main.ts`'s index as of
   * *this* open, not the one that existed when `registerView`'s factory ran
   * — v1.1 row 13's index does not exist until "Sweep the vault on open" has
   * run once, which can be after this view was already constructed.
   */
  constructor(
    leaf: WorkspaceLeaf,
    private getIndex: () => LiveVaultIndex | null = () => null,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return SWEEP_VIEW;
  }

  override getDisplayText(): string {
    return "VisiMark vault sweep";
  }

  override getIcon(): string {
    return "search-check";
  }

  override async onOpen(): Promise<void> {
    const index = this.getIndex();
    if (index !== null && index.isSeeded()) {
      this.drawFromIndex(index);
      this.unsubscribe = index.onChange(() => this.drawFromIndex(index));
      return;
    }
    await this.run();
  }

  override onClose(): Promise<void> {
    this.signal.aborted = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    return Promise.resolve();
  }

  /**
   * Draw straight from the ambient index — no scan, and this is the whole
   * point of row 13: the pane is a read of state that was already kept
   * current, not a new act of finding out. Subscribed for as long as the
   * pane stays open, so an edit made while looking at the list updates it
   * without a click.
   *
   * **Not routed through `drawResult`.** A `SweepResult`'s "N out of M
   * looked at" line describes a scan that just ran; the index has no
   * present-tense "M" to report — it never re-derives the vault's total note
   * count between full sweeps; see `vault-index.ts`'s module note on what it
   * does and does not track — so this says something true instead of forcing
   * a number through the sentence that would go stale as soon as a note is
   * added. "Look again" still runs a real sweep and reseeds the index from
   * it, which is the true count as of that moment.
   */
  private drawFromIndex(index: LiveVaultIndex): void {
    const root = this.container();
    const notes = index.notes();
    const n = notes.length;

    const summary = root.createDiv({ cls: "visimark-sweep-status" });
    summary.createSpan({
      cls: "visimark-note-state",
      text:
        n === 0
          ? "Nothing in this vault currently disagrees with itself."
          : `${n} ${n === 1 ? "note disagrees" : "notes disagree"} with ${n === 1 ? "itself" : "themselves"}, kept up to date as you edit.`,
    });
    const again = summary.createEl("button", {
      cls: "visimark-sweep-again",
      text: "Look again",
      attr: { type: "button", "aria-label": "Look through the whole vault again" },
    });
    again.addEventListener("click", () => void this.run());

    if (n === 0) return;
    const list = root.createEl("ul", { cls: "visimark-list" });
    for (const note of notes) this.row(list, note);
  }

  /** Scan the vault, drawing as it goes. */
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.signal = { aborted: false };
    // a manual scan is about to draw its own progress and result; the live
    // subscription would otherwise redraw underneath it on the next edit
    this.unsubscribe?.();
    this.unsubscribe = null;

    const files = this.app.vault.getMarkdownFiles();
    const read = vaultSweepRead(this.app.vault);
    this.drawProgress(0, files.length);

    try {
      const result = await sweep(
        { paths: () => files.map((f) => f.path), read },
        {
          chunk: 50,
          // the thread goes back to Obsidian here, which is what keeps the
          // app answering taps while a large vault is scanned
          pause: () => new Promise((resolve) => activeWindow.setTimeout(resolve, 0)),
          onProgress: (done, total) => this.drawProgress(done, total),
          signal: this.signal,
        },
      );
      // a real, whole-vault result is the one thing row 13's index is
      // defined to accept without question (`vault-index.ts`'s `seed`) — a
      // manual "Look again" is therefore also how the ambient index heals
      // from anything an incremental update could have missed (rename edge
      // cases, a vault event the adapter never fired). Re-subscribing here
      // is what keeps that promise: without it, an edit made after "Look
      // again" would move the ribbon badge but leave this open pane showing
      // the scan's frozen result until it is closed and reopened.
      const index = this.getIndex();
      if (!result.cancelled && index !== null) {
        index.seed(result);
        this.unsubscribe = index.onChange(() => this.drawFromIndex(index));
      }
      this.drawResult(result);
    } finally {
      this.running = false;
    }
  }

  private container(): HTMLElement {
    const el = this.contentEl;
    el.empty();
    return el.createDiv({ cls: "visimark-sweep" });
  }

  private drawProgress(done: number, total: number): void {
    const root = this.container();
    const bar = root.createDiv({ cls: "visimark-sweep-status" });
    bar.createSpan({
      cls: "visimark-note-state",
      text: `Looking at note ${done.toLocaleString()} of ${total.toLocaleString()}.`,
    });
    const stop = bar.createEl("button", {
      cls: "visimark-sweep-cancel",
      text: "Stop",
      attr: { type: "button", "aria-label": "Stop looking through the vault" },
    });
    stop.addEventListener("click", () => {
      this.signal.aborted = true;
    });
  }

  private drawResult(result: SweepResult): void {
    const root = this.container();
    const count = result.notes.length;

    const summary = root.createDiv({ cls: "visimark-sweep-status" });
    summary.createSpan({
      cls: "visimark-note-state",
      text: this.summaryLine(result),
    });
    const again = summary.createEl("button", {
      cls: "visimark-sweep-again",
      text: result.cancelled ? "Start again" : "Look again",
      attr: { type: "button", "aria-label": "Look through the vault again" },
    });
    again.addEventListener("click", () => void this.run());

    if (result.unreadable.length > 0) {
      root.createEl("p", {
        cls: "visimark-note-state",
        text:
          `${result.unreadable.length} ${result.unreadable.length === 1 ? "note" : "notes"} ` +
          `could not be read, so nothing here is a verdict about ${result.unreadable.length === 1 ? "it" : "them"}.`,
      });
    }

    if (count === 0) return;

    const list = root.createEl("ul", { cls: "visimark-list" });
    for (const note of result.notes) this.row(list, note);
  }

  private summaryLine(result: SweepResult): string {
    const n = result.notes.length;
    const scanned = result.scanned.toLocaleString();
    if (result.cancelled) {
      return n === 0
        ? `Stopped after ${scanned} notes. Nothing so far disagrees with itself.`
        : `Stopped after ${scanned} notes. ${n} of them ${n === 1 ? "disagrees" : "disagree"} with ${n === 1 ? "itself" : "themselves"}.`;
    }
    if (n === 0) return `Nothing in this vault disagrees with itself. ${scanned} notes looked at.`;
    return `${n} ${n === 1 ? "note disagrees" : "notes disagree"} with ${n === 1 ? "itself" : "themselves"}, out of ${scanned} looked at.`;
  }

  private row(list: HTMLElement, note: SweptNote): void {
    const item = list.createEl("li", { cls: "visimark-row" });
    const button = item.createEl("button", {
      cls: "visimark-row-main",
      attr: {
        type: "button",
        "aria-label": `Open ${note.path}`,
        "data-tooltip-position": "top",
      },
    });

    const slash = note.path.lastIndexOf("/");
    button.createSpan({
      cls: "visimark-row-text",
      text: note.path.slice(slash + 1).replace(/\.md$/, ""),
    });
    if (slash > 0) {
      button.createSpan({ cls: "visimark-row-where", text: note.path.slice(0, slash) });
    }
    button.createSpan({ cls: "visimark-row-where", text: this.countLine(note) });
    button.addEventListener("click", () => void this.open(note.path));
  }

  private countLine(note: SweptNote): string {
    const parts: string[] = [];
    if (note.problems > 0) {
      parts.push(
        `${note.problems} ${note.problems === 1 ? "thing needs" : "things need"} attention`,
      );
    }
    if (note.advice > 0) parts.push(`${note.advice} worth knowing`);
    return parts.join(", ");
  }

  private async open(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      new Notice("That note is no longer in the vault.");
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(file);
  }
}
