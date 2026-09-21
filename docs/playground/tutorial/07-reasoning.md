| Item      | Qty | Price | Net   | Discount |
|-----------|----:|------:|------:|---------:|
| Widgets   |   3 | 12.50 | 37.50 |     0.00 |
| Gadgets   |   2 | 30.00 | 60.00 |     0.00 |
| Sprockets |   6 |  8.00 | 48.00 |     0.00 |

```vmark #order
Net = Qty * Price
Discount = IF(Qty > 10, ROUND(Net * 0.1, 2), 0)

orderTotal = SUM(Net)
hasDiscounts = IF(SUM(Discount) > 0, "yes", "no")
itemsCount = COUNT(Item)
cheapest = MIN(Price)
priciest = MAX(Price)
```

Order total: 145.50<!--vmark=order.orderTotal-->

Discounts applied: 0<!--vmark=order.hasDiscounts-->

Items count: 3<!--vmark=order.itemsCount-->

Price range: 8.00<!--vmark=order.cheapest--> to 30.00<!--vmark=order.priciest-->
