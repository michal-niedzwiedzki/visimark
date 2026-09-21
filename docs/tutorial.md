# The VisiMark tutorial

**From a plain Markdown table to numbers a machine checks on every commit.**

This tutorial takes you from nothing to a working setup. You will write a
document, break it on purpose, watch the tool catch it, put the check into CI,
and then read values back out of the document with a script.

It is written for people who know Markdown and Git, and who have never seen
VisiMark. The language is kept simple on purpose, so that it reads the same way
for everyone.

Every command output in this tutorial is a real transcript. Nothing is invented.
They were captured with `visimark 0.1.5`.

## How to read this

There are 28 short chapters in seven parts. They are meant to be read in order:
each one exists because the one before it left a problem open.

| Part | Chapters | What you get |
|---|---|---|
| 1. The problem | 1–2 | Why this tool exists |
| 2. First contact | 3–5 | A working document on your machine |
| 3. The language | 6–16 | Everything you can write |
| 4. Other people's documents | 17–19 | How to adopt it on files you did not write |
| 5. Beyond one file | 20–21 | CSV rows and charts |
| 6. Automation | 22–25 | CI, scripts, agents, your editor |
| 7. Putting it together | 26–28 | A full document, unaided |

Two finished documents come with this tutorial. You can run the tool against
them right now:

- [`tutorial/order.md`](tutorial/order.md) — the small document built in
  chapters 4 to 16.
- [`tutorial/capstone.md`](tutorial/capstone.md) — the full quote built in
  chapter 26.

---

# Part 1 — The problem

## 1. A number that is no longer true

Here is an order, written in ordinary Markdown.

```markdown
| Item      | Qty | Price |    Net |
|-----------|----:|------:|-------:|
| Widgets   |   4 | 12.50 |  50.00 |
| Gadgets   |   2 | 30.00 |  60.00 |
| Sprockets |   6 |  8.00 |  48.00 |

Order total: **158.00** PLN
```

Every number agrees. Now somebody raises the Widgets quantity from 4 to 6, and
changes nothing else.

```markdown
| Item      | Qty | Price |    Net |
|-----------|----:|------:|-------:|
| Widgets   |   6 | 12.50 |  50.00 |
| Gadgets   |   2 | 30.00 |  60.00 |
| Sprockets |   6 |  8.00 |  48.00 |

Order total: **158.00** PLN
```

Two numbers are now wrong. `Net` for Widgets should be `75.00`, and the total
should be `183.00`.

Look at what happens next:

- The file still renders perfectly on GitHub.
- Your Markdown preview shows a clean table.
- Git shows a one-character diff: `4` became `6`. It looks harmless.
- Your tests pass, because no test knows about this file.
- A reviewer reads the sentence, sees a plausible number, and approves it.

Nothing in the whole chain complains. The document is wrong and it *looks*
right. That is the failure this tool exists to catch.

### Why this happens more often now

Three things changed at the same time.

**Numbers moved into text files.** Quotes, invoices, budgets, estimates,
capacity plans, research notes and project plans are increasingly written in
Markdown and kept in Git, because text reviews well and versions well.

**Markdown has no idea what a number means.** A spreadsheet knows that `D4`
contains `=B4*C4`. Markdown only knows that a cell contains the characters
`50.00`. When an input changes, nothing downstream is recomputed, because
nothing downstream is connected.

**AI agents write a lot of these documents.** An agent is reliable at writing
`Net = Qty * Price`. It is unreliable at working out that `6 * 12.50` is `75.00`
and then remembering to update the two totals that depend on it. The formula is
language, which the agent is good at. The arithmetic is a guess.

### The fix in one sentence

Stop writing numbers that follow from other numbers. Write the formula, and let
a tool write the number.

## 2. The idea in one page

A VisiMark document is an ordinary Markdown file. You add a fenced block of
formulas below a table, and invisible HTML comments in the prose.

````markdown
| Item      | Qty | Price |    Net |
|-----------|----:|------:|-------:|
| Widgets   |   4 | 12.50 |  50.00 |
| Gadgets   |   2 | 30.00 |  60.00 |
| Sprockets |   6 |  8.00 |  48.00 |

```vmark #order
Net       = Qty * Price
net_total = SUM(Net)
```

Order total: **158.00**<!--vmark=order.net_total--> PLN
````

That is four ideas, and it is the whole format.

**1. A `vmark` block holds the formulas for the table just above it.** The
`#order` part is the sheet name.

**2. A column rule is one formula for every row.** `Net = Qty * Price` applies
to all three rows. There is no formula-per-cell. A column with no rule — `Item`,
`Qty`, `Price` — is a human input, and the tool never writes to it.

**3. A total is a named value, not a row.** `net_total = SUM(Net)` lives in the
block. There is no "Total" row in the table, so the table stays a rectangle.

**4. An anchor puts a value into a sentence.** `<!--vmark=order.net_total-->`
is an HTML comment. It is invisible on GitHub, in VS Code preview and through
pandoc. The sentence reads normally, and the number in front of the comment is
now owned by the tool.

Now the same edit as before — `4` becomes `6` — produces this instead:

```console
$ visimark check order.md
order.md

  STALE   order.Net       · Widgets                   50.00 ≠ 75.00      Qty * Price
  STALE   order.net_total                            158.00 ≠ 183.00     SUM(Net)
  STALE   1 prose anchors bound to the values above

  3 problems (3 stale, 0 errors)
$ echo $?
1
```

And one command repairs it:

```console
$ visimark fmt order.md
order.md: updated 1 cell, 1 anchor
```

Exit code `1` is the part that matters. It means this can run in CI, and a
document that contradicts itself can stop a merge.

### What you will be able to do at the end

- Write a document whose arithmetic is checked, not claimed.
- Take a document someone else wrote and wire it up without retyping it.
- Read every error the checker can produce, and know what fixes each one.
- Fail a build when a document's numbers drift.
- Read values out of a document from a script, with no export step.

---

# Part 2 — First contact

## 3. Install it and run it once

VisiMark is one command-line program. It runs under Node or Bun.

Try it without installing anything:

```console
$ npx visimark --version
visimark 0.1.5
```

Or install it for real:

```console
$ npm i -g visimark      # or: bun add -g visimark
```

On Windows, both `npx visimark` and `npm i -g visimark` work, but the launcher
needs `sh` on your PATH. Git Bash or WSL provide it. Plain PowerShell does not.

Everywhere below, `visimark` means "the command you just installed", or
`npx visimark` if you did not install it.

### The help screen

```console
$ visimark --help
visimark — spreadsheet mechanics for Markdown

usage:
  visimark check FILE... [--json]      read-only; exit 1 if any finding.
                                        A table with no `vmark` rules is a
                                        finding: run `visimark infer`, or mark
                                        the document `<!--vmark:no-formulas-->`
                                        if it has nothing to derive.
  visimark fmt   FILE... [--fix-dates] [--json]
  visimark infer FILE... [--write] [--json]
  visimark eval  FILE [--get NAME] [--json]
  visimark explain FILE [#sheet] [--json]
  visimark ref   [NAME] [--json]        the language's builtin functions;
                                        reads no file
  visimark --version | -v | version    print the version and exit

exit codes: 0 clean, 1 findings, 2 usage or read failure
```

Six commands. Only one of them matters most of the time.

| Command | What it does | Does it write to your file? |
|---|---|---|
| `check` | Recomputes everything and reports what disagrees | **Never.** It is read-only. |
| `fmt` | Repairs the numbers it owns, in place | Yes — computed cells and anchors only |
| `infer` | Works out the rules a document's existing numbers imply | Only with `--write`, and only by inserting |
| `eval` | Prints the computed values, for a script to read | No |
| `explain` | Prints each sheet's inputs, rules and evaluation order | No |
| `ref` | Prints what a builtin function does | No — it reads no file at all |

### The three exit codes

This is the whole contract with CI, so learn it now.

| Code | Meaning |
|---|---|
| `0` | Nothing to fix. Advice may still have been printed. |
| `1` | The document has problems. Your build should fail. |
| `2` | The command could not run — missing file, no file given, a name that does not exist. This means "your request did not make sense", not "your document is wrong". |

With several files, the worst code wins.

## 4. Write your first document

Create a file called `order.md`. Do it in four steps, in this order. The order
matters, and chapter 5 explains why.

### Step 1 — the table, with placeholders

Write the inputs by hand. For any column the tool will compute, write `0.00` as
a placeholder. Do not work out the real value.

```markdown
| Item      | Qty | Price |    Net |
|-----------|----:|------:|-------:|
| Widgets   |   4 | 12.50 |   0.00 |
| Gadgets   |   2 | 30.00 |   0.00 |
| Sprockets |   6 |  8.00 |   0.00 |
```

### Step 2 — the block, immediately after the table

````markdown
```vmark #order
Net = Qty * Price

net_total  = SUM(Net)
line_count = COUNT(Item)
```
````

