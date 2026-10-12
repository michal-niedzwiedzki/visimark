import type { Extension } from "@codemirror/state";
import { linter, type Diagnostic } from "@codemirror/lint";
import { describeFinding } from "visimark";
import { findingsField, setFindings } from "./findings-field.js";
import { SEVERITY } from "./severity.js";

/**
 * codemirror-visimark/lint — diagnostics over the finding set `visimark()`
 * computed for this editor, in the CLI's own words (#360). It runs no engine
 * pass of its own: it reads the field the marks' recompute fills, and re-reads
 * it whenever that field is replaced. Without `visimark()` in the same editor
 * there is no field, and there are no diagnostics.
 *
 * Obsidian does not use this — #176's constraint 6 forbids red and finding
 * codes in its UI.
 */
export function visimarkLint(): Extension {
  return linter(
    (view) => {
      const findings = view.state.field(findingsField, false);
      if (!findings) return [];
      const length = view.state.doc.length;
      const out: Diagnostic[] = [];
      for (const f of findings) {
        if (f.span === undefined) continue; // NOTE, the collapsed anchor group
        const from = Math.min(f.span.start, length);
        out.push({
          from,
          to: Math.min(Math.max(f.span.end, from), length),
          severity: SEVERITY[f.code],
          source: "visimark",
          message: describeFinding(f),
        });
      }
      return out;
    },
    {
      delay: 0,
      needsRefresh: (update) =>
        update.transactions.some((tr) => tr.effects.some((e) => e.is(setFindings))),
    },
  );
}
