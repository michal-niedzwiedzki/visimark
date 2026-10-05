# Among

```vmark #plan
param hours precision 0 integer in [0, 20] lattice 10 = default 10
param disc precision 2 in [0%, 10%] lattice 5% = default 0%
rate precision 2 = 100.00
margin precision 2 = 1500.00 * (1 - disc) - rate * hours
assert margin >= 0
assert hours <= 15

report best scalar margin direction max among all
report best scalar margin direction max among feasible
report best scalar margin direction max among infeasible
report best scalar margin direction min among feasible
report deltas on margin among all
report deltas on margin among feasible
report deltas on margin among infeasible
```
