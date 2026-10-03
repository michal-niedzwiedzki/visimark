# Sweep a Markdown model with `simulate`

**From one what-if to every what-if: choose the levers, ask for readings, read
them, and publish them from CI.**

This guide is about one job: turning a checked document into a model you can
sweep. You say which numbers may vary and how far, you say which readings you
want, and `visimark simulate` asks every question and prints the answers. It
writes nothing.

It is written for people who already have a document that `visimark check`
passes. If you do not, start with chapters 1 to 9 of the
[tutorial](tutorial.md). Chapters 29 and 30 of the tutorial cover `param` and
scenarios; this guide repeats only what the sweep needs.

The language is kept simple on purpose, so that it reads the same way for
everyone.

Every `visimark` output here is a real transcript of the document in
[`simulate/conference.md`](simulate/conference.md), or of a copy of it with one
line changed. They were captured from the build that introduced `simulate`,
which is newer than `0.1.11`, the latest release when this guide was written.
Nothing is invented. Where a long output is shortened, the text says so.

## How to read this

There are 26 short chapters in six parts. Part 2 and Part 3 are the design
work. Part 4 is the reading. Read them in order the first time.

| Part | Chapters | What you get |
|---|---|---|
| 1. Why sweep | 1–3 | The case, and the four pieces |
| 2. Designing the domain | 4–10 | Levers, domains, lattices, and what "works" means |
| 3. Designing the report | 11–14 | Which readings to ask for, and where |
| 4. Running and reading | 15–24 | Every report, explained, and what to do next |
| 5. Into CI | 25 | The short version; the long one is in [`ci.md`](ci.md) |
| 6. Wrapping up | 26 | A checklist |

---

# Part 1 — Why sweep

## 1. The question that comes in families

Here is a conference budget. Two hundred and fifty people, eighty euros a
ticket, two sponsors. The document checks. It says the day makes **6975.00**
EUR.

Then the organisers ask the real question:

> What is the cheapest ticket we can sell and still break even? Does it depend
> on how many people come? How many sponsors do we need?

That is not one what-if. With four attendance levels, four prices and four
sponsor counts it is sixty-four what-ifs.

You could ask them one at a time. `eval --scenario` answers one question
without editing the document (tutorial chapter 30). Sixty-four JSON files and
sixty-four runs later you have the answers — in a shell script that lives next
to the document, that nobody reviews, and that silently goes stale the day
someone adds a cost line.

`simulate` puts the question in the document. The document says which values to
try and which readings it wants. One command asks every question, with the
document's own rules, and prints the readings.

## 2. What `simulate` proves, and what it does not

**It proves that each answer follows from the document.** Every question is
evaluated exactly the way `eval --scenario` would evaluate it: the same rules,
the same rounding, the same assertions. A `simulate` value and an `eval
--scenario` value for the same question are equal.

**It does not choose for you.** `best` names the question that maximises a
value among the ones it asked. It is a ranking, not a recommendation.

**It does not look between the points.** A sweep visits the values you list and
no others. If the plan breaks at 250 people and your sweep jumps from 200 to
300, the sweep will not tell you.

**It does not check the inputs.** A wrong catering price gives a wrong sweep,
exactly as it gives a wrong `check`.

**It writes nothing.** No cell, anchor or chart changes. To adopt what a sweep
found, you edit a default and run `fmt`, and that is a normal diff for review.

## 3. The four pieces

A sweep needs four things, and three of them you may already have.

| Piece | What it says | Where it lives |
|---|---|---|
| `param` | This number is an assumption. | a `vmark` block |
| `in [...]` and `lattice` | These are the values worth trying. | the `param` line |
| `assert` | This is what "the plan works" means. | a `vmark` block |
| `report` | These are the readings I want. | a sheet of its own, usually |

The rest of this guide takes them in that order.

---

# Part 2 — Designing the domain

## 4. Start from a document that checks

This is the whole example. It is in the repository as
[`simulate/conference.md`](simulate/conference.md).

````markdown
## The event

```vmark #event
param attendees   integer in [100, 400] lattice 100 = default 250
param ticket      precision 2 in [60, 120] lattice 20 = default 80.00
param sponsors    integer in [0, 3] lattice 1 = default 2
param sponsor_fee precision 2 = default 5000.00

venue_capacity = 300

sponsor_income = sponsors * sponsor_fee
revenue        = attendees * ticket + sponsor_income
profit         = revenue - costs.total
sponsor_share precision 3 = sponsor_income / revenue

assert attendees <= venue_capacity
assert profit >= 0
assert sponsor_share <= 50%
```

## Costs

