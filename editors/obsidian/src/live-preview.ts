import { debounce, editorInfoField, type MarkdownFileInfo } from "obsidian";
import { RangeSetBuilder, StateEffect, type Extension } from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { analyse, analyseWithSnapshot } from "./analysis.js";
import type { Decoration as VmarkDecoration } from "./decorations.js";
import { hasVmarkBlock } from "./gate.js";
import { importDependentNames } from "./import-deps.js";
import type { VaultRead } from "./snapshot.js";

/**
 * Live Preview's half of v1 row 2 — the decorations over the editor's own
 * document.
 *
 * **CodeMirror is the easy half and reading mode is the hard one**, because
 * here the thing being decorated *is* the source: a decoration is a range of
 * offsets, which is exactly what `decorations.ts` produces. Nothing has to be
 * matched back to a rendered node.
 *
 * **It runs without a `ReaderPort` synchronously, and dispatches the
 * snapshot's answer once it lands — review row 6.** `check`ing without a
 * reader cannot tell `computed` from `disagrees` for a value whose formula
 * reads an imported sheet: it has never read the file. The old argument here
 * was that the gap was safe because an unresolved import produces `IMPORT`,
 * not `STALE` — that was wrong in both directions (reproduced against the
 * engine: no `IMPORT` is emitted without a reader, and a value that actually
 * disagrees renders as `computed`). So `localMarksFor` withholds the mark on
 * any value `importDependentNames` says reads an import, rather than
 * asserting the reader-less answer for it, and a debounced
 * `analyseWithSnapshot` fills those marks in — and only those — once the
 * vault-backed `check` resolves, via a `StateEffect` the document's own
 * unchanged-ness is checked against before it is applied.
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

// absent only if this editor is not backed by a note Obsidian knows the path
// of yet (e.g. a brand-new unsaved file) — the mark still shows, it just
// cannot say which note it belongs to
//
// `as unknown as typeof field` is a duplicate-`@codemirror/state`-install
// workaround, not a real type difference: this repository's `EditorView`
// resolves `@codemirror/state` to one installed copy, and `obsidian`'s own
// `.d.ts` resolves `editorInfoField`'s `StateField` to a different installed
// copy — nominally distinct types for the same class at runtime, since
// `StateField` has no structural difference to check instead.
function pathFor(view: EditorView): string | null {
  const field = editorInfoField as unknown as Parameters<typeof view.state.field>[0];
  return (view.state.field(field, false) as MarkdownFileInfo | undefined)?.file?.path ?? null;
}

interface LocalMarks {
  readonly decorations: DecorationSet;
  /** at least one decoration was withheld pending the snapshot */
  readonly withheld: boolean;
}

/** The reader-less half: every mark except one that reads an import. */
function localMarksFor(view: EditorView, source: string): LocalMarks {
  const builder = new RangeSetBuilder<Decoration>();
  const path = pathFor(view);
  const { model, decorations } = analyse(source);
  const importDependent = importDependentNames(model);
  let withheld = false;
  for (const decoration of decorations) {
    if (importDependent.has(decoration.name)) {
      withheld = true;
      continue;
    }
    builder.add(decoration.span.start, decoration.span.end, markFor(decoration, path));
  }
  return { decorations: builder.finish(), withheld };
}

const EMPTY: DecorationSet = new RangeSetBuilder<Decoration>().finish();

/** Dispatched once a debounced `analyseWithSnapshot` resolves. */
const setSnapshotMarks = StateEffect.define<DecorationSet>();

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
 *
 * **The vault read stays off the keystroke path.** `localMarksFor` runs
 * synchronously on every `docChanged`, same as before; only when it withholds
 * at least one mark does this schedule `analyseWithSnapshot`, and that call
 * is debounced at the same 400ms `main.ts`'s own `refreshSoon` uses, not a
 * second cadence to reason about. The snapshot's answer is checked against
 * `view.state.doc.toString()` before it is dispatched, so a note edited again
 * during the fetch discards the stale answer instead of painting it.
 */
export function livePreviewMarks(enabled: () => boolean, read: VaultRead): Extension {
  return ViewPlugin.define(
    (view: EditorView) => {
      // Set in `destroy()`. `scheduleSnapshot.cancel()` only drops a *pending*
      // debounced call; a fetch already in flight when the view is torn down
      // has no way to be cancelled, so its `.then` checks this before ever
      // touching `view` again.
      let destroyed = false;

      const scheduleSnapshot = debounce(
        (source: string, path: string) => {
          analyseWithSnapshot(source, path, read)
            .then((snapshot) => {
              if (destroyed) return; // the view closed while the fetch was in flight
              if (!enabled()) return; // the setting flipped off while the fetch was in flight
              if (view.state.doc.toString() !== source) return; // stale; a newer edit already landed
              const builder = new RangeSetBuilder<Decoration>();
              for (const decoration of snapshot.decorations) {
                builder.add(decoration.span.start, decoration.span.end, markFor(decoration, path));
              }
              view.dispatch({ effects: setSnapshotMarks.of(builder.finish()) });
            })
            .catch(() => {
              // a failed vault read leaves the withheld marks withheld; the
              // status bar (`main.ts`'s `refreshState`) reports the failure
            });
        },
        400,
        true,
      );

      const recompute = (v: EditorView): DecorationSet => {
        const source = v.state.doc.toString();
        // the gate, before the parse: an ordinary note costs a substring
        // scan (`mightHaveBlock`, inlined into `hasVmarkBlock`) and nothing more
        if (!hasVmarkBlock(source)) return EMPTY;
        const local = localMarksFor(v, source);
        const path = pathFor(v);
        if (local.withheld && path !== null) scheduleSnapshot(source, path);
        return local.decorations;
      };

      return {
        decorations: enabled() ? recompute(view) : EMPTY,
        update(update: ViewUpdate) {
          for (const tr of update.transactions) {
            for (const effect of tr.effects) {
              if (effect.is(setSnapshotMarks)) this.decorations = effect.value;
            }
          }
          if (update.docChanged) {
            this.decorations = enabled() ? recompute(update.view) : EMPTY;
          }
        },
        destroy() {
          destroyed = true;
          scheduleSnapshot.cancel();
        },
      };
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
