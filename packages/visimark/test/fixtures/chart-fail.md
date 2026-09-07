# Ledger

| Region | Balance |
|--------|--------:|
| north  |  1200.00 |
| south  |   450.00 |
| east   |  -450.00 |

```vmark #ledger
total = SUM(Balance)
chart balances as pie of Balance labelled Region
```

Net position: **1200.00**<!--vmark=ledger.total-->

![balances by region](charts/balances.svg)<!--vmark=ledger.balances-->
