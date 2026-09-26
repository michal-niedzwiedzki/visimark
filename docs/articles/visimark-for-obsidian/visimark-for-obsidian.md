# VisiMark for Obsidian: calculations you can review, in plain Markdown

A plugin that makes numbers in your notes explicit, checkable, and still portable.

Tags: Obsidian, Plugins, Markdown, PKM
Author: Michał Niedźwiedzki

Posted:
Reposted:

## Your vault already checks a lot of things

Obsidian can tell you which notes point nowhere. Dataview can find missing fields. The linter can complain about a heading that has gone rogue.

Years of community plugins have shown that a vault made of plain Markdown files can do surprisingly database-like things without becoming a database.

There is one small problem: none of them know when a number becomes wrong.

Write `Net = Qty * Rate`, put `3120.00` on the page, then change the quantity and forget the total. Obsidian will still render it perfectly. Nothing looks broken.

That is the gap VisiMark tries to fill: checking whether numbers in your notes still match the formulas behind them, while keeping the experience feeling like Obsidian.

## Priya keeps her lab notebook where she keeps everything else

Priya is finishing a PhD in behavioral economics and runs her work from one vault: literature notes, meetings, and A/B test results from a part-time consulting job.

Her experiment log is just a normal note with a results table:

```vmark
Rate precision 4 = Conversions / Visitors

visitors    = SUM(Visitors)
conversions = SUM(Conversions)
pooled_rate precision 4 = conversions / visitors

```

She pastes a correction from an analytics export. VisiMark notices that a value no longer matches its formula.

The status bar changes from `VisiMark ✓` to `VisiMark · 1 to look at`.

Tap it, fix the number, and the warning disappears. No `STALE`, no exit code, no tiny build system hiding inside her notes.

## Kasia's invoices live next to her project notes

Kasia is a freelance UX designer. Her invoices live in the same vault as the projects they belong to. That's one of the reasons she uses Obsidian in the first place.

Her invoice might contain:

```vmark
Net             = Qty * Rate
VAT precision 2 = Net * vat
Gross           = Net + VAT
gross_total     = SUM(Gross)

```

A client asks for two more hours. Kasia changes the quantity on her phone while riding the train.

The totals update, and Reading mode shows a small provenance mark. Tap it and she can see the formula behind the number. The same works on desktop and mobile.

When the invoice is ready, she can use **Copy as JSON** to put `gross_total` and the other checked values on the clipboard. A small Templater script then uses them in a reminder email.

She even has an agent that reads the JSON to help chase unpaid invoices. It doesn't need to scrape the table. It gets the numbers VisiMark has already checked.

## I built it for my own invoices first

That's how this started.

I was updating the same six numbers every time a client asked for another hour. The engine began as a command-line tool because, well, arithmetic is arithmetic.

But a CLI is not much help when your invoice lives in Obsidian and you happen to be using your phone.

So the Obsidian client came later, with a different approach to reporting. No `STALE`, no CI-style error messages, no assumption that everyone has a terminal open.

I'm writing this before VisiMark is in the community plugin registry, and holding it back until it is. The manual test suite still has to run from start to finish inside a real vault first. I'd rather publish this a little late than tell you to go install something that isn't there yet.

## Grace runs a sprint from a vault

Grace leads a five-person engineering team. Their shared vault holds sprint plans alongside the notes explaining why decisions were made.

Capacity planning can be as small as:

```vmark
headroom precision 2 = people.available_total - work.committed

```

Someone adds a work item. The headroom recalculates when the note is opened.

It's not revolutionary. That's rather the point.

A plain Markdown file, synced like the rest of the vault, can do one more useful thing without sending anyone off to a spreadsheet.

## One less thing to double-check

Obsidian already has a nice trick: it lets you keep surprisingly structured information in ordinary files.

VisiMark applies that idea to numbers.

The note stays Markdown. The formulas stay readable. And when the arithmetic stops agreeing with itself, your vault can finally say so.

---

I wrote this article with AI assistance. VisiMark is MIT licensed, has no
business model, no sales team, and no signup. Try it without installing
anything at the [Playground](https://michal-niedzwiedzki.github.io/visimark/playground.html),
or read the [plugin's own README](https://github.com/michal-niedzwiedzki/visimark/blob/master/editors/obsidian/README.md)
and the [project repository](https://github.com/michal-niedzwiedzki/visimark).
