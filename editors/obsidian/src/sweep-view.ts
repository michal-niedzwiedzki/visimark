import { ItemView, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import { sweep, type SweepResult, type SweptNote } from "./sweep.js";
import { vaultSweepRead } from "./vault.js";

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

  constructor(leaf: WorkspaceLeaf) {
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
    await this.run();
  }

  override onClose(): Promise<void> {
    this.signal.aborted = true;
    return Promise.resolve();
  }

  /** Scan the vault, drawing as it goes. */
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.signal = { aborted: false };

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
