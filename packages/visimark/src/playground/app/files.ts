/**
 * The FILES panel, and the one path by which a file becomes current.
 *
 * `switchTo` used to exist twice — once in `selectFile` and once inline in the
 * "+ New" handler — and the two copies had already diverged over whether the
 * terminal gets trimmed (review §2.11). One function now serves both, and the
 * trim happens on every switch, which is the stricter of the two behaviours
 * and the one the cap exists for.
 *
 * Review §3 called §2.5, §2.7 and §2.8 "one piece of work, not three", because
 * all three rewrite what it means for a file to become current, and this is
 * where they meet:
 *
 * - **§2.5** — `switchTo` is async, because the document may not have arrived
 *   yet. It is the only place that awaits a fetch on the visitor's behalf, and
 *   the only place that has to say so when one fails.
 * - **§2.7** — the outgoing buffer is flushed *and saved* on the way out (the
 *   store does both in one step, on purpose), and this panel owns the two
 *   controls that undo that: revert one file, reset everything.
 * - **§2.8** — the address bar is rewritten on the way in, so it never names
 *   a file other than the one on screen.
 */

import type { FileStore } from "./store.js";
import type { Pipeline } from "./pipeline.js";
import type { Quest } from "./quest.js";
import type { Tabs } from "./tabs.js";
import type { Terminal } from "./terminal.js";
import type { InferPanel } from "./infer.js";
import { byId } from "./dom.js";
import { writeFileToUrl } from "./url.js";

const NEW_FILE_TEMPLATE = "# Untitled\n\nWrite your VisiMark document here.\n";

export interface FilesPanel {
  /** Makes `name` current: fetches it if this is its first opening, flushes
   *  the outgoing buffer, loads the new one, and re-runs every panel that
   *  depends on which file is open. */
  switchTo(name: string): Promise<void>;
  render(): void;
  /** Sets the filename shown in the EDITOR head and the editor's accessible
   *  name — boot's job, since boot does not switch to the first file. */
  setEditorName(name: string): void;
  /** Updates the "edited" marks and the revert control in place, without
   *  rebuilding twenty buttons — called once per typing-settle. */
  refreshDirty(): void;
}

export function createFilesPanel(
  cm: CodeMirrorEditor,
  store: FileStore,
  terminal: Terminal,
  pipeline: Pipeline,
  tabs: Tabs,
  inferPanel: InferPanel,
  quest: () => Quest,
): FilesPanel {
  const listEl = byId("file-list");
  const filenameEl = byId("editor-filename");
  const revertBtn = byId<HTMLButtonElement>("revert-file-btn");
  const resetBtn = byId<HTMLButtonElement>("reset-all-btn");

  /**
   * CodeMirror 5 hands assistive technology a bare `<textarea>` it creates
   * itself, and `#editor-ta` in the markup is replaced rather than labelled —
   * so before review §2.3 the editor was announced with no name at all. The
   * name has to track the file, which is the same thing `#editor-filename`
   * shows sighted visitors, so both are set in one place.
   */
  function setEditorName(name: string): void {
    filenameEl.textContent = name;
    cm.getInputField().setAttribute("aria-label", `Editor: ${name}`);
  }

  /**
   * The revert control appears only when there is something to revert — a
   * bundled document the visitor has changed. §2.7 asked for the reset to be
   * "visible, discoverable": a button that is present exactly when it would do
   * something is more discoverable than one that is always there and usually
   * inert, and it doubles as the page's only indication that the current file
   * is carrying unsaved-looking changes that are, in fact, saved.
   */
  function refreshDirty(): void {
    revertBtn.hidden = !store.isDirty(store.current());
    listEl.querySelectorAll<HTMLButtonElement>(".file-btn").forEach((b) => {
      const dirty = store.isDirty(b.textContent ?? "");
      b.classList.toggle("edited", dirty);
      b.title = dirty ? `${b.textContent} — edited, and kept across reloads` : "";
    });
  }

  function render(): void {
    listEl.innerHTML = "";
    for (const name of store.names()) {
      const b = document.createElement("button");
      b.className = `file-btn${name === store.current() ? " active" : ""}`;
      b.type = "button";
      b.textContent = name;
      b.addEventListener("click", () => void switchTo(name));
      listEl.appendChild(b);
    }
    // An edited document is marked, so "reset all" says what it will undo
    // before it is pressed rather than after.
    refreshDirty();
  }

  async function switchTo(name: string): Promise<void> {
    if (name === store.current()) return;
    if (!store.loaded(name)) {
      // First opening of this document: it is fetched now rather than at boot
      // (review §2.5). The failure is reported where every other command
      // failure is reported, and the switch is abandoned — a half-switch that
      // left the editor showing the previous file under the new file's name
      // would be worse than not moving.
      const failed = await store.ensure(name);
      if (!store.loaded(name)) {
        for (const f of failed) {
          terminal.line(`playground: ${f.path} did not load (${f.reason})`, "err");
        }
        terminal.trim();
        return;
      }
      for (const f of failed) {
        terminal.line(`playground: ${f.path} did not load (${f.reason})`, "err");
      }
    }
    // The store puts the incoming text into the editor itself — see
    // FileStore.switchTo for the trap that makes asking for it afterwards
    // wrong.
    store.switchTo(name);
    setEditorName(name);
    writeFileToUrl(name);
    render();
    inferPanel.reset();
    quest().render(name);
    tabs.select("diag", "reasoning");
    pipeline.runFmt();
    pipeline.refreshDerived();
    terminal.trim();
  }

  /** The shared tail of both reset paths. The store has already put the
   *  restored text into the editor; this is everything downstream of that. */
  function reloadCurrent(): void {
    render();
    pipeline.runFmt();
    pipeline.refreshDerived();
    terminal.trim();
  }

  revertBtn.addEventListener("click", () => {
    const name = store.current();
    if (store.revert(name) === undefined) return;
    terminal.cmd(`git checkout -- ${name}`);
    terminal.line(`${name}: restored to the version this page shipped with`);
    reloadCurrent();
  });

  resetBtn.addEventListener("click", () => {
    if (!window.confirm("Discard every edit and restore the documents this page shipped with?")) {
      return;
    }
    const reverted = store.revertAll();
    terminal.cmd("git checkout -- .");
    terminal.line(
      reverted === 0
        ? "nothing to restore — no document has been edited"
        : `restored ${reverted} document${reverted === 1 ? "" : "s"}`,
    );
    // Files the visitor created are theirs, not ours to delete: "restore the
    // documents this page shipped with" is a promise about the bundled
    // documents, and quietly taking a scratch file with it would be a
    // different, unasked-for operation under the same button.
    reloadCurrent();
  });

  byId("new-file-btn").addEventListener("click", () => {
    const raw = window.prompt("New file name", "untitled.md");
    if (!raw) return;
    let name = raw.trim();
    if (!name) return;
    if (!/\.md$/i.test(name)) name += ".md";
    store.flush();
    if (!store.add(name, NEW_FILE_TEMPLATE)) {
      window.alert(`${name} already exists.`);
      return;
    }
    void switchTo(name);
  });

  return { switchTo, render, setEditorName, refreshDirty };
}
