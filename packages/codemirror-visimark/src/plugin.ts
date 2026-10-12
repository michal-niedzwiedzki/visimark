import {
  RangeSetBuilder,
  StateEffect,
  type EditorState,
  type Extension,
  type Text,
} from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { analyse, analyseWithSnapshot } from "./analysis.js";
import type { Decoration as VmarkDecoration } from "./decorations.js";
import { findingsField, setFindings, type FindingSet } from "./findings-field.js";
import { hasVmarkBlock } from "./gate.js";
import { hasImportedSheet, importDependentNames } from "./import-deps.js";
import type { ReadImport } from "./snapshot.js";
import { debounce } from "./timer.js";

/**
 * The marks: Live Preview's half of #176 row 2, extracted from the Obsidian
 * client (#360). The design notes that used to live in
 * editors/obsidian/src/live-preview.ts still hold and are summarised here:
 *
 * - **Local phase, then snapshot phase.** A reader-less `check` cannot tell
 *   `computed` from `disagrees` for a value that reads an imported sheet, so
 *   such a mark is withheld, and a snapshot-backed `check` fills it in once
 *   the host's `readImport` has served the files (review row 6).
 * - **Map now, recompute later.** An edit maps existing marks through the
 *   change (`RangeSet.map`), which can move a mark but never change its
 *   verdict; only a recompute decides `computed` vs `disagrees` (row 17).
 * - **Nothing writes.** A `Decoration.mark` is a class on rendered text.
 * - **Stale answers are dropped.** An async answer applies only if the view
 *   is alive, `active` still holds, and the document is unchanged.
 */

export const RECOMPUTE_DEBOUNCE_MS = 400;

/** Each live view's plugin value, for `marksIn` — tests only, never exported from index.ts. */
const instances = new WeakMap<EditorView, { decorations: DecorationSet }>();

/** Every mark the plugin holds for `view`, whether or not CodeMirror rendered it. */
export function marksIn(
  view: EditorView,
): { from: number; to: number; name: string; disagrees: boolean }[] {
  const set = instances.get(view)?.decorations ?? Decoration.none;
  const out: { from: number; to: number; name: string; disagrees: boolean }[] = [];
  set.between(0, view.state.doc.length, (from, to, value) => {
    const spec = value.spec as { class?: string; attributes?: Record<string, string> };
    out.push({
      from,
      to,
      name: spec.attributes?.["data-vmark"] ?? "",
      disagrees: (spec.class ?? "").includes("visimark-disagrees"),
    });
  });
  return out;
}

export const refreshEffect = StateEffect.define<null>();
const setMarks = StateEffect.define<DecorationSet>();

export interface ResolvedOptions {
  readonly active: (state: EditorState) => boolean;
  readonly path: (state: EditorState) => string | null;
  readonly readImport: ReadImport | undefined;
  readonly recompute: "debounced" | "on-refresh";
  readonly focusableMarks: boolean;
}

function markFor(d: VmarkDecoration, path: string | null, focusable: boolean): Decoration {
  const attributes: Record<string, string> = { "data-vmark": d.name };
  if (focusable) attributes.tabindex = "0";
  if (path !== null) attributes["data-vmark-path"] = path;
  if (d.row !== undefined) attributes["data-vmark-row"] = String(d.row);
  return Decoration.mark({
    class: d.mark === "disagrees" ? "visimark-computed visimark-disagrees" : "visimark-computed",
    attributes,
  });
}

function marksFrom(
  decorations: readonly VmarkDecoration[],
  path: string | null,
  focusable: boolean,
  skip: ReadonlySet<string>,
): { set: DecorationSet; skipped: boolean } {
  const builder = new RangeSetBuilder<Decoration>();
  let skipped = false;
  for (const d of decorations) {
    if (skip.has(d.name)) {
      skipped = true;
      continue;
    }
    builder.add(d.span.start, d.span.end, markFor(d, path, focusable));
  }
  return { set: builder.finish(), skipped };
}

interface Local {
  readonly decorations: DecorationSet;
  readonly findings: FindingSet;
  readonly needsSnapshot: boolean;
}

const NOTHING: Local = { decorations: Decoration.none, findings: [], needsSnapshot: false };

