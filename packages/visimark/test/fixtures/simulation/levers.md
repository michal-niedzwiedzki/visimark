# Levers, with lattices and reports

A non-normative fixture for
[`lattice-on-param-and-report-statements-spec.md`](../../../../../docs/design/lattice-on-param-and-report-statements-spec.md).
Every lever below is askable within its declared domain; a `lattice` says at
which spacing a sweep visits it, and the `report` lines say which readings of
a sweep are wanted. `check` runs neither.

```vmark #levers
param extra_hours  precision 0 integer in [0, 80] lattice 20 = default 40
param volume_disc  precision 3 in [0%, 10%] lattice 1% = default 0%
param prepay_share precision 2 in { 30%, 40%, 45%, 50% } = default 30%
param bump         precision 1 in (0, 10) lattice 5 = default 5
param staff        precision 0 positive integer in [1, 13] lattice 3 = default 1

max_prepay = 40%
cost precision 0 = extra_hours * 100
assert levers.prepay_share <= max_prepay

report ledger assertions broken
report deltas on levers.extra_hours, levers.volume_disc
report gates
report best scalar levers.cost direction min among feasible
report forbidden
```