| Item     |   Fixed |  Each |     Cost |
|----------|--------:|------:|---------:|
| Venue    | 6000.00 |  0.00 |  6000.00 |
| Speakers | 4500.00 |  0.00 |  4500.00 |
| AV       | 2500.00 |  0.00 |  2500.00 |
| Catering |    0.00 | 32.00 |  8000.00 |
| Badges   |  400.00 |  6.50 |  2025.00 |

```vmark #costs
Cost = Fixed + Each * event.attendees

total = SUM(Cost)
```

With **250**<!--vmark=event.attendees--> people at **80.00**<!--vmark=event.ticket-->
EUR a ticket the day costs **23025.00**<!--vmark=costs.total--> EUR and makes
**6975.00**<!--vmark=event.profit--> EUR.

## Readings

```vmark #readings
report gates
report forbidden
report best scalar event.profit direction max among feasible
report best scalar event.ticket direction min among feasible
report deltas on event.profit, event.sponsor_share
```

```vmark #ledger
report ledger assertions broken
```
````

It checks clean, like any other document:

```console
$ visimark check conference.md
conference.md

  0 problems (0 stale, 0 errors)
```

**Get here first.** A sweep of a document that does not check is a sweep of
numbers nobody trusts. If `check` reports a problem in a value a report reads,
that report will not run at all (chapter 22).

The lines that make it sweepable are the `in`, `lattice` and `report` parts.
Remove them and the document says exactly the same thing: every `param` falls
back to its default, and `check`, `fmt` and `eval` give the same answers.

## 5. Choose the levers

A lever is a number someone will ask "what if?" about. Look for three kinds:

- **Numbers you decide.** The ticket price.
- **Numbers you hope for.** How many people come. How many sponsors sign.
- **Numbers someone else sets.** A supplier's rate, a tax rate, an exchange
  rate.

Each lever becomes a `param`. A `param` has a name, a width and a default:

```text
param ticket precision 2 = default 80.00
```

Now choose which levers to **sweep**. Not every `param` needs to move. Here,
`sponsor_fee` is a `param` because a reader may still ask about it with
`eval --scenario`, but it has no lattice, so the sweep holds it at its default.

A good rule: **sweep the levers your question is about, and hold the rest.**
"What is the cheapest ticket that works?" is about price, attendance and
sponsors. It is not about the sponsor fee, so the fee is held.

Every swept lever multiplies the size of the run (chapter 8). Three is plenty
for a first sweep. The battery example sweeps five.

Columns cannot be levers. A `param` is one number for the whole sheet. A
number that differs per row stays a table cell.

## 6. Draw the domain

A domain says which values a lever may take at all. It goes between the width
and the default:

```text
param attendees integer in [100, 400] = default 250
```

Read it aloud: *a whole number from 100 to 400, both ends included.*

There is no `precision` here because `integer` already says it: a whole number
has no decimals, so the param is `precision 0`. The same holds for `natural`
and `positive integer`. A lever that can take fractions, like `ticket`, still
declares its width.

The parts you can combine:

| You write | It means |
|---|---|
| `in [100, 400]` | from 100 to 400, both ends included |
| `in (0, 10)` | strictly between 0 and 10 |
| `in [0, 10)` | 0 included, 10 not |
| `integer` | whole numbers only (also `ℤ`) |
| `natural` | whole numbers, 0 or more (also `ℕ`) |
| `positive integer` | whole numbers, 1 or more (also `ℤ⁺`) |
| `positive` | any number above 0 |
| `in { 30%, 40%, 50% }` | exactly these values |

`integer` for anything you count: people, sponsors, hires, servers. A sweep
over `sponsors` that tried 1.5 would be nonsense.

**Draw the domain from the world, not from the sweep.** The domain is a claim
about what is possible. The venue's fire limit, a contract floor, a price range
the board approved. `check` holds the default to it:

```console
$ visimark check conference.md
conference.md

  NOTE    #event          · 3 assertions not verified (upstream errors)

  DOMAIN  event.attendees   default 450 is not in the domain of attendees: integer in [100, 400]

  1 problem (0 stale, 1 error)
```

That was the same file with `default 450`. The assertions are reported as not
verified because the value they read is broken.

A domain also limits what `eval --scenario` may ask. A scenario outside it is
refused before anything is evaluated (tutorial chapter 30).

## 7. Space the lattice

The domain says what is legal. The **lattice** says where the sweep looks. It
is the last clause before `= default`:

```text
param attendees integer in [100, 400] lattice 100 = default 250
param ticket    precision 2 in [60, 120] lattice 20 = default 80.00
param sponsors  integer in [0, 3] lattice 1 = default 2
```

The sweep starts at the low end and steps up to the high end:

| Lever | Points |
|---|---|
| `attendees` | 100, 200, 300, 400 |
| `ticket` | 60.00, 80.00, 100.00, 120.00 |
| `sponsors` | 0, 1, 2, 3 |

