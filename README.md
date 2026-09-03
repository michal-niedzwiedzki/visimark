# VisiMark

VisiMark is a spreadsheet-mechanics tool for Markdown. The name is a nod to
VisiCalc — the first spreadsheet software, originally developed for the Apple II
by VisiCorp and later ported to the IBM PC.

A VisiMark document is an ordinary Markdown file. It renders correctly on
GitHub, in VS Code preview, and through pandoc to both HTML and Word, today,
with no plugin — verified, not assumed. What VisiMark adds is that every
computed number in it carries the formula that produced it, that a machine can
prove the two still agree, and that a change to either shows up as a small,
readable diff.

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

[`docs/example-invoice.md`](docs/example-invoice.md) is a complete B2B invoice
that computes itself: line items, VAT, a payment schedule derived from the gross
total, early-payment terms, a currency conversion, and a reconciliation that
proves the instalments sum to the invoice. Its appendix explains each mechanism.

[`docs/example-invoice-drift.md`](docs/example-invoice-drift.md) is the same
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

## Diffable by construction

An `.xlsx` is a zip of XML: change one cell and code review can tell you the
file changed, and essentially nothing more. VisiMark documents review like
source, and that is a design constraint rather than a side effect of being
text.

`fmt` never re-renders the Markdown. It locates each value it owns by position
and splices the original byte buffer, so a rewrite touches the characters of
that number and nothing else — no reflowed paragraphs, no renormalised emphasis
markers, no realigned table columns, none of the four-hundred-line diff a
round-trip through a Markdown printer would produce for a one-cell change. It
also writes only what it owns: computed cells and anchored values. Input
columns, prose and headings are human territory and are never touched.

Raising one input in the worked invoice — on-call hours from 12 to 20, the
very edit the drift example above leaves unpropagated — makes `fmt` update 6
cells and 9 anchors, and the result is a **13-line diff in a 127-line
document**. Every changed line is a figure that genuinely depends on that
input, so the diff *is* the propagation: a reviewer sees the VAT, the three
milestone instalments, the early-payment terms and the EUR conversion all move
together, and can check that they moved for the right reason.

The other half is that the diff contains everything. The formula lives in the
document, so a changed rule shows up as a changed rule. Nothing outside the file
can alter a number — no plugins, no config, no clock. And because an aggregate
takes a column rather than an expression, every intermediate is materialised on
the page: a total is always the sum of numbers the reviewer can see.

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

There are no boolean literals. Comparisons produce booleans and `IF()` consumes
them, but a boolean is never written into a cell — a materialised value is a
number, a date, or a string, so the word `true` in a column stays the string it
looks like.

**There is no plugin architecture, and there will not be one.** A document's
numbers depend on its own text and the version of VisiMark reading it, and on
nothing else — no extension modules, no config file, no environment, no
network, no clock. A registry of host-supplied functions would produce
documents whose arithmetic cannot be checked from the document, which is the
one thing the format exists to prevent. When the built-in vocabulary is too
small the answer is a new primitive in the engine, readable by everyone and
runnable by everyone; when a value genuinely comes from outside, it belongs in
an input column where a human wrote it down.

This makes the format smaller, not merely stricter: there is no locale, no
configuration, and no rule for what a bare `/` means.

## Status

The CLI is implemented: `visimark check`, `fmt`, `eval` and `explain`, in
TypeScript. `npm install -g visimark` puts a `visimark` command on your PATH;
`npx visimark` runs it without installing. Both worked examples pass as the
acceptance suite — `check` on the drift invoice reproduces the transcript above
byte-for-byte, and `fmt` leaves the clean invoice untouched. The design is
written up in [`docs/visimark-design.md`](docs/visimark-design.md), including the
deferred work and the known tensions; the implementation plan is
[`docs/superpowers/plans/2026-09-03-visimark-cli.md`](docs/superpowers/plans/2026-09-03-visimark-cli.md).

The editor support is implemented too: one language server
(`packages/visimark-lsp`) wrapping the same engine, and a VS Code client
(`editors/vscode`) — live diagnostics, `fmt` behind the editor's own
format-on-save, quick fixes, inlay hints, CodeLens and hover.

To try the extension in your own VS Code:

```bash
bun run vscode-install     # build, package and install (also reinstalls)
bun run vscode-uninstall   # remove it again
```

Reload the window afterwards, then open `docs/example-invoice-drift.md`. Both
targets need the `code` CLI on your PATH. For development, press <kbd>F5</kbd>
instead — that runs the extension straight from `editors/vscode` in a separate
Extension Development Host, so uninstall the packaged copy first or you will see
every diagnostic twice.

Releases are tag-driven: pushing a `vX.Y.Z` tag publishes the engine to npm and
the extension to both the VS Code Marketplace and Open VSX. The workflow needs
three repository secrets — `NPM_TOKEN`, `VSCE_PAT` and `OVSX_PAT`.

## For agents

[`skills/visimark/SKILL.md`](skills/visimark/SKILL.md) is an agent skill for
authoring and verifying these documents. Copy it to `~/.claude/skills/visimark/`
to install it. Its central warning is one worth stating here too: `check`
reports `0 problems` on a document containing no formulas at all, so a green
check is evidence of agreement, not of derivation. Change an input and confirm
the checker starts complaining before believing a document is wired up.

Editor support is specified in
[`docs/visimark-editor-plugins-design.md`](docs/visimark-editor-plugins-design.md):
one language server — continuous `check` as diagnostics, `fmt` behind
the editor's own format-on-save, quick fixes, and inlay hints that show the
computed value without touching the bytes — with VS Code as the first client.

```
git clone … && cd visimark && bun install
bun test                    # the full suite, the two examples included
bunx visimark check docs/example-invoice-drift.md
```

`bun install` builds the engine and links the `visimark` command into
`node_modules/.bin`, so `bunx visimark` works in a fresh clone. To run the CLI
straight from source without a build, use `bun packages/visimark/src/cli/main.ts
check FILE`.

The project began as a CSV-based idea and moved to Markdown so that several
small sheets can live inside one master document, and so that the file renders
as a document rather than as data.

## Out of scope

No grid, no presentation layer, no cell styling, no locale, no Excel file
compatibility, and no attempt at Excel's function library. Use other tools for
neat presentation.
