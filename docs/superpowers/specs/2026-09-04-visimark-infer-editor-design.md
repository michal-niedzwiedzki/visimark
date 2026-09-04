# Design — applying inferred rules in the editor

**Status:** approved, not implemented.
**Depends on:** [`2026-09-04-visimark-infer-design.md`](2026-09-04-visimark-infer-design.md)
— the engine work that produces `Proposal[]`. Nothing here can start first.

## 1. Purpose and scope

`visimark infer` proposes rules for a document that has none. In a terminal the
user reviews that proposal by reading it and re-running with `--write`. In an
editor they can do better: see the proposals in place, accept them one at a
time or all at once, and see exactly which bytes change before any of them do.

This spec covers the language server and VS Code client work for that. It adds
no engine behaviour and no format surface; every edit it applies comes from
`planInfer`.

Three surfaces, in increasing weight:

1. **A CodeLens** above a table that has arithmetic and no rules, saying what
   was found.
2. **A code action per proposal**, so accepting one rule is one keystroke.
3. **Apply-all with per-edit confirmation**, which is the review pane.

And one supporting feature that the engine spec's naming decision depends on:
**rename**.

## 2. What does not happen

**Inference never publishes diagnostics.** No squiggles, not even for a
near-miss, and not at `Information` severity.

The reasoning is the one that removed `check --suggest` from the engine spec,
carried into the editor. A diagnostic is the tool asserting something is wrong.
`check`'s assertions are deductive and cannot be false; an inferred rule is
abductive, and the document it is asserting about has not opted into anything.
Every Markdown file in a workspace containing a table of numbers would light up
with claims about arithmetic its author never asked to have checked.

Near-misses are still surfaced — in the lens, in the report, and in the preview
pane — but always somewhere the user went looking.

**`source.fixAll.visimark` does not grow.** Format-on-save repairs stale values
and does nothing else. A save must never insert a rule the user has not seen.

## 3. CodeLens on unmanaged tables

`codeLensesFor` currently walks `model.blockOfSheet`, so it only ever sees
tables that already have a sheet. It gains a second pass over tables with no
block:

```
VisiMark: 3 rules, 3 totals found — preview        (table with no vmark block)
VisiMark: 3 rules found, 1 near-miss — preview
VisiMark: 1 near-miss — preview
```

The command is `visimark.inferPreview`, arguments `[uri, tableSpan]`.

**The gate before running inference at all**, so that opening an arbitrary
Markdown file costs nothing: the document must contain at least one table with
no owning block, at least three rows, and at least two numeric columns. Below
that threshold inference cannot propose anything (engine spec §7), so it is not
run and no lens is produced.

Inference shares the existing check debounce. It is computed in the same
`Analysis` pass and cached on it, so a lens, a code action and a preview in
quick succession run the search once.

## 4. A code action per proposal

Each `Proposal` becomes its own action:

```
VisiMark: add rule  Net = Qty * Rate
VisiMark: add total  net_total = SUM(Net)  and anchor line 31
```

Kind is **`refactor.rewrite`**, not `quickfix`. Quick fixes in this server are
bound to diagnostics and participate in fix-all; these have no diagnostic and
must never be swept up by a save. The refactor kind puts them in the lightbulb's
refactor group, where a user goes deliberately.

The edit is `planInfer(source, [thatProposal])`. Because `planInfer` takes the
subset, accepting one rule does not require computing or discarding the others,
and there is exactly one code path shared with apply-all.

Actions are offered at the table's range and at the range of the block that
would be created. A proposal marked `ambiguous` or `near-miss` produces **no
action** — there is nothing to apply — but both still appear in the report.

An accepted proposal that mints a sheet id says so in its title:

```
VisiMark: add rule  Amount = Share * lines.gross_total  (names this table #unnamed2)
```

## 5. Apply all, with per-edit confirmation

This is the review surface, and LSP has a native mechanism for it that is
better than anything built out of temporary files: **change annotations**.

`visimark.inferPreview` sends a `workspace/applyEdit` whose `WorkspaceEdit`
carries `changeAnnotations`, with every `AnnotatedTextEdit` referencing one:

```ts
{
  changeAnnotations: {
    "rule:lines.Net": {
      label: "Net = Qty * Rate",
      description: "4/4 rows",
      needsConfirmation: true,
    },
    "anchor:lines.net_total": {
      label: "anchor net_total at line 31",
      description: "23300.00 = SUM(Net)",
      needsConfirmation: true,
    },
  },
  documentChanges: [ /* AnnotatedTextEdit[] carrying annotationId */ ],
}
```

VS Code renders that as its refactor-preview tree: one checkbox per annotation,
grouped, with the label and description visible, and a live diff of the file as
the user toggles them. Accept some, reject others, apply. That is precisely the
accept-or-reject-each-finding review, drawn by the editor, with no copy of the
file on disk and nothing to clean up.

`needsConfirmation: true` on every annotation is what forces the preview rather
than a silent apply. One annotation per proposal, so the checkboxes match the
units the user is actually deciding about — a rule and its anchor are separate
decisions and get separate boxes.