The block must come **immediately after** its table. A paragraph in between
detaches it, and you get a `SHEET` error.

### Step 3 — the prose, with anchors

```markdown
The order has **0**<!--vmark=order.line_count--> lines. Net of tax it comes to
**0.00**<!--vmark=order.net_total--> PLN.
```

The placeholder text does not matter. It is an output. The tool will overwrite
it.

### Step 4 — let the tool fill it in

```console
$ visimark fmt order.md
order.md: updated 3 cells, 2 anchors
```

Open the file. The placeholders are gone:

````markdown
| Item      | Qty | Price |    Net |
|-----------|----:|------:|-------:|
| Widgets   |   4 | 12.50 |  50.00 |
| Gadgets   |   2 | 30.00 |  60.00 |
| Sprockets |   6 |  8.00 |  48.00 |

```vmark #order
Net = Qty * Price

net_total  = SUM(Net)
line_count = COUNT(Item)
```

The order has **3**<!--vmark=order.line_count--> lines. Net of tax it comes to
**158.00**<!--vmark=order.net_total--> PLN.
````

And it checks clean:

```console
$ visimark check order.md
order.md

  0 problems (0 stale, 0 errors)
$ echo $?
0
```

You have never typed `50.00`, `48.00` or `158.00`. You typed the four inputs and
two formulas. Everything else was derived.

### Read the output of `check`

The report has a fixed shape:

```
  STALE   order.Net       · Widgets                   50.00 ≠ 75.00      Qty * Price
  ─────   ──────────────    ───────                   ───────────────    ───────────
  code    what it is        which row                 stored ≠ correct   the rule
```

- **code** — the kind of problem. Chapter 18 covers all of them.
- **what it is** — `sheet.name`.
- **which row** — the first cell of that row, so you can find it.
- **stored ≠ correct** — what the file says, then what the formula says.
- **the rule** — the formula that owns the number.

## 5. Prove that it is really derived

This is the most important chapter in the tutorial. Read it twice.

`check` compares numbers against formulas. A document with **no formulas** has
nothing to disagree with. A naive checker would call such a document clean —
which is the most misleading answer it could give.

So `check` refuses:

```console
$ visimark check plain.md
plain.md

  COVERAGE a table with no `vmark` rules — nothing in this document is checked
           run `visimark infer` to derive them, or mark it `<!--vmark:no-formulas-->`

  1 problem (0 stale, 1 error)
$ echo $?
1
```

`COVERAGE` exists to stop one specific lie: computing the totals in your head,
typing them as plain text, running `check`, seeing `0 problems`, and reporting
"the checker passes". That is a green build on a document with no build in it.

Two things keep `COVERAGE` from being annoying:

- It needs a **table** to fire. A README or a changelog is never asked for
  arithmetic it does not have.
- It is counted for the **whole document**. A reference table that really is all
  input passes, as long as some other table in the file carries a rule.

### When a document really has no arithmetic

Say so in the document itself:

```markdown
<!--vmark:no-formulas-->
```

It must be on its own line, not indented, and not inside a fenced block — so a
marker shown inside an example (like the one above) is documentation, not a
claim.

The marker lives in the file rather than in a CI flag. That is deliberate: the
decision is about a document, not about a build. It travels with the content, it
shows up in review, and `grep` finds it.

The marker is checked like everything else. Add rules to a marked document later
and `check` reports the marker as wrong.

**Never add this marker to silence a failure you have not read.** That is the
one move the `COVERAGE` finding exists to prevent.

### The habit that outranks all of this

A green check proves agreement. It does not prove derivation. To prove
derivation, break the document on purpose:

```console
$ sed -i 's/|   4 | 12.50 |/|   6 | 12.50 |/' order.md
$ visimark check order.md
order.md

  STALE   order.Net       · Widgets                   50.00 ≠ 75.00      Qty * Price
  STALE   order.net_total                            158.00 ≠ 183.00     SUM(Net)
  STALE   1 prose anchors bound to the values above

  3 problems (3 stale, 0 errors)
$ git checkout order.md
```

If `check` still says `0 problems` after you changed an input, then nothing in
that document is wired up. Fix that before you trust it.

Do this once for every document you set up. It takes ten seconds and it is the
only test of the thing you actually care about.

---

# Part 3 — The language

Everything in this part is small. There are thirteen functions, five operators
and two kinds of binding. That is the whole language, and it is meant to stay
that way.

## 6. Columns: one rule for every row

A binding whose name matches a **column header** of the table above is a
**column rule**. It runs once per row.

````markdown
| Item      | Qty | Price |    Net |
|-----------|----:|------:|-------:|
| Widgets   |   4 | 12.50 |  50.00 |
| Gadgets   |   2 | 30.00 |  60.00 |
| Sprockets |   6 |  8.00 |  48.00 |

```vmark #order
Net = Qty * Price
```
````

`Net = Qty * Price` is not three formulas. It is one rule, and every row obeys
it. Inside the rule, a bare column name means "this row's value".

There is no way to write a different formula for one row. This is on purpose. A
per-cell exception is exactly the thing that hides in a spreadsheet and survives
every review. If one row really is different, it needs a different input column
or an `IF`, both of which are visible on the page.

### Inputs are the columns with no rule

`Item`, `Qty` and `Price` have no rule. They are **inputs**: values a person
wrote down. The tool never writes to an input column. Ever.

So every column in a table is one of two things, and you can tell which by
looking at the block:

| Kind | Has a rule? | Who owns it |
|---|---|---|
| Input | No | You |
| Computed | Yes | The tool |

### The order of rules does not matter

Inside a block, order is irrelevant. VisiMark works out the dependencies and
evaluates in the right order. You can write the total above the rule that feeds
it.

### Comments

A `#` starts a comment inside a block:

````markdown
```vmark #plan
# how long each task ran
Days = End - Start
```
````

The sheet id lives on the fence line, so `#` is free inside the body.

## 7. Who owns which bytes

VisiMark owns exactly three things in your file:

1. **Computed cells** — cells in a column that has a rule.
2. **Anchored values** — the text in front of a `<!--vmark=…-->` comment.
3. **Generated artifacts** — chart files, covered in chapter 21.

Everything else is yours: prose, headings, input columns, table layout, the
formulas themselves.

### Never hand-edit an output

If a computed number looks wrong, do not fix the number. Change the input or
change the rule, then run `fmt`.

Hand-editing an output is the precise failure this tool exists to catch, and
`fmt` will overwrite you at the next run anyway.

### Why `fmt` produces small diffs

`fmt` does not re-render your Markdown. It finds each number it owns by byte
position and splices just those characters. Nothing else in the file moves — no
reflowed paragraphs, no renormalised `*` and `_`, no realigned tables.

Here is a real diff. One input changed, from `4` to `6`, in
[`tutorial/order.md`](tutorial/order.md):

```diff
-| Widgets   |   4 | 12.50 |  50.00 |
+| Widgets   |   6 | 12.50 |  75.00 |

 The order has **3**<!--vmark=order.line_count--> lines. Net of tax it comes to
-**158.00**<!--vmark=order.net_total--> PLN, an average of
-**52.67**<!--vmark=order.avg_line--> PLN per line.
+**183.00**<!--vmark=order.net_total--> PLN, an average of
+**61.00**<!--vmark=order.avg_line--> PLN per line.

-| Standard |  23% | 158.00 | 36.34 |
+| Standard |  23% | 183.00 | 42.09 |

-Tax adds **36.34**<!--vmark=tax.tax_total--> PLN, so the amount due is
-**194.34**<!--vmark=tax.gross_total--> PLN.
+Tax adds **42.09**<!--vmark=tax.tax_total--> PLN, so the amount due is
+**225.09**<!--vmark=tax.gross_total--> PLN.
```

Six changed lines. Every one of them is a figure that genuinely depends on that
input. **The diff is the propagation.** A reviewer can see the tax, the base and
the amount due all move together, and can ask whether they moved for the right
reason.

One cosmetic note: if a new value is wider than the old one, your table columns
may stop lining up. `fmt` will not re-pad the table, because the padding is
yours. Give computed cells a little room when you write the placeholders, or
re-align by hand when you like.

## 8. Scalars and aggregates

A binding whose name is **not** a column header is a **scalar** — a single named
value.

````markdown
```vmark #order
Net = Qty * Price

net_total  = SUM(Net)
line_count = COUNT(Item)
```
````

`net_total` and `line_count` are scalars. `Net` is a column rule, because the
table has a `Net` header.

### The five aggregates

An aggregate — the specification calls it a **reduce** — takes one whole column
and returns one value. It takes a bare column name, never an expression.

| Function | Returns |
|---|---|
| `SUM(col)` | Total of the column. `0` over an empty column. |
| `COUNT(col)` | Number of rows. |
| `MIN(col)` | Least value. Works on numbers or on dates. |
| `MAX(col)` | Greatest value. Works on numbers or on dates. |
| `AVG(col)` | Arithmetic mean. |

