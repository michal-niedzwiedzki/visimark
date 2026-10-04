# Bare deltas

```vmark #plan
param price precision 2 in [10, 30] lattice 10 = default 20.00
param units precision 0 integer in [100, 300] lattice 100 = default 200

revenue = price * units

assert revenue >= 2000
```

The plan brings in **4000.00**<!--vmark=plan.revenue-->.

```vmark #readings
report deltas
report gates
```
