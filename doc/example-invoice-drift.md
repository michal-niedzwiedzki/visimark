# Invoice 2026/09/017

**Seller:** Epsi sp. z o.o., ul. Piękna 12, 00-549 Warszawa, NIP 5252445566
**Buyer:** Northwind Logistics GmbH, Hafenstraße 8, 20457 Hamburg, USt-IdNr. DE811907980

**Issued:** 2026-09-03 &nbsp;&nbsp; **Delivered:** 2026-08-31 &nbsp;&nbsp; **Payment due:** 2026-09-17

```vmark
vat            = 23%
early_pay_disc = 2%
fx_eur         = 4.2650
issued         = 2026-09-03
```

## Services rendered

| Item                       | Unit  | Qty |    Rate |      Net |     VAT |    Gross |
|----------------------------|-------|----:|--------:|---------:|--------:|---------:|
| Discovery workshop         | day   |   2 | 1800.00 |  3600.00 |  828.00 |  4428.50 |
| **Backend implementation** | hour  |  64 |  220.00 | 14080.00 | 3238.40 | 17318.40 |
| Code review retainer       | month |   1 | 2500.00 |  2500.00 |  575.00 |  3075.00 |
| On-call support            | hour  |  20 |  260.00 |  3120.00 |  717.60 |  3837.60 |

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

| Milestone           | Share |   Amount | Due        | Days |
|---------------------|------:|---------:|------------|-----:|
| Signature           |   30% |  8597.70 | 2026-09-10 |    7 |
| Delivery of backend |   40% | 11463.60 | 15.10.2026 |   42 |
| Acceptance          |   30% |  8597.70 | 11/12/2026 |   99 |

```vmark #schedule
Amount = Share * lines.gross_total
Days   = Due - issued

covered = SUM(Amount)
```

The three milestones account for **28659.00**<!--vmark=schedule.covered--> PLN.

## Payment terms

```vmark #terms
early_pay_total = lines.gross_total * (1 - early_pay_disc)
early_pay_saved = lines.gross_total - early_pay_total
eur_total       = lines.gross_total / fx_rate
```

Settlement within 7 days qualifies for a 2% early-payment discount, reducing the
amount due to **28085.82**<!--vmark=terms.early_pay_total--> PLN — a saving of
**573.18**<!--vmark=terms.early_pay_saved--> PLN.

For reference, the gross total is approximately
**6719.58**<!--vmark=terms.eur_total--> EUR at the ECB reference rate recorded on
the delivery date.

## Late payment

```vmark #late_fees
base  = total - fee
fee   = base * 5%
total = base + fee
```

## Reconciliation

```vmark #recon
scheduled = SUM(schedule.Amount)
variance  = lines.gross_total - schedule.Amount
```

Scheduled instalments total **28659.00**<!--vmark=recon.scheduled--> PLN against a
gross invoice value of **28659.00**<!--vmark=lines.gross_total--> PLN, leaving a
variance of **0.00**<!--vmark=recon.variance--> PLN.

---

## Appendix — what went wrong

Nothing above looks wrong. It renders as a clean invoice, the columns line up,
and every number is plausible. That is the point: the buyer asked for eight more
on-call hours, someone raised `Qty` from 12 to 20, and every figure derived from
it stayed behind. A human reviewer would have to redo the whole invoice by hand
to notice. A reviewer skimming a pull request would not notice at all.