### There is no totals row

This is worth stating plainly, because everybody tries it once.

```markdown
| Item      | Qty | Price |    Net |
|-----------|----:|------:|-------:|
| Widgets   |   4 | 12.50 |  50.00 |
| **Total** |     |       | 158.00 |     ← do not do this
```

A totals row breaks the rectangle. `SUM(Net)` would then include the total
itself, and `COUNT(Item)` would count a row that is not a line item. A total is
a scalar, and it reaches the reader through an anchor.

### The trap: a rule whose name is not a column

This is the mistake everybody makes once. Suppose the header is `Price`, and you
write:

````markdown
```vmark #order
Net = Qty * Prise
```
````

That is caught, because `Prise` does not exist:

```console
  UNDEF   s.Net             unknown name `Prise`
          did you mean `Price`?
```

But now suppose you misspell the **left** side:

````markdown
```vmark #order
Nett = Qty * Price
```
````

`Nett` is not a column header, so it is not a column rule. It quietly becomes a
scalar. Your `Net` column is still an input full of hand-typed numbers, and the
checker has nothing to say about it.

This is why the tool warns about a value nobody reads:

```console
  WARN    order.Nett        defined and never read — did you mean `Net`?
```

`WARN` is advice. It does not fail the build. But a scalar nobody reads is
almost always a typo on the left-hand side of a rule, so treat it as a real
signal.

This is also the second reason for chapter 5's habit: change an input, and the
column that never updates is the column that was never wired up.

### What-if runs: `param`

Sometimes you want to ask *what would this come to if the tax rate were 12.5%?*
without editing the document. Editing it means `fmt` rewrites every figure
downstream, and you get a diff for a question you never meant to commit.

Declare the knob as a `param` instead of a plain scalar:

````markdown
```vmark #order
param vat precision 3 = default 19%
gross precision 2 = SUM(Net) * (1 + vat)
```
````

Everywhere except one command, `vat` is exactly `vat precision 3 = 19%`:
`check`, `fmt` and plain `eval` all see the default. The `precision` clause is
required, because a value arriving from outside has no width the document
could derive.

The one exception is `eval --scenario`. Write the other value in a JSON file,
as a string:

```console
$ cat cheaper.json
{ "vat": "12.5%" }
$ visimark eval --scenario cheaper.json order.md
```

`eval` prints the values computed with 12.5%, then a `scenario:` block listing
each param, its value and its default. It writes nothing. A misspelled key, a
value wider than the declared precision, a JSON number such as `12.5`, or a
bare `"12.5"` for a percent param is refused with exit `2`, so a what-if cannot
quietly run with the wrong input. Every other command refuses `--scenario`.

## 9. Anchors: a number inside a sentence

A total is useless if a reader has to run a tool to see it. An **anchor** puts
the value into the prose.

```markdown
Net of tax it comes to **158.00**<!--vmark=order.net_total--> PLN.
```

The comment sits immediately after the value it owns. It rewrites the text of
the inline element directly before it: **bold**, *emphasis*, `code`, or plain
text.

The comment is invisible in GitHub, in VS Code preview, and through pandoc to
HTML and Word. The sentence reads normally. Nobody but you and the tool knows it
is there.

### An anchor names `sheet.name`, always

```markdown
**158.00**<!--vmark=order.net_total-->
```

The sheet id is required. A value defined outside any sheet cannot be anchored,
so put anything you want to say in prose inside a named sheet.

### An anchor is an output, never an input

The text in front of the comment states a value. It never decides one.

- It does not decide how many decimals to print. That comes from the binding
  (chapter 14).
- It is never read back by the evaluator.
- Two anchors on the same value cannot disagree, because neither is consulted.

So writing `**0**` as a placeholder does not mean "zero decimals". Whatever you
type is replaced at the binding's own width.

### An anchor can start empty

`fmt` will seed it:

```markdown
Net of tax it comes to <!--vmark=order.net_total--> PLN.
```

This is legal authoring syntax. `fmt` fills it in. What `fmt` never does is
*invent* an anchor — you decide where a value appears in your prose.

### Put the currency outside the anchor

```markdown
**158.00**<!--vmark=order.net_total--> PLN     ← right
**158.00 PLN**<!--vmark=order.net_total-->     ← wrong
```

In the second form, `PLN` is inside the value the tool owns, and the tool will
rewrite the whole thing.

### One current limit

Today only **numeric** anchored values are rewritten and checked. If a value is
a string or a date, the anchor is left alone and no `STALE` is reported for it.
Until that changes, keep strings and dates out of prose anchors, or accept that
they are documentation rather than verified figures. Numbers — which is almost
everything you want to anchor — are fully checked.

## 10. More than one table: sheets

A real document has several tables. Each `vmark` block names a **sheet**, and a
sheet owns the table immediately above it.

Here is the second half of [`tutorial/order.md`](tutorial/order.md):

````markdown
| Band     | Rate |   Base |   Tax |
|----------|-----:|-------:|------:|
| Standard |  23% | 158.00 | 36.34 |

```vmark #tax
Base = order.net_total
Tax  = ROUND(Base * Rate, 2)

tax_total   = SUM(Tax)
gross_total = order.net_total + tax_total
```
````

`order.net_total` reaches across from the first sheet. That is the whole
mechanism: a qualified name, `sheet.value`.

### Two rules that bite

**A cross-sheet reference must be qualified.** Inside `#tax`, a bare `net_total`
means nothing. Write `order.net_total`.

**A column from another sheet must be aggregated.** A column is not a value:

````markdown
```vmark #schedule
Amount = Share * order.Net
```
````

```console
  VECTOR  schedule.Amount   `order.Net` is a column, not a value.
          Wrap it in an aggregate: SUM(order.Net)
```

The error message tells you the fix. Inside its own sheet, a bare column name is
fine, because a column rule runs per row and "this row's value" is meaningful.
Across a sheet boundary there is no "this row", so you must collapse the column
to one number.

### A block with no table

If a block declares only scalars, it does not need a table above it. This is how
you write a reconciliation section:

````markdown
```vmark #recon
invoiced  = lines.gross_total
scheduled = schedule.covered
variance  = scheduled - invoiced
```
````

A block that declares **column rules** and has no table above it is a `SHEET`
error.

### Blank lines do not detach a block

A block owns the table immediately above it, ignoring blank lines. A *paragraph*
in between does detach it. If you see a `SHEET` error, look for prose that
wandered between a table and its block.

## 11. Functions that run per row

An aggregate collapses a column. A **map** does the opposite job: it runs once
per row, inside a column rule, and turns one value into one value.

| Function | What it does |
|---|---|
| `ROUND(x, places)` | Round to `places` decimals. Ties go away from zero. |
| `ABS(x)` | Drop the sign. Also written `\|x\|`. |
| `MOD(x, y)` | Remainder. Zero divisor is an error. |
| `SQRT(x)` | Square root. Negative input is an error. Also written `√(x)`. |
| `FLOOR(x, s)` | Largest multiple of `s` not above `x`. `⌊x⌋` is the whole-number floor, `FLOOR(x, 1)`. |
| `CEILING(x, s)` | Smallest multiple of `s` not below `x`. `⌈x⌉` is the whole-number ceiling, `CEILING(x, 1)`. |
| `IF(cond, a, b)` | `a` when `cond` is true, otherwise `b`. |
| `EOMONTH(d, months)` | Last day of the month `months` away from `d`. |

Maps and aggregates compose freely, because both produce a single value:

```
Share precision 4 = Net / SUM(Net)
```

`SUM(Net)` collapses the column to a number, and then the division runs once per
row. This is legal and useful.

### Operators

`+` `-` `*` `/` `^`, the comparisons `==` `!=` `<` `<=` `>` `>=`, and the words
`and`, `or`, `not`. Division by zero is an error, not a value.

Two characters are missing on purpose. `|` would collide with table syntax, and
`%` is postfix only, so that `23%` can never be ambiguous. Use `MOD()` for
modulo.

Equality is `==`. A single `=` only ever binds a name.

### Booleans exist, but never land in a cell

A comparison produces a boolean. `IF()`, `and`, `or`, `not` and `assert` consume
one. Nothing else can.

There are no `true` and `false` literals, and storing a boolean is an error:

````markdown
```vmark #plan
Flag = Days > 30
```
````

```console
  TYPE    plan.Flag         a boolean cannot be stored; wrap it in `IF()` to produce a number or a string
```

Write this instead:

```
Late = IF(Days > 30, 1, 0)
```

The reason is that a stored value must be a number, a date or a string — nothing
else. If a cell could hold a boolean, then the English word `true` in an input
column would silently change type.

### Look functions up. Do not guess.

`visimark ref` prints the exact behaviour of any builtin, including its errors
and worked examples. Every example it prints is executed against the engine in
CI, so what it says is what the engine does.

