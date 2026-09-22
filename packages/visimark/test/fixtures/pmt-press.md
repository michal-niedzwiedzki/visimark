# Brake press, financed

The quote is for one press at **48000.00**<!--vmark=press.price--> PLN.
The financing rate is **6%**<!--vmark=press.annual%--> a year, paid monthly
over **36**<!--vmark=press.term--> months. The instalment is
**1460.25**<!--vmark=press.instalment--> PLN.

| Item        | Amount   |
|-------------|---------:|
| Brake press | 48000.00 |

```vmark #press
param price  precision 2 = default 48000.00
param annual precision 2 = default 6%
param term   precision 0 = default 36

monthly_rate precision 3 = annual / 12
instalment   precision 2 = PMT(monthly_rate, term, price)
```
