import {
  debounce,
  editorInfoField,
  editorLivePreviewField,
  type Editor,
  type MarkdownFileInfo,
} from "obsidian";
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
 * **Map immediately, recompute on a debounce — review row 17.** The old code
 * ran the whole `locate` + `build` + `check` pipeline synchronously on every
 * `docChanged` (measured ~9ms per keystroke on a note-sized document, several
 * times that on mobile), which is the same mistake `analysis.ts`'s memo fixed
 * for reading mode, just uncached because a keystroke's source string is
 * different every time. A value's decoration is a source span, and CodeMirror
 * already knows how to carry a span across an edit — `RangeSet.map` — so
 * `update.changes` moves every existing mark to keep pace with the keystroke
 * for free, and the expensive part (deciding whether a value is `computed` or
 * `disagrees` at all) waits for typing to pause. Mapping can only move a
 * decoration; it can't change which one a span is (`Decoration.mark`'s own
 * `class`/`attributes` ride along unmodified), so a mark drifting for the
 * length of the debounce window never flips its verdict — only the recompute
 * below, or the snapshot effect above, ever does that. The debounced
 * recompute captures the source string it was scheduled for and checks it
 * against the document at fire time, the same guard `scheduleSnapshot`
 * already used for its own, slower race: a further edit before the timer
 * fires simply becomes the debounce's next call (`resetTimer: true` replaces
 * the pending one outright), and if some other path still manages to fire it
 * against stale text, the guard drops it instead of dispatching a decoration
 * set for a document nobody is looking at any more.
 *
 * **Gated on `editorLivePreviewField`, not just the setting — review row
 * 17.** The old code decorated Source mode too, though the setting is named
 * "Show provenance in *Live Preview*"; a source-mode editor now gets `EMPTY`
 * regardless, and switching modes recomputes immediately rather than waiting
 * for the next edit, since a mode switch is not a per-keystroke event worth
 * debouncing.
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

/**
 * The bridge from a `StateField` Obsidian exports to a value out of this
 * view's own `EditorState`. Obsidian bundles its own copy of
 * `@codemirror/state`; this plugin bundles a second one for its own
 * `EditorView`/`ViewPlugin` types. The two `StateField` classes are nominally
 * distinct for the same runtime shape (a `StateField` has no structural
 * difference for `tsc` to check instead), so reading a value out of either
 * `editorInfoField` (which note this editor is backed by) or
 * `editorLivePreviewField` (whether Live Preview, not Source mode, is
 * active — review row 17) needs a bridge across the two copies. `field` is
 * the *same* object at runtime either way — Obsidian's own installed
 * instance — so `state.field` still finds it by the internal id `StateField`
 * assigns at `define()`, regardless of which copy's type declaration `tsc`
 * checked the cast against.
 *
 * **This is the only `as unknown as` in the codebase.** One generic helper
 * bridges both fields, so `editorLivePreviewField` reuses the exact cast
 * `editorInfoField` already needed instead of adding a second, distinct idiom
 * for the same underlying problem. The parameter type is derived from
 * `EditorView`'s own `state` property (`Parameters<typeof state.field>[0]`),
 * the same way the original single-field cast was, rather than named against
 * a bare `import ... from "@codemirror/state"` — the latter is a *third*
 * installed copy in this workspace (`@codemirror/view` depends on
 * `@codemirror/state@^6.5.0`; this workspace's own `devDependencies` ask for
 * `^6.5.2`; the lockfile did not dedupe them), so naming it directly would
 * fail exactly the way it does for `editorInfoField`/`editorLivePreviewField`,
 * just one dependency edge further down.
 */
function fieldValue<T>(state: EditorView["state"], field: unknown): T | undefined {
  return state.field(field as unknown as Parameters<typeof state.field>[0], false) as T | undefined;
}

// absent only if this editor is not backed by a note Obsidian knows the path
// of yet (e.g. a brand-new unsaved file) — the mark still shows, it just
// cannot say which note it belongs to
function pathFor(view: EditorView): string | null {
  return fieldValue<MarkdownFileInfo>(view.state, editorInfoField)?.file?.path ?? null;
}