Five rules decide the points.

**It starts at the low end, not at zero.** `in [100, 400] lattice 100` visits
100, not 0. `integer in [3, 83] lattice 20` visits 3, 23, 43, 63 and 83.

**The step must land exactly on the far end.** The tool never drops the last
point to make a step fit:

```console
  TYPE    event.ticket      lattice step 25 does not reach the end of [60, 120]: 120 is not a multiple of 25 above 60
```

**An open end is not visited.** `in (0, 10) lattice 5` visits only 5.

**The default does not have to be a point.** 250 is not on the attendance
lattice, and that is fine. The sweep asks the default separately, as the
**base** question (chapter 15).

**It narrows nothing.** A scenario may still ask for 230 people. The lattice is
only the spacing the sweep uses.

### Choosing the step

Start coarse. Four or five points per lever show the shape of the answer. Then
narrow the domain around the interesting part and step finer, instead of
stepping finer everywhere.

Put a point on every boundary you care about. The venue holds 300, so 300 is a
point. If the lattice jumped from 250 to 350, the sweep could not tell you that
300 is exactly the limit.

The step must fit the width. `ticket` is `precision 2`, so `lattice 0.125` is
refused:

```console
  PRECISION event.ticket      lattice step 0.125 has 3 decimals; param ticket declares 2
```

A percent lever takes a percent step: `in [0%, 6%] lattice 2%`.

## 8. Count before you run

The questions are every combination of the lattice points, plus the base:

```text
4 attendance levels × 4 prices × 4 sponsor counts = 64, plus the base = 65
```

The first thing `simulate` prints is this count, before it asks anything:

```console
simulate: conference.md: 65 questions (3 lattice params)
```

Grids grow by multiplication, so they grow fast:

| Change | Questions |
|---|---|
| the example as written | 64 + 1 |
| attendance stepped by 50 instead of 100 (7 points) | 112 + 1 |
| also sweep `sponsor_fee` over `[3000, 7000] lattice 1000` (5 points) | 320 + 1 |
| the battery example: five levers | 576 + 1 |

There is no cap. A grid of a million questions will be asked, one at a time.
The count line is the warning, and the size is your decision. Each question is
a full evaluation of the document, so a few hundred run in seconds; a million
do not.

## 9. Say what "works" means, with `assert`

A question is **feasible** when every `assert` in the document holds. That is
the whole definition, so the assertions you write decide what every report
means by "works".

The example has three, and they are of three different kinds:

```text
assert attendees <= venue_capacity   # a physical limit
assert profit >= 0                   # a money rule
assert sponsor_share <= 50%          # a policy
```

Three things to know.

**Every assertion in the file counts.** Not only the ones near the reports. If
the document has an assertion you do not want to judge the sweep by, it is the
wrong document to sweep, or the wrong assertion.

**An assertion about a lever is fine.** `attendees <= venue_capacity` reads a
`param` directly. It turns the venue limit into a reading: the sweep will tell
you which attendance levels are out (chapter 17).

**Assert on values the document already shows.** `profit >= 0` reads
`profit`, which every reader of the document already sees. If a rule needs a
value the document does not compute, add that value as its own line first, so
a reader can see it too.

The default must pass. `check` verifies the assertions at the defaults, so a
document whose defaults break a rule fails `check` before it is ever swept.

## 10. Mistakes in the declaration, and what they report

Every one of these is found by `check`, at the line that declares it. Each was
produced by changing one line of the example.

| You wrote | `check` reports |
|---|---|
| `in [60, 120] lattice 25` | `TYPE    event.ticket      lattice step 25 does not reach the end of [60, 120]: 120 is not a multiple of 25 above 60` |
| `in { 60, 80, 100, 120 } lattice 20` | `TYPE    event.ticket      param ticket declares a lattice, but a set already lists its points` |
| `param sponsor_fee precision 2 lattice 1000 = …` | `TYPE    event.sponsor_fee  param sponsor_fee declares a lattice but no domain` |
| `natural lattice 1` | `TYPE    event.sponsors    param sponsors declares a lattice, but its domain has no upper bound` |
| `lattice 0.125` on a `precision 2` param | `PRECISION event.ticket      lattice step 0.125 has 3 decimals; param ticket declares 2` |
| `default 450` outside `[100, 400]` | `DOMAIN  event.attendees   default 450 is not in the domain of attendees: integer in [100, 400]` |

A set already lists its own points, so a sweep over `{ 30%, 40%, 50% }` is
simply not available yet. Use a range with a step where the values are evenly
spaced.

A broken lattice stops the whole file's sweep, because there is no grid to
build (chapter 22). The default, the domain and every formula that reads the
lever still check normally.

