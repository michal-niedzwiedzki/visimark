import { visimark } from "codemirror-visimark";
import { visimarkLint } from "codemirror-visimark/lint";

interface EditorControl {
  cm6?: unknown;
  addExtension(extension: unknown): void;
}

/**
 * Marks and lint in Joplin's CodeMirror 6 editor. No highlighting: Joplin
 * passes its own `codeLanguages` to `markdown()` and gives plugins no way in
 * (spec §2.4). `@codemirror/*` comes from Joplin at run time.
 */
export default (_context: unknown) => ({
  plugin: (control: EditorControl) => {
    if (!control.cm6) return; // the legacy CodeMirror 5 editor: do nothing
    control.addExtension([visimark(), visimarkLint()]);
  },
  assets: () => [{ name: "visimark.css" }],
});
