# Conference budget, 2027

This is the model used in [the `simulate` guide](../simulate.md): a one-day
conference with three levers declared as ranges to sweep, three rules for what
"works" means, and two sheets of readings for `visimark simulate`. Every number
below that follows from another number is written by `visimark fmt`.

## The event

```vmark #event
param attendees   integer in [100, 400] lattice 100 = default 250
param ticket      precision 2 in [60, 120] lattice 20 = default 80.00
param sponsors    integer in [0, 3] lattice 1 = default 2
param sponsor_fee precision 2 = default 5000.00

venue_capacity = 300

sponsor_income = sponsors * sponsor_fee
revenue        = attendees * ticket + sponsor_income
profit         = revenue - costs.total
sponsor_share precision 3 = sponsor_income / revenue

assert attendees <= venue_capacity
assert profit >= 0
assert sponsor_share <= 50%
```

## Costs

| Item     |   Fixed |  Each |     Cost |
|----------|--------:|------:|---------:|
| Venue    | 6000.00 |  0.00 |  6000.00 |
| Speakers | 4500.00 |  0.00 |  4500.00 |
| AV       | 2500.00 |  0.00 |  2500.00 |
| Catering |    0.00 | 32.00 |  8000.00 |
| Badges   |  400.00 |  6.50 |  2025.00 |

```vmark #costs
Cost = Fixed + Each * event.attendees

total = SUM(Cost)
```

With **250**<!--vmark=event.attendees--> people at **80.00**<!--vmark=event.ticket-->
EUR a ticket the day costs **23025.00**<!--vmark=costs.total--> EUR and makes
**6975.00**<!--vmark=event.profit--> EUR.

## Readings

```vmark #readings
report gates
report forbidden
report best scalar event.profit direction max among feasible
report best scalar event.ticket direction min among feasible
report deltas on event.profit, event.sponsor_share
```

```vmark #ledger
report ledger assertions broken
```