---

# Part 3 — Designing the report

## 11. Where reports live

A `report` line goes in a sheet block, a `vmark #id` block. It binds nothing
and stores nothing, the same as a `chart`.

You can put reports in the sheet whose values they read, but the example keeps
them apart:

````markdown
## Readings

```vmark #readings
report gates
report forbidden
report best scalar event.profit direction max among feasible
report best scalar event.ticket direction min among feasible
report deltas on event.profit, event.sponsor_share
```

```vmark #ledger
report ledger assertions broken
```
````

**A sheet of its own reads as a section of the document.** "Readings" is a
heading a reviewer can find. It also means the model sheets stay exactly what
they were before anyone asked for a sweep.

**The long report gets its own sheet.** The ledger prints one row per
question, 65 here. `simulate` prints sheets in document order, so putting the
ledger last keeps the short readings at the top of the output.

**One grid per file.** Every report sheet in a file reads the same questions.
Each question is evaluated once, however many reports read it.

`check` reads every `report` line, checks its options and resolves every name
in it. It never runs one. A report must be in a `#id` block; a document-scope
block is a `SHEET` error.

## 12. The five reports, and the question each answers

The list is closed. A document can ask for these five and nothing else, so a
Markdown file can never make the tool run code it does not ship.

| You want to know | Ask for | It prints |
|---|---|---|
| What happened in each question? | `report ledger assertions broken` | one row per question, with the rules it breaks |
| Which rule bites, and where first? | `report gates` | one row per `assert`: how often it holds and fails |
| Which lever values are out, whatever else I choose? | `report forbidden` | every lattice point at which no question works |
| Which question does best at one value? | `report best scalar X direction max among feasible` | the winning question, and its value |
| How far does a value move across the grid? | `report deltas on X, Y` | the base value, the lowest, the highest, and where |

A sensible first sheet is `gates`, `forbidden`, one `best` and one `deltas`,
with the ledger on its own. That is the example. Add more `best` lines for each
separate question you have: the example asks two, "most profit" and "cheapest
ticket".

The exact grammar:

| Report | Options |
|---|---|
| `ledger` | `[assertions broken]` |
| `deltas` | `[on REF {, REF}]` |
| `gates` | none |
| `best` | `scalar REF direction max\|min [among feasible]` |
| `forbidden` | none |

## 13. Choosing what `best` and `deltas` read

A `REF` names one scalar: `profit` in its own sheet, or `event.profit` from
anywhere. It cannot name a column.

**A lever is a scalar too.** `best scalar event.ticket direction min among
feasible` asks *what is the lowest ticket price at which some plan still
works?* Reading a lever directly is often the clearest way to ask about it.

**Almost always write `among feasible`.** Without it, `best` ranks every
question that could be computed, including the ones that break your rules. The
most profitable plan in this grid needs 400 people in a 300-seat venue.

**Name what `deltas` reads.** `report deltas` with no `on` covers every
non-param scalar of its own sheet. In a readings sheet, which has no scalars,
it prints a heading and nothing under it. In a model sheet it prints every
scalar, including constants that never move:

```text
  event.venue_capacity  base 300
    low   300  (0)  attendees=100 ticket=60.00 sponsors=0
    high  300  (0)  attendees=100 ticket=60.00 sponsors=0
```

So write `deltas on`, and name the values a reader will ask about.

A scalar that only a report reads is not reported as unused. The report counts
as a read.

## 14. Mistakes in a report line, and what they report

Each comes from changing one line of the example's `#readings` sheet.

A misspelt name, `report deltas on event.proift`:

```console
  UNDEF   readings.         unknown name `event.proift`
          did you mean `profit`?
```

A column, `report deltas on costs.Cost`:

```console
  TYPE    readings.         a report reads a scalar; costs.Cost is a column
```

A report the tool does not ship, `report heatmap`:

```console
  TYPE    readings.         unknown report `heatmap`; the reports are ledger, deltas, gates, best, forbidden
```

Options that do not fit, `direction lowest`:

```console
  TYPE    readings.         `report best` takes: scalar REF direction max|min [among feasible]
```

The same line twice:

```console
  DUP     readings.         report gates is declared twice in sheet readings
```

Two `deltas` lines with different names are not duplicates.

---

# Part 4 — Running and reading

## 15. The first run

```console
$ visimark simulate conference.md
```

The output comes in two streams, and they do different jobs.

**stderr is about the run.** Before anything is asked:

```console
simulate: conference.md: 65 questions (3 lattice params)
```

and after the last question, with the time the file took:

```console
simulate: conference.md: 2 of 2 sheets ran in 66 ms
```

