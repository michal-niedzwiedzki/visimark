# Simulate fixture

```vmark #plan
param hours precision 0 integer in [0, 20] lattice 10 = default 10
param disc  precision 2 in [0%, 10%] lattice 5% = default 0%
rate precision 2 = 100.00
cost precision 2 = hours * rate
price precision 2 = 1500.00 * (1 - disc)
margin precision 2 = price - cost
assert margin >= 0
assert hours <= 15

report ledger assertions broken
report deltas on plan.margin
report gates
report best scalar plan.margin direction max among feasible
report forbidden
```