```console
$ visimark ref EOMONTH
EOMONTH(d, months) — map, 2 arguments

  Last day of the month `months` calendar months from `d`; `d`'s day is discarded.

  d        date     the date whose month starts the count
  months   number   whole number of months to move; may be negative

  returns    date
  precision  not applicable — the result is a date

  errors
    a non-whole `months`            TYPE
    a result outside years 1–9999   DATE

  examples
    EOMONTH(2026-01-15, 0)   = 2026-01-31
    EOMONTH(2026-01-31, 1)   = 2026-02-28
    EOMONTH(2024-01-31, 1)   = 2024-02-29
    EOMONTH(2026-01-15, -1)  = 2025-12-31

  see also  MIN, MAX
```

Bare `visimark ref` lists all thirteen. `--json` gives the machine-readable
form. The same content is in
[`function-reference.md`](function-reference.md).

This is a habit worth building, and it matters more than it sounds. Rounding
direction, what `FLOOR` does to a negative number, what `EOMONTH` does to
31 January — these are exactly the details that produce a document that is
plausible and wrong.

## 12. Percent, currency and units

### Percent

`23%` is a number exactly equal to `0.23`. It is not a display setting.

```
vat_rate = 23%
```

### Decoration in a cell

A column may carry a currency symbol or a unit:

```markdown
| Item    | Price  | Qty |    Net |
|---------|-------:|----:|-------:|
| Widgets | $12.50 |   4 | $50.00 |
| Gadgets | $30.00 |   2 | $60.00 |
```

VisiMark strips the `$` to compute, and puts it back when it writes. The
decoration is **inert**: it is never converted, never propagated through a
formula, and never given meaning.

### One column means one thing

A column holding both `$5.00` and `€4.00` is an error, not a sum:

```console
  UNIT    s.Price         · b                     "€4.00"
          column mixes units: $ and €
```

This is not fussiness. Two currencies in one column have no total, and guessing
one would be worse than refusing.

### Thousands separators are refused

`1,800.00` does not parse. Write `1800.00`. A comma means different things in
different countries, and no amount of care catches that by reading.

## 13. Dates

A date is `YYYY-MM-DD`. Ten characters. ISO 8601. Nothing else is a date.

```markdown
| Milestone | Due        |
|-----------|------------|
| Signature | 2026-10-01 |
```

### Why the tool refuses the alternatives

```console
  DATE    s.Due           · One                   "15.10.2026"
          Dates must be ISO 8601 calendar dates: YYYY-MM-DD.
          Unambiguous — `visimark fmt --fix-dates` rewrites it to 2026-10-15.
```

`15.10.2026` has only one reading, because 15 cannot be a month. The tool offers
to fix it:

```console
$ visimark fmt --fix-dates invoice.md
```

This one is different:

```console
  DATE    s.Due           · One                   "11/12/2026"
          Dates must be ISO 8601 calendar dates: YYYY-MM-DD.
          Ambiguous: 2026-12-11 or 2026-11-12, 29 days apart. Fix by hand.
```

`11/12/2026` is 11 December in London and 12 November in Chicago. The two
readings are 29 days apart, which is the difference between paying on time and
paying late. No tool can decide that from the text, so VisiMark refuses, and
`--fix-dates` leaves it alone.

### Arithmetic on dates

- `date - date` is a whole number of days.
- `date + n` and `date - n` give another date.
- `MIN` and `MAX` work over a column of dates.
- `EOMONTH(d, months)` gives the last day of a month, which is how payment terms
  are usually written.

A worked example:

````markdown
| Task  | Start      | End        | Days | Late |
|-------|------------|------------|-----:|-----:|
| Alpha | 2026-01-05 | 2026-02-10 |   36 |    1 |
| Beta  | 2026-02-01 | 2026-03-20 |   47 |    1 |
| Gamma | 2026-03-01 | 2026-03-08 |    7 |    0 |

```vmark #plan
Days = End - Start
Late = IF(Days > 30, 1, 0)

longest    = MAX(Days)
late_count = SUM(Late)
```
````

Every number in `Days` and `Late` was written by `fmt`.

## 14. Precision: how wide a number is written

A number has to be written with some number of decimals. VisiMark does not have
a setting for that, and it never reads it from your prose. The width comes from
the arithmetic.

### Where width comes from

| Operation | Width of the result |
|---|---|
| `+` `-` | The wider of the two operands |
| `*` | The two widths added together |
| `^` | The base's width times the exponent |
| `SUM` `MIN` `MAX` | The width of the column |
| `COUNT` | Always 0 |
| `ROUND(x, places)` | The value of `places` |
| `FLOOR(x, s)` / `CEILING(x, s)` | The width of `s` |
| `ABS(x)` | The width of `x` |
| `MOD(x, y)` | The wider of the two |
| `IF(c, a, b)` | The wider of `a` and `b` |
| `/` `AVG` `SQRT` | **Nothing. You must declare it.** |

### The three that bound nothing

Division, `AVG` and `SQRT` produce a result whose decimals do not follow from
their inputs. `10 / 3` has no natural width. So a binding that uses one must say
how wide it writes:

```
avg_line precision 2 = net_total / line_count
```

`N` runs from 0 to 18. Not declaring it is an error:

```console
  PRECISION s.per_item        `total / COUNT(Net)` has no derivable precision
            declare the width: `per_item precision N = …`
```

`fmt` will not guess for you. Take the width from what the document already
shows, or decide it.

The finding only appears when a value has to be **written** somewhere — into a
cell or an anchor. An intermediate value that nobody materialises keeps full
precision and needs no declaration.

### Declare it even when you do not have to

Multiplication adds widths. That surprises people:

```
vat = total * vat_rate
```

`total` has 2 decimals, `vat_rate` (`23%`) has 2, so `vat` is written with
**four**: `36.3400`. That is arithmetically honest and, on an invoice, wrong.

Two ways to fix it, and the second is usually better:

```
vat precision 2 = total * vat_rate      # declare the width
VAT = ROUND(Net * vat_rate, 2)          # round on purpose
```

Prefer `ROUND` on money. It makes the rounding a stated decision in the
document, rather than a display width.

Declaring a width electively is good practice anywhere a column holds money and
must stay at two decimals even if an input later gains a third.

### Prose never decides a width

Writing `**0**` in front of an anchor does not request zero decimals. The anchor
is an output. If you want fewer decimals, change the binding.

## 15. Headers that are not names

A column rule's name is normally the header text itself, so it normally has to
be a plain identifier. Real headers are not:

```markdown
| Stage     | Effort (man-days) |
```

The wrong fix is to rename the header. That header is human-facing prose,
somebody chose those words, and rewriting it to `Effort` to please a tool is
exactly the kind of intrusion this format tries to avoid.

Two forms handle it, and neither touches the table.

### `"Header text" is symbol` — give the column a short name

```
"Effort (man-days)" is days

Net = days * Rate
effort_total = SUM(days)
```

The alias works everywhere the column's own name would: as an operand, inside a
reduce, and as the left side of a rule. It creates no second column.

This is the **only** way to *read* such a column in a formula. A bare quoted
string is already a string literal, so it cannot double as an operand.

### `"Header text" = expr` — write the column directly

```
"GPU-to-GPU Bandwidth (GB/s)" = ROUND(bpu / GPUs * 1000, 0)
```

Use this when you only produce that column and never read it back.

### Matching is exact

The quoted text must be byte-for-byte identical to the header cell's printed
text. No trimming, no case folding. If it does not match any header, that is an
`UNDEF` error with a suggestion — never a silently created scalar.

## 16. Assertions: facts that must stay true

Some things are not numbers to compute, but statements that must hold. A
schedule must cover the invoice. Shares must add to 100%. A span must stay
inside a limit.

```
assert variance == 0
assert ROUND(SUM(Share), 2) == 1
assert delivery >= signature
```

An `assert` line lives in a `#id` block. It stores nothing, `fmt` never touches
it, and a false one is an error:

```console
  ASSERT  #recon          variance == 0
          -50.00 == 0   is false
```

Note the second line. The report prints the expression, and then the same
expression with the named values filled in. You see *why* it failed without
opening the file.

### Rules for assertions

**Scalar expressions only.** To check something about every row, use an
aggregate: `assert MIN(margin) >= 0` means "no row has a negative margin".

**There is no rounding tolerance.** If you need one, write it:

```
assert |variance| <= 0.05
```

That is better than a hidden tolerance, because the number `0.05` is on the page
where a reviewer can argue with it.

### When to reach for one

Whenever a number's correctness depends on a relationship that a later edit
could quietly break. Rounding each instalment of a payment schedule can leave a
few cents of remainder — an assertion is how you state which remainder is
acceptable.

Here is the one from [`tutorial/capstone.md`](tutorial/capstone.md):

````markdown
```vmark #recon
invoiced  = lines.gross_total
scheduled = schedule.covered
variance  = scheduled - invoiced

assert |variance| <= 0.05
```
````

An assertion is also the only construct in the language that states an argument
rather than a number. That makes it the most valuable thing in the file during
review.

