# Design — line numbers in `visimark check`

**Status:** approved, not implemented.
**Handoff:** `docs/superpowers/plans/HANDOFF-check-line-numbers.md`

## What changes

`check` grows a left gutter carrying the 1-based source line of each finding.

Before:

```
doc/example-invoice-drift.md

  STALE   lines.Net       · On-call support         3120.00 ≠ 5200.00    Qty * Rate
  STALE   8 prose anchors bound to the values above

  DATE    schedule.Due    · Delivery of backend   "15.10.2026"
          Dates must be ISO 8601 calendar dates: YYYY-MM-DD.

  26 problems (21 stale, 5 errors)
```

After:

```
doc/example-invoice-drift.md

  22  STALE   lines.Net       · On-call support         3120.00 ≠ 5200.00    Qty * Rate
      STALE   8 prose anchors bound to the values above

  43  DATE    schedule.Due    · Delivery of backend   "15.10.2026"
              Dates must be ISO 8601 calendar dates: YYYY-MM-DD.

      26 problems (21 stale, 5 errors)
```

Nothing else about the report moves. `eval`, `explain` and `fmt`'s own summary
lines are untouched.

## Where the numbers come from

Every finding already carries a `span` — the engine amendments that unblocked
the language server put one on all of them. Nothing new has to be threaded
through the pipeline.

The spans are also at the right granularity. A per-row `STALE` gets
`{start, end}` of **the offending table cell** (`eval/check.ts`, in
`evalColumn`), not of the `Net = Qty * Rate` rule that produced it, so ten stale
rows report ten distinct lines rather than ten copies of the rule's line. A
scalar `STALE` gets `anchorValueSpanOf(...)` — the anchor in the prose — falling
back to the binding line only when there is no anchor.

Two findings have no single site and get a blank gutter:

- the collapsed `N prose anchors bound to the values above` `STALE`
- `NOTE` (`N rows not verified`)

Both are aggregates over other findings that do carry lines. A blank gutter is
the honest rendering; inventing a representative line for them would be worse
than leaving it empty.

## Rendering rules

Let `L(f)` be the 1-based line containing `f.span.start`, undefined when the
finding has no span.

1. `W` = digit count of the largest `L(f)` in this report; `0` if no finding has
   a line.
2. `G` = `2 + W`, the full gutter width. `G` is `0` when `W` is `0`.
3. Each rendered finding line is prefixed:
   - the **first** line of a finding that has `L`: `"  " + String(L).padStart(W)`
   - every other finding line, including continuation lines: `" ".repeat(G)`
4. Blank separator lines stay empty. No gutter, no trailing whitespace.
5. The path header stays flush left.
6. The footer is prefixed with `" ".repeat(G)`.
7. `W` is computed per file. A multi-file run may use different widths for
   different files.

Rule 6 is the one that needs defending. Leaving the footer flush left is more
obvious, but `  26 problems (21 stale, 5 errors)` would then put `26` in exactly
the columns where line numbers live, and it reads as line 26 of the document.
Indenting the footer keeps the number column holding nothing but line numbers.

Rule 1 also means the existing unit tests in `test/report/format.test.ts`, which
build synthetic findings with no spans, keep producing byte-identical output:
`W` is `0`, so no gutter is rendered at all.

## Why a gutter and not `file:line:`

`file:line:` on every finding is clickable everywhere and trivially parseable,
and it was the runner-up. It loses because it repeats the path on every line and
destroys the column layout, and because the audience that most wants to *jump*
to a finding is already served — the VS Code extension publishes real
diagnostics with real ranges. The CLI's readers are humans scanning a table and
agents parsing a stable format. Both are better served by a narrow gutter.

## Why no flag

Rejected: `--line-numbers`, and `--no-line-numbers`.

`report/format.ts` is a fixed-width layout built on column constants
(`CONTENT_COL`, `ID_FIELD`, `STORED_END`, `DATE_VALUE_COL`, `CONT`). A gutter is
not a decoration that toggles — it shifts every one of them. Supporting both
shapes means two sets of constants, two continuation indents, and every format
test doubled, permanently, to preserve an output nobody asked to keep.

