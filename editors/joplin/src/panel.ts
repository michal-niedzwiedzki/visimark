import { escape } from "./html.js";
import { MESSAGES } from "./messages.js";
import { noteFindings, type NoteFindings } from "./note-findings.js";
import { sweepNotebook } from "./notebook-sweep.js";
import { EDITOR_COMMANDS } from "./protocol.js";

/**
 * The findings panel (#384 spec §2.5): **This note**, computed in the main
 * script from the selected note's saved body, so it works in either editor;
 * and **Sweep**, empty until a sweep runs. The panel writes nothing.
 */

export type SweepState =
  | { readonly kind: "idle" }
  | { readonly kind: "running"; readonly done: number; readonly total: number }
  | {
      readonly kind: "done";
      readonly cancelled: boolean;
      readonly notes: readonly { id: string; title: string; problems: number }[];
      readonly adviceOnly: number;
      readonly unreadable: number;
      readonly importsDropped: number;
    };

export interface PanelState {
  readonly note: NoteFindings;
  readonly sweep: SweepState;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function panelHtml(state: PanelState): string {
  return `<div class="visimark-panel"><h3>This note</h3>${noteHtml(state.note)}<h3>Sweep</h3>${sweepHtml(state.sweep)}</div>`;
}

function noteHtml(note: NoteFindings): string {
  if (note.kind === "no-block") return `<p>${escape(MESSAGES.N1)}</p>`;
  if (note.kind === "failed") return `<p>${escape(MESSAGES.F2)}</p>`;
  const header =
    note.problems === 0 ? escape(MESSAGES.C1) : plural(note.problems, "problem", "problems");
  const rows = note.rows
    .map((r) => {
      const body = `<div class="visimark-label">${escape(r.label)}</div><div>${escape(r.text)}</div>`;
      return r.span === undefined
        ? `<div class="visimark-row">${body}</div>`
        : `<div class="visimark-row" data-action="reveal" data-start="${r.span.start}" data-end="${r.span.end}">${body}</div>`;
    })
    .join("");
  const imports = note.importsDropped ? `<p>${escape(MESSAGES.I1)}</p>` : "";
  return `<p class="visimark-header">${header}</p>${rows}${imports}`;
}

function sweepHtml(sweep: SweepState): string {
  if (sweep.kind === "idle") return "";
  if (sweep.kind === "running") {
    return `<p>Checked ${sweep.done} of ${sweep.total} notes</p><button data-action="cancel">Cancel</button>`;
  }
  const notes = sweep.notes
    .map(
      (n) =>
        `<div class="visimark-row" data-action="open" data-id="${escape(n.id)}"><div class="visimark-label">${escape(n.title)}</div><div>${plural(n.problems, "problem", "problems")}</div></div>`,
    )
    .join("");
  const lines = [
    sweep.cancelled ? "Cancelled." : "",
    sweep.notes.length === 0 && !sweep.cancelled ? "Every note checked agrees with itself." : "",
    sweep.adviceOnly > 0
      ? `${plural(sweep.adviceOnly, "note has", "notes have")} advice only.`
      : "",
    sweep.unreadable > 0
      ? `${plural(sweep.unreadable, "note", "notes")} could not be read or checked.`
      : "",
    sweep.importsDropped > 0
      ? `${plural(sweep.importsDropped, "note reads", "notes read")} another file, which Joplin cannot open, so ${sweep.importsDropped === 1 ? "it was" : "they were"} only partly checked.`
      : "",
  ].filter((l) => l !== "");
  return notes + lines.map((l) => `<p>${escape(l)}</p>`).join("");
}

/** The panel in Joplin: created on first use, then kept. */
export class FindingsPanel {
  private handle: Promise<string> | null = null;
  private state: PanelState = { note: { kind: "no-block" }, sweep: { kind: "idle" } };
  private signal: { aborted: boolean } | null = null;

  private ensure(): Promise<string> {
    if (this.handle === null) {
      this.handle = (async () => {
        const h = await joplin.views.panels.create("visimark.findings");
        await joplin.views.panels.addScript(h, "./panel.css");
        await joplin.views.panels.addScript(h, "./panel.js");
        await joplin.views.panels.onMessage(h, (message: unknown) => this.onMessage(message));
        const refresh = async (): Promise<void> => {
          if (await joplin.views.panels.visible(h)) await this.refreshNote();
        };
        await joplin.workspace.onNoteSelectionChange(refresh);
        await joplin.workspace.onNoteChange(refresh);
        return h;
      })();
    }
    return this.handle;
  }

  async toggle(): Promise<void> {
    const h = await this.ensure();
    const visible = await joplin.views.panels.visible(h);
    await joplin.views.panels.show(h, !visible);
    if (!visible) await this.refreshNote();
  }

  /** What Check does from group 4: open the panel on this note, in either editor. */
  async showNote(): Promise<void> {
    const h = await this.ensure();
    await joplin.views.panels.show(h, true);
    await this.refreshNote();
  }

  async refreshNote(): Promise<void> {
    const note = await joplin.workspace.selectedNote();
    this.state = { ...this.state, note: noteFindings(note?.body ?? "") };
    await this.render();
  }

  /** Sweeps a notebook and its sub-notebooks. A second sweep cancels the first. */
  async sweep(folderId?: string): Promise<void> {
    const root = folderId ?? (await joplin.workspace.selectedFolder())?.id;
    if (root === undefined) return;
    const h = await this.ensure();
    await joplin.views.panels.show(h, true);
    if (this.signal !== null) this.signal.aborted = true;
    const signal = { aborted: false };
    this.signal = signal;
    this.state = { ...this.state, sweep: { kind: "running", done: 0, total: 0 } };
    await this.render();
    const result = await sweepNotebook(joplin.data, root, {
      signal,
      pause: () => new Promise((r) => setTimeout(r, 0)),
      onProgress: (done, total) => {
        if (this.signal !== signal) return;
        this.state = { ...this.state, sweep: { kind: "running", done, total } };
        void this.render();
      },
    });
    if (this.signal !== signal) return; // a newer sweep owns the panel now
    this.signal = null;
    this.state = {
      ...this.state,
      sweep: {
        kind: "done",
        cancelled: result.cancelled,
        notes: result.notes.map((n) => ({
          id: n.path,
          title: n.detail.title,
          problems: n.problems,
        })),
        adviceOnly: result.adviceOnly.length,
        unreadable: result.unreadable.length,
        importsDropped: result.importsDropped,
      },
    };
    await this.render();
  }

  private async render(): Promise<void> {
    const h = await this.ensure();
    await joplin.views.panels.setHtml(h, panelHtml(this.state));
  }

  private async onMessage(message: unknown): Promise<void> {
    const m = message as { kind?: string; start?: number; end?: number; id?: string };
    if (m.kind === "cancel" && this.signal !== null) this.signal.aborted = true;
    if (m.kind === "open" && typeof m.id === "string") {
      await joplin.commands.execute("openNote", m.id);
    }
    if (m.kind === "reveal" && typeof m.start === "number" && typeof m.end === "number") {
      // the Rich Text editor has no Markdown offsets to move to
      if ((await joplin.settings.globalValue("editor.codeView")) === false) return;
      try {
        await joplin.commands.execute("editor.execCommand", {
          name: EDITOR_COMMANDS.reveal,
          args: [{ start: m.start, end: m.end }],
        });
      } catch {
        // no Markdown editor to reveal in
      }
    }
  }
}