---

# Part 4 — Documents you did not write

## 17. `infer`: wiring up a table that already has numbers

Most adoption does not start with an empty file. It starts with a quote, a
budget or an estimate that somebody already wrote the ordinary way. All the
numbers are there. None of them are connected.

Do **not** type the rules out by hand. Ask the tool what the numbers already
imply:

```console
$ visimark infer quote.md
quote.md  table at line 3 — 4 rows, 4 columns

  column rules
    Revenue  = Seats * Fee                    4/4 rows

  scalars matching figures in prose
    72        line 10  = SUM(Seats)                seats_total
    27600.00  line 10  = SUM(Revenue)              revenue_total

  no rule found — treating as inputs
    Module, Seats, Fee

1 rule, 0 aliases, 2 scalars, 2 anchors.
```

`infer` reads the tables and the prose, and works out which rules reproduce the
numbers that are already there.

### Rules are verified, never fitted

A candidate rule either reproduces **every** cell of its column, at that
column's own precision, or it is not a candidate. There is no score, no
threshold and no best guess.

A constant is solved from the first row and then checked against all the others.
A constant that only satisfies the row it came from is not a finding.

### The most valuable output is a near-miss

Transpose two digits in one cell and ask again:

```console
$ visimark infer quote.md
  near-miss — not proposed
    Delivered = Revenue + Materials           3/4 rows
      row 3  Coaching
      cell 5823.00, rule gives 5832.00        differs by 9.00
```

Read what that means. The tool has just told you the document **has a wrong
number in it** — to someone who has adopted nothing, written no formulas and
learned no syntax.

A near-miss is never proposed and never written, even with `--write`. It is
reported, with the row named and the difference given, and what to do about it
is your decision.

### "Also fits, not proposed"

Sometimes two rules both reproduce a column exactly:

```console
  also fits, not proposed
    Delivered = Revenue * 1.08    prefers a rule over materialised columns
    Delivered = Materials * 13.5  prefers a rule over materialised columns
```

`Delivered = Revenue + Materials` wins, because a rule built from columns that
are on the page beats one that introduces a constant. Every intermediate stays a
number the reviewer can see. The losers are listed rather than dropped, because
choosing between them is a judgment call and you should see it being made.

### "Weak, not written"

```console
    Revenue  = Seats * Fee                    2 rows — weak, not written
```

Two rows are not enough evidence. Almost any rule fits two rows. `infer` says so
and declines.

### `--write` only inserts

```console
$ visimark infer quote.md --write
```

It inserts a `vmark` block after each table, and an anchor after each matched
figure. It never rewrites an existing byte. Your prose, your headings and every
input column survive untouched.

It also writes the `<!--vmark:no-formulas-->` marker — but only when it found
**nothing whatsoever** to derive. If it found a near-miss, or two rules it could
not choose between, it refuses to write the marker, because those mean the
document does have arithmetic and wants a person to look at it.

### What it will not do for you

A figure has to be an inline element — usually `**bold**` — for an anchor to be
proposed. A bare number inside a plain sentence is reported as
`no anchorable inline node holds this figure`, and you add the emphasis yourself.

`infer` never invents names from your prose. `SUM(Revenue)` becomes
`revenue_total`, mechanically. Reading the sentence and calling it
`teaching_revenue` would read better and would be a guess about meaning. Rename
it yourself afterwards; it is one edit.

Tables with no name get `#unnamed1`, `#unnamed2`. They read as placeholders,
which is the point.

### The adoption path, in full

```console
$ visimark check quote.md        # COVERAGE: nothing here is checked
$ visimark infer quote.md        # read the proposal. Look hard at near-misses.
$ visimark infer quote.md --write
$ visimark check quote.md        # 0 problems
$ sed -i 's/| 24 |/| 30 |/' quote.md
$ visimark check quote.md        # MUST fail now. If it does not, nothing is wired.
$ git checkout quote.md
```

## 18. Reading `check`: every finding

Findings come in two classes. **Problems** are counted in the `N problems` line
and make the run fail. **Advice** is printed and costs nothing.

### The problems

**`STALE` — a stored number disagrees with its formula.**

```console
  STALE   order.Net       · Widgets                   50.00 ≠ 75.00      Qty * Price
```

This is the ordinary case, and the only one `fmt` repairs. It also covers a
chart file that no longer matches its data, including one that is missing.

**`COVERAGE` — nothing in this document is checked.**

```console
  COVERAGE a table with no `vmark` rules — nothing in this document is checked
           run `visimark infer` to derive them, or mark it `<!--vmark:no-formulas-->`
```

See chapter 5. Also reported when a document carries a `no-formulas` marker that
its own rules now contradict.

**`DATE` — a date is not ISO 8601.** See chapter 13. `fmt --fix-dates` fixes the
unambiguous ones.

**`UNIT` — one column means two things.**

```console
  UNIT    s.Price         · b                     "€4.00"
          column mixes units: $ and €
```

**`UNDEF` — a formula names something that does not exist.**

```console
  UNDEF   s.Net             unknown name `Prise`
          did you mean `Price`?
```

**`DUP` — the same name is bound twice in one scope.**

```console
  DUP     s.total           `total` is already defined in this scope
          the first binding wins; delete or rename one of them
```

The first binding wins, which is exactly why this is an error and not a silent
overwrite.

**`VECTOR` — a column was used where one value is required.**

```console
  VECTOR  p.Amount          `s.Net` is a column, not a value.
          Wrap it in an aggregate: SUM(s.Net)
```

**`CYCLE` — values depend on each other in a circle.**

```console
  CYCLE   s.base → s.total → s.fee → s.base
```

The whole path is printed, so you can see where to cut it.

**`TYPE` — something cannot go where it was asked to go.**

```console
  TYPE    plan.Flag         a boolean cannot be stored; wrap it in `IF()` to produce a number or a string
```

**`SHEET` — a block's relationship to its table is broken.**

```console
  SHEET   s.                this block declares column rules but no table immediately precedes it
```

Usually a paragraph wandered between the table and the block.

**`PRECISION` — a binding writes numbers but has no width.**

```console
  PRECISION s.per_item        `total / COUNT(Net)` has no derivable precision
            declare the width: `per_item precision N = …`
```

**`ASSERT` — an `assert` statement is false.**

```console
  ASSERT  #recon          variance == 0
          -50.00 == 0   is false
```

**`ANCHOR` — an anchor has nothing it can rewrite**, or a comment that announces
itself as an anchor does not parse. A hyphenated sheet id, a stray space or an
empty name is reported rather than silently ignored.

**`IMPORT` — a declared CSV import cannot be resolved.** See chapter 20.

**`ARTIFACT` — a declared chart cannot be built or written.** A pie of negative
values, a series that is blank or not numeric, an unknown chart type, or a path
outside the document's directory. See chapter 21.

### The advice

**`WARN` — something is defined and never read.**

```console
  WARN    order.count       defined and never read — did you mean `Net`?
```

Usually a typo on the left-hand side of a rule. See chapter 8.

**`NOTE` — something could not be verified, because something it depends on is
broken.**

```console
  NOTE    schedule.Days   · 2 rows not verified (upstream DATE errors)
```

It disappears when the real problem above it is fixed.

### Which ones can a tool fix?

| Finding | Fixed by |
|---|---|
| `STALE` | `visimark fmt` |
| `DATE` | `fmt --fix-dates` when unambiguous, otherwise by hand |
| `IMPORT`, missing stamp only | `visimark fmt` |
| `COVERAGE` | `visimark infer`, or the marker if it is honest |
| `PRECISION` | by hand — `infer` can propose the clause |
| everything else | by hand |

**`fmt` repairs stale values and nothing else.** Every other finding is a
question only a person can answer. Do not paper over a `DATE`, `UNIT`, `CYCLE`,
`UNDEF` or `DUP` finding by editing the number it points at. Changing the number
a finding complains about is the one move that turns a caught error into a
hidden one.

## 19. `explain`, and reviewing a VisiMark diff

### `explain` answers "what is this document doing?"

```console
$ visimark explain docs/tutorial/order.md
#order
  inputs:  Item, Qty, Price
  rules:
    Net = Qty * Price   precision 2 (derived)
  scalars:
    net_total = SUM(Net)                precision 2 (derived)
    line_count = COUNT(Item)            precision 0 (derived)
    avg_line = net_total / line_count   precision 2 (declared)
  order:   Net → net_total → line_count → avg_line

#tax
  inputs:  Band, Rate
  rules:
    Base = order.net_total        precision 2 (derived)
    Tax = ROUND(Base * Rate, 2)   precision 2 (derived)
  scalars:
    tax_total = SUM(Tax)                        precision 2 (derived)
    gross_total = order.net_total + tax_total   precision 2 (derived)
  order:   Base → Tax → tax_total → gross_total
  assertions:
    gross_total >= order.net_total
```

Four things worth reading here:

