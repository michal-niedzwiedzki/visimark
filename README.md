# VisiMark

VisiMark is a spreadsheet-mechanics tool for Markdown. The name is a nod to
VisiCalc — the first spreadsheet software, originally developed for the Apple II
by VisiCorp and later ported to the IBM PC.

A VisiMark document is an ordinary Markdown file. It renders correctly on
GitHub, in VS Code preview, and through pandoc to both HTML and Word, today,
with no plugin — verified, not assumed. What VisiMark adds is that every
computed number in it carries the formula that produced it, and that a machine
can prove the two still agree.

## Why

The working stack for collaborating with an AI agent is a text editor over
lightly formatted artifacts. Markdown covers prose. Nothing covers calculation.

Agents are unreliable at arithmetic and reliable at writing formulas. If an
agent emits `Net = Price * Qty` instead of `50.00`, the number stops being a
claim and becomes a derivation: reviewable in a diff, re-runnable, and
enforceable in CI. That is the point of the project. The arithmetic is not the
value; the audit trail is.

## What it looks like

````markdown
| Item  | Price | Qty |   Net |
|-------|------:|----:|------:|
| pen   |  5.00 |  10 | 50.00 |
| paper |  0.10 | 100 | 10.00 |

```vmark #order
Net   = Price * Qty
total = SUM(Net)
```

Order total: **60.00**<!--vmark=order.total-->
````

Four ideas, and that is the whole format:

- A **`vmark` block** declares formulas for the table above it, and names the sheet.
- **Columns are uniform** — `Net = Price * Qty` is one rule for every row, not a
  formula per cell. Columns with no rule are inputs, and are never overwritten.
- **Aggregates are scalars**, declared alongside. This is what replaces the
  totals row; tables stay rectangular.
- An **anchor** materialises a scalar into a sentence. The HTML comment is
  invisible in every target renderer, so the prose reads normally while the
  number stays machine-checkable.

## Worked examples

[`doc/example-invoice.md`](doc/example-invoice.md) is a complete B2B invoice
that computes itself: line items, VAT, a payment schedule derived from the gross
total, early-payment terms, a currency conversion, and a reconciliation that
proves the instalments sum to the invoice. Its appendix explains each mechanism.

[`doc/example-invoice-drift.md`](doc/example-invoice-drift.md) is the same
invoice after someone raised the on-call hours from 12 to 20 and updated nothing
derived from it. It renders as a clean, plausible invoice — which is the entire
argument. `visimark check` finds 26 problems in it, including a payment date
that is ambiguous by twenty-nine days and a cell somebody nudged by hand to make
the column look right.

## How it works

VisiMark parses the document, builds a dependency graph across every sheet,
sorts it topologically, and evaluates in decimal arithmetic. Circular
dependencies are reported with the full path through the cycle.

`visimark check` is read-only and exits non-zero on any disagreement, so a
wrong number fails CI instead of reaching the customer. `visimark fmt` repairs
stale values, and only stale values — every other class of problem is a
question a human has to answer.

The CLI is the product. An agent must be able to verify a document without an
editor; a VS Code extension is a later, thin wrapper.

## What it refuses to do

Where a value could mean two things, VisiMark errors rather than guesses.

Dates are ISO 8601 only — `YYYY-MM-DD`, ten characters. `15.10.2026` is
rejected with an offered fix, because 15 cannot be a month. `11/12/2026` is
rejected outright, because it is 11 December or 12 November depending on where
its author lives, and no amount of care catches that by reading. Thousands
separators are rejected for the same reason.

A column may carry a currency symbol or a physical unit — `$5.50`, `12 N` —
and VisiMark strips it to compute and puts it back when it writes. What it will
not do is let one column mean two things: a column holding both `$5.00` and
`€5.00` is an error, not a sum. The decoration is inert, never converted and
never propagated through a formula.

A name bound twice in one scope is an error rather than a silent overwrite.

This makes the format smaller, not merely stricter: there is no locale, no
configuration, and no rule for what a bare `/` means.

## Status

The CLI is implemented: `visimark check`, `fmt`, `eval` and `explain`, in
TypeScript, run with `npx visimark`. Both worked examples pass as the acceptance
suite — `check` on the drift invoice reproduces the transcript above
byte-for-byte, and `fmt` leaves the clean invoice untouched. The design is
written up in [`doc/visimark-design.md`](doc/visimark-design.md), including the
deferred work and the known tensions; the implementation plan is
[`docs/superpowers/plans/2026-09-03-visimark-cli.md`](docs/superpowers/plans/2026-09-03-visimark-cli.md).

## For agents

[`skills/visimark/SKILL.md`](skills/visimark/SKILL.md) is an agent skill for
authoring and verifying these documents. Copy it to `~/.claude/skills/visimark/`
to install it. Its central warning is one worth stating here too: `check`
reports `0 problems` on a document containing no formulas at all, so a green
check is evidence of agreement, not of derivation. Change an input and confirm
the checker starts complaining before believing a document is wired up.

Editor support is designed but not built:
[`doc/visimark-editor-plugins-design.md`](doc/visimark-editor-plugins-design.md)
specifies one language server — continuous `check` as diagnostics, `fmt` behind
the editor's own format-on-save, quick fixes, and inlay hints that show the
computed value without touching the bytes — with VS Code as the first client.

```
git clone … && cd visimark && bun install
bun test                    # 88 tests, the two examples included
bun run build               # bundle to dist/ for npx
bun src/cli/main.ts check doc/example-invoice-drift.md
```

The project began as a CSV-based idea and moved to Markdown so that several
small sheets can live inside one master document, and so that the file renders
as a document rather than as data.

## Out of scope

No grid, no presentation layer, no cell styling, no locale, no Excel file
compatibility, and no attempt at Excel's function library. Use other tools for
neat presentation.
