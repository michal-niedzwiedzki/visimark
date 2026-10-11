import type { EditorState, Extension, StateEffectType } from "@codemirror/state";
import { refreshEffect, visimarkExtension } from "./plugin.js";

/**
 * codemirror-visimark — VisiMark's marks for any CodeMirror 6 editor (#360).
 *
 * The whole published surface is this file and `./lint`. Everything else in
 * src/ is internal; no engine type appears in a published declaration, and
 * the options are closed — `readImport` returns text and nothing else, so no
 * option can carry an evaluation hook (docs/visimark-design.md §2,
 * constraint 4).
 */

/** Read one file a document declares as an import. Text, or null when unreadable. */
export type ReadImport = (path: string) => Promise<string | null>;

export interface VisimarkOptions {
  /** Whether to decorate this state at all. Default: always. */
  readonly active?: (state: EditorState) => boolean;
  /**
   * The document's path, relative to the root its imports resolve within
   * (`notes/q3.md`, `tutorial/13-imports.md`). The engine sees it as `/` + path.
   * null: this document gets no reader. Default: always null.
   */
  readonly path?: (state: EditorState) => string | null;
  /** How declared imports are read. Absent: no reader, whatever `path` says. */
  readonly readImport?: ReadImport;
  /** When marks are recomputed. Default: "debounced". */
  readonly recompute?: "debounced" | "on-refresh";
  /** Put tabindex="0" on every mark. Default: false. */
  readonly focusableMarks?: boolean;
}

export function visimark(options: VisimarkOptions = {}): Extension {
  return visimarkExtension({
    active: options.active ?? (() => true),
    path: options.path ?? (() => null),
    readImport: options.readImport,
    recompute: options.recompute ?? "debounced",
    focusableMarks: options.focusableMarks ?? false,
  });
}

/** Dispatch `refresh.of(null)` to recompute now, whatever `recompute` says. */
export const refresh: StateEffectType<null> = refreshEffect;
