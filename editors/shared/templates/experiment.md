# Experiment — checkout button copy

**Started:** 2026-01-12 &nbsp;&nbsp; **Ended:** 2026-01-26

**Question:** does "Pay now" convert better than "Continue"?

## Results

| Variant        | Visitors | Conversions |   Rate |
|----------------|---------:|------------:|-------:|
| A — "Continue" |     4120 |         186 | 0.0451 |
| B — "Pay now"  |     4098 |         221 | 0.0539 |

```vmark #variants
Rate precision 4 = Conversions / Visitors

visitors    = SUM(Visitors)
conversions = SUM(Conversions)

pooled_rate precision 4 = conversions / visitors
assert visitors > 0
```

Across **8218**<!--vmark=variants.visitors--> visitors the experiment recorded
**407**<!--vmark=variants.conversions--> conversions, a pooled rate of
**0.0495**<!--vmark=variants.pooled_rate-->.

**Read:** _write what you concluded, and what you are doing about it._

## How to use this

Edit **Variant**, **Visitors** and **Conversions**. **Rate** and the three
numbers in the sentence are computed.

`precision 4` on **Rate** is doing real work. A conversion rate is a division,
and a division does not tell you how many decimals it deserves — VisiMark will
say so rather than guess, and `precision 4` is you answering. Change it to `3`
and every rate in the column is rewritten to three places.

One limit worth knowing before you rely on it: a formula is one rule for a
whole column, so there is no way to write "B's rate minus A's rate" as a cell.
Compare the two rates by reading them, or give each variant its own small table
and a block that reads across them — the way the capacity template's second
table reads a total out of the first.

The `assert` line is a claim about the whole table rather than about one cell.
This one is nearly trivial, and it is still worth keeping: it fails loudly if
you ever paste in a table whose **Visitors** column is empty, which is the
state in which every rate silently becomes meaningless.
