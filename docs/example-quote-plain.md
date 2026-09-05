# Training programme — quote TQ-2026-0417

**From:** Northaven Learning, ul. Krótka 14, 30-001 Kraków, NIP PL7788990011
**To:** Kestrel Systems s.r.o., Vodičkova 12, 110 00 Praha, DIČ CZ24681012

**Issued:** 2026-09-04 &nbsp;&nbsp; **Valid until:** 2026-10-04

## Programme

| Module            | Format   | Seats |    Fee |  Revenue | Materials | Delivered |
|-------------------|----------|------:|-------:|---------:|----------:|----------:|
| Foundations       | workshop |    24 | 450.00 | 10800.00 |    864.00 |  11664.00 |
| Advanced patterns | workshop |    12 | 650.00 |  7800.00 |    624.00 |   8424.00 |
| Coaching          | 1:1      |     6 | 900.00 |  5400.00 |    432.00 |   5832.00 |
| Assessment        | async    |    30 | 120.00 |  3600.00 |    288.00 |   3888.00 |

The programme seats **72** people across four modules. Teaching revenue comes to
**27600.00** PLN, and printed and hosted materials are charged at 8% of that,
adding **2208.00** PLN — a delivered value of **29808.00** PLN. The average fee
per seat is **530.00** PLN.

## Payment schedule

| Stage      | Share |   Amount | Due        |
|------------|------:|---------:|------------|
| Kickoff    |   25% |  7452.00 | 2026-10-15 |
| Midpoint   |   50% | 14904.00 | 2026-11-30 |
| Completion |   25% |  7452.00 | 2027-01-15 |

The three instalments account for **29808.00** PLN, payable within 14 days of
each date above.

---

## Appendix — what `visimark infer` makes of this

Everything above is ordinary Markdown, and none of it is checked. The numbers
were typed by a person, and they agree with each other only because that person
was careful once. There is no formula anywhere in this file.

`visimark infer` is for a document in exactly that state. It reads the tables and
the prose, works out which rules reproduce the numbers already there, and prints
them:

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

**Rules are found by exact verification, not by fitting.** A candidate either
reproduces every cell of its column, at that column's own precision, or it is
not a candidate. `Revenue = Seats * Fee` reproduces all four rows.
`Materials = Revenue * 0.08` has its constant solved from the first row and then
checked against every remaining one — a constant that satisfies only the row it
came from is not a finding. Nothing here is a score or a threshold.

**The result is a set, not a list of findings.** `Delivered = Revenue + Materials`
fits, and so does `Materials = Delivered - Revenue`; taking both would emit a
document that fails `check` with a `CYCLE`. Selection rejects any rule that
closes a cycle with the ones already accepted, which is why `Seats` and `Fee`
come out as inputs rather than as `Revenue / Fee` and `Revenue / Seats`. Those
fit too. They are the same arithmetic read backwards.

**Constants are detected and never named.** The report says that `0.08` also
appears as `8%` in the sentence under the table, and stops there. Matching the
two forms is reliable; concluding that the constant is therefore *called*
`materials_rate` is a guess about meaning, and this tool does not guess.

**Scalars are named from the column and the reduce, mechanically.**
`SUM(Revenue)` becomes `revenue_total` and `AVG(Fee)` becomes `fee_avg`. Reading
the surrounding sentence for a nicer name — "teaching revenue" becoming
`teaching_revenue` — reads better and is another guess. The boring scheme is
predictable, and renaming is one keystroke.

**A figure in prose is what makes a scalar worth proposing.** The reduces that
match nothing a human wrote down are discarded: `MAX(Fee)` and `COUNT(Seats)` are
computable, but no sentence in this quote claims them, so no binding is invented
for them. A scalar is anchored at the first figure that follows its own table,
and only once — which is why the second sentence stating the delivered value,
under the schedule, binds `amount_total` rather than repeating `delivered_total`.

**"Also fits, not proposed" is not padding.** `Delivered = Revenue * 1.08` and
`Delivered = Materials * 13.5` each reproduce the column exactly. They lose to
`Delivered = Revenue + Materials` because a rule over materialised columns beats
one that introduces a constant: every intermediate stays a number the reviewer
can see. Listing the losers is what makes the proposal reviewable.

**The tables have no names, so the tool mints them.** `#unnamed1` and `#unnamed2`
are placeholders, and they read as placeholders, which is the point — a generated
`#programme` would read as a name somebody chose. The id binds once, at write
time, and renaming it afterwards is an ordinary edit.

### What `--write` inserts

`visimark infer docs/example-quote-plain.md --write` inserts a block after each
table and an anchor after each matched figure. It never rewrites an existing
byte, so the prose, the headings and every input column survive untouched:

````markdown
```vmark #unnamed1
Revenue   = Seats * Fee
Materials = Revenue * 0.08
Delivered = Revenue + Materials

seats_total     = SUM(Seats)
revenue_total   = SUM(Revenue)
materials_total = SUM(Materials)
delivered_total = SUM(Delivered)
fee_avg         = AVG(Fee)
```
````

The sentence under the table keeps its words and gains invisible comments:

```markdown
The programme seats **72**<!--vmark=unnamed1.seats_total--> people across four
modules.
```

`visimark check` reports `0 problems` on the document as committed, and that
means nothing at all: there is nothing in it to disagree with. It says so —
`no rules found — try visimark infer …` sits under the count, because a green
check on a document with no rules is a question, not an answer. Run it against
the document `--write` leaves behind and the same `0 problems` is a claim.
Change one `Seats` figure there and it stops being true — in both tables at once, because
the schedule reads the delivered total.

### The half that matters more

A rule that fits every row but one is not a failed inference. It is the tool
saying the document has a wrong number in it, to someone who has adopted nothing
and learned no syntax. Transpose two digits in the `Delivered` column and ask
again:

```console
$ sed -i 's/5832.00 |/5823.00 |/' quote.md
$ visimark infer quote.md
  near-miss — not proposed
    Delivered = Revenue + Materials           3/4 rows
      row 3  Coaching
      cell 5823.00, rule gives 5832.00        differs by 9.00
```

That is an excerpt: `Delivered` is now the only column without a rule, and the
sentence stating the delivered value no longer matches any total, so that anchor
is not proposed either. Every other rule in the document still holds.

A near-miss is never proposed and never written, even under `--write`. It is
reported, with the row named and the difference given, and what to do about it is
the reader's decision.
