import {
  ItemView,
  MarkdownView,
  Notice,
  debounce,
  type Editor,
  type WorkspaceLeaf,
} from "obsidian";
import { check, type Edit } from "visimark";
import { hasVmarkBlock } from "./gate.js";
import { isClean, reportFor, type FindingRow, type NoteReport } from "./report.js";
import { readNote } from "./snapshot.js";
import { vaultRead } from "./vault.js";

/**
 * The findings view — v1 row 6 of #176, and **not a Problems panel**.
 *
 * Audience B has never run `visimark check` and does not know what a non-zero
 * exit code is. So there is no red, no finding code, no "1 problem (1 stale, 0
 * errors)" anywhere on this pane: every row is a sentence from
 * `findings.ts`, which translates the engine's taxonomy once for every surface
 * the plugin will ever have (spec §3.2, v1 constraint 6). The code is on the
 * row's `aria-label`, for a screen reader and for someone who goes looking,
 * and never in the text.
 *
 * **Everything that could be got wrong is in `report.ts`, not here.** Which
 * findings are rows, which of them can be repaired, and what repairing does to
 * the bytes are questions about a document, and they are tested against the
 * CLI. What is left in this file is DOM and two Obsidian gestures.
 *
 * **The repair writes, and that is allowed exactly here.** v1 constraint 3 and
 * spec §3.3: `applyEdits` over a `planFmt` plan, on an explicit act and
 * nothing else. A button press is an explicit act; a keystroke, an idle timer
 * and an autosave are not, and this file starts no timer that writes.
 * `reportFor` always plans with `noArtifacts`, so a stale chart keeps its row
 * and gets no button — declining the write never silences the finding.
 */

export const FINDINGS_VIEW = "visimark-findings";

