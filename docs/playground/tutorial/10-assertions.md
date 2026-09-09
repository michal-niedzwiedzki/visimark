| Ledger | Expected | Actual  |
|--------|---------:|--------:|
| Cash   |   500.00 |  500.00 |
| Bank   |  1200.00 | 1200.00 |

```vmark #recon
variance = SUM(Actual) - SUM(Expected)
assert variance == 0
```
