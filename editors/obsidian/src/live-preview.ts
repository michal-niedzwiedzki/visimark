import { editorInfoField, type MarkdownFileInfo } from "obsidian";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView } from "@codemirror/view";
import { analyse } from "./analysis.js";
import type { Decoration as VmarkDecoration } from "./decorations.js";
import { hasVmarkBlock } from "./gate.js";

/**
 * Live Preview's half of v1 row 2 — the decorations over the editor's own
 * document.
 *
 * **CodeMirror is the easy half and reading mode is the hard one**, because
 * here the thing being decorated *is* the source: a decoration is a range of
 * offsets, which is exactly what `decorations.ts` produces. Nothing has to be
 * matched back to a rendered node.
 *
 * **It runs without a `ReaderPort`, and that is a deliberate limitation.**
 * The snapshot (§2.6) is asynchronous and a CodeMirror plugin is not, so a
 * note whose imports or charts are unresolved is decorated from a `check` that
 * could not read them. The consequence is bounded and in the safe direction:
 * an unresolved import produces `IMPORT`, not `STALE`, so a value is never
 * *wrongly* called disagreeing — at worst a chart's staleness goes unmarked
 * here, and the findings view, which does wait for the snapshot, says so.
 *
 * **Nothing here writes.** Manual test §2.2's pass condition is that a note
 * copied out of the vault renders on GitHub exactly as it did before the
 * plugin existed; the guarantee is structural — a `Decoration.mark` is a class
 * on a rendered range and never a change to the document.
 *
 * **Every mark carries `data-vmark`, `data-vmark-row` and `data-vmark-path`
 * as DOM attributes**, not only a CSS class — `main.ts`'s hover/tap listeners
 * find a mark by `closest("[data-vmark]")`, and reading mode is not the only
 * renderer they have to work in (#176's row 3 is "hover / tap" precisely
 * because a phone has no hover, and Live Preview is the surface an author is
 * looking at while typing). `MarkDecorationSpec.attributes` puts them on the
 * wrapping element CodeMirror renders, the same way `reading-mode.ts`'s
 * `apply` does for its own `<span>`s.
 */

/** one CodeMirror mark per decoration, carrying that decoration's own name/row/path */
function markFor(d: VmarkDecoration, path: string | null): Decoration {
  const attributes: Record<string, string> = { "data-vmark": d.name, tabindex: "0" };
  if (path !== null) attributes["data-vmark-path"] = path;
  if (d.row !== undefined) attributes["data-vmark-row"] = String(d.row);
  return Decoration.mark({
    class: d.mark === "disagrees" ? "visimark-computed visimark-disagrees" : "visimark-computed",
    attributes,
  });
}

function marksFor(view: EditorView): DecorationSet {
  const source = view.state.doc.toString();
  const builder = new RangeSetBuilder<Decoration>();
  // the gate, before the parse: an ordinary note costs a substring scan
  // (`mightHaveBlock`, inlined into `hasVmarkBlock`) and nothing more
  if (!hasVmarkBlock(source)) return builder.finish();

  // absent only if this editor is not backed by a note Obsidian knows the
  // path of yet (e.g. a brand-new unsaved file) — the mark still shows, it
  // just cannot say which note it belongs to
  //
  // `as unknown as typeof field` is a duplicate-`@codemirror/state`-install
  // workaround, not a real type difference: this repository's `EditorView`
  // resolves `@codemirror/state` to one installed copy, and `obsidian`'s own
  // `.d.ts` resolves `editorInfoField`'s `StateField` to a different
  // installed copy — nominally distinct types for the same class at runtime,
  // since `StateField` has no structural difference to check instead.
  const field = editorInfoField as unknown as Parameters<typeof view.state.field>[0];
  const path = (view.state.field(field, false) as MarkdownFileInfo | undefined)?.file?.path ?? null;
  const { decorations } = analyse(source);
  for (const decoration of decorations) {
    builder.add(decoration.span.start, decoration.span.end, markFor(decoration, path));
  }
  return builder.finish();
}

const EMPTY: DecorationSet = new RangeSetBuilder<Decoration>().finish();

/**
 * The extension to register.
 *
 * Rebuilt on every document change rather than mapped through it: a value's
 * span moves when a character before it is typed, and a mapped range would
 * drift off the value it is about. **Not on `viewportChanged`** — the
 * decoration set is source spans, computed from the whole document, and does
 * not depend on which part of it is scrolled into view; rebuilding on scroll
 * would pay for a full `locate` + `build` + `check` (measured ~9ms on a
 * note-sized document, not the ~2.8ms of `check` alone) for no change in the
 * result.
 *
 * `enabled` is read fresh on every rebuild rather than baked in once, so
 * flipping the "Show provenance in Live Preview" setting (§2.5, default on)
 * takes effect on the next document change or the next time a note opens,
 * with no separate mechanism to force every open editor to redraw.
 */
export function livePreviewMarks(enabled: () => boolean): Extension {
  return ViewPlugin.define(
    (view: EditorView) => ({
      decorations: enabled() ? marksFor(view) : EMPTY,
      update(update: { docChanged: boolean; view: EditorView }) {
        if (update.docChanged) {
          this.decorations = enabled() ? marksFor(update.view) : EMPTY;
        }
      },
    }),
    { decorations: (plugin) => plugin.decorations },
  );
}
