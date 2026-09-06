## Diagonal brace schedule

Each brace spans one rectangular bay corner to corner. The length to cut
is the straight-line distance between the end pins, fixed by the bay's
width and height alone.

| Brace | Width | Height |  Length |
|-------|------:|-------:|--------:|
| B1    |  3600 |   4200 | 5531.73 |
| B2    |  3600 |   2400 | 4326.66 |
| B3    |  6000 |   3000 | 6708.20 |

```vmark #braces
Length = SQRT(Width^2 + Height^2)

longest = MAX(Length)
```

All dimensions in mm. The longest brace to cut is
**6708.20**<!--vmark=braces.longest--> mm.
