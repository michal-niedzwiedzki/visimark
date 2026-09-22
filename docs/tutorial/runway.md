# Runway plan, 2027

This is the model used in chapters 29 and 30 of
[the VisiMark tutorial](../tutorial.md). Every number below that follows from
another number is written by `visimark fmt`. The `param` lines are the
assumptions a what-if run may change, and `visimark eval --scenario` changes
them without editing this file.

## Team

| Team        | Heads |   Salary |     Cost |
|-------------|------:|---------:|---------:|
| Engineering |     6 | 11000.00 | 67980.00 |
| Sales       |     3 |  9000.00 | 27810.00 |
| Operations  |     2 |  7500.00 | 15450.00 |

```vmark #team
param raise precision 3 = default 3%

Cost = ROUND(Heads * Salary * (1 + raise), 2)

headcount = SUM(Heads)
payroll   = SUM(Cost)
```

The team of **11**<!--vmark=team.headcount--> people costs
**111240.00**<!--vmark=team.payroll--> PLN a month, after a
**3.0%**<!--vmark=team.raise%--> raise.

## Runway

```vmark #runway
param cash      precision 2 = default 2000000.00
param overhead  precision 2 = default 21000.00
param new_hires precision 0 = default 2
param hire_cost precision 2 = default 10500.00

burn = team.payroll + overhead + new_hires * hire_cost
months precision 1 = cash / burn

assert months >= 12
```

With **2**<!--vmark=runway.new_hires--> new hires the company spends
**153240.00**<!--vmark=runway.burn--> PLN a month, so the cash lasts
**13.1**<!--vmark=runway.months--> months. The plan requires at least twelve.
