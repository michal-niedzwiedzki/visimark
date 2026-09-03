---
name: visimark
description: Use when authoring, editing, or verifying a Markdown document containing arithmetic — a quote, invoice, budget, estimate, payment schedule, or engineering calculation — or when working in a repository that contains `vmark` blocks or a `visimark` dependency.
---

# VisiMark

## Overview

VisiMark makes a number in a Markdown document carry the formula that produced
it, so a machine can prove the two still agree. You are unreliable at
arithmetic and reliable at writing formulas. Write the formula; let the tool do
the arithmetic.

**Core principle: never write a number you calculated yourself.** If a number
follows from other numbers, it belongs in a `vmark` block as a rule, and the
tool writes the value.

## The trap: a green check proves nothing on its own

`visimark check` verifies that the formulas in a document agree with the
numbers. A document with **no formulas** has nothing to disagree with:

```
$ visimark check quote-with-no-formulas.md
quote-with-no-formulas.md

  0 problems (0 stale, 0 errors)
$ echo $?
0
```

That is the exact output a fully-derived document gives. If you hand-compute
the totals, write them as plain text, run `check`, and report "the checker
passes," you have reported a green build on a document with no build.

**Before reporting a VisiMark document as done, prove the numbers are derived.**
Change one input and confirm the checker starts complaining:

```bash
sed -i 's/| 40 |/| 48 |/' quote.md      # bump one input
visimark check quote.md                  # MUST now report problems, exit 1
git checkout quote.md                    # or undo the edit
```

If `check` still says `0 problems` after you changed an input, nothing in that
document is wired up. Fix it before you report anything.

## Running it

```bash
visimark check FILE...                # read-only; exit 1 if anything disagrees
visimark fmt   FILE... [--fix-dates]  # rewrite computed cells and anchors
visimark eval  FILE [--get NAME] [--json]
visimark explain FILE [#sheet]        # rules and evaluation order
```

From a clone: `bun src/cli/main.ts check FILE`, or `node bin/visimark.js check FILE`
once `bun run build` has been run. `npx visimark` for a published install.

## Authoring: the shape

Four parts, in this order. The block must come **immediately after** its table.

````markdown
| Item           | Unit | Qty |    Rate |     Net |     VAT |
|----------------|------|----:|--------:|--------:|--------:|
| Consulting     | day  |   3 | 1600.00 | 4800.00 | 1104.00 |
| Implementation | hour |  40 |  210.00 | 8400.00 | 1932.00 |

```vmark #lines
Net = Qty * Rate
VAT = Net * vat
net_total   = SUM(Net)
gross_total = SUM(Net) + SUM(VAT)
```

Net of tax this comes to **13200.00**<!--vmark=lines.net_total--> PLN,
or **16236.00**<!--vmark=lines.gross_total--> PLN gross.
````

- **Columns are uniform rules**, one per column, applied to every row. A column
  with no rule is a human-owned input and is never overwritten.
- **Totals are scalars**, declared in the same block. Never add a totals row —
  tables stay rectangular.
- **Anchors** put a scalar into a sentence. The HTML comment is invisible in
  GitHub, VS Code preview and pandoc.

Write the table cells as `0.00` placeholders and run `visimark fmt` to fill
them in. Do not compute them yourself.

## Rules that bite

| Rule | Consequence if ignored |
|------|------------------------|
| An anchor names `sheet.scalar` — always qualified | A document-scope constant **cannot** be anchored. Put anything you want in prose inside a named sheet. |
| A block owns the table immediately above it, ignoring blank lines | A paragraph between table and block detaches the rules: `SHEET` error. |
| Cross-sheet column references must be qualified **and** aggregated | `SUM(schedule.Amount)` is legal; bare `schedule.Amount` is a `VECTOR` error. |
| Dates are ISO 8601 only, `YYYY-MM-DD` | `15.10.2026` is refused with an offered fix; `11/12/2026` is refused outright. |
| No thousands separators | `1,800.00` is a lex error. Write `1800.00`. |
| A currency or unit in a cell must be uniform down the column | `$5.50` and `€4.00` in one column is a `UNIT` error, not a sum. |
| Currency in prose goes **outside** the anchor | `**13200.00**<!--vmark=lines.net_total--> PLN` — not inside the bold. |
| A name bound twice in one scope is a `DUP` error | The first binding wins and the second is reported. |
| An unreferenced scalar is a `WARN` | Usually means you typo'd a column name and silently created a scalar. |

## Editing an existing document

**Never hand-edit a computed cell or an anchored value.** Change the input or
the formula, then run `visimark fmt`. Hand-editing an output is the precise
failure the tool exists to catch, and `fmt` will overwrite you anyway.

`fmt` repairs stale values and nothing else. Every other finding is a question
only a person can answer — do not paper over a `DATE`, `UNIT`, `CYCLE`,
`UNDEF` or `DUP` finding by editing the number it points at.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "The arithmetic is trivial, I'll just write 4800" | You are unreliable at arithmetic and the value stops being reviewable. Write the rule. |
| "`check` passed, so the document is correct" | `check` passes on a document with no formulas. Prove derivation by changing an input. |
| "I'll add the formulas after the prose reads well" | You will forget, and the checker will not tell you. Table, block, anchors, then prose. |
| "A totals row is more readable" | It breaks the rectangle. Totals are scalars reached through anchors. |
| "I'll just fix that one cell by hand" | That cell is an output. Change the input or the rule and run `fmt`. |
| "The date format is obvious from context" | `11/12/2026` is two different dates. VisiMark refuses on purpose. |

## Red flags — stop

- You typed a number that another number implies.
- You reported "0 problems" without changing an input to see it break.
- You edited a value inside a `<!--vmark=…-->` anchor or a computed column.
- You added a `Total` row to a table.
- You wrote a date that is not exactly ten characters of `YYYY-MM-DD`.
- You silenced a finding by changing the number it complained about.

## Reference

`docs/visimark-design.md` in the repository is the normative spec.
`docs/example-invoice.md` is a complete worked example — a self-computing B2B
invoice with VAT, a payment schedule, early-payment terms, a currency
conversion and a reconciliation. `docs/example-invoice-drift.md` is the same
invoice after someone changed one input and updated nothing derived from it;
`check` finds 26 problems in it. Read the clean one before authoring.
