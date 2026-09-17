# Order OD-2026-0912

**Customer:** Kestrel Systems s.r.o.  
**Issued:** 2026-09-12

This is the document built step by step in
[the VisiMark tutorial](../tutorial.md). Every number below that follows from
another number is written by `visimark fmt`, not by hand.

## Lines

| Item      | Qty | Price |    Net |
|-----------|----:|------:|-------:|
| Widgets   |   4 | 12.50 |  50.00 |
| Gadgets   |   2 | 30.00 |  60.00 |
| Sprockets |   6 |  8.00 |  48.00 |

```vmark #order
Net = Qty * Price

net_total  = SUM(Net)
line_count = COUNT(Item)
avg_line precision 2 = net_total / line_count
```

The order has **3**<!--vmark=order.line_count--> lines. Net of tax it comes to
**158.00**<!--vmark=order.net_total--> PLN, an average of
**52.67**<!--vmark=order.avg_line--> PLN per line.

## Tax and amount due

| Band     | Rate |   Base |   Tax |
|----------|-----:|-------:|------:|
| Standard |  23% | 158.00 | 36.34 |

```vmark #tax
Base = order.net_total
Tax  = ROUND(Base * Rate, 2)

tax_total   = SUM(Tax)
gross_total = order.net_total + tax_total

assert gross_total >= order.net_total
```

Tax adds **36.34**<!--vmark=tax.tax_total--> PLN, so the amount due is
**194.34**<!--vmark=tax.gross_total--> PLN.