The time covers the whole file: building the grid, asking every question and
printing every report. Reports are not timed one by one, because they share
the work. Each question is evaluated once and every report reads the same
answers, so one report's time would mostly be the others'. The time is only
on stderr, and stdout is the same on every run.

**stdout is the readings,** and nothing else. It starts with a header naming
the file, then each report sheet in document order, then each report in the
order written:

```text
==> conference.md <==
#readings

report gates

  …
```

Each report starts with its own line, as you wrote it, so a reader always knows
which question a block answers.

**Every question names itself by its lever values,** in declaration order:
`attendees=200 ticket=60.00 sponsors=2`. The question at the defaults is
called **base**. It is always asked, first, and it is never counted in the
grid's 64.

A lever prints at its width. A percent lever prints as a percent. A derived
value prints at its own width, so `sponsor_share` prints as `0.333`, not 33.3%.

The next five chapters read each report of the example's output in turn.

## 16. Reading `gates`

```text
report gates

  64 questions
  assert                       holds  fails  faulted  base   first failure
  attendees <= venue_capacity     48     16        0  holds  attendees=400 ticket=60.00 sponsors=0
  profit >= 0                     46     18        0  holds  attendees=100 ticket=60.00 sponsors=0
  sponsor_share <= 50%            57      7        0  holds  attendees=100 ticket=60.00 sponsors=2
```

One row per assertion, in document order. The counts are over the 64 grid
questions. `base` says how the assertion fares at the defaults. `first failure`
is the first question, in grid order, that breaks it.

Read it as *which rule bites most?* Here, break-even fails most often: 18
questions lose money. The venue fails 16, which is exactly one attendance level
times sixteen combinations of the other two. That pattern, a count that is a
whole slice of the grid, usually means one lever value is out entirely. The
next report confirms it.

`sponsor_share` fails only 7 times, all at low attendance. Too many sponsors and
too few tickets is a small corner of the plan, not a general risk.

## 17. Reading `forbidden`

```text
report forbidden

  attendees = 400  every question with it breaks an assertion
  39 of 64 questions are infeasible
```

`forbidden` lists every lattice point at which **every** question breaks some
assertion. No price and no number of sponsors can save it.

400 people do not fit in a 300-seat venue. That is not a surprise here, but in a
real model this is the report that finds the constraint nobody had written down
as one.

There are two honest answers, and they are different decisions:

- **The domain is wrong.** Nobody will sell 400 tickets for this venue. Change
  the domain to `[100, 300]` and the sweep stops spending a quarter of its
  questions on a plan that cannot happen.
- **The venue is the question.** Then price a larger venue as its own lever,
  and let the sweep tell you whether the extra seats pay for it.

`sponsors = 0` is *not* forbidden. Some plans work with no sponsors at all, so
no sponsorship is a risk, not a wall. If no point is forbidden, the report says
`nothing is forbidden`.

## 18. Reading `best`

```text
report best scalar event.profit direction max among feasible

  attendees=300 ticket=120.00 sponsors=3
  event.profit  26050.00  (+19075.00 against base)
  chosen from 25 feasible of 64 questions

report best scalar event.ticket direction min among feasible

  attendees=200 ticket=60.00 sponsors=2
  event.ticket  60.00  (-20.00 against base)
  chosen from 25 feasible of 64 questions
  3 questions tie; the first in grid order is shown
```

The first line is the winning question. The second is the value, and how far
it moved from the base. The third says how many questions competed.

The second answer is the one the organisers asked for: **60 euros works**, with
200 people and two sponsors.

**Read the tie line.** Three questions reach 60.00 euros. `best` shows the
first in grid order and tells you the others exist. A tie means the lever you
ranked does not decide the answer alone: here, 60 euros works with 200 people and
two sponsors, or with 300 people and two or three. The ledger (chapter 20) shows which.

**`best` is the best of what was asked.** The cheapest *lattice* price is
60.00. Whether 55 would also work is a question the sweep did not ask. Narrow
the domain, step finer, and sweep again.

**`best` does not say how much room is left.** The 60-euro plan makes a profit
of 900 euros (chapter 23 shows how to read that). A winner at the edge of a
rule is a winner with no margin.

## 19. Reading `deltas`

```text
report deltas on event.profit, event.sponsor_share

  event.profit  base 6975.00
    low   -11250.00  (-18225.00)  attendees=100 ticket=60.00 sponsors=0
    high   34200.00  (+27225.00)  attendees=400 ticket=120.00 sponsors=3
  event.sponsor_share  base 0.333
    low   0.000  (-0.333)  attendees=100 ticket=60.00 sponsors=0
    high  0.714  (+0.381)  attendees=100 ticket=60.00 sponsors=3
```

