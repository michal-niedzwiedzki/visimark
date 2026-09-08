| Item      | Qty | Price | Total |
|-----------|----:|------:|------:|
| Widgets   |   4 | 12.50 | 50.00 |
| Gadgets   |   2 | 30.00 | 60.00 |
| Sprockets |   6 |  8.00 | 48.00 |

```vmark #order
Total = Qty * Price
grand_total = SUM(Total)
chart spend as bar of Total labelled Item
```

![total spend by item](charts/order-spend.svg)<!--vmark=order.spend-->
