# Quote QT-2026-0031 — data migration

**From:** Northaven Systems sp. z o.o., ul. Krótka 14, 30-001 Kraków  
**To:** Kestrel Systems s.r.o., Vodičkova 12, 110 00 Praha  
**Issued:** 2026-09-12 &nbsp;&nbsp; **Valid until:** 2026-10-12

This is the finished capstone from
[the VisiMark tutorial](../tutorial.md). Nothing computed below was typed by a
person: every derived cell and every bold figure in the prose was written by
`visimark fmt` from the rules in this file.

## Scope and price

| Stage            | Effort (man-days)    |    Rate |      Net |     VAT |    Gross |
|------------------|---------------------:|--------:|---------:|--------:|---------:|
| Discovery        |                    6 |  900.00 |  5400.00 | 1242.00 |  6642.00 |
| Schema mapping   |                   14 |  850.00 | 11900.00 | 2737.00 | 14637.00 |
| Migration runs   |                    9 |  850.00 |  7650.00 | 1759.50 |  9409.50 |
| Cutover support  |                    4 | 1100.00 |  4400.00 | 1012.00 |  5412.00 |

```vmark #lines
"Effort (man-days)" is days

vat_rate = 23%

Net   = days * Rate
VAT   = ROUND(Net * vat_rate, 2)
Gross = Net + VAT

effort_total = SUM(days)
net_total    = SUM(Net)
vat_total    = SUM(VAT)
gross_total  = SUM(Gross)
day_rate_avg precision 2 = net_total / effort_total
```

The engagement is **33**<!--vmark=lines.effort_total--> man-days at an
average of **889.39**<!--vmark=lines.day_rate_avg--> PLN per day. Net of tax it
comes to **29350.00**<!--vmark=lines.net_total--> PLN. VAT at 23% adds
**6750.50**<!--vmark=lines.vat_total--> PLN, giving a total of
**36100.50**<!--vmark=lines.gross_total--> PLN gross.

## Payment schedule

| Milestone        | Share |   Amount | Due        |
|------------------|------:|---------:|------------|
| Signature        |   25% |  9025.13 | 2026-10-01 |
| Schema sign-off  |   45% | 16245.23 | 2026-11-16 |
| Cutover accepted |   30% | 10830.15 | 2027-01-15 |

```vmark #schedule
Amount = ROUND(Share * lines.gross_total, 2)

covered  = SUM(Amount)
share_sum precision 2 = SUM(Share)

assert share_sum == 1
```

The three instalments cover **36100.51**<!--vmark=schedule.covered--> PLN,
payable within 14 days of each date above.

## Reconciliation

The schedule is derived from the invoice total, so the two must agree. Rounding
each instalment to the nearest grosz can leave a remainder of a few grosz, which
is why the variance is stated rather than assumed.

```vmark #recon
invoiced  = lines.gross_total
scheduled = schedule.covered
variance  = scheduled - invoiced

assert |variance| <= 0.05
```

Scheduled instalments total **36100.51**<!--vmark=recon.scheduled--> PLN against
an invoiced **36100.50**<!--vmark=recon.invoiced--> PLN, a rounding variance of
**0.01**<!--vmark=recon.variance--> PLN. The assertion above allows at most five
grosz; anything larger is an error in the shares, not a rounding artefact.
