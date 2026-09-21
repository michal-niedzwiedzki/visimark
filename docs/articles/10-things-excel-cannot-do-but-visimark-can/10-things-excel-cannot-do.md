# 10 things Excel cannot do but VisiMark can

Tags: Excel, Markdown, Git, CI

Posted:
Reposted:

An `.xlsx` is a zip of XML. A VisiMark document is a Markdown file. What follows is what that difference does.

## 1. Show the formulas in the pull request

The rules sit in the file as text:

```
Net = Qty * Rate
VAT precision 2 = Net * vat
```

GitHub renders the tables. The diff of a quantity change is one line:

```diff
-| On-call support            | hour  |  12 |  260.00 |  3120.00 |  717.60 |  3837.60 |
+| On-call support            | hour  |  20 |  260.00 |  3120.00 |  717.60 |  3837.60 |
```

An `.xlsx` diff is not that line. The formulas are not that source.

## 2. Fail CI when the stored numbers disagree with the rules

Same invoice, quantity 12 changed to 20, derived cells left alone. The Markdown still renders. `check` does not:

```text
$ visimark check docs/example-invoice-drift.md
  STALE   lines.Net       · On-call support         3120.00 ≠ 5200.00    Qty * Rate
  STALE   lines.VAT       · On-call support          717.60 ≠ 1196.00    Net * vat
  STALE   lines.Gross     · On-call support         3837.60 ≠ 6396.00    Net + VAT
  ...
  26 problems (21 stale, 5 errors)
$ echo $?
1
```

Excel recalculates when you open the workbook. This is a command on the file in git, without Excel, while the file remains the document.

## 3. Bind a number in a sentence to a formula

```markdown
Net of tax the engagement comes to **23300.00**<!--vmark=lines.net_total--> PLN.
```

The HTML comment is invisible on GitHub, in VS Code preview, and in pandoc. `check` still compares the bold number to `SUM(Net)`. Excel has no equivalent that survives as ordinary Markdown.

## 4. Refuse a date that could be two dates

```text
$ visimark check date.md
  DATE    t.Start         · 11/12/2026            "11/12/2026"
          Dates must be ISO 8601 calendar dates: YYYY-MM-DD.
          Ambiguous: 2026-12-11 or 2026-11-12, 29 days apart. Fix by hand.
```

Excel picks one, from locale. `2026-12-11` checks clean. `11/12/2026` does not.

## 5. Keep the clock out of the file

```text
$ visimark check today.md
  TYPE    s.x               unknown function `TODAY`
```

There is no `TODAY()`, no `NOW()`, no locale, no plugin slot. Two checkouts of the same commit get the same numbers. Excel's `TODAY()` is the opposite of that.

## 6. Derive the rule from the table you already wrote

```text
$ visimark infer prices.md
  column rules
    Net    = Price * Qty                      3/3 rows

1 rule, 0 aliases, 0 scalars, 0 anchors.
```

`infer --write` inserts the block. It only proposes a rule that reproduces every row exactly.

## 7. State an invariant in the same file

```
assert variance == 0
```

On the clean invoice, `visimark eval --get recon.variance` prints `0` and exits 0. If the schedule stops adding up, `check` reports `ASSERT` and exits 1. The claim lives next to the numbers.

## 8. Ask a what-if without writing the document

`param budget precision 2 = default 2.00` is the cap in [`example-agent-budget.md`](https://michal-niedzwiedzki.github.io/visimark/preview.html?file=example-agent-budget.md). A scenario is an argument to `eval`, not an edit:

```text
$ visimark eval --scenario tight.json docs/example-agent-budget.md
  ASSERT  #calls   spent <= rates.budget
          0.4266 <= 0.40   is false under scenario (holds on defaults)
$ echo $?
1
```

The Markdown is byte-identical afterwards. `check` and `fmt` refuse `--scenario`.

## 9. Pin a local CSV to a hash in the document

````
```vmark #lines from example-invoice-csv-import.csv labelled Item, Unit, Qty, Rate, Net, VAT, Gross at sha256:e6667fb8dda6801721d885c259e2456a9e6c92f1ec89af7f14330e0c54c6ac14
````

Change a byte of the CSV:

```text
$ visimark check example-invoice-csv-import.md
  STALE   lines.            `example-invoice-csv-import.csv` does not match its recorded stamp
          expected sha256:e6667fb8dda6801721d885c259e2456a9e6c92f1ec89af7f14330e0c54c6ac14,
          got sha256:06824485a65f0142617c34c951f772d22e91a556bbe3f0c2f95e19da44115143
```

Excel can import CSV. It does not carry the digest in the document as the condition `check` enforces.

## 10. Commit the chart as a file, and check the bytes

[`docs/example-charts.md`](https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/example-charts.md) declares `chart performance as bar of Revenue, Cost, Profit labelled Month`. `fmt` writes `charts/example-charts-sales.svg`. `check` renders again and compares bytes. The image is an ordinary committed file. Excel's chart lives inside the workbook.

The workbook calculates. The Markdown file is the document in git.

## Disclosure

I wrote this article with AI. VisiMark is a MIT-licensed project with no business model or sales team behind it.

- [Website](https://michal-niedzwiedzki.github.io/visimark/)
- [Playground](https://michal-niedzwiedzki.github.io/visimark/playground.html)
- [Tutorial](https://michal-niedzwiedzki.github.io/visimark/tutorial.html)
- [GitHub](https://github.com/michal-niedzwiedzki/visimark)
- [VS Code extension](https://marketplace.visualstudio.com/items?itemName=visimark-michal-niedzwiedzki.visimark-vscode)
