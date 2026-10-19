import {
  editorInfoField,
  editorLivePreviewField,
  type Editor,
  type MarkdownFileInfo,
} from "obsidian";
import type { EditorState, Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { visimark } from "codemirror-visimark";
import type { VaultRead } from "./snapshot.js";

/**
 * Live Preview's marks are `codemirror-visimark`'s (#360). What stays here is
 * the part only Obsidian can answer: which note this editor is backed by, and
 * whether Live Preview (not Source mode) is showing.
 *
 * **The bridge from a `StateField` Obsidian exports.** `obsidian.d.ts` types
 * `editorInfoField` and `editorLivePreviewField` against its own declaration
 * of `@codemirror/state`; at run time they are Obsidian's own field objects
 * and the plugin uses Obsidian's CodeMirror (every `@codemirror/*` is
 * external in esbuild.config.mjs), so `state.field` finds them. The cast only
 * crosses two type declarations. **This is the only `as unknown as` in the
 * codebase.**
 */
function fieldValue<T>(state: EditorState, field: unknown): T | undefined {
  return state.field(field as Parameters<typeof state.field>[0], false) as T | undefined;
}

// absent only for an editor not yet backed by a note Obsidian knows the path of
function pathFor(state: EditorState): string | null {
  return fieldValue<MarkdownFileInfo>(state, editorInfoField)?.file?.path ?? null;
}

/** True only in Live Preview, never Source mode or reading mode — review row 17. */
function isLivePreview(state: EditorState): boolean {
  return fieldValue<boolean>(state, editorLivePreviewField) ?? false;
}

/**
 * The extension to register: the package's, gated on the setting and on Live
 * Preview, debounced as it always was, with focusable marks for the tap
 * listener in main.ts (#176 row 3).
 */
export function livePreviewMarks(enabled: () => boolean, read: VaultRead): Extension {
  return visimark({
    active: (state) => enabled() && isLivePreview(state),
    path: pathFor,
    readImport: read,
    recompute: "debounced",
    focusableMarks: true,
  });
}

/**
 * The real, undocumented bridge from Obsidian's public `Editor` to the CM6
 * `EditorView` underneath it — `obsidian.d.ts` never declares `cm` on
 * `Editor` (the interface predates CM6, and also has to describe Source
 * mode's plain textarea editor), but every CM6-backed `Editor` instance
 * carries one; it is how the plugin ecosystem gets from a `MarkdownView` to
 * the CodeMirror state living inside it. `settings-tab.ts` needs it to
 * dispatch the package's `refresh` to every open editor when the setting
 * changes.
 *
 * A plain `as`, not `as unknown as`: `Editor & { cm: EditorView }` is a
 * strict subtype of `Editor` (every member `Editor` requires, plus one more),
 * so it is assignable *to* `Editor`, which is what lets `tsc` accept the
 * narrowing without the `unknown` bridge `fieldValue` above needs for two
 * nominally unrelated classes.
 */
export function editorViewOf(editor: Editor): EditorView | undefined {
  return (editor as Editor & { cm?: EditorView }).cm;
}
