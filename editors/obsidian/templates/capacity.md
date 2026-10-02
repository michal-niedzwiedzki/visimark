# Team capacity — sprint 12

## People

| Person  | Days | Hours | Util | Available |
|---------|-----:|------:|-----:|----------:|
| Ada     |   10 |     8 |  70% |     56.00 |
| Grace   |    8 |     8 |  70% |     44.80 |
| Linus   |   10 |     6 |  80% |     48.00 |
| Barbara |    6 |     8 |  60% |     28.80 |

```vmark #people
Available precision 2 = Days * Hours * Util

available_total = SUM(Available)
```

## Commitments

| Work item              | Estimate |
|------------------------|---------:|
| Checkout rewrite       |       60 |
| Search relevance       |       28 |
| On-call and interrupts |       24 |
| Accessibility audit    |       16 |

```vmark #work
committed = SUM(Estimate)

headroom precision 2 = people.available_total - committed
```

The team has **177.60**<!--vmark=people.available_total--> hours in this sprint
and has committed **128**<!--vmark=work.committed--> of them, leaving
**49.60**<!--vmark=work.headroom--> hours of headroom.

## How to use this

Edit **Person**, **Days**, **Hours** and **Util** in the first table, and the
work items in the second. **Available**, the two totals and the headroom are
computed.

**Util** is the fraction of a working day that actually goes into planned work.
It is written as a percentage, which is just a number — `70%` and `0.7` mean
the same thing, so you can write whichever reads better.

Headroom is the number to watch. When it goes negative the sprint is
over-committed, and it goes negative the moment you add a work item, not at the
end of the sprint when you notice.

The two tables are separate sheets, and the second reads a total out of the
first as `people.available_total`. A whole column of another sheet can only be
used inside a total like `SUM(...)`, because two tables have no reason to have
the same number of rows.