- **`inputs`** — the columns nobody computes. These are the numbers a human is
  responsible for. In a review, this is the list you check against reality.
- **`order`** — the evaluation order VisiMark worked out.
- **`precision … (derived)` / `(declared)`** — whether a width followed from the
  arithmetic or you chose it.
- **`assertions`** — the claims this document makes about itself.

Pass `#sheet` to limit it to one sheet.

### What to look at in review

A VisiMark diff tells you more than an ordinary one, so review it differently.

**Did an input change?** That is a human decision. Ask about it.

**Did a computed value change without an input or rule changing?** That should
be impossible. If it happened, somebody hand-edited an output.

**Did a rule change?** This is the most important line in any VisiMark diff. A
changed rule silently changes every number under it. Read it carefully.

**Did the right things move together?** In the chapter 7 diff, one `Qty` change
moved the net, the tax base, the tax and the amount due. If a quantity changes
and the tax does not, something is not connected.

**Did an assertion get deleted or loosened?** `assert |variance| <= 0.05`
becoming `<= 50.00` is a one-character-looking change that removes a real
guarantee.

Nothing outside the file can change a number. There are no plugins, no config
file, no environment variables, no clock. So the diff really does contain
everything.

---

# Part 5 — Beyond one file

The core of VisiMark is finished at chapter 19. These two chapters are features
you may never need. Read them when you do.

## 20. Rows from a CSV

Sometimes the rows are produced by another system and it makes no sense to paste
them into the document. A sheet can take its rows from a local CSV file instead
of from a Markdown table.

````markdown
```vmark #order from rows.csv labelled Item, Qty, Price, Net at sha256:618cac75ed467d26508037dac4fced2fa3853e712e9172bc0d15c69d2bb05412
total = SUM(Net)
count = COUNT(Item)
```

The order totals **158.00**<!--vmark=order.total--> across **3**<!--vmark=order.count--> lines.
````

Three clauses on the fence line:

- **`from rows.csv`** — where the rows come from. The path must be inside the
  document's own directory.
- **`labelled Item, Qty, Price, Net`** — asserts the CSV's header row, by name
  and in order. A column renamed or reordered upstream becomes a loud `IMPORT`
  finding instead of a silent misread.
- **`at sha256:…`** — pins the exact bytes of the file.

### Writing one

Write the `from` and `labelled` clauses, leave the stamp out, and let `fmt` add
it:

```console
$ visimark check order.md
order.md

  STALE   order.total                                  0.00 ≠ 158.00     SUM(Net)
  STALE   order.count                                     0 ≠ 3          COUNT(Item)
  STALE   2 prose anchors bound to the values above

  IMPORT  #order            unstamped import

  5 problems (4 stale, 1 error)

$ visimark fmt order.md
order.md: updated 2 anchors
```

`fmt` wrote the `at sha256:…` clause and filled the anchors.

### What the stamp buys you

Change the CSV underneath the document and `check` notices:

```console
$ visimark check order.md
order.md

  STALE   order.            `rows.csv` does not match its recorded stamp — expected sha256:618cac…, got sha256:ad5069…

  1 problem (1 stale, 0 errors)
```

An inline table needs no such guard, because its data is in the same text
`check` is already reading. An imported sheet has data that can move without the
document changing, so the stamp is what keeps the document honest.

When the change is intended, `visimark fmt` re-stamps it. **VisiMark never
writes to the CSV itself.**

### What changes when a sheet is imported

**There are no column rules.** An imported sheet's columns are read-only inputs
taken from the CSV. There is no cell for a rule to write to. Only aggregates
still run.

So if the CSV has a `Net` column, that `Net` was computed by whatever produced
the CSV — not by VisiMark. VisiMark verifies the aggregate over it, and the
stamp on the file, and nothing more.

A binding that shadows an imported column is an `IMPORT` error.

## 21. Charts as generated artifacts

A `chart` statement declares a picture drawn from columns of its own sheet.

````markdown
| Month | Revenue  | Cost     |   Profit |
|-------|---------:|---------:|---------:|
| Jan   | 48200.00 | 31100.00 | 17100.00 |
| Feb   | 51400.00 | 33250.00 | 18150.00 |
| Mar   | 46900.00 | 32800.00 | 14100.00 |

```vmark #sales
Profit = Revenue - Cost
total = SUM(Profit)
chart trend as bar of Revenue, Cost labelled Month
```

![revenue and cost by month](charts/c-trend.svg)<!--vmark=sales.trend-->
````

The shape is `chart NAME as TYPE of SERIES… labelled LABELS`, with an optional
`aspect 16:9`. Types include `bar`, `line`, `stacked-bar`, `pie` and `area`.

Like an aggregate, a chart takes bare column references, never expressions — so
every value it draws is a number already visible on the page.

### The image anchor

The chart is an ordinary Markdown image carrying an anchor. The tool writes to
exactly the path the image names. It never invents an image line, and a
declaration with no image is an `ANCHOR` error.

### `fmt` draws it, `check` verifies it

```console
$ visimark check c.md
  STALE   sales.Profit    · Jan                        0.00 ≠ 17100.00   Revenue - Cost
  STALE   sales.trend       artifact missing at `charts/c-trend.svg`

$ visimark fmt c.md
c.md: updated 3 cells, 1 artifact
```

Change a `Revenue` cell and the SVG is `STALE` until `fmt` regenerates it.
Delete the file and it is `STALE` as missing.

### What `check` does and does not prove

`check` proves the SVG on disk is **exactly what the current data renders to**.
It does not prove the picture is a fair depiction of the numbers. An artifact's
provenance is verifiable; its draughtsmanship is not.

Charts belong on data worth looking at as a shape — a trend over months, a split
across segments. An invoice does not need one.

---

# Part 6 — Automation

This is the payoff. Everything so far was about making a document checkable. Now
the check runs without you, and other programs read the document.

## 22. In CI

The whole point of `check` is that it runs somewhere other than a human's
judgment. This chapter is the short version;
[`ci.md`](ci.md) is the long one, and covers annotations, pinning, other CI
systems and how to roll this out on a repository that already has documents.

The setup is one line:

```bash
npx visimark check docs/*.md
```

It exits non-zero on the first disagreement, which is all any CI system needs.

**The command does not expand globs — your shell does.** So quote nothing, and
turn on `globstar` if you want `**` to cross directories:

```bash
shopt -s globstar            # bash; zsh has ** already
npx visimark check docs/**/*.md
```

A quoted `"docs/**/*.md"` reaches the tool as a literal filename, and you get
exit code `2` and `cannot read **/*.md`. If you would rather not think about
shell options:

```bash
find docs -name '*.md' -print0 | xargs -0 npx visimark check
```

### GitHub Actions, by hand

```yaml
name: docs
on: [push, pull_request]

jobs:
  visimark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: check the documents
        run: |
          shopt -s globstar nullglob
          npx --yes visimark@0.1.5 check docs/**/*.md
```

### GitHub Actions, with the shipped action

```yaml
      - uses: michal-niedzwiedzki/visimark@v0.1.5
        with:
          files: "docs/**/*.md"
```

Inputs: `files` (a glob, `**` matches across directories), `command` (`check` or
`fmt`), `args` (for example `--fix-dates`), and `version`.

There is nothing else to configure. There is no strictness dial to find.
Pointing it at a glob is the whole setup.

### Pin the version

The action's `version` input defaults to the release that action ref ships. So
pinning the action at `@v0.1.5` also pins the engine that does the work. Re-run
an unchanged commit next month and you get the same verifier.

Set `version: latest` if you would rather track releases as they land.

### `check` in CI, `fmt` on your machine

Run **`check`** in CI. It is read-only, so it is safe to point at anything, and
a failure is a real answer: the document contradicts itself, and a person should
look.

Do not run `fmt` in CI and commit the result. That would repair the drift
automatically, and the whole value of this tool is that a human sees the drift
and decides whether the input or the formula was wrong. `fmt` belongs on a
developer's machine, or behind format-on-save in an editor (chapter 25).

The one reasonable exception is a job that runs `fmt` and then fails if the file
changed — a "you forgot to run fmt" check. That still puts the decision on a
person.

### What to tell a contributor whose build failed

The report already says it, but this is the short version:

- **`STALE`** — run `visimark fmt FILE`, then look at the diff and decide if
  those new numbers are what you meant.
- **`COVERAGE`** — run `visimark infer FILE` and read the proposal.
- **Anything else** — a person has to answer it. The finding says which person
  question it is. Chapter 18 is the full list.

### Machine-readable output

Every command takes `--json`:

```json
{
  "command": "check",
  "visimark": "0.1.5",
  "status": "problems",
  "files": [
    {
      "path": "undef.md",
      "findings": [
        {
          "code": "UNDEF",
          "class": "problem",
          "location": { "file": "undef.md", "sheet": "s", "name": "Net" },
          "details": { "suggestion": "Price" }
        }
      ],
      "summary": { "problems": 1, "stale": 0, "errors": 1 }
    }
  ],
  "summary": { "files": 1, "problems": 1, "stale": 0, "errors": 1 }
}
```

