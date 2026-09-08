# Demo

Edit this document and watch **fmt**, the **preview**, and the **knowledge**
panel update live.

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

```vmark #order
Total = Qty * Price

grand_total = SUM(Total)
```

The order comes to **110.00**<!--vmark=order.grand_total--> in total.

```vmark #order
assert grand_total > 0
```
