# Slack fixture

```vmark #s
param x integer in [0, 3] lattice 1 = default 2
param y precision 2 in [0, 1] lattice 0.25 = default 0.50
due = 2027-01-01 + x

assert x < 3
assert y >= 0.25
assert x / 4 > 0.25
assert x * 0 == 0
assert x >= 0 and x <= 3
assert x != 9
assert due <= 2027-01-05
```

```vmark #r
report slack
```
