import type { EditorView } from "@codemirror/view";
import { visimark } from "codemirror-visimark";
import { visimarkLint } from "codemirror-visimark/lint";
import { editorCommands } from "./editor-commands.js";
import { EDITOR_COMMANDS, type ApplyArgs } from "./protocol.js";

interface EditorControl {
  cm6?: unknown;
  addExtension(extension: unknown): void;
  registerCommand?(name: string, command: (...args: unknown[]) => unknown): void;
}

/**
 * Marks and lint in Joplin's CodeMirror 6 editor, and the editor commands the
 * main script's palette commands route to (#384 spec §2.3). No highlighting:
 * Joplin passes its own `codeLanguages` to `markdown()` and gives plugins no
 * way in (#378 spec §2.4). `@codemirror/*` comes from Joplin at run time.
 */
export default (_context: unknown) => ({
  plugin: (control: EditorControl) => {
    if (!control.cm6) return; // the legacy CodeMirror 5 editor: do nothing
    control.addExtension([visimark(), visimarkLint()]);
    const run = editorCommands(control.cm6 as EditorView);
    const register = control.registerCommand?.bind(control);
    if (!register) return;
    register(EDITOR_COMMANDS.check, (args) => run.check(args as { title: string }));
    register(EDITOR_COMMANDS.format, (args) => run.format(args as { fixDates: boolean }));
    register(EDITOR_COMMANDS.evaluate, () => run.evaluate());
    register(EDITOR_COMMANDS.explain, () => run.explain());
    register(EDITOR_COMMANDS.inferPreview, () => run.inferPreview());
    register(EDITOR_COMMANDS.apply, (args) => run.apply(args as ApplyArgs));
    register(EDITOR_COMMANDS.insertTemplate, (args) => run.insertTemplate(args as { id: string }));
  },
  assets: () => [{ name: "visimark.css" }],
});
