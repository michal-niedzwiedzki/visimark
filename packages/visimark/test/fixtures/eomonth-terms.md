# Consulting invoice

```vmark
vat = 23%
```

## Lines

| Item                | Unit | Qty |    Rate |     Net |
|---------------------|------|----:|--------:|--------:|
| Consulting          | day  |   6 | 1600.00 | 9600.00 |
| Integration support | hour |  32 |  210.00 | 6720.00 |

```vmark #lines
Net = Qty * Rate

subtotal    = SUM(Net)
vat_total   = SUM(Net) * vat
gross_total = SUM(Net) + vat_total
```

Net of tax the work comes to **16320.00**<!--vmark=lines.subtotal--> PLN,
**20073.60**<!--vmark=lines.gross_total--> PLN gross.

## Payment terms

```vmark #terms
issued = 2026-01-15
due    = EOMONTH(issued, 2)
```

Terms are net two months, end of month. With the invoice issued 2026-01-15,
payment falls due **2026-03-31**<!--vmark=terms.due-->.
