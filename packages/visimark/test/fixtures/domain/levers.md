# Levers, with declared domains

A non-normative fixture for
[`a-param-declares-the-set-of-values-it-ac-spec.md`](../../../../../docs/design/a-param-declares-the-set-of-values-it-ac-spec.md).
Every lever below is askable only within its declared domain — the set of
values a scenario search is allowed to try — while `max_prepay` stays a
business rule an `assert` still checks.

```vmark #levers
param extra_hours    precision 0 integer in [0, 80] = default 40
param prepay_share   precision 2 in { 30%, 40%, 45%, 50% } = default 30%
param crosssell_days precision 0 natural in [0, 8) = default 0
param premium_hours  precision 0 ℕ in [0, 12] = default 0
param staff_added    precision 0 positive integer = default 1
param code           precision 0 ℤ⁺ = default 2
param volume_disc    precision 3 ∈ [0%, 15%] = default 0%
param rate_change    precision 0 ℤ in [-5, 5] = default 0

max_prepay = 40%
assert levers.prepay_share <= max_prepay
```
