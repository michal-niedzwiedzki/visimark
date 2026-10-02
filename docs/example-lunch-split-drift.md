# Team Lunch — Cost Split

Four of us ordered lunch. Whoever wrote up the split added a row after the
total was already written down — and never went back to fix the total.

| Person  | Order          | Price |
|---------|----------------|------:|
| Alice   | Burger, fries  |  9.50 |
| Bilal   | Salad, soda    |  7.25 |
| Chinwe  | Pizza slice    |  4.00 |
| Diego   | Burger, soda   |  8.75 |

```vmark #lunch
Total = SUM(Price)
```

The four of us owe **30.00**<!--vmark=lunch.Total--> total, split evenly.

This is exactly the kind of drift a scan the [homepage's "Scan your
repo"](index.html#repo-scan) widget is meant to catch: a plausible-looking
number that quietly stopped matching the table it came from. Paste
`michal-niedzwiedzki/visimark` into that box and this file is one of the
files it finds.
