# Brake press, rate of return

The same series — 48000.00 PLN out today, 20000.00 PLN back at the end of each
of the next three years — earns
**12.04%**<!--vmark=project.rate%--> a year. The hurdle is
**8%**<!--vmark=project.hurdle%-->.

| Year |     Cash |
|-----:|---------:|
|    0 | -48000.00 |
|    1 |  20000.00 |
|    2 |  20000.00 |
|    3 |  20000.00 |

```vmark #project
param hurdle precision 2 = default 8%

rate precision 4 = IRR(Cash)

assert rate > hurdle
```
