import { Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { visimark } from "codemirror-visimark";
import { visimarkLint } from "codemirror-visimark/lint";
import { editorCommands } from "./editor-commands.js";
import { EDITOR_COMMANDS, type ApplyArgs } from "./protocol.js";

interface EditorControl {
  cm6?: unknown;
  addExtension(extension: unknown): void;
  registerCommand?(name: string, command: (...args: unknown[]) => unknown): void;
}

interface Context {
  /** what a CodeMirror content script uses to ask the main script something */
  postMessage?(message: unknown): Promise<unknown>;
}

/** `showMarks` off: a class the stylesheet hides the marks under (#384 spec §2.4) */
const marksOff: Extension = EditorView.editorAttributes.of({ class: "visimark-marks-off" });

/**
 * Marks and lint in Joplin's CodeMirror 6 editor, and the editor commands the
 * main script's palette commands route to (#384 spec §2.3). No highlighting:
 * Joplin passes its own `codeLanguages` to `markdown()` and gives plugins no
 * way in (#378 spec §2.4). `@codemirror/*` comes from Joplin at run time.
 *
 * `showMarks` off hides the marks and keeps the diagnostics: the lint reads
 * the same findings whether or not the marks show.
 */
export default (context: Context) => ({
  plugin: (control: EditorControl) => {
    if (!control.cm6) return; // the legacy CodeMirror 5 editor: do nothing
    const view = control.cm6 as EditorView;
    const marks = new Compartment();
    control.addExtension([visimark(), visimarkLint(), marks.of([])]);
    const setMarks = (show: boolean): void => {
      view.dispatch({ effects: marks.reconfigure(show ? [] : marksOff) });
    };
    void context.postMessage?.({ kind: "settings" }).then(
      (reply) => {
        if ((reply as { showMarks?: unknown } | undefined)?.showMarks === false) setMarks(false);
      },
      () => {}, // no answer keeps the default: marks on
    );

    const run = editorCommands(view);
    const register = control.registerCommand?.bind(control);
    if (!register) return;
    register(EDITOR_COMMANDS.check, (args) => run.check(args as { title: string }));
    register(EDITOR_COMMANDS.format, (args) => run.format(args as { fixDates: boolean }));
    register(EDITOR_COMMANDS.evaluate, () => run.evaluate());
    register(EDITOR_COMMANDS.explain, () => run.explain());
    register(EDITOR_COMMANDS.inferPreview, () => run.inferPreview());
    register(EDITOR_COMMANDS.apply, (args) => run.apply(args as ApplyArgs));
    register(EDITOR_COMMANDS.insertTemplate, (args) => run.insertTemplate(args as { id: string }));
    register(EDITOR_COMMANDS.setMarks, (args) => {
      setMarks((args as { show: boolean }).show);
      return { kind: "ok" };
    });
  },
  assets: () => [{ name: "visimark.css" }],
});