```console
$ visimark check doc/example-invoice-drift.md
doc/example-invoice-drift.md

  STALE   lines.Net       · On-call support         3120.00 ≠ 5200.00    Qty * Rate
  STALE   lines.VAT       · On-call support          717.60 ≠ 1196.00    Net * vat
  STALE   lines.Gross     · On-call support         3837.60 ≠ 6396.00    Net + VAT
  STALE   lines.Gross     · Discovery workshop      4428.50 ≠ 4428.00    Net + VAT
  STALE   lines.net_total                          23300.00 ≠ 25380.00   SUM(Net)
  STALE   lines.vat_total                           5359.00 ≠ 5837.40    SUM(VAT)
  STALE   lines.gross_total                        28659.00 ≠ 31217.40   SUM(Gross)
  STALE   schedule.Amount · Signature               8597.70 ≠ 9365.22    Share * lines.gross_total
  STALE   schedule.Amount · Delivery of backend    11463.60 ≠ 12486.96   Share * lines.gross_total
  STALE   schedule.Amount · Acceptance              8597.70 ≠ 9365.22    Share * lines.gross_total
  STALE   schedule.covered                         28659.00 ≠ 31217.40   SUM(Amount)
  STALE   terms.early_pay_total                    28085.82 ≠ 30593.05
  STALE   terms.early_pay_saved                      573.18 ≠ 624.35
  STALE   8 prose anchors bound to the values above

  DATE    schedule.Due    · Delivery of backend   "15.10.2026"
          Dates must be ISO 8601 calendar dates: YYYY-MM-DD.
          Unambiguous — `visimark fmt --fix-dates` rewrites it to 2026-10-15.

  DATE    schedule.Due    · Acceptance            "11/12/2026"
          Dates must be ISO 8601 calendar dates: YYYY-MM-DD.
          Ambiguous: 2026-12-11 or 2026-11-12, 29 days apart. Fix by hand.

  NOTE    schedule.Days   · 2 rows not verified (upstream DATE errors)

  UNDEF   terms.eur_total   unknown name `fx_rate`
          did you mean `fx_eur`?

  VECTOR  recon.variance    `schedule.Amount` is a column, not a value.
          Wrap it in an aggregate: SUM(schedule.Amount)

  CYCLE   late_fees.base → late_fees.fee → late_fees.total → late_fees.base

  26 problems (21 stale, 5 errors)
```

`visimark fmt` repairs every `STALE` line without asking, because those cells are
outputs and the formula is the authority. It repairs none of the four errors,
because each is a question only a human can answer.

### The error classes, and why each earns its place

**DATE** is the class that used to be a guess. VisiMark accepts exactly one date
syntax — ISO 8601 calendar dates, `YYYY-MM-DD`, ten characters — so no document
can contain a date whose meaning depends on where its author lives. Both
non-ISO cells above are rejected, but the tool answers them differently.
`15.10.2026` is decidable, because 15 cannot be a month, so `fmt --fix-dates`
rewrites it to `2026-10-15` when asked. `11/12/2026` is genuinely undecidable —
2026-12-11 or 2026-11-12, twenty-nine days apart — so the tool refuses to touch
it and says why. Neither is ever resolved by inference.

Rejecting at parse is a smaller design than detecting at parse, not just a
stricter one: there is no locale, no `date_order` directive, no per-document
configuration, and no rule for what a bare `/` means. Dates also sort
lexicographically, so chronological ordering is free, and every date is exactly
ten characters, so columns stay aligned.

Date arithmetic is closed and small: date minus date is a number of days, date
plus or minus a number is a date, everything else is an error. Times, timezones,
week dates (`2026-W37`) and partial dates (`2026-09`) are out of scope — the
last being the omission a monthly reporting table will miss first.

**UNDEF** is what makes column and constant names safe to rename. Because every
reference resolves by name, a typo or a stale rename fails loudly at check time
instead of quietly producing a different number. This is the mitigation for
letting sheets read each other's columns.

**VECTOR** enforces the rule that a foreign column may only be consumed by an
aggregate. `#recon` and `#schedule` have no reason to share a row count, so
subtracting one sheet's column from another sheet's scalar is meaningless. The
fix is mechanical and the tool suggests it.

**CYCLE** is ordinary circular-reference detection, reported with the full path
rather than a bare "circular reference" so the offending edge is obvious.

### On rounding

`terms.early_pay_total` is exactly `30593.052`. It is bound to a name, so it
rounds there, to `30593.05` — and from that point the rounded figure is the
value. `early_pay_saved` subtracts `30593.05`, not `30593.052`, and arrives at
`624.35`. The two sum to `31217.40` by rule rather than by luck.

Rounding happens at every name binding — a column cell or a named scalar — and
nowhere else; sub-expressions inside a single formula carry full precision. The
consequence worth having is that anyone re-adding a column on a calculator gets
the same answer the tool does, which is what makes a printed invoice defensible.
Arithmetic is decimal rather than binary floating point, so no document ever
contains `0.30000000000000004`.