/** The gate, then the reader-less pipeline. */
function localFor(state: EditorState, o: ResolvedOptions): Local {
  if (!o.active(state)) return NOTHING;
  const source = state.doc.toString();
  if (!hasVmarkBlock(source)) return NOTHING;
  const { model, result, decorations } = analyse(source);
  const imported = hasImportedSheet(model);
  const { set, skipped } = marksFrom(
    decorations,
    o.path(state),
    o.focusableMarks,
    importDependentNames(model),
  );
  return {
    decorations: set,
    findings: imported ? null : result.findings,
    needsSnapshot: skipped || imported,
  };
}

export function visimarkExtension(o: ResolvedOptions): Extension {
  const plugin = ViewPlugin.define(
    (view: EditorView) => {
      let destroyed = false;

      const publish = (decorations: DecorationSet, findings: FindingSet): void => {
        view.dispatch({ effects: [setMarks.of(decorations), setFindings.of(findings)] });
      };

      /** Findings for a recompute done during construction or `update()`,
       *  where dispatching is not allowed: queued, and dropped if the
       *  document moved on first. */
      const publishFindingsSoon = (findings: FindingSet, doc: Text): void => {
        queueMicrotask(() => {
          if (!destroyed && view.state.doc === doc)
            view.dispatch({ effects: setFindings.of(findings) });
        });
      };

      const runSnapshot = (source: string, path: string, read: ReadImport): void => {
        analyseWithSnapshot(source, path, read)
          .then((snapshot) => {
            if (destroyed) return;
            if (!o.active(view.state)) return;
            if (view.state.doc.toString() !== source) return;
            // an import the engine could not read (IMPORT) means a value
            // computed from it was not checked either: keep those withheld
            const unread = snapshot.result.findings.some((f) => f.code === "IMPORT");
            const skip = unread ? importDependentNames(snapshot.model) : new Set<string>();
            const { set } = marksFrom(snapshot.decorations, path, o.focusableMarks, skip);
            publish(set, snapshot.result.findings);
          })
          .catch(() => {
            // a failed read leaves withheld marks withheld; the host reports
            // its own read failures where it reports everything else
          });
      };
      const scheduleSnapshot = debounce(runSnapshot, RECOMPUTE_DEBOUNCE_MS);

      /** `settled`: the caller already waited for typing to pause (the
       *  debounced recompute, or on-refresh), so the snapshot starts now
       *  rather than a second debounce later. */
      const recompute = (state: EditorState, settled: boolean): Local => {
        const local = localFor(state, o);
        const path = o.path(state);
        if (local.needsSnapshot && path !== null && o.readImport !== undefined) {
          const source = state.doc.toString();
          if (settled || o.recompute === "on-refresh") runSnapshot(source, path, o.readImport);
          else scheduleSnapshot(source, path, o.readImport);
        }
        return local;
      };

      const scheduleRecompute = debounce((doc: Text) => {
        if (destroyed || view.state.doc !== doc) return;
        const local = recompute(view.state, true);
        publish(local.decorations, local.findings);
      }, RECOMPUTE_DEBOUNCE_MS);

      const initial = recompute(view.state, false);
      publishFindingsSoon(initial.findings, view.state.doc);

      const value = {
        decorations: initial.decorations,
        update(update: ViewUpdate) {
          for (const tr of update.transactions) {
            for (const effect of tr.effects)
              if (effect.is(setMarks)) this.decorations = effect.value;
          }
          const switched = o.active(update.startState) !== o.active(update.state);
          const forced = update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(refreshEffect)),
          );
          if (switched || forced) {
            const local = recompute(update.state, false);
            this.decorations = local.decorations;
            publishFindingsSoon(local.findings, update.state.doc);
            return;
          }
          if (!o.active(update.state)) {
            this.decorations = Decoration.none;
            return;
          }
          if (update.docChanged) {
            this.decorations = this.decorations.map(update.changes);
            if (o.recompute === "debounced") scheduleRecompute(update.state.doc);
          }
        },
        destroy() {
          destroyed = true;
          scheduleSnapshot.cancel();
          scheduleRecompute.cancel();
          instances.delete(view);
        },
      };
      instances.set(view, value);
      return value;
    },
    { decorations: (p) => p.decorations },
  );
  return [findingsField, plugin];
}
