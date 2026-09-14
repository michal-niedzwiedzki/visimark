# GPU network bandwidth

This document is part of the acceptance suite. It exists to exercise
**human-readable column references and aliases**: the two headers below are
not identifiers — they carry units and punctuation a formula cannot spell —
so each is given a short name with `is`, and the formula reads one alias and
writes through the other.

| GPUs | Bandwidth per Unit (TB/s, full-duplex) | GPU-to-GPU Bandwidth (GB/s, full-duplex) |
|-----:|----------------------------------------:|------------------------------------------:|
|    8 |                                      3.2 |                                        400 |
|   16 |                                      3.2 |                                        200 |

```vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
"GPU-to-GPU Bandwidth (GB/s, full-duplex)" is gpu_bw

gpu_bw = ROUND(bpu / GPUs * 1000, 0)
peak = MAX(gpu_bw)
```

`bpu` is read on the right of `gpu_bw`'s rule, and `gpu_bw` is the target on
the left — the same short name both reads an aliased input column and writes
an aliased output column. Doubling `GPUs` from 8 to 16 at a fixed
per-unit bandwidth halves the GPU-to-GPU figure, from 400 to 200 GB/s.

Peak GPU-to-GPU bandwidth across both configurations: **400**<!--vmark=network.peak--> GB/s.

## How the aliases work

`"Bandwidth per Unit (TB/s, full-duplex)" is bpu` gives that column the short
name `bpu`. From here on, `bpu` and the full header text refer to the same
column interchangeably: a formula may read `bpu` instead of repeating the
header, and a binding may assign through `bpu` instead of quoting the header
on the left. `bpu = GPUs * 2` and `"Bandwidth per Unit (TB/s, full-duplex)" =
GPUs * 2` would be the same rule.

`gpu_bw = ROUND(bpu / GPUs * 1000, 0)` looks like an ordinary column rule
because it is one: `is` only renames the header for reference purposes, it
never changes what a binding does. The alias is why this rule can be written
at all without repeating two long, punctuation-heavy header strings on every
line that touches them.
