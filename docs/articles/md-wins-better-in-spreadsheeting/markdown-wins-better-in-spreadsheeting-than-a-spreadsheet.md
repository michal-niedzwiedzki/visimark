# Markdown wins: Better in spreadsheeting than spreadsheet

Tags: Markdown, Spreadsheets, CI, AI
Author: Michał Niedźwiedzki

Posted:
Reposted:

## He needed one number. Calc wanted a relationship.

Michał was building a product after hours, the kind you open after the day job has been put in a drawer. He needed the GMV where a flat monthly plan and a commission plan cost the same. Simple maths: two prices and a percentage. He threw some inputs at it, squinted, adjusted, squinted again.

He did not fire up LibreOffice Calc. He has used Calc and Excel at work for years, and at 11pm he wanted a sticky note with arithmetic, not a conference room booked for a chat with a friend. So he googled the break-even, poked the GNOME calculator in the panel, and once piped the whole thing through `bc` because it was already in a terminal.

Calc does a million things he did not need that evening, and after an upgrade it greets you with a _Did you know?_ dialog, as if the missing piece was product education. It also saves the figure in a `.ods` sitting next to the Markdown file that actually has to quote it. Two files, one number. By the second adjustment they had already drifted, and nothing keeps them in sync except a person who has already gone to bed.

The README was already Markdown. The number belonged there.

## I usually write these in third person. This time that person is me.

I built VisiMark so a Markdown file would compute, the way a spreadsheet does. Change a knob, the derived numbers move, and the sentence that quotes them moves too. I'll admit it, I fell for the thing.

The evening's file is short.

````markdown
They meet at **24375.00**<!--vmark=p.breakeven--> of GMV.

```vmark #p
flat = 2000
fee = 50
pct = 0.08
breakeven precision 2 = (flat - fee) / pct
assert breakeven <= 50000
```
````

The `assert` is the thought I had about a medium tier, written down: this number stays below a line, or the commission plan is a trap.

## He raised the fee

He raised the flat price from 2000 to 5000, because the medium tier felt cheap, and changed nothing else.

```text
$ visimark check pricing.md
pricing.md

  STALE   p.breakeven                              24375.00 ≠ 61875.00
  STALE   1 prose anchors bound to the values above

  ASSERT  #p              breakeven <= 50000
          61875.00 <= 50000   is false

  3 problems (2 stale, 1 error)
$ echo $?
1
```

That is the dialog he actually wanted. The break-even moved, the sentence that quoted 24375 is now a liar, and the cap he wrote down is false. Calc would have shown a new cell and left the README alone.

`visimark fmt` rewrites the figure the document owns. The assert still fails until he lowers the price or admits the cap was theatre.

Later, building the plans endpoint, he asked an agent to feed the billing step from the same file.

"Export knowledge from that Markdown file as JSON. `visimark eval --json`. Make it a step in the build."

"Do you want me to write a skill for that?"

"Enthusiastically so."

```text
$ visimark eval pricing.md --json
```

```json
{
  "command": "eval",
  "visimark": "0.1.6",
  "status": "problems",
  "file": "pricing.md",
  "values": {
    "p.flat": "5000",
    "p.fee": "50",
    "p.pct": "0.08",
    "p.breakeven": "61875"
  },
  "assertions": [
    {
      "sheet": "p",
      "source": "assert breakeven <= 50000",
      "holds": false,
      "operands": {
        "breakeven": "61875.00"
      },
      "substituted": "61875.00 <= 50000"
    }
  ],
  "charts": []
}
```

The JSON is a projection of the README, not a second document, so it cannot drift. It also exits 1 while the assert is false, which means the build stops before billing quotes a price the cap forbids. The file lives in the repo, which is the only office that was open at 11pm.

He needed one number. He opened a Markdown file.

## Disclosure

I wrote this article with AI. VisiMark is a MIT-licensed project with no business model or sales team behind it.
