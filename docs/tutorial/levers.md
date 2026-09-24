# Levers, a plan with real limits

This is the model used for the domain examples in
[chapter 29](../tutorial.md#29-parameters-the-assumptions-a-reader-may-vary) of
the VisiMark tutorial: two levers a plan may adjust, each with a declared
envelope of legal values, not just a declared width.

```vmark #levers
param extra_hours  precision 0 integer in [0, 80] = default 40
param prepay_share precision 2 in { 30%, 40%, 45%, 50% } = default 30%

max_extra_hours = 80
max_prepay      = 40%

assert levers.extra_hours  <= max_extra_hours
assert levers.prepay_share <= max_prepay
```

Both assertions hold on the defaults. Ask `visimark eval --scenario` about a
value outside either declared domain and it is refused before the document is
evaluated at all — see chapter 30.
