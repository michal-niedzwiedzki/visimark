# Brake press, as a project

Buying the press costs 48000.00 PLN today and is expected to save 20000.00 PLN
at the end of each of the next three years. At a hurdle of
**8%**<!--vmark=project.hurdle%--> the present value of that series is
**3541.94**<!--vmark=project.present--> PLN.

| Year |     Cash |
|-----:|---------:|
|    0 | -48000.00 |
|    1 |  20000.00 |
|    2 |  20000.00 |
|    3 |  20000.00 |

```vmark #project
param hurdle precision 2 = default 8%

present precision 2 = NPV(hurdle, Cash)

assert present > 0
```
