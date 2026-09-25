import {
  ItemView,
  MarkdownView,
  Notice,
  debounce,
  setIcon,
  type Editor,
  type WorkspaceLeaf,
} from "obsidian";
import { check, type Edit, type Finding } from "visimark";
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
   * note; debounced so typing costs one per pause. The third argument is
   * `resetTimer`, not leading-edge: each keystroke resets the 400ms timer,
   * and `refresh` runs once, after typing stops.
   */
  private readonly refreshSoon = debounce(() => void this.refresh(), 400, true);

  /**
   * Bumped at the start of every `refresh`. `readNote` awaits a vault read, so
   * two refreshes can be in flight at once — typing during a slow one, say —
   * and without this an older one finishing after a newer one would paint a
   * stale report over a current one.
   */
  private renderId = 0;

  /** The note text `draw`'s rows were computed from, for `apply` to check. */
  private renderedSource: string | null = null;

  /**
   * Section headings the reader has folded. `draw` rebuilds the whole pane on
   * every refresh — a keystroke, a repair, a leaf change — so this lives on
   * the view rather than in the DOM, or folding "Advice" would reopen itself
   * the next time a debounced re-check ran.
   */
  private readonly collapsedSections = new Set<string>();

  override async onOpen(): Promise<void> {
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => void this.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => void this.refresh()));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.refreshSoon()));
    await this.refresh();
  }

  /** Re-check the active note and redraw. */
  async refresh(): Promise<void> {
    const id = ++this.renderId;
    const view = this.noteView();
    const file = view?.file;
    if (view === null || file === null || file === undefined) return this.drawEmpty(null);

    const source = view.getViewData();
    if (!hasVmarkBlock(source)) return this.drawEmpty(file.basename);

    try {
      const { model, snapshot } = await readNote(source, file.path, vaultRead(this.app.vault));
      if (id !== this.renderId) return; // a newer refresh started; let it paint instead
      const doc = { path: snapshot.path, reader: snapshot.reader };
      this.draw(reportFor(model, check(model, { doc }), doc), file.basename, source);
    } catch {
      if (id !== this.renderId) return;
      // §3.1: the plugin never shows a clean state for a note it failed to
      // check. A pane that silently emptied itself would do exactly that.
      this.drawFailed(file.basename);
    }
  }

  private container(): HTMLElement {
    const el = this.contentEl;
    el.empty();
    // the pin points at DOM this call is about to discard, and at a
    // FindingRow instance the next `draw` will replace with a new one
    this.pinned = null;
    return el.createDiv({ cls: "visimark-findings" });
  }

  private drawEmpty(note: string | null): void {
    this.renderedSource = null;
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
    this.renderedSource = null;
    const root = this.container();
    root.createEl("p", {
      cls: "visimark-note-state",
      text: `${note} could not be checked. Nothing here is a verdict about it.`,
    });
  }

  private draw(report: NoteReport, note: string, source: string): void {
    this.renderedSource = source;
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
    const collapsed = this.collapsedSections.has(heading);

    const head = section.createEl("button", {
      cls: "visimark-section-heading",
      attr: { type: "button", "aria-expanded": String(!collapsed) },
    });
    head.toggleClass("is-collapsed", collapsed);
    setIcon(head.createSpan({ cls: "visimark-section-chevron" }), "chevron-right");
    head.createSpan({ text: heading });

    const list = section.createEl("ul", { cls: "visimark-list" });
    list.toggleClass("visimark-list-collapsed", collapsed);
    for (const row of rows) this.node(list, row);

    head.addEventListener("click", () => {
      const nowCollapsed = !this.collapsedSections.has(heading);
      if (nowCollapsed) this.collapsedSections.add(heading);
      else this.collapsedSections.delete(heading);
      head.toggleClass("is-collapsed", nowCollapsed);
      head.setAttr("aria-expanded", String(!nowCollapsed));
      list.toggleClass("visimark-list-collapsed", nowCollapsed);
    });
  }

  /**
   * One entry in the tree — a value that disagrees with its formula gets its
   * own line plus one detail child naming what the formula gives instead
   * (`valueNode`); everything else is one leaf line, same as before
   * (`leafNode`).
   */
  private node(list: HTMLElement, row: FindingRow): void {
    const item = list.createEl("li", { cls: "visimark-node" });
    if (isValueMismatch(row.finding)) this.valueNode(item, row);
    else this.leafNode(item, row);
  }

  /**
   * The one finding shape with a stored value and a computed one to put
   * against it (`f.stored`/`f.computed` — a plain per-cell or per-anchor
   * STALE mismatch; the collapsed anchor group and a stale chart/import have
   * neither, `isValueMismatch` below). Both lines are `.visimark-node-detail`
   * children of the same list, so both get the same hairline and indent —
   * there is no separate header row above them. The stored value leads the
   * first line ("1242.00: This value no longer matches its formula.",
   * unmarked), and that line is what jumps and previews on hover; "The
   * formula gives {computed}" is the second, with the repair icon inline.
   */
  private valueNode(item: HTMLElement, row: FindingRow): void {
    const f = row.finding;
    const children = item.createEl("ul", { cls: "visimark-node-children" });

    const value = children.createEl("li", { cls: "visimark-node-detail" });
    const button = value.createEl("button", {
      cls: "visimark-node-detail-action",
      attr: { type: "button", "aria-label": detail(row), "data-tooltip-position": "top" },
    });
    button.createSpan({ text: `${f.stored}: ${row.reader.row}` });
    button.addEventListener("click", () => this.select(row));
    button.addEventListener("mouseenter", () => this.peek(row, true));
    button.addEventListener("mouseleave", () => {
      if (this.pinned !== row) this.peek(row, false);
    });

    const fact = children.createEl("li", { cls: "visimark-node-detail visimark-node-fact" });
    fact.createSpan({ text: `The formula gives ${f.computed}` });
    if (row.repair !== null) this.fixIcon(fact, row);
  }

  /** Every finding that is not a value/formula mismatch: one leaf line, as before. */
  private leafNode(item: HTMLElement, row: FindingRow): void {
    const self = item.createDiv({ cls: "visimark-node-row" });
    // a button rather than a div, so it is in the tab order and answers Enter
    // and Space without this file having to reimplement either
    const main = self.createEl("button", {
      cls: "visimark-node-self",
      attr: {
        type: "button",
        "aria-label": detail(row),
        "data-tooltip-position": "top",
      },
    });
    main.createSpan({ cls: "visimark-row-text", text: row.reader.row });
    const where = row.finding.rowLabel ?? row.finding.name;
    if (where !== undefined) main.createSpan({ cls: "visimark-row-where", text: where });
    main.addEventListener("click", () => this.select(row));
    // desktop-only preview: a hover marks what the row is about in the
    // editor without moving the cursor, so looking down the list costs
    // nothing. Mobile has no hover, but a tap there already jumps (below).
    main.addEventListener("mouseenter", () => this.peek(row, true));
    main.addEventListener("mouseleave", () => {
      if (this.pinned !== row) this.peek(row, false);
    });

    if (row.repair !== null) this.fixIcon(self, row);
  }

  /**
   * The repair action, as an icon rather than a labelled button —
   * `clickable-icon` is Obsidian's own chrome for a compact inline action
   * (the same class the core file explorer's own hover actions use), sized
   * down (`--icon-size`, in `styles.css`) so it sits on the line it repairs
   * instead of the 44px touch box every other control in this plugin gets.
   * That is a deliberate exception to this plugin's own mobile-first
   * touch-target rule, made on request: inline in a sentence, the full box
   * read as a gap rather than a target.
   */
  private fixIcon(parent: HTMLElement, row: FindingRow): void {
    const fix = parent.createEl("button", {
      cls: "visimark-fix clickable-icon",
      attr: {
        type: "button",
        "aria-label": `Fix: ${row.reader.row}`,
        "data-tooltip-position": "top",
      },
    });
    setIcon(fix, "wrench");
    const edits = row.repair!;
    fix.addEventListener("click", () => this.apply(edits, row));
  }

  /**
   * The rendered element(s) a row is about, in whichever mode the note is
   * currently showing — `noteView().contentEl` holds Live Preview/Source and
   * Reading mode alike, and only one is visible at a time, so this needs no
   * separate case for either.
   *
   * A collapsed anchor-group STALE finding has no `span` and no `name`: it is
   * `check-report.ts`'s `reportAnchors`, reporting on every drifted prose
   * anchor at once because "there is no single place to point at" (see this
   * file's own top-of-file note). Pointing at nothing would make the one kind
   * of row a reader most wants previewed the one kind that never highlights,
   * so this returns every value the editor already has `.visimark-disagrees`
   * on instead of none of them — the group's members, not a stand-in site.
   *
   * Everything else matches by name, the same key Live Preview and reading
   * mode already stamp on every marked value as `data-vmark`
   * (`live-preview.ts`, `reading-mode.ts`): a name bound in two places lights
   * up both, which is no worse than the mark both places already carry from
   * the same name.
   */
  private markedElements(row: FindingRow): HTMLElement[] {
    const container = this.noteView()?.contentEl;
    if (container == null) return [];
    const f = row.finding;
    if (f.code === "STALE" && f.anchorGroup === true) {
      return [...container.querySelectorAll<HTMLElement>(".visimark-disagrees[data-vmark]")];
    }
    if (row.span === null) return [];
    const name = f.name;
    if (name === undefined) return [];
    return [...container.querySelectorAll<HTMLElement>("[data-vmark]")].filter(
      (el) => el.getAttribute("data-vmark") === name,
    );
  }

  /** Mark (or unmark) what a row is about, without moving the cursor. */
  private peek(row: FindingRow, on: boolean): void {
    for (const el of this.markedElements(row)) el.toggleClass("visimark-peek", on);
  }

  /**
   * The row a click has pinned highlighted, so a hover that follows the
   * pointer off the button it was clicked on doesn't clear it. Cleared
   * whenever the pane redraws (`container()`), since the DOM the pin points
   * at is rebuilt from scratch every time.
   */
  private pinned: FindingRow | null = null;

  /**
   * What a click on a row does — `jumpTo` moves the editor's own cursor and
   * selection, which is invisible in Reading mode because the editor isn't
   * what's on screen there. This is the part that works in every mode: the
   * same DOM mark `peek` uses for a hover preview, made to stay instead of
   * clearing on mouseleave, and scrolled into view directly rather than
   * through the (possibly hidden) editor — the same idea as Ctrl-F's own
   * find-in-note highlight, which doesn't care which mode is showing either.
   */
  private select(row: FindingRow): void {
    if (this.pinned !== null && this.pinned !== row) this.peek(this.pinned, false);
    this.pinned = row;
    this.peek(row, true);
    this.markedElements(row)[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    this.jumpTo(row);
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
   * one undo step for the press — `transaction` applies every edit as one
   * CodeMirror dispatch, which is what makes that one step true for a
   * collapsed-anchor repair's several non-adjacent edits.
   *
   * **The offsets are only valid against the source they were planned
   * against.** `row.repair` was computed from `renderedSource`; the editor may
   * have moved since — a keystroke inside the 400ms debounce window, or a
   * slower `refresh` still in flight — and writing stale offsets into a
   * buffer that has since changed shape would land in the wrong place. Refuse
   * and re-check instead.
   */
  private apply(edits: Edit[], row: FindingRow): void {
    const editor = this.editor();
    if (editor === null) {
      new Notice("Open the note in an editor to repair it.");
      return;
    }
    if (editor.getValue() !== this.renderedSource) {
      new Notice("This note changed since it was checked. Checking again before repairing.");
      void this.refresh();
      return;
    }
    const ordered = [...edits].sort((a, b) => b.start - a.start);
    editor.transaction({
      changes: ordered.map((edit) => ({
        from: editor.offsetToPos(edit.start),
        to: editor.offsetToPos(edit.end),
        text: edit.text,
      })),
    });
    new Notice(row.reader.row.replace(/\.$/, " — repaired."));
    void this.refresh();
  }

  private editor(): Editor | null {
    return this.noteView()?.editor ?? null;
  }

  /**
   * The note this pane reports on — not necessarily `getActiveViewOfType`,
   * which answers `null` the moment this pane itself is the active leaf
   * (opening it, or a click inside it, both do that via `setActiveLeaf`).
   * `getMostRecentLeaf()` is Obsidian's own answer to "the leaf in the root
   * split while a sidebar leaf might be active" — exactly this pane's shape,
   * since it opens in the right sidebar (`getRightLeaf(false)` in `main.ts`).
   */
  private noteView(): MarkdownView | null {
    const leaf = this.app.workspace.getMostRecentLeaf();
    return leaf?.view instanceof MarkdownView ? leaf.view : null;
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
  const hint = suggestion(row);
  if (hint !== null) parts.push(hint);
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

/**
 * Whether this finding has a stored value and a computed one to show
 * against it — a plain per-cell or per-anchor STALE mismatch, and nothing
 * else. The collapsed anchor group (`check-report.ts`'s `reportAnchors`) and
 * a stale chart or a stale data file — see `check-charts.ts` and
 * `import/resolve.ts` — both set `code: "STALE"` but never `stored`/
 * `computed`, because neither names one site; every other code never sets
 * this pair at all.
 */
function isValueMismatch(f: Finding): boolean {
  return f.code === "STALE" && f.stored !== undefined && f.computed !== undefined;
}