The one thing a flag would buy is stability for the transcript in
`doc/example-invoice-drift.md`. That is a one-document maintenance cost, and the
next section says what to do about it.

## What this breaks

**The transcript inside `doc/example-invoice-drift.md` must be regenerated.**
The fenced `console` block at line 100 of that file is the check output *of that
same file*, and the findings it reports sit at lines 19–83 — above the block.
Two tests pin it byte-for-byte (`test/acceptance.test.ts`,
`test/report/format.test.ts`).

This is the cost the design accepts: from here on, editing the prose above the
transcript renumbers the findings the transcript quotes, and the acceptance
suite fails until the block is regenerated. Previously a prose edit could not
touch it.

The standing rule is "if the transcript test fails, the change is wrong — do not
edit the example documents." That rule is correct and stays in force. **This
change is the single sanctioned exception**, and the handoff note says so
explicitly.

`docs/superpowers/plans/2026-09-03-visimark-cli.md` also quotes the old
transcript. It is a record of completed work, not living spec — leave it alone.

`README.md` quotes no transcript. `skills/visimark/SKILL.md` shows only
`  0 problems (0 stale, 0 errors)`, which is unaffected: a clean document has no
findings, so `W` is `0` and the footer keeps its current indent.

## API change

```ts
formatCheck(path: string, findings: Finding[], source: string): string
```

`source` is new and **required**. It is a breaking change to an exported symbol
(`src/index.ts`) at 0.1.0, taken deliberately rather than making the parameter
optional: an optional `source` would reintroduce exactly the two-output-shapes
problem that the no-flag decision rejects. Every existing caller already has the
source in hand.

| Caller | Passes |
|---|---|
| `cli/commands.ts` — `cmdCheck` | `source` |
| `cli/commands.ts` — `cmdFmt` (unfixable findings) | `source`, the **pre-fmt** text |
| `editors/vscode/src/extension.ts` — Show Report | `doc.getText()` |
| `test/acceptance.test.ts`, `test/report/format.test.ts`, `test/eval/functions.test.ts` | the fixture source |

### The `cmdFmt` subtlety

`fmt` computes its `unfixable` findings from `check()` on the **original**
source, then writes a rewritten `output`. Their spans are offsets into the
original. `cmdFmt` must therefore resolve line numbers against the original
source, not the file it just wrote.

The numbers stay correct for the written file because `fmt` only splices
replacement text inside existing lines — it never adds or removes a newline, so
line numbers are preserved even where columns shift. That invariant is currently
implicit. Make it explicit with a test asserting `fmt(src).output` has the same
line count as `src`, for both worked examples.

## New module

`src/report/lines.ts`, internal to the report layer and not exported from
`src/index.ts`:

```ts
export function lineStarts(source: string): number[];
export function lineAt(starts: number[], offset: number): number; // 1-based
```

Built once per `formatCheck` call, binary search per finding. The language
server does not use it — it has `TextDocument.positionAt`.

Offsets are UTF-16 code units, consistent with the rest of the engine. Counting
`\n` in the same string agrees with `slice`, and a `\r\n` document is handled
correctly because the `\n` is what terminates the line.

## Testing

New, written first:

- `lineAt`: offset 0 → 1; the offset of a `\n` and the offset just after it;
  an offset on the last line; a source with no trailing newline; empty source.
- gutter width derives from the largest line number in the report
- a finding with no span renders a blank gutter, aligned under the code column
- continuation lines are indented by the gutter
- the footer is indented by the gutter
- blank separator lines carry no trailing whitespace
- a report where no finding has a span renders no gutter at all
- `fmt` preserves line count on both worked examples

Existing, must stay green:

- the byte-for-byte transcript tests, against the **regenerated** block
- `check doc/example-invoice.md` → zero findings, exit 0
- `fmt` on the clean invoice → byte-for-byte identical

## Out of scope

Column numbers. A machine-readable `--json` output for `check`. Line numbers in
`eval` or `explain`. Any change to how the language server reports positions.
