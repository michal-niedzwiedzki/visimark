# 01-tables.md

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

This table is not verifiable. Change one number and nothing updates.
Even if unchanged, no one can guarantee the math is solid.

**Scenario:**
1. Change any column value or order total.
2. Try to answer if figures are correct without running all calculations by hand. It's a catch: this task canot be completed - there is nothing that keeps the math mathing.

# 02-inference.md

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

_Inference_ is a feature where formulas and anchors are detected by VisiMark automatically. Inferred formulas are saved in the document as _sheets_. We will talk about anchors later.

**Scenario:**
1. Go to INFERENCE tab and click _Infer_ button.
2. You will have seen _sheet_ added to table. Now go and change `Qty` or `Price` and watch `Total` and Order total update automatically.
3. Now go and change `Total` - the table updates automatically and overwrites it with derived value. This is how VisiMark protects documents from rotting.
4. Change the anchored number `110.00` and watch it being brought back to correct figure.

# 03-sheets.md

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

```vmark #order
OrderTotal = SUM(Total)
```

**Scenario:**
1. Write a sheet definition without the use of _inference_. Use the formula that `Total` is `Qty` times `Price`. Go, write it in `vmark` block.
2. Pay attention to name after # sign - it is the sheet name. Names are useful because each document can contain multiple tables and sheets. Change the sheet name now. 

# 04-anchors.md

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

```vmark #order
OrderTotal = SUM(Total)
```
Order total: 110.00<!--vmark=order.OrderTotal-->

_Anchors_ bind derived value directly in Markdown prose. They appear as HTML comments. Anchors can be _inferred_ automatically.

_Anchors_ must be used with sheet names as they can be placed all over the document, not only directly under table or sheet.

**Scenario:**
1. The number `110.00` is annotated with _anchor_. Now go and change `Qty` or `Price` and watch `Total` and order total update automatically.
2. Now go and change the `110.00` to something else - the anchor updates automatically and overwrites it with derived value. VisiMark have just saved you from breaking the document again.
3. Remember that sheet name must be present in an anchor. Change the sheet name after # sign and watch the anchor loosing its grip.

# 05-mappers.md

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

```vmark #order
Total = Qty * Price
grand_total = SUM(Total)
```

_Mappers_ run once per row, or once for a scalar, turning one value into another. `IF(condition, if_true, if_false)` is the one you will reach for most.

**Scenario:**
1. Add a column rule `Discounted = ROUND(Total * 0.9, 2)`. A new `Discounted` column appears in the table, one row at a time, rounded to two places even when the raw math isn't.
2. Add `big_order = IF(grand_total > 100, "yes", "no")`. Change `Qty` until `grand_total` crosses 100 in each direction and watch `big_order` flip between `"yes"` and `"no"`.
3. Now try `is_big = grand_total > 100`, without the `IF`. VisiMark refuses to store it: a comparison produces a boolean, and a boolean cannot be written into a document — only `IF` turns it into a number or a string first.
4. VisiMark never reads the system clock — a document must evaluate the same way forever, so there is no `TODAY()`. Add `issued = 2026-01-15` as a scalar and `due = EOMONTH(issued, 0)` to compute the last day of that month. Change `issued` and watch `due` follow, entirely from a date already in the document.

# 06-aggregates.md

| Item      | Qty | Price | Total |
|-----------|----:|------:|------:|
| Widgets   |   4 | 12.50 | 50.00 |
| Gadgets   |   2 | 30.00 | 60.00 |
| Sprockets |   6 |  8.00 | 48.00 |

```vmark #order
Total = Qty * Price
grand_total = SUM(Total)
```

_Reducers_ collapse a whole column down to one number. VisiMark ships five: `SUM`, `MIN`, `MAX`, `AVG`, and `COUNT`. You have only met `SUM` so far.

**Scenario:**
1. Add `average_price = AVG(Price)` under `grand_total`. Switch to the KNOWLEDGE tab and find it sitting next to `grand_total`.
2. Add `cheapest = MIN(Total)`, `priciest = MAX(Total)`, and `line_count = COUNT(Total)`. Now add a fourth row to the table without touching the sheet at all — every one of those four numbers updates on its own.
3. Try writing `SUM(Price * Qty)` directly, skipping the `Total` column. VisiMark refuses it: a reducer takes exactly one bare column, never an expression — that rule is why every number a reducer produces can be traced back to a column you can actually see and re-add by hand.

# 07-reasoning.md

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

```vmark #order
Total = Qty * Price
grand_total = SUM(Total)
```

The REASONING tab shows what `visimark explain` shows: not the numbers, but *why* each one is what it is — the chain of rules that produces it.

**Scenario:**
1. Open the REASONING tab and read the explanation of `grand_total`: it is `SUM(Total)`, and `Total` is `Qty * Price`. This is the same chain a human auditor would have to reconstruct by hand from a plain table.
2. Change a `Qty` value, then look at REASONING again. The text reads exactly the same — REASONING explains the *rule*, not one run's numbers. (KNOWLEDGE, next, is where the numbers themselves live.)
3. Add a third computed line, `tax = ROUND(grand_total * 0.2, 2)`, and find it appended to the explanation in dependency order, after `grand_total` — REASONING always lists a value only once everything it depends on has already been explained.

# 08-knowledge.md

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

```vmark #order
Total = Qty * Price
grand_total = SUM(Total)
```

