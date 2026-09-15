| Item      | Qty | Price | Net   |
|-----------|----:|------:|------:|
| Widgets   |   4 | 12.50 | 50.00 |
| Gadgets   |   2 | 30.00 | 60.00 |
| Sprockets |   6 |  8.00 | 48.00 |

```vmark #unnamed1
Net = Qty * Price

orderTotal = SUM(Net)
```

Order total: 110.00<!--vmark=order.orderTotal-->

```vmark #tax
vatRate = 23%

taxAmount = order.orderTotal * vatRate
```

Tax amount: 36.34<!--vmark=tax.taxAmount-->