For each value: its base, then the lowest and the highest it reaches across the
grid, the change from base in brackets, and the first question that gets there.

Read it as *how exposed is this number?* Profit swings from an 11250-euro loss
to a 34200-euro gain. That spread is the size of the bet the organisers are
making.

**`deltas` ranges over every question, feasible or not.** The 34200 high needs
400 people, which `forbidden` just ruled out. That is on purpose: `deltas`
shows how far a value *can* move, and `best … among feasible` shows how far it
can move inside the rules. Read the two together.

## 20. Reading the `ledger`

The ledger is one row per question, base first. This is the start of it and a
slice of the end; the 28 rows between were left out here.

```text
report ledger assertions broken

  question  attendees  ticket  sponsors  feasible  broken
  base            250   80.00         2  yes
  1               100   60.00         0  no        profit >= 0
  2               100   60.00         1  no        profit >= 0
  3               100   60.00         2  no        profit >= 0; sponsor_share <= 50%
  4               100   60.00         3  no        sponsor_share <= 50%
  5               100   80.00         0  no        profit >= 0
  6               100   80.00         1  no        profit >= 0
  7               100   80.00         2  no        sponsor_share <= 50%
  8               100   80.00         3  no        sponsor_share <= 50%
  9               100  100.00         0  no        profit >= 0
  10              100  100.00         1  no        profit >= 0
  11              100  100.00         2  yes
  12              100  100.00         3  no        sponsor_share <= 50%
  13              100  120.00         0  no        profit >= 0
  14              100  120.00         1  no        profit >= 0
  15              100  120.00         2  yes
  16              100  120.00         3  no        sponsor_share <= 50%
  17              200   60.00         0  no        profit >= 0
  18              200   60.00         1  no        profit >= 0
  19              200   60.00         2  yes
  20              200   60.00         3  no        sponsor_share <= 50%
  …
  49              400   60.00         0  no        attendees <= venue_capacity; profit >= 0
  50              400   60.00         1  no        attendees <= venue_capacity
  51              400   60.00         2  no        attendees <= venue_capacity
  52              400   60.00         3  no        attendees <= venue_capacity
```

**Grid order is fixed.** Levers vary in the order they are declared, and the
last one changes fastest. So `sponsors` cycles 0 to 3 inside each price, and
price cycles inside each attendance level. A row number means the same question
every run.

The ledger is where you go when another report raises a question. Row 19 is the
60-euro plan from `best`. Row 20 is the same plan with a third sponsor, and it
fails: a third sponsor pushes the sponsor share over half. Rows 3 and 4 show
the same thing at 100 people. **More sponsorship can break a plan.** No other
report says that as plainly.

`feasible` is `yes`, `no` or `faulted` (the next chapter). Without
`assertions broken`, the ledger has no `broken` column.

## 21. Faulted questions

A question is **faulted** when something the readings need cannot be computed
for it. Division by zero at one corner of the grid is the usual cause.

Widen the attendance domain to start at zero, `integer in [0, 400] lattice
100`, and the grid gains a row of plans where nobody comes. With no sponsors
either, revenue is zero and `sponsor_share = sponsor_income / revenue` has no
value. The run still completes:

```text
  question  attendees  ticket  sponsors  feasible  broken
  base            250   80.00         2  yes
  1                 0   60.00         0  faulted   profit >= 0
  2                 0   60.00         1  no        profit >= 0; sponsor_share <= 50%
```

and `gates` counts the four faulted questions against the assertion that could
not be verified:

```text
  80 questions
  assert                       holds  fails  faulted  base   first failure
  attendees <= venue_capacity     64     16        0  holds  attendees=400 ticket=60.00 sponsors=0
  profit >= 0                     50     30        0  holds  attendees=0 ticket=60.00 sponsors=0
  sponsor_share <= 50%            57     19        4  holds  attendees=0 ticket=60.00 sponsors=1
```

A faulted question is a reading, not a failure of the command. `best` and
`deltas` leave it out. `forbidden` treats it like an infeasible one, so it now
adds `attendees = 0` to its list.

`check` did not object to this domain, and could not have: at the defaults
there is no division by zero. Only a sweep visits the corner. When you see
`faulted`, decide whether the corner is real. Here it is not, which is a good
reason to start the domain at 100.

## 22. Sheets that cannot start

If `check` finds an error in a sheet's `report` lines, or in a value one of its
reports reads, that sheet **cannot start**. Its heading prints with
`(cannot start)` under it, the rest of the file still runs, and stderr says
why. With the misspelt `deltas on event.proift`:

