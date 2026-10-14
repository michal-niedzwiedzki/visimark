import type { Extension } from "@codemirror/state";
import { linter, type Action, type Diagnostic } from "@codemirror/lint";
import { describeFinding } from "visimark";
import { findingsField, setFindings, type LintFinding } from "./findings-field.js";
import { SEVERITY } from "./severity.js";

/**
 * codemirror-visimark/lint — diagnostics over the finding set `visimark()`
 * computed for this editor, in the CLI's own words (#360). It runs no engine
 * pass of its own: it reads the field the marks' recompute fills, and re-reads
 * it whenever that field is replaced. Without `visimark()` in the same editor
 * there is no field, and there are no diagnostics.
 *
 * Each diagnostic carries the quick fixes `visimark-lsp` offers for the same
 * finding (#384): update a stale value, rewrite a decidable date, take the
 * did-you-mean, wrap a column in `SUM`. Each is one transaction over the
 * diagnostic's current span, so one undo reverts it.
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
          actions: actionsFor(f),
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

/** The replacement for one finding, or `null` when nothing obvious repairs it. */
function fixFor(f: LintFinding): { name: string; text: string } | null {
  switch (f.code) {
    case "STALE":
      return f.fix === undefined ? null : { name: `Update to ${f.fix}`, text: f.fix };
    case "DATE":
      // offered whatever the host's Format setting, as the LSP offers it
      return f.isoFix === undefined ? null : { name: `Rewrite to ${f.isoFix}`, text: f.isoFix };
    case "UNDEF":
      return f.suggestion === undefined
        ? null
        : { name: `Change to ${f.suggestion}`, text: f.suggestion };
    case "VECTOR":
      return f.raw === undefined ? null : { name: `Wrap in SUM(${f.raw})`, text: `SUM(${f.raw})` };
    default:
      return null;
  }
}

function actionsFor(f: LintFinding): Action[] {
  const fix = fixFor(f);
  if (fix === null) return [];
  return [
    {
      name: fix.name,
      apply: (view, from, to) => view.dispatch({ changes: { from, to, insert: fix.text } }),
    },
  ];
}
