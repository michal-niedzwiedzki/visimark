# Invoice 2026/09/014

**Seller:** EPSI sp. z o.o., ul. Bura 21, 00-000 Burowce, NIP PL9998877666
**Buyer:** Northwind Logistics GmbH, Hafenstraße 8, 22222 Hamburg, USt-IdNr. DE881188118

**Issued:** 2026-09-03 &nbsp;&nbsp; **Delivered:** 2026-08-31 &nbsp;&nbsp; **Payment due:** 2026-09-17

## Services rendered

```vmark #lines from example-invoice-csv-import.csv labelled Item, Unit, Qty, Rate, Net, VAT, Gross at sha256:e6667fb8dda6801721d885c259e2456a9e6c92f1ec89af7f14330e0c54c6ac14
net_total   = SUM(Net)
vat_total   = SUM(VAT)
gross_total = SUM(Gross)
```

Net of tax the engagement comes to **23300.00**<!--vmark=lines.net_total--> PLN.
VAT at 23% adds **5359.00**<!--vmark=lines.vat_total--> PLN, giving a total due of
**28659.00**<!--vmark=lines.gross_total--> PLN.

---

## Appendix — how this differs from the inline version

This is [example-invoice.md](example-invoice.md) with the `#lines` sheet's rows
moved out to [example-invoice-csv-import.csv](example-invoice-csv-import.csv)
and declared with a `from` clause instead of a preceding GFM table. Everything
else about the sheet is unchanged: `net_total`, `vat_total` and `gross_total`
are the same `SUM` reduces over the same column names, and the anchored
numbers below the block are the same values.

Three things are different because the sheet is now imported rather than
inline:

**No column rules.** The original document computes `Net`, `VAT` and `Gross`
per row inside the `vmark` block (`Net = Qty * Rate`, and so on). An imported
sheet has no cell for a column rule to write to — its columns are read-only
inputs taken straight from the CSV header row — so `Net`, `VAT` and `Gross`
are already computed values *in the CSV*, produced by whatever generated it,
not by VisiMark. Only the aggregate reduces (`SUM`) still run here.

**The `at sha256:…` stamp.** The clause on the fence line pins the CSV's exact
bytes. `visimark check` recomputes the digest on every run and fails with
`STALE` if the file has changed underneath the document, or `IMPORT` if the
clause is missing entirely — an inline table has no analogous guard, because
its data lives in the same text `check` is already reading. Editing
`example-invoice-csv-import.csv` and running `visimark fmt` rewrites only this
`at` clause; the CSV itself is never touched by any VisiMark command.

**`labelled` asserts the header.** `labelled Item, Unit, Qty, Rate, Net, VAT,
Gross` checks the CSV's header row matches this exact name and order before
anything is evaluated, so a column renamed or reordered upstream is a loud
`IMPORT` finding instead of a silent misread.

See `docs/design/declared-local-data-imports-spec.md` for the full syntax and
semantics.