```console
$ visimark simulate conference.md
simulate: conference.md: 65 questions (3 lattice params)
==> conference.md <==
#readings
  (cannot start)
#ledger

report ledger assertions broken

  question  attendees  ticket  sponsors  feasible  broken
  …
simulate: conference.md: #readings cannot start: UNDEF: unknown name `event.proift`; did you mean `profit`?
simulate: conference.md: 1 of 2 sheets ran in 62 ms
$ echo $?
0
```

The ledger rows are left out above. The ledger sheet reads nothing that is
broken, so it ran in full.

A broken lattice is worse: there is no grid to build, so **every** report sheet
in the file is stopped, and the count line says `0 questions`:

```console
simulate: conference.md: 0 questions (3 lattice params)
==> conference.md <==
#readings
  (cannot start)
#ledger
  (cannot start)
simulate: conference.md: #readings cannot start: TYPE event.ticket: lattice step 25 does not reach the end of [60, 120]: 120 is not a multiple of 25 above 60
simulate: conference.md: #ledger cannot start: TYPE event.ticket: lattice step 25 does not reach the end of [60, 120]: 120 is not a multiple of 25 above 60
simulate: conference.md: 0 of 2 sheets ran in 22 ms
```

Both runs exit `0`. To make a sheet that cannot start fail the run, pass
`--fail-on-fault`:

```console
$ visimark simulate --fail-on-fault conference.md > /dev/null
simulate: conference.md: 65 questions (3 lattice params)
simulate: conference.md: #readings cannot start: UNDEF: unknown name `event.proift`; did you mean `profit`?
simulate: conference.md: 1 of 2 sheets ran in 64 ms
$ echo $?
1
```

The fix is always the same: run `visimark check` on the file and fix what it
says. A document that checks clean has no sheet that cannot start.

## 23. From a reading to a decision

A sweep points at a question. `eval --scenario` looks at that question in full.

`best` said 60 euros works with 200 people and two sponsors. Write that
question down as a scenario:

```console
$ cat cheapest.json
{ "attendees": "200", "ticket": "60.00", "sponsors": "2" }
$ visimark eval --scenario cheapest.json conference.md
event.attendees       200
event.ticket          60
event.sponsors        2
event.sponsor_fee     5000
event.venue_capacity  300
event.sponsor_income  10000
event.revenue         22000
event.sponsor_share   0.455
costs.total           21100
event.profit          900
costs.Cost            6000, 4500, 2500, 6400, 1700
scenario: cheapest.json
  event.attendees    200   scenario  (default 250)
  event.ticket       60    scenario  (default 80)
  event.sponsors     2     scenario  (default 2)
  event.sponsor_fee  5000  default
params:
  event.attendees   integer in [100, 400] lattice 100
  event.ticket      [60, 120] lattice 20
  event.sponsors    integer in [0, 3] lattice 1
```

Now the margin is visible: a profit of **900** euros, and a sponsor share of
45.5%, close to the 50% limit. That is a plan that works on paper and has
almost no room. The same plan with a third sponsor fails, as the ledger said:

```console
$ cat three.json
{ "attendees": "200", "ticket": "60.00", "sponsors": "3" }
$ visimark eval --scenario three.json conference.md --get event.sponsor_share
0.556
  ASSERT  #event   sponsor_share <= 50%
          0.556 <= 50%   is false under scenario (holds on defaults)
$ echo $?
1
```

### Adopting the answer

When the organisers decide, the decision goes into the document the normal
way: edit the defaults, run `fmt`, and commit the diff for review.

```text
param ticket      precision 2 in [60, 120] lattice 20 = default 60.00
```

`simulate` never does this for you. The defaults are the document, and a
person changes them.

## 24. Exit codes, and several files

| Code | `simulate` means |
|---|---|
| `0` | Every report sheet that could start printed its readings, **whatever its assertions found** |
| `1` | No file has a `report` statement, or a sheet could not start and you passed `--fail-on-fault` |
| `2` | A file could not be read, or the command line is wrong |

**A false assertion is a reading.** Infeasible questions are the point of a
sweep. A command that failed every time it found one would be useless, so
`simulate` exits `0` when 39 of 64 plans fail. This is the opposite of `check`,
on purpose.

**A file with no reports is skipped, not an error,** unless every file is like
that:

```console
$ visimark simulate notes.md
simulate: notes.md: no report statement
$ echo $?
1
```

With several files, each gets a `==> FILE <==` header on stdout, separated by
`---`, and stderr ends with a total. A file with no reports among files that
have them is only noted:

```console
$ visimark simulate notes.md conference.md 2>&1 >/dev/null
simulate: notes.md: no report statement
simulate: conference.md: 65 questions (3 lattice params)
simulate: conference.md: 2 of 2 sheets ran in 60 ms
simulate: 2 of 2 sheets ran across 2 files in 64 ms
$ echo $?
0
```

