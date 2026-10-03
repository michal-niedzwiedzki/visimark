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
param price   precision 2 in [1.00, 5.00] lattice 0.50 = default 3.00
param batches precision 0 integer in [1, 6] lattice 1 = default 2

fee         precision 2 = 12.00
piggy_bank  precision 2 = 60.00
goal        precision 2 = 60.00

baked   = batches * 24
demand  = 160 - 30 * price
sold    = IF(baked < demand, baked, demand)
left    = baked - sold
spend   precision 2 = batches * batch.batch_cost + fee
revenue precision 2 = sold * price
profit  precision 2 = revenue - spend

assert spend <= piggy_bank
assert profit >= goal
assert left <= 12
```

At **3.00**<!--vmark=stall.price--> a cookie she bakes
**48**<!--vmark=stall.baked-->, sells **48**<!--vmark=stall.sold--> and makes
**101.00**<!--vmark=stall.profit--> on **43.00**<!--vmark=stall.spend--> spent.
She wants at least **60.00**<!--vmark=stall.goal--> out of the day and will not
spend more than **60.00**<!--vmark=stall.piggy_bank-->.

## What to ask

```vmark #sweep
report best scalar stall.profit direction max among feasible
report gates
report forbidden
```