export class FindingsView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  override getViewType(): string {
    return FINDINGS_VIEW;
  }

  override getDisplayText(): string {
    return "VisiMark findings";
  }

  override getIcon(): string {
    return "list-checks";
  }

  /**
   * A full re-check per keystroke is a parse, a build and a check of the whole
   * note; debounced so typing costs one per pause. Leading-edge, so the first
   * keystroke after a pause is answered at once.
   */
  private readonly refreshSoon = debounce(() => void this.refresh(), 400, true);

  override async onOpen(): Promise<void> {
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => void this.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => void this.refresh()));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.refreshSoon()));
    await this.refresh();
  }

  /** Re-check the active note and redraw. */
  async refresh(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    if (view === null || file === null || file === undefined) return this.drawEmpty(null);

    const source = view.getViewData();
    if (!hasVmarkBlock(source)) return this.drawEmpty(file.basename);

    try {
      const { model, snapshot } = await readNote(source, file.path, vaultRead(this.app.vault));
      const doc = { path: snapshot.path, reader: snapshot.reader };
      this.draw(reportFor(model, check(model, { doc }), doc), file.basename);
    } catch {
      // §3.1: the plugin never shows a clean state for a note it failed to
      // check. A pane that silently emptied itself would do exactly that.
      this.drawFailed(file.basename);
    }
  }

  private container(): HTMLElement {
    const el = this.contentEl;
    el.empty();
    return el.createDiv({ cls: "visimark-findings" });
  }

  private drawEmpty(note: string | null): void {
    const root = this.container();
    root.createEl("p", {
      cls: "visimark-note-state",
      text:
        note === null
          ? "Open a note to see what VisiMark checks in it."
          : `${note} has no VisiMark block, so there is nothing to check in it yet.`,
    });
  }

  private drawFailed(note: string): void {
    const root = this.container();
    root.createEl("p", {
      cls: "visimark-note-state",
      text: `${note} could not be checked. Nothing here is a verdict about it.`,
    });
  }

  private draw(report: NoteReport, note: string): void {
    const root = this.container();
    if (isClean(report)) {
      root.createEl("p", {
        cls: "visimark-note-state",
        text: `Everything in ${note} agrees with its formulas.`,
      });
      return;
    }
    this.section(root, "Needs attention", report.problems);
    this.section(root, "Advice", report.advice);
  }

  private section(parent: HTMLElement, heading: string, rows: FindingRow[]): void {
    if (rows.length === 0) return;
    const section = parent.createDiv({ cls: "visimark-section" });
    section.createEl("h3", { cls: "visimark-section-heading", text: heading });
    const list = section.createEl("ul", { cls: "visimark-list" });
    for (const row of rows) this.row(list, row);
  }

  private row(list: HTMLElement, row: FindingRow): void {
    const item = list.createEl("li", { cls: "visimark-row" });

    // a button rather than a div, so it is in the tab order and answers Enter
    // and Space without this file having to reimplement either
    const main = item.createEl("button", {
      cls: "visimark-row-main",
      attr: {
        type: "button",
        "aria-label": detail(row),
        "data-tooltip-position": "top",
      },
    });
    main.createSpan({ cls: "visimark-row-text", text: row.reader.row });
    const where = row.finding.rowLabel ?? row.finding.name;
    if (where !== undefined) main.createSpan({ cls: "visimark-row-where", text: where });
    main.addEventListener("click", () => this.jumpTo(row));

    if (row.repair !== null) {
      const repair = item.createEl("button", {
        cls: "visimark-repair",
        text: "Repair",
        attr: { type: "button", "aria-label": `Repair: ${row.reader.row}` },
      });
      const edits = row.repair;
      repair.addEventListener("click", () => this.apply(edits, row));
    }

    const hint = suggestion(row);
    if (hint !== null) item.createEl("p", { cls: "visimark-row-hint", text: hint });
  }

  /** Put the cursor on what a row is about. */
  private jumpTo(row: FindingRow): void {
    const editor = this.editor();
    if (editor === null || row.span === null) return;
    const from = editor.offsetToPos(row.span.start);
    const to = editor.offsetToPos(row.span.end);
    editor.setSelection(from, to);
    editor.scrollIntoView({ from, to }, true);
  }

  /**
   * Write the row's repair.
   *
   * Through the editor rather than the vault: the buffer is what the person is
   * looking at, `Vault.modify` on an open file fights it, and the editor keeps
   * one undo step for the press. Applied right-to-left so earlier offsets stay
   * valid, which is the same order `applyEdits` uses and for the same reason.
   */
  private apply(edits: Edit[], row: FindingRow): void {
    const editor = this.editor();
    if (editor === null) {
      new Notice("Open the note in an editor to repair it.");
      return;
    }
    const ordered = [...edits].sort((a, b) => b.start - a.start);
    for (const edit of ordered) {
      editor.replaceRange(edit.text, editor.offsetToPos(edit.start), editor.offsetToPos(edit.end));
    }
    new Notice(row.reader.row.replace(/\.$/, " — repaired."));
    void this.refresh();
  }

  private editor(): Editor | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null;
  }
}

/**
 * What the row says to someone who goes looking — a screen reader, or a
 * pointer resting on it. **This is the only place the engine's own code
 * appears**, which is where §3.2 puts it: available in the detail, never in a
 * row.
 */
function detail(row: FindingRow): string {
  const f = row.finding;
  const parts = [row.reader.row, `VisiMark calls this ${f.code}`];
  if (f.name !== undefined) parts.push(f.name);
  if (f.stored !== undefined && f.computed !== undefined) {
    parts.push(`the note says ${f.stored}, the formula gives ${f.computed}`);
  }
  if (row.reader.quote !== undefined) parts.push(row.reader.quote);
  return parts.join(" · ");
}

/** The one line of help a row can offer, when the engine supplied one. */
function suggestion(row: FindingRow): string | null {
  const action = row.reader.action;
  if (action === null) return null;
  if (action.kind === "suggest") return `Did you mean ${action.name}?`;
  if (action.kind === "cycle") return action.path.join(" → ");
  if (action.kind === "infer") return "VisiMark can propose the formulas for this table.";
  return null;
}
