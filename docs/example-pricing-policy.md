# SaaS pricing policy — the page copy and the billing rule are one file

The usual failure here is not arithmetic — it's that the pricing page, the
sales deck and the billing engine's config each restate the same numbers
independently, and one of the three gets updated when a tier changes. This
document is the pricing policy in prose a prospect can read, and the exact
values `billing.ts` pulls with `visimark eval --json` at deploy time. There is
one number for "the Team tier's included seats", not three.

## Tiers

| Tier       | BasePrice | IncludedSeats | OveragePerSeat |
|------------|----------:|---------------:|---------------:|
| Starter    |     29.00 |               3 |           12.00 |
| Team       |     99.00 |              10 |            9.00 |
| Business   |    349.00 |              40 |            7.00 |

```vmark #tiers
cheapest_overage  = MIN(OveragePerSeat)
team_overage_rate = 9.00
```

A table cell is not addressable by row — `tiers.OveragePerSeat` is a column,
legal only inside a reduce like `MIN` above. A figure that names one specific
tier's rate, such as Team's overage price feeding the worked quote below,
has to be pulled out as its own scalar (`team_overage_rate`), the same way
`cheapest_overage` collapses the whole column.

The cheapest per-seat overage rate across all three tiers is
**$7.00**<!--vmark=tiers.cheapest_overage-->, which is what the pricing page's
"as low as $7/seat" claim has to stay less than or equal to — checked, not
promised.

## A worked quote

A prospect on **Team** wants **16** seats. This is the exact computation the
checkout page runs, expressed as a sheet instead of buried in a controller —
a one-row table, reduced to scalars the same way any other table is, because
there is no special case for "only one row" in the shape system.

| Requested | IncludedInTeam |
|----------:|---------------:|
|        16 |             10 |

```vmark #quote
overage_seats = SUM(Requested) - SUM(IncludedInTeam)
overage_cost  = overage_seats * tiers.team_overage_rate
monthly_total = 99.00 + overage_cost
```

A **16**-seat Team subscription costs
**$153.00**<!--vmark=quote.monthly_total--> per month:
**$99.00** base plus **6**<!--vmark=quote.overage_seats--> overage seats at
**$9.00**<!--vmark=quote.team_overage_rate--> each, for
**$54.00**<!--vmark=quote.overage_cost-->.

## What the billing engine actually reads

```console
$ visimark eval docs/example-pricing-policy.md --json
{
  "command": "eval",
  "visimark": "0.1.1",
  "status": "ok",
  "file": "docs/example-pricing-policy.md",
  "values": {
    "tiers.cheapest_overage": "7",
    "tiers.team_overage_rate": "9",
    "quote.overage_seats": "6",
    "quote.overage_cost": "54",
    "quote.monthly_total": "153"
  },
  "assertions": [],
  "charts": []
}
```

`billing.ts` does not hardcode `9.00` for Team overage — it runs this command
at build time and fails the deploy if `visimark check` fails, which is the
same gate that stops a marketing edit ("we're dropping Team overage to
$7.50") from shipping to the pricing page without the billing engine's
config changing in the same commit. Today that second change is still a
human editing this file's `team_overage_rate` — VisiMark verifies the
document is internally consistent, it does not sync to a live database. What
it removes is the silent third copy: there is exactly one place the number
$9.00 is asserted, and every consumer — page copy, deploy-time config
extraction, sales deck screenshot — is generated or checked from it.

## Why this is knowledge extraction, not documentation-as-code

The conventional fix for "docs drift from code" is generating the docs from
the code. This is the reverse: the **document is the source**, prose and
formula in the same paragraph, and `eval --json` is what makes it also a
config file. Nothing here reads as code review — a product manager reviews
this PR by reading English sentences with numbers in them, and `check` is
what stands in for the unit test they cannot write.
