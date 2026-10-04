# How to finance with VisiMark: NPV, IRR, PMT

## What this covers

`PMT`, `NPV` and `IRR` are three of VisiMark's sixteen builtin functions. Between them they answer the two questions most financial documents ask: what is the fixed periodic payment on a loan (`PMT`), and is a stream of cash flows worth the money going in (`NPV`, `IRR`).

This is a working reference, not a finance course. Two documents follow: a loan, then an investment appraisal. Both are real `.md` files, checked into this repository. Every number in them was written by `visimark fmt`, not typed by hand, and `visimark check` passes on both. That distinction is the whole point of the tool: a number that follows from a rate and a term is not something you should ever retype after the third recalculation.

If you have not met VisiMark before, the short version: a fenced ` ```vmark ` block right after a table declares the rules for that table's columns and any totals derived from them. `fmt` fills the cells the rules describe; `check` fails, with a specific complaint, the moment a cell and its rule disagree.

## Loan: what PMT computes

`PMT(rate, nper, pv)` is the instalment that repays `pv` to exactly zero over `nper` periods at a per-period rate `rate`. Below is a three-year equipment loan, paid annually, with the full amortization schedule underneath it: `Interest`, `Principal` and `Balance` are separate rules, not one formula copied down a spreadsheet column.

| Period | Payment | Interest | Principal | Balance  |
|-------:|--------:|---------:|----------:|---------:|
|      1 | 6733.98 |  1080.00 |   5653.98 | 12346.02 |
|      2 | 6733.98 |   740.76 |   5993.22 |  6352.80 |
|      3 | 6733.98 |   381.17 |   6352.81 |    -0.01 |

```vmark #van
param principal precision 2 = default 18000.00
param rate      precision 4 = default 6%
param nper      precision 0 = default 3

payment precision 2 = PMT(rate, nper, principal)

Payment   = payment
Interest  precision 2 = (principal * (1 + rate) ^ (Period - 1) - payment * ((1 + rate) ^ (Period - 1) - 1) / rate) * rate
Balance   precision 2 = principal * (1 + rate) ^ Period - payment * ((1 + rate) ^ Period - 1) / rate
Principal = Payment - Interest

total_paid     = SUM(Payment)
total_interest = SUM(Interest)
```

On a principal of **18000.00**<!--vmark=van.principal--> PLN at **6.0%**<!--vmark=van.rate|percent--> a year over **3**<!--vmark=van.nper--> years, the instalment `PMT` computes is **6733.98**<!--vmark=van.payment--> PLN a year. Over the life of the loan that's **20201.94**<!--vmark=van.total_paid--> PLN paid, of which **2201.93**<!--vmark=van.total_interest--> PLN is interest.

Look at the last row of `Balance`: `-0.01`, not `0.00`. That is not a bug in the example. `PMT` rounds its answer to the declared precision, two decimals, because this is money, and a payment rounded to the cent does not zero out a balance computed at full precision three years later. The same cent shows up as the gap between `total_interest` (2201.93) and `total_paid` minus `principal` (2201.94). Real banks patch this by rounding the final instalment up by whatever is left; a VisiMark schedule just shows you the residual instead of hiding it in a spreadsheet's floating-point noise.

## Investment: NPV and IRR of a cash-flow schedule

`NPV(rate, flows)` discounts a column of cash flows back to today at a per-period `rate`; row 0 is undiscounted. `IRR(flows)` is the break-even discount rate: the rate at which that same column's present value is exactly zero, with no `rate` argument of its own.

Here's a small equipment purchase: money out at year 0, returns for four years after.

| Year |  Cash |
|-----:|------:|
|    0 |-50000 |
|    1 | 12000 |
|    2 | 15000 |
|    3 | 18000 |
|    4 | 22000 |

```vmark #deal
param discount_rate precision 3 = default 8%

npv precision 2 = NPV(discount_rate, Cash)
irr precision 4 = IRR(Cash)

assert npv > 0
```

At a discount rate of **8.0%**<!--vmark=deal.discount_rate|percent-->, this deal's net present value is **4430.83**<!--vmark=deal.npv-->, positive, which the `assert` line checks on every run, so a later edit that pushes `npv` negative fails `check` instead of shipping quietly. The break-even rate, `IRR`, is **11.54%**<!--vmark=deal.irr|percent-->: raise the discount rate past that and the deal stops paying for itself.

## The free bonus: what-if without touching the file

`rate`, `nper` and `discount_rate` above are all declared with `param`, not hardcoded. That buys you something neither of the two documents shows on its own: a what-if question that never edits the file.

```
$ echo '{"nper":"4"}' | visimark eval howto-finance-npv-irr-pmt.md --scenario - --get van.payment
5194.65
$ echo '{"discount_rate":"11%"}' | visimark eval howto-finance-npv-irr-pmt.md --scenario - --get deal.npv
638.67
```

Stretching the loan to four years drops the instalment from 6733.98 to 5194.65. Pushing the hurdle rate from 8% to 11%, close to the deal's own 11.54% break-even, drops the NPV from 4430.83 to 638.67, still positive, by design: this deal is meant to survive a rate close to its `IRR`. Neither command touched the document on disk; `--scenario` reads its input, evaluates the whole sheet against it, and prints the one number you asked for. This is the part a spreadsheet can't give you for free: no copy of the file, no "scenario 2" tab to forget about and reconcile later. One document, one set of rules, and a rate you can swap out from the command line.

## Precision is not optional on these three

Most functions in VisiMark know how many decimals to write from their inputs: `+` and `-` take the wider operand, `ROUND` takes its argument, `COUNT` is always whole. `PMT`, `NPV` and `IRR` do not. Along with plain division, `AVG` and `SQRT`, they bound nothing, because nothing about a discount rate or an amortization schedule tells you how many digits are meaningful. That is a decision, not arithmetic, and VisiMark refuses to guess it for you.

Leave it out and `fmt`/`check` refuse outright:

```
PRECISION van.payment      `PMT(rate, nper, principal)` has no derivable precision
          declare the width: `payment precision N = …`
```

`payment precision 2 = PMT(...)` above is what answers that. The number goes right after the name, before the `=`.

`IRR` has a second, rarer failure along the same line. It searches for the break-even rate by bisection, and for most cash flows that search pins down as many digits as you ask for. But if the true rate sits close enough to a rounding boundary at the width you declared, say you asked for 18 decimals on a rate that your bisection can only approach and never land on exactly, `check` reports it rather than print a value it cannot stand behind:

```
PRECISION deal.irr    IRR did not determine a rate at precision 18
```

More decimals only makes it worse. The fix is to declare the precision the input actually supports (four digits is already more than any real cash-flow forecast justifies), or wrap the call in `ROUND(IRR(Cash), 4)` if you want the same width the engine can guarantee, explicitly.

## Verify it yourself

Nothing above is a screenshot or a hand-typed example. This article is the document: every number in it lives in the same `.md` file you're reading, at `docs/articles/howto-finance-npv-irr-pmt/` in this repository, and `visimark check howto-finance-npv-irr-pmt.md` passes on it right now. No spreadsheet to download, no separate source file to trust instead of the prose.

## Disclosure

I wrote this article with AI. VisiMark is a MIT-licensed project with no business model, sales team or signup behind it.

The [Playground](https://visimark.dev/playground.html) runs the tool in your browser with nothing to install. The [repository](https://github.com/michal-niedzwiedzki/visimark) and the [project site](https://visimark.dev/) have the rest.