This is what you use to turn findings into PR annotations.

An option a command does not accept is refused, not ignored: `--jsonn` exits `2`
with a did-you-mean, and so does `--fix-dates` on `check`. Nothing is read or
written first.

## 23. Knowledge extraction: a document a machine can read

A VisiMark document is not only checkable. It is queryable. `visimark eval`
prints the computed values, so a script can act on them.

### All the values

```console
$ visimark eval docs/tutorial/order.md
order.net_total   158
order.line_count  3
order.avg_line    52.67
tax.tax_total     36.34
tax.gross_total   194.34
order.Net         50, 60, 48
tax.Base          158
tax.Tax           36.34
```

Both scalars and columns. Names are `sheet.name`.

### One value, for a shell script

```console
$ visimark eval docs/tutorial/order.md --get tax.gross_total
194.34
```

Nothing else on stdout. This is the form to pipe.

`--get` takes `sheet.name`, or a bare `name` when it is unambiguous. An unknown
name exits `2` — "your request did not make sense" — which a script should treat
differently from `1`.

### Structured output

```json
{
  "command": "eval",
  "visimark": "0.1.5",
  "status": "ok",
  "file": "docs/tutorial/order.md",
  "values": {
    "order.net_total": "158",
    "order.line_count": "3",
    "order.avg_line": "52.67",
    "tax.gross_total": "194.34",
    "order.Net": ["50", "60", "48"]
  },
  "assertions": [
    {
      "sheet": "tax",
      "source": "assert gross_total >= order.net_total",
      "holds": true,
      "operands": { "gross_total": "194.34", "order.net_total": "158.00" },
      "substituted": "194.34 >= 158.00"
    }
  ],
  "charts": []
}
```

Three things to notice:

**Quantities are decimal strings, not JSON numbers.** `"158"`, not `158`. This
is on purpose. JSON numbers are IEEE floats, and money is not. Parse them with a
decimal library, or keep them as strings.

**A column is an array.** A scalar is a single string.

**Assertions come with the values filled in.** `substituted` is the assertion
with each name replaced by what it evaluated to. A monitoring script can report
*why* a claim failed, not just that it did.

`eval` exits `1` when an assertion is false — and still prints the values first.

### Why this matters: one source of truth

Normally a number that both a person and a machine need lives twice: once in a
document for the person, once in a config file for the machine. The two drift,
and nobody notices until something breaks.

`eval` removes the second copy. The document a person reads *is* the thing the
machine reads. Three real shapes of this:

**A CI shard matrix.** The test-suite timings live in a table someone can read,
with an assertion that no suite may cost more than double the average. A
packaging script calls `eval --get suite.total_seconds` and builds the matrix.
There is no YAML file to forget to update. See
[`example-ci-sharding.md`](example-ci-sharding.md).

**An agent spending gate.** A run ledger has a budget scalar and one row per
tool call, with `assert spent <= budget`. The harness calls
`eval --get calls.spent` **before** dispatching each call. The agent doing the
spending is not the actor doing the accounting. See
[`example-agent-budget.md`](example-agent-budget.md).

**A capacity decision.** A budget document derives the maximum affordable number
of Kubernetes worker nodes from the cost of everything else. The cluster size is
not an independently maintained configuration value any more; it is a
consequence of the budget, and it is re-derived every time the budget changes.
See [`example-executable-documentation.md`](example-executable-documentation.md).

### What a script should not depend on

- **The human text output.** Its layout is for people. Use `--json`.
- **Key order in the JSON.**
- **Findings being absent.** Check the exit code.

## 24. Working with an AI agent

This format was designed with agents in mind, and the reason is narrow and
specific.

An agent is **reliable at writing formulas**. `Net = Qty * Rate` is language, and
language is what it is good at.

An agent is **unreliable at arithmetic**. `50.00` is a guess that looks like a
fact, and it looks equally like a fact when it is wrong.

Write the formula instead of the number, and the number stops being a claim. It
becomes a derivation: reviewable in a diff, re-runnable, enforceable in CI. The
agent writes, VisiMark verifies, Git records the result.

### The skill file

[`skills/visimark/SKILL.md`](../skills/visimark/SKILL.md) is an agent skill for
authoring and verifying these documents. Copy it to `~/.claude/skills/visimark/`
to install it.

### The one rule to give an agent

**Never write a number you calculated yourself.** If a number follows from other
numbers, it belongs in a `vmark` block as a rule, and the tool writes the value.

### The rationalizations to refuse

These are the excuses that show up in practice — from agents and from people.

| Excuse | Reality |
|---|---|
| "The arithmetic is trivial, I will just write 4800" | Trivial arithmetic is still wrong sometimes, and the value stops being reviewable. Write the rule. |
| "`check` passed, so the document is correct" | `check` passes on a document with no formulas. Change an input and watch it break. |
| "I will add the formulas after the prose reads well" | You will forget, and nothing will tell you. Table, block, anchors, then prose. |
| "A totals row is more readable" | It breaks the rectangle. Totals are scalars reached through anchors. |
| "I will just fix that one cell by hand" | That cell is an output. Change the input or the rule and run `fmt`. |
| "The document already has numbers, I will write the same rules by hand" | Run `infer` first. Hand-authoring re-does its work and can introduce the exact mistake the tool exists to catch. |
| "The date format is obvious from context" | `11/12/2026` is two different dates. |
| "I will widen the anchor to get more decimals" | The anchor is an output. Change the binding's `precision N`. |

### The review loop

1. The agent writes the table, the block, the anchors and the prose — in that
   order.
2. It runs `visimark fmt` to fill in every computed value.
3. It changes one input, confirms `check` starts failing, and puts the input
   back. (Chapter 5.)
4. You review the diff: inputs, rules and assertions. Not the arithmetic.
5. CI runs `check` on every commit afterwards.

Step 4 is the change worth having. Reviewing an agent's arithmetic is slow and
unreliable. Reviewing an agent's *inputs and rules* is fast, and it is a
question you can actually answer.

## 25. In the editor

The CLI is the product, and everything works without an editor. But there is a
language server wrapping the same engine, and a VS Code client for it.

What you get:

- **Live diagnostics** — the findings from chapter 18, as you type.
- **`fmt` behind format-on-save** — using the editor's own setting, so it
  behaves like every other formatter you have.
- **Quick fixes** — for the findings that have one.
- **Inlay hints** — the computed value shown next to a formula, without touching
  the bytes of your file.
- **CodeLens and hover.**

At the time of writing, the extension is not on a marketplace. Build it from a
clone:

```console
$ bun run vscode-install     # build, package and install
$ bun run vscode-uninstall   # remove it
```

Reload the window afterwards. Both targets need the `code` CLI on your PATH.

The design is written up in
[`visimark-editor-plugins-design.md`](visimark-editor-plugins-design.md).

There is also a browser playground — [`playground.html`](playground.html) — that
runs the real engine on a document you edit in the page, with a live preview and
a knowledge panel. It is the fastest way to try something without installing
anything.

---

# Part 7 — Putting it together

## 26. Capstone: a quote, end to end

Now build a real document from nothing, using everything. The finished file is
[`tutorial/capstone.md`](tutorial/capstone.md). It is a consulting quote with
line items, VAT, a payment schedule derived from the total, and a reconciliation
that proves the instalments add up.

Follow along. Every command is shown.

### Step 1 — the table, inputs only

The header is written for the reader, not for the tool. Do not rename it.

```markdown
| Stage            | Effort (man-days)    |    Rate |   Net |   VAT | Gross |
|------------------|---------------------:|--------:|------:|------:|------:|
| Discovery        |                    6 |  900.00 |  0.00 |  0.00 |  0.00 |
| Schema mapping   |                   14 |  850.00 |  0.00 |  0.00 |  0.00 |
| Migration runs   |                    9 |  850.00 |  0.00 |  0.00 |  0.00 |
| Cutover support  |                    4 | 1100.00 |  0.00 |  0.00 |  0.00 |
```

Three inputs, three placeholders. Leave room in the computed columns so the
table still lines up after `fmt`.

### Step 2 — the block

````markdown
```vmark #lines
"Effort (man-days)" is days

vat_rate = 23%

Net   = days * Rate
VAT   = ROUND(Net * vat_rate, 2)
Gross = Net + VAT

effort_total = SUM(days)
net_total    = SUM(Net)
vat_total    = SUM(VAT)
gross_total  = SUM(Gross)
day_rate_avg precision 2 = net_total / effort_total
```
````

Four decisions are visible here, and each one is a chapter you have read:

- The alias (chapter 15) lets the header stay as written.
- `ROUND(…, 2)` on VAT (chapter 14) keeps money at two decimals, as a stated
  decision rather than an accident of widths.