/** True only in Live Preview, never Source mode or reading mode — review row 17. */
function isLivePreview(state: EditorView["state"]): boolean {
  return fieldValue<boolean>(state, editorLivePreviewField) ?? false;
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

/** The gate, then the pipeline: `EMPTY` for a note with no block, the reader-less marks otherwise. */
function localAnalysisFor(view: EditorView): LocalMarks {
  const source = view.state.doc.toString();
  // the gate, before the parse: an ordinary note costs a substring
  // scan (`mightHaveBlock`, inlined into `hasVmarkBlock`) and nothing more
  if (!hasVmarkBlock(source)) return { decorations: EMPTY, withheld: false };
  return localMarksFor(view, source);
}

/** Dispatched once a debounced `analyseWithSnapshot` resolves. */
const setSnapshotMarks = StateEffect.define<DecorationSet>();

/** Dispatched once a debounced local recompute (row 17) resolves. */
const setLocalMarks = StateEffect.define<DecorationSet>();

/**
 * Dispatched by `settings-tab.ts` to every open Live Preview editor when
 * "Show provenance in Live Preview" is toggled — a setting flip is not a
 * document change or a mode switch, and would otherwise sit unapplied until
 * the next keystroke or the next time the note opened (review row 17).
 */
export const forceLivePreviewRecompute = StateEffect.define<undefined>();

const RECOMPUTE_DEBOUNCE_MS = 400; // the same cadence `main.ts`'s `refreshSoon` and `scheduleSnapshot` use, not a third one to reason about

/**
 * The extension to register.
 *
 * Rebuilt from scratch only on a debounce, a mode switch, or a forced
 * settings refresh — never synchronously on every `docChanged` (row 17).
 * **Not on `viewportChanged`** — the decoration set is source spans, computed
 * from the whole document, and does not depend on which part of it is
 * scrolled into view; rebuilding on scroll would pay for a full `locate` +
 * `build` + `check` (measured ~9ms on a note-sized document, not the ~2.8ms
 * of `check` alone) for no change in the result.
 *
 * `enabled` is read fresh every time a full recompute runs, so flipping the
 * setting takes effect the moment `forceLivePreviewRecompute` lands rather
 * than waiting on a separate mechanism to notice.
 *
 * **The vault read stays off the keystroke path.** Same as before: only a
 * recompute that withholds at least one mark schedules `analyseWithSnapshot`,
 * debounced at the shared 400ms cadence, and the snapshot's answer is checked
 * against `view.state.doc.toString()` before it is dispatched.
 */
export function livePreviewMarks(enabled: () => boolean, read: VaultRead): Extension {
  return ViewPlugin.define(
    (view: EditorView) => {
      // Set in `destroy()`. `scheduleSnapshot.cancel()`/`scheduleRecompute.cancel()`
      // only drop a *pending* debounced call; work already in flight when the
      // view is torn down has no way to be cancelled, so each `.then`/callback
      // checks this before ever touching `view` again.
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
        RECOMPUTE_DEBOUNCE_MS,
        true,
      );

      /** The full pipeline, gated on the setting and on Live Preview, with the snapshot fetch armed as a side effect. */
      const applyFull = (v: EditorView): DecorationSet => {
        if (!enabled() || !isLivePreview(v.state)) return EMPTY;
        const local = localAnalysisFor(v);
        const path = pathFor(v);
        if (local.withheld && path !== null) scheduleSnapshot(v.state.doc.toString(), path);
        return local.decorations;
      };

      const scheduleRecompute = debounce(
        // The immutable `Text` CodeMirror already holds, not a stringified
        // copy: `state.doc` is a new instance only when the document itself
        // changes (a selection-only transaction keeps the same one), so
        // comparing by identity is an O(1) staleness check that never pays
        // for the O(document length) `toString()` row 17 exists to avoid.
        (source: typeof view.state.doc) => {
          if (destroyed) return;
          if (view.state.doc !== source) return; // dropped: a newer edit landed first
          view.dispatch({ effects: setLocalMarks.of(applyFull(view)) });
        },
        RECOMPUTE_DEBOUNCE_MS,
        true,
      );

      return {
        decorations: applyFull(view),
        update(update: ViewUpdate) {
          for (const tr of update.transactions) {
            for (const effect of tr.effects) {
              if (effect.is(setSnapshotMarks) || effect.is(setLocalMarks)) {
                this.decorations = effect.value;
              }
            }
          }

          const modeSwitched = isLivePreview(update.startState) !== isLivePreview(update.state);
          const forced = update.transactions.some((tr) =>
            tr.effects.some((effect) => effect.is(forceLivePreviewRecompute)),
          );

          if (modeSwitched || forced) {
            // neither is a per-keystroke event, so both recompute immediately
            // rather than waiting on the debounce below
            this.decorations = applyFull(update.view);
            return;
          }

          if (!enabled() || !isLivePreview(update.state)) {
            this.decorations = EMPTY;
            return;
          }

          if (update.docChanged) {
            // Map now, so a mark tracks the edit instead of vanishing or
            // freezing for the debounce window; recompute for real once
            // typing pauses. Mapping only moves a decoration — it can't
            // change `computed` to `disagrees` or back, since only
            // `applyFull` (below, or the snapshot effect above) ever decides
            // a mark's verdict.
            this.decorations = this.decorations.map(update.changes);
            scheduleRecompute(update.view.state.doc);
          }
        },
        destroy() {
          destroyed = true;
          scheduleSnapshot.cancel();
          scheduleRecompute.cancel();
        },
      };
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

/**
 * The real, undocumented bridge from Obsidian's public `Editor` to the CM6
 * `EditorView` underneath it — `obsidian.d.ts` never declares `cm` on
 * `Editor` (the interface predates CM6, and also has to describe Source
 * mode's plain textarea editor), but every CM6-backed `Editor` instance
 * carries one; it is how the plugin ecosystem gets from a `MarkdownView` to
 * the CodeMirror state living inside it. `settings-tab.ts` needs it to
 * dispatch `forceLivePreviewRecompute` to every open editor when the setting
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
