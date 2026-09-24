# Budget — January 2026

```vmark
carried_over = 0.00
```

## Spending

| Category      | Planned |  Actual |   Left |
|---------------|--------:|--------:|-------:|
| Rent          | 1200.00 | 1200.00 |   0.00 |
| Groceries     |  450.00 |  512.40 | -62.40 |
| Transport     |  120.00 |   96.00 |  24.00 |
| Subscriptions |   45.00 |   45.00 |   0.00 |
| Going out     |  200.00 |  150.00 |  50.00 |

```vmark #spending
Left = Planned - Actual

planned_total = SUM(Planned)
actual_total  = SUM(Actual)
left_total    = SUM(Left)

available = planned_total + carried_over
assert left_total == planned_total - actual_total
```

Planned spending for the month is **2015.00**<!--vmark=spending.planned_total-->,
of which **2003.40**<!--vmark=spending.actual_total--> has gone out, leaving
**11.60**<!--vmark=spending.left_total-->. With anything carried over from last
month the budget is **2015.00**<!--vmark=spending.available-->.

## How to use this

Edit **Category**, **Planned** and **Actual**. **Left** is computed per row,
and the three numbers in the sentence recompute with it.

The line `assert left_total == planned_total - actual_total` is the part worth
keeping. It does not store anything and it is never repaired — it is a claim
about the table that VisiMark checks every time. Change a number so the two
sides stop agreeing and the assertion fails, which catches the class of mistake
that a per-row formula cannot: one where every cell agrees with its own formula
and the table as a whole still says something false.

Carry a balance forward by putting last month's **Left** into `carried_over` at
the top.
