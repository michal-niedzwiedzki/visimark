# Invoice 001

**From:** your name or company
**To:** the client

**Issued:** 2026-01-31 &nbsp;&nbsp; **Payment due:** 2026-02-14

```vmark
vat = 23%
```

## Work

| Item               | Unit  | Qty |   Rate |     Net |    VAT |   Gross |
|--------------------|-------|----:|-------:|--------:|-------:|--------:|
| Discovery workshop | day   |   2 | 800.00 | 1600.00 | 368.00 | 1968.00 |
| Implementation     | hour  |  20 | 100.00 | 2000.00 | 460.00 | 2460.00 |
| Support retainer   | month |   1 | 300.00 |  300.00 |  69.00 |  369.00 |

```vmark #lines
Net             = Qty * Rate
VAT precision 2 = Net * vat
Gross           = Net + VAT

net_total   = SUM(Net)
vat_total   = SUM(VAT)
gross_total = SUM(Gross)
```

Before tax this invoice comes to **3900.00**<!--vmark=lines.net_total-->.
Tax adds **897.00**<!--vmark=lines.vat_total-->, so the amount due is
**4797.00**<!--vmark=lines.gross_total-->.

## How to use this

Edit the input columns — **Item**, **Unit**, **Qty** and **Rate** — and the
tax rate at the top. Everything else is computed: **Net**, **VAT**,
**Gross** and the three numbers in the sentence above all recalculate, and
VisiMark tells you when one of them stops agreeing with its formula.

Add or delete table rows freely. The formulas are one rule per column, not one
per cell, so they apply to whatever rows are there.

The numbers in the sentence are bound to names by an invisible comment right
after them. Keep the comment when you edit the sentence and the number stays
checked; delete it and the sentence becomes ordinary prose again.