- `day_rate_avg` divides, so it declares its width (chapter 14).
- Every total is a scalar, not a row (chapter 8).

### Step 3 — the prose, with anchors

```markdown
The engagement is **0**<!--vmark=lines.effort_total--> man-days at an
average of **0.00**<!--vmark=lines.day_rate_avg--> PLN per day. Net of tax it
comes to **0.00**<!--vmark=lines.net_total--> PLN. VAT at 23% adds
**0.00**<!--vmark=lines.vat_total--> PLN, giving a total of
**0.00**<!--vmark=lines.gross_total--> PLN gross.
```

Currency stays outside the anchors (chapter 9).

### Step 4 — the schedule, a second sheet

````markdown
| Milestone        | Share | Amount | Due        |
|------------------|------:|-------:|------------|
| Signature        |   25% |   0.00 | 2026-10-01 |
| Schema sign-off  |   45% |   0.00 | 2026-11-16 |
| Cutover accepted |   30% |   0.00 | 2027-01-15 |

```vmark #schedule
Amount = ROUND(Share * lines.gross_total, 2)

covered  = SUM(Amount)
share_sum precision 2 = SUM(Share)

assert share_sum == 1
```
````

`lines.gross_total` crosses sheets and is qualified (chapter 10). Dates are ISO
(chapter 13). The assertion says the shares must be a whole (chapter 16).

### Step 5 — the reconciliation, a sheet with no table

````markdown
```vmark #recon
invoiced  = lines.gross_total
scheduled = schedule.covered
variance  = scheduled - invoiced

assert |variance| <= 0.05
```
````

Rounding each instalment can leave a few grosz of remainder. The tolerance is
written down where a reviewer can argue with it, instead of being assumed.

### Step 6 — fill it in

```console
$ visimark fmt capstone.md
capstone.md: updated 15 cells, 9 anchors

$ visimark check capstone.md
capstone.md

  0 problems (0 stale, 0 errors)
```

### Step 7 — prove it (do not skip this)

Change one input. Raise the schema-mapping effort from 14 days to 16:

```console
$ visimark check capstone.md
capstone.md

  STALE   lines.Net       · Schema mapping         11900.00 ≠ 13600.00   days * Rate
  STALE   lines.VAT       · Schema mapping          2737.00 ≠ 3128.00    ROUND(Net * vat_rate, 2)
  STALE   lines.Gross     · Schema mapping         14637.00 ≠ 16728.00   Net + VAT
  STALE   lines.effort_total                             33 ≠ 35         SUM(days)
  STALE   lines.net_total                          29350.00 ≠ 31050.00   SUM(Net)
  STALE   lines.vat_total                           6750.50 ≠ 7141.50    SUM(VAT)
  STALE   lines.gross_total                        36100.50 ≠ 38191.50   SUM(Gross)
  STALE   lines.day_rate_avg                         889.39 ≠ 887.14
  STALE   schedule.Amount · Signature               9025.13 ≠ 9547.88    ROUND(Share * lines.gross_total, 2)
  STALE   schedule.Amount · Schema sign-off        16245.23 ≠ 17186.18   ROUND(Share * lines.gross_total, 2)
  STALE   schedule.Amount · Cutover accepted       10830.15 ≠ 11457.45   ROUND(Share * lines.gross_total, 2)
  STALE   schedule.covered                         36100.51 ≠ 38191.51   SUM(Amount)
  STALE   recon.invoiced                           36100.50 ≠ 38191.50
  STALE   recon.scheduled                          36100.51 ≠ 38191.51
  STALE   8 prose anchors bound to the values above

  22 problems (22 stale, 0 errors)
```

Twenty-two numbers depend on that one input. In a plain Markdown quote, all
twenty-two would still say the old value, and the document would render
perfectly.

Run `visimark fmt` and all twenty-two move together, in one small diff.

### Step 8 — watch an assertion earn its keep

Now break something an arithmetic check alone would not catch. Change the last
milestone's share from 30% to 35%:

```console
$ visimark check capstone.md
capstone.md

  STALE   schedule.Amount · Cutover accepted       10830.15 ≠ 12635.18   ROUND(Share * lines.gross_total, 2)
  STALE   schedule.covered                         36100.51 ≠ 37905.54   SUM(Amount)
  STALE   recon.scheduled                          36100.51 ≠ 37905.54
  STALE   recon.variance                               0.01 ≠ 1805.04
  STALE   3 prose anchors bound to the values above

  ASSERT  #schedule       share_sum == 1
          1.05 == 1   is false

  ASSERT  #recon          |variance| <= 0.05
          |1805.04| <= 0.05   is false

  9 problems (7 stale, 2 errors)
```

This is the important difference. `fmt` would happily repair all seven `STALE`
findings, and the document would then be internally consistent — and still
wrong, because the shares add to 105% and the schedule over-collects by 1805.04
PLN.

The two assertions survive `fmt` and keep failing. They are the part of the
document that says what *should* be true, rather than what is.

### Step 9 — put it in CI

```yaml
- uses: michal-niedzwiedzki/visimark@v0.1.5
  with:
    files: "docs/**/*.md"
```

### Step 10 — read a number back out

```console
$ visimark eval capstone.md --get lines.gross_total
36100.50
```

You are done. That document now computes itself, states its own invariants,
fails a build when it drifts, and answers a script.

## 27. What VisiMark refuses to do

Knowing the limits saves you from fighting them.

**Where a value could mean two things, it errors rather than guesses.** Dates are
ISO only. Thousands separators are refused. A column mixing `$` and `€` is an
error, not a sum. A name bound twice is an error, not an overwrite.

**There are no booleans in cells.** A stored value is a number, a date or a
string.

**There is no plugin architecture, and there will not be one.** A document's
numbers depend on its own text and the version of VisiMark reading it, and on
nothing else: no extension modules, no config file, no environment, no network,
no clock.

This is the most important refusal. Host-supplied functions would produce
documents whose arithmetic cannot be checked from the document — which is the one
thing this format exists to prevent. When the builtin vocabulary is too small,
the answer is a new primitive in the engine, readable and runnable by everyone.
When a value genuinely comes from outside, it belongs in an input column where a
human wrote it down.

This makes the format **smaller**, not only stricter. There is no locale, no
configuration, and no rule for what a bare `/` means in a date.

**It is not a spreadsheet replacement.** No grid, no cell styling, no
presentation layer, no Excel compatibility, no attempt at Excel's function
library. Use a spreadsheet when what you want is a spreadsheet.

Use VisiMark when what you want is a **document**: plain text, readable without
the tool, reviewable in an ordinary pull request, writable by a human or an
agent — with numbers that can be checked on every commit.

### Asking for something new

Requests to grow the vocabulary, and proposals for any other language or tooling
change, go through
[`vocabulary-catalogue.md`](vocabulary-catalogue.md), which records every one and
the decision on it. The review process is
[`issue-runbook.md`](issue-runbook.md).

## 28. Where to go next

### Reference

| Document | What it answers |
|---|---|
| [`ci.md`](ci.md) | Protect your Markdown numbers with CI — the Action, globs, annotations, pinning and rollout |
| [`cli-reference.md`](cli-reference.md) | Every command, option, exit code and finding, in tables |
| [`function-reference.md`](function-reference.md) | What each of the thirteen builtins does, with examples that run in CI |
| [`visimark-design.md`](visimark-design.md) | The normative specification, the deferred work, and the known tensions |

Or ask the tool: `visimark ref NAME`.

### Worked examples to read

| Document | Why read it |
|---|---|
| [`example-invoice.md`](example-invoice.md) | A complete self-computing B2B invoice. Its appendix explains each mechanism. |
| [`example-invoice-drift.md`](example-invoice-drift.md) | The same invoice after one input changed and nothing else. 26 findings, each walked through. |
| [`example-quote-plain.md`](example-quote-plain.md) | A quote with no VisiMark in it at all — the `infer` path, start to finish. |
| [`example-charts.md`](example-charts.md) | Generated chart artifacts. |
| [`example-structural-check.md`](example-structural-check.md) | An engineering calculation, and a transposed digit caught before the framer sees it. |
| [`example-ci-sharding.md`](example-ci-sharding.md) | A document a build tool reads. |
| [`example-agent-budget.md`](example-agent-budget.md) | A spending cap an agent cannot talk itself out of. |
| [`example-executable-documentation.md`](example-executable-documentation.md) | A capacity decision that stopped being a second source of truth. |

### Try it without installing

[`playground.html`](playground.html) runs the real engine in your browser, with
a live preview and a knowledge panel.

### The five things worth remembering

1. **Never write a number that another number implies.** Write the rule.
2. **A green check proves agreement, not derivation.** Change an input and watch
   it break.
3. **Never hand-edit an output.** Change the input or the rule, then `fmt`.
4. **`fmt` repairs stale values and nothing else.** Every other finding is a
   question for a person.
5. **Look functions up.** `visimark ref NAME`. Do not guess.

<!--vmark:no-formulas-->
