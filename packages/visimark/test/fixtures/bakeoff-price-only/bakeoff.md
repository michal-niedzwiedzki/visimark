# Bakeoff stall

## One batch

A batch makes 24 cookies.

| Ingredient | Qty | Price |  Cost |
|------------|----:|------:|------:|
| Flour      | 1.2 |  1.50 |  1.80 |
| Butter     | 0.5 |  9.00 |  4.50 |
| Sugar      | 0.6 |  2.00 |  1.20 |
| Eggs       |   6 |  0.40 |  2.40 |
| Chocolate  | 0.4 | 14.00 |  5.60 |

```vmark #batch
Cost precision 2 = Qty * Price

batch_cost = SUM(Cost)
```

One batch costs **15.50**<!--vmark=batch.batch_cost--> to make.

## The stall

```vmark #stall
param price precision 2 in [1.00, 5.00] lattice 0.50 = default 3.00
batches = 2
fee     precision 2 = 12.00

baked   = batches * 24
demand  = 160 - 30 * price
sold    = IF(baked < demand, baked, demand)
left    = baked - sold
spend   precision 2 = batches * batch.batch_cost + fee
revenue precision 2 = sold * price
profit  precision 2 = revenue - spend

goal    precision 2 = 60.00
assert profit >= goal
```

```vmark #sweep
report best scalar stall.profit direction max among feasible
```