**Capability gate.** This requires
`workspace.workspaceEdit.changeAnnotationSupport` on the client. When it is
absent the server falls back to applying the edit without annotations and the
client shows the report first (§7), so a non-VS Code client degrades to
read-then-apply rather than silently losing the confirmation step.

## 6. Rename

The engine spec names scalars mechanically (`net_total`) and mints sheet ids as
placeholders (`#unnamed1`) on the explicit grounds that renaming is one
keystroke. This is that keystroke, and it is not optional: without it those two
decisions are worse than the alternatives they beat.

`textDocument/rename` and `textDocument/prepareRename` over two targets:

**A sheet id.** Rewrites the fence info string, every qualified reference
`sheetId.name` in every block, and every anchor comment `<!--vmark=sheetId.…-->`
in prose. `#unnamed1` becoming `#lines` is one edit set across the whole
document.

**A scalar.** Rewrites its binding and every anchor bound to it, plus any
qualified reference from another sheet.

`prepareRename` returns a range only on those two, so pressing rename anywhere
else in a Markdown file does nothing rather than something surprising.

The safety argument is the engine's, unchanged: references resolve by name, so
anything a rename fails to reach fails loudly at check time rather than
silently evaluating to a different number.

**Column rename is deferred.** It has to rewrite the table's header cell as
well as every reference, and a header cell is human-owned text with alignment
and padding to preserve. It is worth having and it is a separate piece of work.

## 7. The inference report

`visimark.showInferenceReport` opens the `infer` report — the exact text from
engine spec §10 — in a read-only virtual document, reusing the
`virtualDocs.ts` provider that already backs `visimark.explainSheet`.

This is where near-misses, ambiguous candidates, unanchorable figures and
skipped items are read in full. The lens counts them; the report explains them.

## 8. Configuration

Two keys, merged one level deep the way the existing `Settings` are:

```ts
infer: {
  enable: boolean;    // default true — all inference surfaces
  codeLens: boolean;  // default true — the unmanaged-table lens only
}
```

`infer.codeLens: false` with `infer.enable: true` is the useful combination for
someone who wants the commands but no passive nudging in files they are only
reading. `enable: false` removes the lens, the code actions and the commands,
and leaves rename alone — rename is not inference.

## 9. Protocol and client

Server: `codeLens.ts` gains the unmanaged-table pass; `codeActions.ts` gains the
`refactor.rewrite` provider; a new `rename.ts`; `analysis.ts` caches
`Proposal[]` alongside the `CheckResult`. The server declares
`renameProvider: { prepareProvider: true }` and adds `refactor.rewrite` to its
`codeActionKinds`.

Client: two commands in `package.json` — `VisiMark: Preview Inferred Rules` and
`VisiMark: Show Inference Report` — both also reachable from the palette with an
active Markdown editor, matching how the existing commands were fixed to work
from the palette. The status bar item gains nothing; inference is not a state
the document is in.

## 10. Testing

Server tests, in the existing `packages/visimark-lsp/test/` harness:

- a lens appears on a stripped `example-invoice.md` and reports the right counts
- no lens, and no inference run, on a document whose tables are all managed
- no lens on a two-row table (below the evidence floor)
- one code action per proposable rule; none for `ambiguous` or `near-miss`
- the apply-all edit carries one annotation per proposal, every one with
  `needsConfirmation: true`
- the annotation-unsupported fallback path produces a valid unannotated edit
- rename on `#unnamed1` rewrites fence, references and anchors together
- rename on a scalar rewrites its binding and its anchors
- `prepareRename` returns null in prose, in a table cell, and on a column name

Client tests, in `editors/vscode/test/`: both commands appear in the palette
with a Markdown editor active, and `visimark.inferPreview` on the stripped
example produces a document that `check` then reports clean.

## 11. Rejected alternatives

**Write a copy of the file, run `infer --write` on it, open a diff.** The
interaction is right and the plumbing is wrong. The server holds the document in
memory and it is frequently dirty, so a saved copy infers from stale bytes; the
temp file needs a lifecycle, a location and cleanup; the diff editor gives
whole-hunk accept rather than per-proposal accept; and the platform already has
a mechanism that does all of it properly. Change annotations are that mechanism.

**Near-misses as `Information` diagnostics.** Rejected for the reason in §2.
The lower stakes of a squiggle compared to a failing build do not change the
fact that it is a fallible assertion about a document nobody opted in.

**Folding inference into `source.fixAll.visimark`.** A save would insert rules
the user never saw. `fixAll` repairs values the document already claims; it must
not add claims.

**A single code action that applies everything, with no preview.** It is the
one-keystroke path people would actually press, and it writes a `vmark` block, a
sheet id and several prose anchors in one invisible step. Apply-all exists, and
it goes through the confirmation pane.

## 12. Deferred

**Column rename** — §6.

**Inference across a workspace.** A command that reports every unmanaged table
in every Markdown file, for the legacy-documents case. It wants a progress
API, cancellation and result aggregation, and none of that is needed to make
inference useful in the file that is open.

**Applying a proposal from the report.** The report is read-only text today.
Making its lines actionable means either a webview or document links into the
source, and the code actions already cover the same ground from the table.
