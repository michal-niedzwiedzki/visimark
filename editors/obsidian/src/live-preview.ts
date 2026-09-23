import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView } from "@codemirror/view";
import { build, check, locate } from "visimark";
import { decorationsFor } from "./decorations.js";
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
 */

const COMPUTED = Decoration.mark({ class: "visimark-computed" });
const DISAGREES = Decoration.mark({ class: "visimark-computed visimark-disagrees" });

function marksFor(view: EditorView): DecorationSet {
  const source = view.state.doc.toString();
  const builder = new RangeSetBuilder<Decoration>();
  // the gate, before the parse: an ordinary note must cost a substring scan
  if (!hasVmarkBlock(source)) return builder.finish();

  const model = build(locate(source));
  for (const decoration of decorationsFor(model, check(model))) {
    builder.add(
      decoration.span.start,
      decoration.span.end,
      decoration.mark === "disagrees" ? DISAGREES : COMPUTED,
    );
  }
  return builder.finish();
}

/**
 * The extension to register.
 *
 * Rebuilt on every document change rather than mapped through it: a value's
 * span moves when a character before it is typed, and a mapped range would
 * drift off the value it is about. `check` on a note-sized document is ~2.8 ms
 * (measured), and CodeMirror only asks when the document or the viewport
 * actually changed.
 */
export function livePreviewMarks(): Extension {
  return ViewPlugin.define(
    (view: EditorView) => ({
      decorations: marksFor(view),
      update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = marksFor(update.view);
        }
      },
    }),
    { decorations: (plugin) => plugin.decorations },
  );
}