**`--progress`** writes `question i of N` to stderr while the run works. On a
terminal it rewrites one line. Anywhere else it prints a line at each tenth of
the run:

```console
$ visimark simulate --progress conference.md 2>&1 >/dev/null
simulate: conference.md: 65 questions (3 lattice params)
simulate: conference.md: question 7 of 65
simulate: conference.md: question 13 of 65
simulate: conference.md: question 20 of 65
simulate: conference.md: question 26 of 65
simulate: conference.md: question 33 of 65
simulate: conference.md: question 39 of 65
simulate: conference.md: question 46 of 65
simulate: conference.md: question 52 of 65
simulate: conference.md: question 59 of 65
simulate: conference.md: question 65 of 65
simulate: conference.md: 2 of 2 sheets ran in 64 ms
```

There is no time estimate while the run works. The elapsed time arrives on the
last line, once the file is done.

**There is no `--json`.** The readings are text for people:

```console
$ visimark simulate --json conference.md
visimark: simulate has no --json mode
$ echo $?
2
```

When a program needs one value from one question, `eval --scenario … --get` is
the machine interface, as in chapter 23.

---

# Part 5 — Into CI

## 25. Bake the sweep into the build

The short version. The full one, with the job summary, keeping the exit code,
artifacts and a diff against the base branch, is
[chapter 21 of the CI guide](ci.md#21-running-the-simulations-in-ci).

**`check` is the gate. `simulate` is a published reading.** Run `check` first,
and let it block the merge. Run `simulate` after it, so the readings sit where
a reviewer will see them.

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: michal-niedzwiedzki/visimark@vX.Y.Z   # a release that ships simulate
        with:
          files: "docs/**/*.md"

  sweep:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: michal-niedzwiedzki/visimark@vX.Y.Z
        with:
          command: simulate
          files: "models/*.md"
          args: --progress
```

`simulate` first ships in the release after `0.1.11`. `vX.Y.Z` stands for that
release or a later one.

Four things to know:

- **Do not make the sweep a gate.** It exits `0` when plans fail, because that
  is a reading. If one particular plan must keep working, that is a scenario:
  commit it as JSON and gate on `eval --scenario`, which exits `1` when an
  assertion is false. The CI guide shows this.
- **Point the glob at the documents that have reports.** A glob in which no
  file has one exits `1`, which almost always means the glob is wrong.
- **`--progress` is worth having in a log.** A long sweep then shows it is still
  working, a line at each tenth.
- **Pin the version.** The readings are text for people. Pinned, a change in
  them is a change in the document, not in the tool.

---

# Part 6 — Wrapping up

## 26. The checklist

Before you trust a sweep:

- [ ] The document checks clean. (Chapter 4.)
- [ ] Only the levers your question is about have a lattice. (Chapter 5.)
- [ ] Each domain describes the world, not the sweep. (Chapter 6.)
- [ ] Every boundary you care about is a lattice point. (Chapter 7.)
- [ ] You read the question count, and it is the size you meant. (Chapter 8.)
- [ ] The assertions say what "works" means, all of them. (Chapter 9.)
- [ ] `best` says `among feasible`, and `deltas` says `on`. (Chapter 13.)
- [ ] Any `forbidden` point and any `faulted` question has been explained.
      (Chapters 17 and 21.)
- [ ] The winning question was looked at in full with `eval --scenario`.
      (Chapter 23.)
- [ ] In CI, `check` gates and `simulate` publishes. (Chapter 25.)

### The five things worth remembering

1. **The defaults are the document.** A sweep is a view of it, and writes
   nothing. A decision goes back in as a reviewed edit.
2. **The assertions define "works".** Every report reads them. Write them
   before you read a single report.
3. **A sweep only sees its points.** Put a point on every boundary, and narrow
   before you step finer.
4. **`best` is a ranking, not a margin.** Look at the winner with
   `eval --scenario` before you act on it.
5. **A false assertion is a reading.** `simulate` exits `0`. Keep `check` as
   the gate.

### Where to go next

| Document | What it answers |
|---|---|
| [`simulate/conference.md`](simulate/conference.md) | The example from this guide, to run yourself |
| [`tutorial.md`](tutorial.md) | Chapters 29–31: `param`, scenarios and `simulate`, on a runway plan |
| [`example-battery-storage.md`](example-battery-storage.md) | A larger model: five levers, 577 questions, four lender covenants, every report |
| [`ci.md`](ci.md) | Chapter 21: the sweep in CI, in full |
| [`cli-reference.md`](cli-reference.md) | Every command, option and exit code |
| [`design/add-a-simulate-command-spec.md`](design/add-a-simulate-command-spec.md) | The exact contract: questions, output layout, every report's body |

<!--vmark:no-formulas-->
