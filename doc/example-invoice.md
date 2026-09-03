# Invoice 2026/09/014

**Seller:** Epsi sp. z o.o., ul. Piękna 12, 00-549 Warszawa, NIP 5252445566
**Buyer:** Northwind Logistics GmbH, Hafenstraße 8, 20457 Hamburg, USt-IdNr. DE811907980

**Issued:** 2026-09-03 &nbsp;&nbsp; **Delivered:** 2026-08-31 &nbsp;&nbsp; **Payment due:** 2026-09-17

```vmark
vat            = 23%
early_pay_disc = 2%
fx_eur         = 4.2650
```

## Services rendered

| Item                       | Unit  | Qty |    Rate |      Net |     VAT |    Gross |
|----------------------------|-------|----:|--------:|---------:|--------:|---------:|
| Discovery workshop         | day   |   2 | 1800.00 |  3600.00 |  828.00 |  4428.00 |
| **Backend implementation** | hour  |  64 |  220.00 | 14080.00 | 3238.40 | 17318.40 |
| Code review retainer       | month |   1 | 2500.00 |  2500.00 |  575.00 |  3075.00 |
| On-call support            | hour  |  12 |  260.00 |  3120.00 |  717.60 |  3837.60 |

```vmark #lines
Net   = Qty * Rate
VAT   = Net * vat
Gross = Net + VAT

net_total   = SUM(Net)
vat_total   = SUM(VAT)
gross_total = SUM(Gross)
```

Net of tax the engagement comes to **23300.00**<!--vmark=lines.net_total--> PLN.
VAT at 23% adds **5359.00**<!--vmark=lines.vat_total--> PLN, giving a total due of
**28659.00**<!--vmark=lines.gross_total--> PLN.

## Payment schedule

| Milestone           | Share |   Amount | Due        |
|---------------------|------:|---------:|------------|
| Signature           |   30% |  8597.70 | 2026-09-10 |
| Delivery of backend |   40% | 11463.60 | 2026-10-15 |
| Acceptance          |   30% |  8597.70 | 2026-11-30 |

```vmark #schedule
Amount = Share * lines.gross_total

covered = SUM(Amount)
```

The three milestones account for **28659.00**<!--vmark=schedule.covered--> PLN.

## Payment terms

```vmark #terms
early_pay_total = lines.gross_total * (1 - early_pay_disc)
early_pay_saved = lines.gross_total - early_pay_total
eur_total       = lines.gross_total / fx_eur
```

Settlement within 7 days qualifies for a 2% early-payment discount, reducing the
amount due to **28085.82**<!--vmark=terms.early_pay_total--> PLN — a saving of
**573.18**<!--vmark=terms.early_pay_saved--> PLN.

For reference, the gross total is approximately
**6719.58**<!--vmark=terms.eur_total--> EUR at the ECB reference rate of
4.2650 PLN/EUR recorded on the delivery date.

## Reconciliation

```vmark #recon
scheduled = SUM(schedule.Amount)
variance  = lines.gross_total - scheduled
```

Scheduled instalments total **28659.00**<!--vmark=recon.scheduled--> PLN against a
gross invoice value of **28659.00**<!--vmark=lines.gross_total--> PLN, leaving a
variance of **0.00**<!--vmark=recon.variance--> PLN.

---

## Appendix — how this document computes

Everything above renders as ordinary Markdown. The mechanics are four ideas.

**A `vmark` block declares formulas for the table above it.** The block carries the
sheet's identity as `#lines`, `#schedule` and so on. A block with no identity —
the one near the top of this file — declares document-level constants that every
sheet can read, which is why `vat` and `fx_eur` resolve without qualification.

**Columns are uniform.** `Net = Qty * Rate` is one rule applied to every row of
the sheet, not a formula per cell. Columns not named in the block — `Item`,
`Unit`, `Qty`, `Rate`, `Share`, `Due` — are inputs, typed by a human and never
overwritten. There is no per-row exception and no totals row inside a table.

**Aggregates are scalars, declared in the same block.** `net_total = SUM(Net)`
collapses a column to a single named value that lives outside any grid. This is
what replaces the totals row, and it is why the `#recon` block needs no table of
its own: a sheet is a namespace, and a table is optional.

**A comment anchor materialises a scalar into prose.** `<!--vmark=lines.net_total-->`
binds the bold number in front of it to that name. The comment is invisible in
every Markdown renderer that permits raw HTML, so the sentence reads normally
while the number stays machine-checkable.

Sheets address each other by qualified name, as `#schedule` does when it reads
`lines.gross_total` and `#recon` does when it aggregates `schedule.Amount`. A
foreign column is a vector, so it is legal only inside an aggregate — bare
`schedule.Amount` in a column formula is an error, because the two sheets have
no reason to share a row count.

The payoff is the last section. `visimark check` recomputes every formula and
exits non-zero if any stored number disagrees, so an arithmetic error in this
invoice fails CI instead of reaching the buyer — whether a human or an agent
wrote it.

### Deliberately unresolved

A percent literal is a number: `23%` and `0.23` are the same value, so `vat` may
be written either way and arithmetic needs no special case. Because the tool
writes only computed cells, an input written as `30%` stays `30%` forever — the
display-format layer that Excel needs never has to exist here.

Dates are settled: ISO 8601 calendar dates, `YYYY-MM-DD`, and nothing else, so
no date here can mean two things. Thousands separators in cells, decimal versus
binary floating point, and rounding policy remain open. See
`example-invoice-drift.md` for what the checker does with each.
