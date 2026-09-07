# Charts — generated artifacts — feature spec

**Status:** approved (#36) · **Date:** 2026-09-07 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/36#issuecomment-5575507072>

## 1. Purpose

VisiMark derives values and proves they still agree with their formulas. A document that carries a table, the rules that compute it, and the totals anchored into its prose still cannot show that data — and any chart of it is a second artifact with a second source of truth, made elsewhere, stale the moment an input changes, and invisible to `check`.

A `chart` statement closes that gap by making a visualisation a **derived artifact of the document**, on the same footing as a computed cell:

````markdown
| Item  | Price | Qty |   Net |
|-------|------:|----:|------:|
| pen   |  2.00 |  10 | 20.00 |
| paper |  0.15 | 100 | 15.00 |

```vmark #items
Net = Price * Qty
chart cost_component as pie of Net labelled Item
```

![cost breakdown](charts/cost.svg)<!--vmark=items.cost_component-->
````

`fmt` writes `charts/cost.svg`; `check` proves the file on disk is what the document says it should be. Change a `Qty` and the chart is stale until `fmt` regenerates it.

The category this introduces is **generated verifiable artifacts**, not charts specifically. Charts are its first instance; [§9](../visimark-design.md#9-write-back) gains the category generically so a second artifact type does not reopen the ownership question.

Existing features do not reach it: no expression produces anything but a number, a date or a string, and nothing in the language writes outside the document.

## 2. Scope and the constraints

Three design-doc positions move, and each moves deliberately.

**[§1](../visimark-design.md#1-purpose) — "no presentation layer".** Clarified, not overturned. It sits among "no grid", "no cell styling" — all about not becoming a spreadsheet application. It means **VisiMark never renders or displays a document and makes no claim about how it is displayed.** Producing a derived data artifact is not that. §1 gains that sentence so the non-goal is not read as forbidding this.

**[§9](../visimark-design.md#9-write-back) — ownership.** The tool owns computed cells and anchored values; it now also owns **generated artifacts**. This is not a second `--fix-dates`: that flag is gated because it overwrites *human input* in place, whereas a generated artifact is exclusively tool-owned — nobody hand-edits it. Generation therefore needs no opt-in flag, and §9 names a third owned category rather than a second exception.

**[§13](../visimark-design.md#13-testing) — diffability.** The one-line-diff guarantee is about **documents**. An external artifact leaves the Markdown byte-stable when data changes: the image line never moves, and churn is confined to a generated file. (Inlining the SVG as a `data:` URL would satisfy §9 literally and be strictly worse here.) §13's guarantee is scoped to documents explicitly; generated artifacts are excluded.

Constraint 4 is untouched and is the reason the rest holds: no clock, no network, no ambient fonts, no config, and the engine set is closed and built-in — a document selects the name `pie` exactly as it selects the name `SUM`.

## 3. Syntax

A **statement**, like `assert` — it binds no value and is the second statement form in the language.

```
chart <name> as <engine> of <series> [, <series>]* labelled <column> [aspect <w>:<h>]
```

- `chart` is a **keyword**, tokenised by the lexer beside `assert`. It may not be a bound name or a column header — `chart = 1` is a `TYPE` error ("`chart` is a reserved word").
- `<name>` is an identifier, `[A-Za-z_][A-Za-z0-9_]*` — `cost_component`, never `cost-component`. It occupies the sheet's namespace beside columns and scalars; a collision is a `DUP` error. **No `#` sigil**: `#` begins a comment inside a block body ([§4](../visimark-design.md#4-syntax)), so `chart #cost_component` would lex as a bare `chart` followed by a comment.
- `as` is **mandatory**. It marks the name/engine boundary structurally rather than positionally, which keeps a misspelled engine diagnosable (`unknown chart type 'pei' — did you mean 'pie'?`) instead of ambiguous with a second name token.
- `<engine>` is `pie` or `bar`. Any other word is an `ARTIFACT` error with a did-you-mean.
- `of <series>` takes one or more **bare column references in the statement's own sheet** — the exact parallel of the reducer rule ([§4](../visimark-design.md#4-syntax): a reduce takes a column reference, never an expression). `of Profit / Revenue` is refused; materialise a column first. A foreign column (`other.Net`) is a `VECTOR` error, as everywhere ([§6](../visimark-design.md#6-name-resolution-and-scoping)). Same-sheet operands share a row count by construction, so no length-mismatch case exists.
- `labelled <column>` is **mandatory** and names one bare column of the same sheet.
- `aspect <w>:<h>` is optional, `<w>` and `<h>` positive integers. It sets the **shape of the viewBox**, not a display size — geometry rather than styling. The viewBox width is always `640` units and the height follows the ratio, so `aspect 16:9` is `640 × 360`. Default `16:10`, i.e. `640 × 400` — a fixed constant, never inferred from row count. `:` becomes a token; a zero, negative or non-integer component is an `ARTIFACT` error.
- A `chart` in a **document-scope block** (no `#id`) is a `SHEET` error; it references columns. A `chart` in a sheet that owns **no table** is likewise a `SHEET` error, exactly as column rules without a table are.

**Association with the document.** The artifact's location is not derived — the author states it, in an ordinary Markdown image carrying an anchor:

```markdown
![cost breakdown](charts/cost.svg)<!--vmark=items.cost_component-->
```

This mirrors the anchor model: the tool never invents an anchor; the human places the target and `fmt` fills it. The alt text and surrounding prose own the caption, which is why there is no `title` parameter — it would be a second place to drift.

Declaration and image line are **symmetric**. A declaration with no image line is an `ARTIFACT` error (the tool has nowhere to write); an anchor naming no declaration takes the existing `UNDEF` path.

Both the fenced block and the image render correctly unmodified everywhere ([§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 1): the block is inert code, the image is an ordinary image, and the anchor is an HTML comment ([§16](../visimark-design.md#16-renderer-verification)).

## 4. The artifact path — a hard gate

The author chooses the path, so it is bounded. Every rule below is a refusal, never a transformation — there is no normalisation of any component.

| Rule | Rejected |
|---|---|
| Relative only | absolute paths, drive letters (`C:\`), UNC (`\\server\share`), extended prefixes (`\\?\`) |
| Contained | the **resolved real path** must sit inside the document's own directory; traversal (`../../etc/x.svg`) is rejected after normalisation, not before |
| No symlink escape | symlinks resolved before the containment check, or refused outright |
| Extension | anything but a lowercase `.svg` |
| Hostile names | NUL and control characters; Windows reserved device names (`CON`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`) even when suffixed `.svg` |
| Subdirectories | permitted under the document's directory, and created as needed |

The backstop is **ownership**: VisiMark refuses to overwrite an existing file that does not carry its own metadata marker. A hand-drawn `diagram.svg` cannot be destroyed by a misaimed declaration. Once a path passes the gate, overwriting is unrestricted — no prompt, no flag, no check on the target's age.

Two declarations resolving to one path is an `ARTIFACT` error on both. Within one document this is static; across documents named in a single invocation it is checked too. Across *separate* runs it is still caught, because the ownership marker records the owning sheet and chart: a target whose marker names a different chart is not this chart's artifact, and the overwrite is refused by the same rule that protects a hand-drawn SVG.

## 5. Staleness — byte comparison, no checksum

`check` renders the chart into memory and **compares bytes against the file on disk**. Different, or absent, means stale.

There is deliberately no input hash. Byte comparison gives exact invalidation — no false alarm from an unrelated edit to the same table, no missed regeneration when the renderer itself changes — with no hash coverage to define, no engine output-version to maintain, and no checksum algorithm anything external could come to depend on. It also treats a hand-edited artifact as stale, which is correct for a generated file. A hash may return later purely as an optimisation, in the spirit of [§8](../visimark-design.md#8-evaluation)'s stance on incremental reparse; nothing external may depend on one existing.

Two consequences, both binding:

- **Line endings are normalised to LF before comparison**, or an `autocrlf` checkout reports every artifact stale.
- **The SVG's metadata carries nothing volatile** — no version, no timestamp, no absolute path. Under byte comparison any volatile field is a permanent staleness trigger. It carries only the ownership marker and the artifact's identity:

```xml
<metadata><visimark sheet="items" chart="cost_component"/></metadata>
```

That marker is what the §4 ownership check reads. It is informational otherwise.

## 6. Rendering

Deterministic given the resolved values, the declaration and the `visimark` version. No clock, no randomness, no network, no ambient fonts, no locally installed software.

**Canvas.** The SVG carries a `viewBox` and no absolute `width`/`height`, so it scales to whatever box the renderer gives it. The viewBox is `640` units wide; its height comes from `aspect` (default `16:10` → `640 × 400`). Display size is the renderer's business, which is why there is no pixel dimension to set.

**Text.** All text uses a monospace family, so advance width is exactly `0.6em × character count` and layout is exact arithmetic — no embedded font, no bundled metrics table. `textLength` pins geometry where a string must occupy a known box. Value labels are formatted at the column's **inferred write precision** ([§7](../visimark-design.md#7-numeric-semantics)) and **carry the column's unit decoration**: §7 strips a unit for arithmetic and re-applies it on write-back, and a label displays that column's own cells, so a `$`-decorated column yields `$20.00`. A chart whose series carry *differing* decorations is a `UNIT` error — §7's mixed-decoration rule one level up.

**Colour.** Fills step evenly through a greyscale band, first series or slice darkest:

| n | Fills |
|---|---|
| 1 | `#808080` |
| 3 | `#333333`, `#808080`, `#CCCCCC` |
| n > 1 | `n` values evenly spaced from `#333333` (20 % luminance) to `#CCCCCC` (80 %), each channel rounded half-up |

The band is restricted rather than running white-to-black because a fixed artifact cannot know its background: pure white vanishes on a light page, pure black on a dark one, and GitHub sanitizes SVG so an internal `prefers-color-scheme` block cannot be relied on. All strokes and all text are `#808080`, one ink colour that reads on either background — a deliberate trade of contrast for background-independence. Stroke width `1` viewBox unit.

Discrimination weakens past roughly five series, where adjacent steps differ by ~15 % luminance. Recorded as a known limitation, not solved; hatch patterns are the monochrome escape hatch if a document ever needs one.

**No configuration.** No colours, fonts, line widths, gradients, shadows, backgrounds, themes, slice separation, bar spacing, marker shapes or axis styling. Settled; not a parameter, not an override.

**Pie.** Slices in row order, starting at 12 o'clock, clockwise. Each slice labelled with its label-column value and its share to one decimal place. A legend is not drawn — slices are labelled directly.

**Bar.** Vertical bars, grouped for multiple series, in row order left to right. A value axis with a zero baseline; negative values extend below it. Tick values are chosen by the standard `1 / 2 / 5 × 10^k` rule, which is deterministic given the data range. Multiple series draw a **default legend** — necessary for the chart to be readable, with no configuration surface, which is why it is not a styling option.

## 7. Semantics and errors

**New finding `ARTIFACT`** ([§10](../visimark-design.md#10-error-taxonomy)): class *problem*, auto-fixable *no*. **`STALE` widens** to cover an artifact that disagrees with the document *including one that is absent* — `fmt` repairs both, so it stays auto-fixable, and §10's row is reworded to "stored value **or artifact** disagrees with its formula". Two codes split on fixability, which keeps §10's one-code-one-fixability shape.

An unbuildable artifact is an **error, not a notice**. Below error level `check` exits `0` and the artifact stays missing indefinitely while CI reports the document green. The noise concern is met instead by **one finding per artifact, never per row**, folding into [§8](../visimark-design.md#8-evaluation)'s suppression when a series is unevaluable upstream — the behaviour `assert` already has.

Reporting an impossible artifact is the **builder's obligation**: an engine returns bytes or a diagnostic, so the core holds no per-engine knowledge of what makes a given artifact type undrawable. That is what lets a future `line` engine land without touching dependency tracking, anchoring, staleness, `check` or `fmt`.

Engine isolation is **structural, not conventional**. An engine receives resolved data and nothing else — `{ series: { name, values, unit, precision }[], labels: string[], aspect }` — with no handle on the document, the AST or the evaluator. Filtering, aggregation or expression semantics inside an engine are therefore unrepresentable rather than merely discouraged, which is the boundary that keeps the calculation model in the language.

| Situation | Code | When |
|---|---|---|
| Artifact differs from the rendered bytes, or is absent | **`STALE`** | evaluation; `fmt` repairs |
| Pie over a series containing a negative value | **`ARTIFACT`** | evaluation — no defined slice geometry |
| Pie whose series sums to zero | **`ARTIFACT`** | evaluation — the angles divide by zero |
| Series contains a blank cell | **`ARTIFACT`** | evaluation — no numeric meaning; constraint 3 forbids coercing to `0` |
| Series column is empty (no rows) | **`ARTIFACT`** | evaluation — consistent with `AVG` over an empty column |
| Series is non-numeric (string or date column) | **`ARTIFACT`** | static |
| Series carry differing unit decorations | `UNIT` | static — §7's rule one level up |
| Unknown engine name | **`ARTIFACT`** | static, with did-you-mean |
| Malformed `aspect` — zero, negative or non-integer component | **`ARTIFACT`** | static |
| Declaration has no image line | **`ARTIFACT`** | static — nowhere to write |
| Path fails any §4 gate rule | **`ARTIFACT`** | static — names the rule it broke |
| Target exists and is not VisiMark-owned | **`ARTIFACT`** | evaluation — refuses to overwrite |
| Two declarations resolve to one path | **`ARTIFACT`** | static, on both |
| Operand is an expression, not a bare column | `TYPE` | static — "a chart takes a column, not an expression" |
| Operand is a foreign column | `VECTOR` | static |
| A name does not resolve | `UNDEF` | static, with did-you-mean |
| `chart` used as a bound name or column header | `TYPE` | static |
| `chart` in a document-scope block, or a table-less sheet | `SHEET` | static |
| Chart name collides with a column or scalar | `DUP` | static |
| Chart name used as a value (`x = cost_component`) | `TYPE` | static — "a chart is not a value" |
| A series is unevaluable upstream | `NOTE` | one per sheet, as `assert` |

**A single row is not degenerate** — one slice at 100 %, and it renders.

`ARTIFACT` joins the `errors` tally; a stale artifact joins the `stale` tally. `ARTIFACT` is **eight characters, filling the code field exactly** — the same case `COVERAGE` already carries in `report/format.ts`, so its continuation lines indent to the head they follow rather than to the shared `CONT` constant. Report lines otherwise follow the existing grid, the sheet-qualified chart name in the id field:

```
  STALE   items.cost_component  artifact is out of date — run `visimark fmt`
  ARTIFACT items.cost_component  pie of `Net` contains a negative value (-5.00, row 3)
```

## 8. Interaction with the rest of the language

| Area | Effect |
|---|---|
| Shape system ([§4](../visimark-design.md#4-syntax)) | A chart is a **second consumer of vectors** beside a reduce — it takes several columns and produces no value. §4 gains a sentence admitting it. No vector → vector is introduced; no boolean reaches a cell. |
| Evaluation ([§8](../visimark-design.md#8-evaluation)) | Each chart is a leaf node depending on its series and label columns. It sorts and evaluates like any node, has no dependents, and is suppressed to a per-sheet `NOTE` when a dependency is unevaluable. |
| Write-back ([§9](../visimark-design.md#9-write-back)) | The tool gains a third owned category, generated artifacts. `fmt` writes the SVG; it **never** rewrites the image line, the alt text or any prose. The offset splicer is untouched — the document is not modified at all by chart generation. |
| Anchors ([§3](../visimark-design.md#3-document-model)) | A new anchor target kind: an `image` node. The anchor is *not* rewritten — it associates the declaration with a path. Today an image target is an `ANCHOR` error; that becomes legal for chart anchors only. |
| Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)) | A chart name lives in its sheet's namespace; `sheet.chart` addresses it from an anchor. It resolves as an artifact, never as a value. |
| Lifecycle | **Generate and overwrite; never delete.** Orphans from a renamed or deleted declaration are the author's, surfacing at git staging; deliberate handling is deferred. Artifacts are expected to be **committed** — the payoff is that a reader without VisiMark still sees the chart, so a missing artifact on a clean clone is an accurate report that the repo is incomplete. |
| `check` | Renders every chart and compares bytes. Still read-only on disk; it now runs the renderer, which costs microseconds against the single-digit milliseconds §8 already accepts for a full reparse. |
| `fmt` | Writes artifacts that are stale or missing. Writes **nothing** for a chart carrying an `ARTIFACT` error, leaving whatever is on disk — the rule §9 already applies to a column with a `UNIT` error. No opt-in flag: the artifact is exclusively tool-owned and the §4 gate is the safety property. |
| `infer` | Never proposes a chart. A chartable column is not evidence of an intended chart, and `infer` only ever inserts. |
| `explain` | After a sheet's inputs, rules, order and assertions, a trailing `charts:` block lists each chart — engine, series, label column, target path and current state (`current` / `stale` / `missing`). |
| `eval --json` | Gains a top-level `"charts"` array: `{"sheet":"items","name":"cost_component","engine":"pie","series":["Net"],"labels":"Item","path":"charts/cost.svg","state":"stale"}`. |
| `eval` | Exit contract unchanged. A stale artifact is a `check`/`fmt` concern. |
| `COVERAGE` | Unchanged — a chart displays numbers, it does not verify them, so a sheet whose only content is a chart is still uncovered. |
| Dates ([§5](../visimark-design.md#5-dates)), numeric semantics ([§7](../visimark-design.md#7-numeric-semantics)) | Unchanged. A date column is a legal **label** column (rendered as ISO text) and an illegal **series**. |
| LSP / VS Code | Chart findings surface as diagnostics on the declaration line like any other. One line in `editors/vscode/CHANGELOG.md`. |

## 9. Acceptance

[§13](../visimark-design.md#13-testing)-style. Charts get their **own worked example** rather than being grafted onto the invoice pair, where they do not semantically belong.

**`docs/example-charts.md` — a new normative example**, joining `example-invoice.md` and `example-invoice-drift.md` in the acceptance suite. Two sheets, on data charts actually suit.

A `#sales` sheet — a table `Month | Revenue | Cost | Profit` over five months, `Revenue` and `Cost` human inputs, `Profit = Revenue - Cost`, scalars `total_revenue = SUM(Revenue)` and `total_profit = SUM(Profit)` anchored into the prose, and an `assert total_profit > 0`:

```
chart performance as bar of Revenue, Cost, Profit labelled Month aspect 16:9
```

An `#audience` sheet — a table `Segment | Headcount` over four demographic bands, `Headcount` a human input, `total = SUM(Headcount)` anchored into the prose:

```
chart mix as pie of Headcount labelled Segment
```

Between them these exercise multi-series grouped bars, a single-series pie, a computed column as a series, an input column as a series, a string label column, the default aspect and an explicit one. Both SVGs are committed at the paths their image lines name.

`visimark check docs/example-charts.md` must print `0 problems (0 stale, 0 errors)`, and `visimark fmt` must leave the document **and both SVGs** byte-for-byte identical. Deleting either SVG must produce a `STALE` finding naming it, and `fmt` must restore it byte-identically — which is the determinism guarantee under test, not merely the write path.

**`example-invoice.md` and `example-invoice-drift.md` are untouched.** Their transcripts are normative, and the drift document's 26-problem count stays exactly as it is.

**New fixture `packages/visimark/test/fixtures/chart-fail.md`** — a `Region | Balance` table whose third row carries `-450.00`, and a `#ledger` sheet declaring `chart balances as pie of Balance labelled Region` with its image line present. `check` must produce, transcript-exact:

```
<path>/chart-fail.md

  ARTIFACT ledger.balances    pie of `Balance` contains a negative value (-450.00, row 3)

  1 problem (0 stale, 1 error)
```

and exit `1`. `fmt` must write no file and exit `1`.

**Unit coverage:** each §7 error row; a single-row pie; a negative-value bar (legal) against a negative-value pie (error); byte-identical regeneration proving determinism; a second `fmt` leaving the artifact untouched; LF normalisation under a CRLF checkout; each §4 path-gate rule including a traversal attempt and a symlink escape; refusal to overwrite a non-VisiMark `.svg`; two declarations colliding on one path; unit decoration carried into labels; differing decorations across series (`UNIT`); `explain` and `eval --json` output shape; a chart suppressed to `NOTE` by an unevaluable series.

## 10. Non-goals

- **Other output formats.** SVG only. No PNG, PDF or `--format`.
- **Absolute pixel dimensions.** `aspect` sets the viewBox shape; display size belongs to the renderer.
- **Styling.** Covered in §6 — settled, not a parameter.
- **`title`.** The alt text and prose own the caption.
- **`numbered` labels.** Deferred: it would render labels appearing nowhere in the document. Add a visible column and use `labelled`.
- **More engines.** `line`, `area`, `scatter`, `stacked-bar` are later, and must land without touching anything outside their own file.
- **Cross-sheet series.** Same-sheet only; reversible if a real document needs it.
- **Orphan handling.** Deferred; the metadata leaves an explicit `prune` possible later.
- **A configurable artifact directory.** There is no directory convention at all — the document states the path.
- **Formulas in declarations.** The calculation model belongs to the language; a chart consumes it.
- **Verifying the picture.** `check` proves the artifact was generated from current data, not that it depicts it faithfully. Artifacts are downstream of the primary mechanics; revisit if a good way to prove renderer correctness appears.
- **pandoc → docx.** Unverified and not a blocker; recorded in the [§16](../visimark-design.md#16-renderer-verification) matrix as untested, the treatment that section already gives the accepted markdown-it failure.

## 11. Open questions

None.

<!--vmark:no-formulas-->
