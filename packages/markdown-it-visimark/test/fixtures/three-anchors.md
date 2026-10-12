Total **12.50**<!--vmark=s.total-->, subtotal 10.00<!--vmark=s.sub--> and tax `2.50`<!--vmark=s.tax-->.

| Item | Qty | Net |
|------|----:|----:|
| pen  |  2  | 10.00 |

```vmark #s
Net precision 2 = Qty * 5
sub precision 2 = SUM(Net)
tax precision 2 = sub * 0.25
total precision 2 = sub + tax
```
