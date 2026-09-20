# Markdown woes: Looks right, is wrong

Tags: Markdown, CI, AI, GitHub

Posted: https://dev.to/holdmybear/markdown-woes-looks-right-is-wrong-4ep0
Reposted: https://visimark.hashnode.dev/markdown-woes-looks-right-is-wrong

## Your Markdown can be perfectly rendered and completely wrong

Markdown has an unfair advantage: it looks trustworthy.

A table lines up, the headings are right. The numbers have two decimal places. GitHub renders it beautifully. The pull request is green, so you merge it.

And the invoice is wrong.

Not obviously wrong: not broken-Markdown wrong. Not “the build failed” wrong. Worse: **arithmetic wrong**, and that is a different class of problem, one Markdown has never really had an answer for.

## Marta has an invoice to ship.

Marta, a project manager at a small software consultancy. She is good at getting things out the door and the company needs people like her: smart, gets things done on an infra stack that hangs together on zip ties and duct tape. And agents, lots of AI agents.

The client has added eight hours of on-call support to an already annoying project. Marta opens the invoice in her editor, finds the quantity, changes: `12` to `20`.

The table still looks fine. She scans the diff.

```diff
-| On-call support | hour | 12 | 260.00 | 3120.00 | 717.60 | 3837.60 |
+| On-call support | hour | 20 | 260.00 | 3120.00 | 717.60 | 3837.60 |
```

Looks like the intended change and Peter, the reviewer, who is a programmer does not concern himself too much with non-code.

“Eight more hours. Makes sense.” Approved.

Marta closes her laptop. She has a train to catch.

The invoice is wrong.

The net amount should have changed from 3,120 to 5,200. VAT should have changed. Gross should have changed. The invoice total should have changed. The payment schedule should have changed. The early-payment discount should have changed.

None of that happened. And yet **the Markdown is valid Markdown.**

## Git sees the edit. It does not see the mistake.

This is the uncomfortable bit. Git is doing exactly what it was built to do: it tells you that one value changed. Markdown rendering is also doing exactly what it was built to do: it tells you that the document can be rendered.

Neither one knows that `Net = Qty × Rate` is supposed to be true.

They see this:

```text
Qty:   20
Net:   3120.00
```

A human sees it too, and a human reviewer has to stop and calculate.

- Then notice that VAT is stale.
- Then notice that gross is stale.
- Then notice that the invoice total is stale.
- Then notice that the payment schedule is stale.
- Then notice that the prose still quotes the old totals.

At some point, this stops being code review. It becomes **rebuilding the spreadsheet in your head.** That is a terrible way to review a document.

## The dangerous numbers are the ones that still look plausible

A typo is easy to catch. `52000` instead of `5200` jumps off the screen. A derived-number error doesn't. `3120` looks fine for twenty hours at that rate. `717.60` looks like normal VAT. Nothing is absurd, so nobody stops to check the relationship between the numbers. That's the whole bug.

## Nobody designed it this way

The company that employs Marta and Peter didn't set out to build a fragile invoicing process. It started as a two-person proof of concept that happened to land a client, then a second one, then five more before anybody had a spare afternoon to fix the parts held together with hope. Peter's first job there, on his first day, was helping carry desks up three flights of stairs. Two years later he's reviewing six-figure invoices in Markdown, same instinct for getting things done, new stakes.

That's not a knock on Peter or Marta. It's how most small companies actually grow: traction arrives faster than process does, and the gap between them is where invoices like this one live.

## The tool I wrote for exactly this problem

I built the first version for my own invoices, because I was tired of hand-updating the same six numbers every time a client asked for one more hour. Then I thought it might be useful to somebody other than me, so I painted it and waxed it: a real CLI, real docs, a name. I'll admit it, I fell for the thing. It brings me genuine joy to keep working on it.

Instead of treating this:

```markdown
| Item  | Price | Qty | Net   |
|-------|------:|----:|------:|
| pen   |  5.00 |  10 | 50.00 |
| paper |  0.10 | 100 | 10.00 |
```

as a pile of unrelated numbers, I state the rule:

````markdown
```vmark #order
Net   = Price * Qty
total = SUM(Net)
assert total > 0
```
````

Now `50.00` is no longer just a number sitting in a cell. It has a derivation: the document says, in effect:

- This value is supposed to be `Price × Qty`.
- That value is supposed to be the sum of `Net`.

Now that changes the review model. You don't have to trust the number. **You can check the claim that produced it.**

## VisiMark doesn't replace Markdown. That's the point.

A VisiMark document is still an ordinary Markdown file. The Markdown still renders normally, the formulas live in `vmark` blocks. Numbers in prose can be connected to calculated values with invisible anchors:

```markdown
Order total: **60.00**<!--vmark=order.total-->

```

The HTML comment doesn't clutter the rendered document. But VisiMark can now ask a much more useful question: does the number written here still agree with the formula?

That is the missing layer: Markdown handles the document, Git handles the history, VisiMark handles the arithmetic.

## Back to Marta's invoice

She changes the on-call quantity from 12 to 20. The table still renders fine. But now the repo runs a check before anything gets approved:

```text
$ visimark check invoice.md
STALE   lines.Net       · On-call support
        3120.00 ≠ 5200.00    Qty * Rate

STALE   lines.gross_total
        28659.00 ≠ 31217.40   SUM(Gross)

STALE   schedule.Amount · Signature
        8597.70 ≠ 9365.22    Share * lines.gross_total
```

Not a subtle warning. Each line points at exactly what's now wrong and why. The document isn't hoping Peter notices; it's telling him, and loudly so: by breaking the build.

That's the shift. A Git diff tells you what changed. VisiMark tells you what should now be true, and whether it is. Those turn out to be different questions, and only one of them was ever being asked.

Wire `visimark check` into CI and the rule gets blunt: if the document disagrees with its own arithmetic, the build fails. No more hoping someone remembers to recalculate the invoice by hand.

And since fixing stale numbers by typing them in by hand is exactly the kind of chore nobody wants, `visimark fmt` will just repair them for you. The formula is the source of truth; the numbers are just its last known output.

## The morning after

The client asks for eight more hours. Marta makes the edit. CI goes red before anyone has to eyeball a spreadsheet in their head. She runs the formatter in a VisiMark VS Code extension, the totals catch up on save, she checks the diff: numbers changed, formulas didn't. That's the whole review.

She sends an invoice that doesn't just look right. It's been checked against the rules that produced it, and the proof travels with the file.

**Your Markdown can be perfectly rendered and completely wrong.** VisiMark doesn't fix Markdown. It just makes the numbers show their work.

## Disclosure

I wrote this article with AI. VisiMark is a MIT-licensed project with no business model or sales team behind it.

- [Website](https://michal-niedzwiedzki.github.io/visimark/)
- [Playground](https://michal-niedzwiedzki.github.io/visimark/playground.html)
- [Tutorial](https://michal-niedzwiedzki.github.io/visimark/tutorial.html)
- [GitHub](https://github.com/michal-niedzwiedzki/visimark)
- [VS Code extension](https://marketplace.visualstudio.com/items?itemName=visimark-michal-niedzwiedzki.visimark-vscode)

The article first appeared on [DEV.to](https://dev.to/holdmybear/markdown-woes-looks-right-is-wrong-4ep0).