The KNOWLEDGE tab shows what `visimark eval --json` shows: the actual computed value behind every cell and scalar in the document, right now.

**Scenario:**
1. Open the KNOWLEDGE tab. Find `grand_total` in the JSON and match its value against what PREVIEW shows in prose — same number, two views of the same fact.
2. Change a `Price` cell and watch KNOWLEDGE update immediately, line by line — unlike REASONING, which stays still because the rule didn't change, only the numbers going through it.
3. Note the empty `assertions` array. It has nothing to show yet because this document does not check any invariant of its own — that's two chapters from now.

# 09-units.md

| Item    | Qty | Price  | Total  |
|---------|----:|-------:|-------:|
| Widgets |   4 | $12.50 | $50.00 |
| Gadgets |   2 | $30.00 | $60.00 |

```vmark #order
Total = Qty * Price
grand_total = SUM(Total)
```

Every cell in `Price` and `Total` carries the same `$` decoration. VisiMark calls this a _unit_ — not a real, convertible unit of measure, just a marking that a column must agree on.

**Scenario:**
1. Run BUILD. It passes, and `grand_total` is written back as `$110.00`, not a bare number — the column's unit is re-applied on write, even though `Qty` (bare) times `Price` (`$`) is computed with the `$` stripped off entirely for the arithmetic itself.
2. Delete the `$` from one `Price` cell and run BUILD again. VisiMark reports a `UNIT` error: the column no longer agrees on one decoration. Put it back.
3. Instead, change one `Total` cell's `$` to `zł`. Same `UNIT` error, a different mismatch — VisiMark does not know whether `$` and `zł` are both currencies, only that a column may not mix decorations.
4. There is no conversion anywhere in this story. A unit is a consistency check on a column, not a currency system — the human decides what `$` and `zł` mean; VisiMark only refuses to let them sit silently in the same column.

# 10-assertions.md

| Ledger | Expected | Actual  |
|--------|---------:|--------:|
| Cash   |   500.00 |  500.00 |
| Bank   |  1200.00 | 1200.00 |

```vmark #recon
variance = SUM(Actual) - SUM(Expected)
assert variance == 0
```

An `assert` states an invariant that must hold, not a value to compute. It has no output of its own — only a pass or a fail.

**Scenario:**
1. Run BUILD. It passes: `Expected` and `Actual` agree everywhere, so `variance` is `0` and `assert variance == 0` holds.
2. Change one `Actual` cell so it no longer matches its row's `Expected`. Run BUILD again — the assertion now fails, and VisiMark names it, instead of leaving behind a ledger that quietly no longer balances.
3. Put the number back so it balances again, then edit the assertion itself to `assert variance > 0`. The very same, correctly balanced ledger now fails — proof that `assert` only ever checks the exact invariant you wrote, nothing more.
4. Fix the assertion back to `== 0` and open KNOWLEDGE. The assertion's `holds: true` sits right there next to the numbers it is judging.

# 11-build-automation.md

| Item    | Qty | Price | Total |
|---------|----:|------:|------:|
| Widgets |   4 | 12.50 | 50.00 |
| Gadgets |   2 | 30.00 | 60.00 |

```vmark #order
Total = Qty * Price
grand_total = SUM(Total)
```

The BUILD tab runs `visimark check` across every open file at once — the same command a CI pipeline would run against a whole repository, not just the file in front of you.

**Scenario:**
1. Switch to the BUILD tab and click **Run Build**. Every file in FILES is checked, and the tab reports how many passed — not just the document you're currently editing.
2. Switch to a different file, break something in it (change a `Total` cell to a number that no longer matches `Qty * Price`, or leave a stale anchor), then switch back to this one. Run Build again — it still reports the failure in the other file, because BUILD always checks everything, not whatever happens to be on screen.
3. Fix the mistake and Run Build a third time. The status flips from `BUILD FAILING` back to `BUILD PASSING`. This is exactly the signal a pull request's CI check would show a reviewer — nothing about it is specific to the playground.

# 12-charts.md

| Item      | Qty | Price | Total |
|-----------|----:|------:|------:|
| Widgets   |   4 | 12.50 | 50.00 |
| Gadgets   |   2 | 30.00 | 60.00 |
| Sprockets |   6 |  8.00 | 48.00 |

```vmark #order
Total = Qty * Price
grand_total = SUM(Total)
chart spend as bar of Total labelled Item
```

![total spend by item](charts/order-spend.svg)<!--vmark=order.spend-->

A `chart` statement is a generated artifact: `fmt` draws the SVG from the column(s) it names, and `check` proves the file on disk still matches the table it was drawn from — so the picture can never quietly drift away from the numbers underneath it.

**Scenario:**
1. Look at PREVIEW: the bar chart is already there, sitting where the `![...]<!--vmark=order.spend-->` anchor points, drawn from the `Total` column.
2. Change a `Price` or `Qty` value. Watch the bar chart in PREVIEW redraw itself — it is generated fresh from the current numbers on every run, not a picture someone pasted in once.
3. Add a fourth row to the table (say, `Widgets Mini`) without touching the `chart` statement. A new bar appears on its own.
4. Change `chart spend as bar of Total labelled Item` to `chart spend as pie of Total labelled Item`. Same data, a different picture — proving the chart's shape is a one-word choice, not a separate drawing to keep in sync by hand.
