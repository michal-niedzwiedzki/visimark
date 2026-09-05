# VisiMark

VisiMark is a spreadsheet-mechanics tool for Markdown. The name is a nod to
VisiCalc — the first spreadsheet software, originally developed for the Apple II
by VisiCorp and later ported to the IBM PC.

Agents are unreliable at arithmetic and reliable at writing formulas. VisiMark
is what that fact implies for Markdown: write `Net = Price * Qty` instead of
`50.00`, and a machine can prove the two still agree.

A VisiMark document is an ordinary Markdown file. It renders correctly on
GitHub, in VS Code preview, and through pandoc to both HTML and Word, today,
with no plugin — verified, not assumed. What VisiMark adds is that every
computed number in it carries the formula that produced it, that a machine can
prove the two still agree, and that a change to either shows up as a small,
readable diff.

## A wrong invoice that renders clean

[`docs/example-invoice-drift.md`](docs/example-invoice-drift.md) is a real B2B
invoice after someone raised the on-call hours from 12 to 20 and updated
nothing that depends on it. It renders as a clean, plausible invoice on
GitHub, in a Markdown preview, anywhere — which is the entire argument for
this project. Every number in it carries the formula that produced it; the
syntax follows further down. Here is `visimark check` reading the same file a
reviewer just skimmed and approved:

```console
$ visimark check docs/example-invoice-drift.md
docs/example-invoice-drift.md

  STALE   lines.Net       · On-call support         3120.00 ≠ 5200.00    Qty * Rate
  STALE   lines.VAT       · On-call support          717.60 ≠ 1196.00    Net * vat
  STALE   lines.Gross     · On-call support         3837.60 ≠ 6396.00    Net + VAT
  STALE   lines.Gross     · Discovery workshop      4428.50 ≠ 4428.00    Net + VAT
  STALE   lines.net_total                          23300.00 ≠ 25380.00   SUM(Net)
  STALE   lines.vat_total                           5359.00 ≠ 5837.40    SUM(VAT)
  STALE   lines.gross_total                        28659.00 ≠ 31217.40   SUM(Gross)
  STALE   schedule.Amount · Signature               8597.70 ≠ 9365.22    Share * lines.gross_total
  STALE   schedule.Amount · Delivery of backend    11463.60 ≠ 12486.96   Share * lines.gross_total
  STALE   schedule.Amount · Acceptance              8597.70 ≠ 9365.22    Share * lines.gross_total
  STALE   schedule.covered                         28659.00 ≠ 31217.40   SUM(Amount)
  STALE   terms.early_pay_total                    28085.82 ≠ 30593.05
  STALE   terms.early_pay_saved                      573.18 ≠ 624.35
  STALE   8 prose anchors bound to the values above

  DATE    schedule.Due    · Delivery of backend   "15.10.2026"
          Dates must be ISO 8601 calendar dates: YYYY-MM-DD.
          Unambiguous — `visimark fmt --fix-dates` rewrites it to 2026-10-15.

  DATE    schedule.Due    · Acceptance            "11/12/2026"
          Dates must be ISO 8601 calendar dates: YYYY-MM-DD.
          Ambiguous: 2026-12-11 or 2026-11-12, 29 days apart. Fix by hand.

  NOTE    schedule.Days   · 2 rows not verified (upstream DATE errors)

  UNDEF   terms.eur_total   unknown name `fx_rate`
          did you mean `fx_eur`?

  VECTOR  recon.variance    `schedule.Amount` is a column, not a value.
          Wrap it in an aggregate: SUM(schedule.Amount)

  CYCLE   late_fees.base → late_fees.fee → late_fees.total → late_fees.base

  26 problems (21 stale, 5 errors)
$ echo $?
1
```

Twenty-six problems: a payment date ambiguous by twenty-nine days, a cell
someone nudged by hand to make a column look right, a circular reference — all
invisible on the rendered page, all caught before a human had to notice.

## Why

The working stack for collaborating with an AI agent is a text editor over
lightly formatted artifacts. Markdown covers prose. Nothing covers calculation.

When an agent emits a formula instead of a number, the number stops being a
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

[`docs/example-invoice-drift.md`](docs/example-invoice-drift.md) is that same
invoice with the drift shown at the top of this README — the `26 problems`
transcript above is `check` reading this exact file, and its appendix walks
through every one of the 26 findings.

[`docs/example-quote-plain.md`](docs/example-quote-plain.md) is the other
direction: a quote with no VisiMark in it at all — no `vmark` block, no
anchor, just a table and a total written in prose, the way an agent hands one
over before anyone has wired it up. `visimark infer` reads it and proposes the
rules that reproduce every number already there:

```console
$ visimark infer docs/example-quote-plain.md
docs/example-quote-plain.md  table at line 10 — 4 rows, 7 columns

  column rules
    Revenue    = Seats * Fee                  4/4 rows
    Materials  = Revenue * 0.08               4/4 rows
    Delivered  = Revenue + Materials          4/4 rows

  constants worth naming
    0.08   also appears as "8%" in prose, line 18

  scalars matching figures in prose
    72        line 17  = SUM(Seats)                seats_total
    27600.00  line 18  = SUM(Revenue)              revenue_total
    2208.00   line 19  = SUM(Materials)            materials_total
    29808.00  line 19  = SUM(Delivered)            delivered_total
    530.00    line 20  = AVG(Fee)                  fee_avg

  no rule found — treating as inputs
    Module, Format, Seats, Fee

  also fits, not proposed
    Delivered = Revenue * 1.08    prefers a rule over materialised columns
    Delivered = Materials * 13.5  prefers a rule over materialised columns

docs/example-quote-plain.md  table at line 24 — 3 rows, 4 columns

  column rules
    Amount  = Share * unnamed1.delivered_total  3/3 rows

  scalars matching figures in prose
    29808.00  line 30  = SUM(Amount)               amount_total

  no rule found — treating as inputs
    Stage, Share, Due

  also fits, not proposed
    Amount = Share * 29808    prefers a rule over materialised columns

4 rules, 6 scalars, 6 anchors.
```

A rule is proposed only if it reproduces every row exactly, at that column's
own precision — never a best fit, never a threshold, and `also fits, not
proposed` is listed rather than silently dropped, because a rule over
materialised columns beating one with a bare constant is a judgment call worth
seeing. `--write` inserts exactly the blocks and anchors above and rewrites
nothing else. A rule that fits every row but one is never written; it is
reported as a near-miss instead — the tool telling you the document already
has a wrong number in it, before anyone runs `check` on it. The document's own
appendix walks through every mechanism, including that near-miss case.

`infer` is the way in for the document `check` cannot yet help with: one with
no formulas at all. Pairing the two closes the loop — `infer` gets a plain
table wired up, `check` (`--require-formulas` included) keeps it that way.

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

## In CI

The whole point of `check` is that it runs somewhere other than a human's
judgment, so the CI story is one line:

```bash
npx visimark check **/*.md
```

That exits non-zero on the first disagreement, which is all most CI systems
need. A GitHub Actions workflow can do the same with the composite action
this repo ships ([`action.yml`](action.yml)) instead of hand-rolling the
`npx` line:

```yaml
- uses: michal-niedzwiedzki/visimark@v1
  with:
    files: "docs/**/*.md"
```

Add `--require-formulas` — `args: "--require-formulas"` for the action —
for a stricter gate: without it, a document with zero `vmark` rules still
passes `check`, for having nothing to disagree with rather than for being
verified.

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

The CLI is implemented: `visimark check`, `fmt`, `infer`, `eval` and `explain`,
in TypeScript. `npm install -g visimark` puts a `visimark` command on your PATH;
`npx visimark` runs it without installing. All three worked examples pass as the
acceptance suite — `check` on the drift invoice reproduces the transcript above
byte-for-byte, `fmt` leaves the clean invoice untouched, and `infer` on
[`docs/example-quote-plain.md`](docs/example-quote-plain.md) — a quote with no
formulas in it at all — reproduces the transcript in that document's own
appendix. The design is
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
bun test                    # the full suite, the three examples included
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
