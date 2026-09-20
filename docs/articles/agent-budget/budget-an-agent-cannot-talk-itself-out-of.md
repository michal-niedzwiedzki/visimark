# The budget an agent cannot talk itself out of

Tags: AI, Agents, Markdown, CI

Posted:
Reposted:

## The prompt said two dollars. The invoice said forty-six.

Dana runs the platform for a small company that ships faster than it documents. Last month she pointed a coding agent at a backlog of flaky tests and went to bed. The prompt was polite and specific: "Keep the whole session under $2."

At breakfast the provider dashboard said $46.

The agent had not lied. Around step nine it hit a failing test, decided one more retry was cheap, and then decided that again. Every decision was reasonable. The instruction to stay under two dollars was somewhere far up a context window that had long since scrolled it out of view.

## The accountant was the one spending

Look at who tracked the budget. The agent did, and the agent was also the one with a reason to keep going. Nothing outside the model could read the number, so nothing outside the model could enforce it.

Dana's first fix was a wrapper script that summed token counts from a log. It worked until the log format changed, and then it quietly summed nothing. Her second fix was to write the cap in the prompt twice.

## Put the cap where a process can read it

The cap and the running total belong in a file that a harness checks before it lets the next tool call fire. The agent can argue with a prompt. It cannot argue with an exit code.

I built VisiMark to keep numbers in Markdown honest: a table holds the inputs, a small block states the rules, and a command checks that they still agree. Dana's ledger is one of the documents I use to try it out. The harness appends a row per model call, and the block under the table looks like this:

````markdown
```vmark #calls
Cost = ROUND(InputTok / 1000000 * InCostPerM + OutputTok / 1000000 * OutCostPerM, 4)

spent     = SUM(Cost)
remaining = rates.budget - spent

assert spent <= rates.budget
```
````

The budget itself is one line in another block, `param budget precision 2 = default 2.00`, and only the human who opened the task edits it. The whole ledger is [on the site](https://michal-niedzwiedzki.github.io/visimark/preview.html?file=example-agent-budget.md&highlight=1), with its rate card and the five calls that have run so far.

## The next call

Five calls in, the ledger reads clean.

```text
$ visimark check ledger.md
ledger.md

  0 problems (0 stale, 0 errors)
$ visimark eval ledger.md --get calls.spent
0.4266
```

Then the agent hits the failing test and wants a retry loop: nine attempts on the expensive model, 61,000 tokens in and 14,000 out. Before dispatching the call, the harness appends the projected row and asks the document.

```text
$ visimark eval ledger.md --get calls.spent
2.3916
  ASSERT  #calls   spent <= rates.budget
          2.3916 <= 2.00   is false
$ echo $?
1
```

Exit code 1. The harness never makes the call. It tells the agent that the budget would be exhausted at step 6, which is a sentence the agent can act on: summarise what it has and stop, or ask the human for more.

The model never got a vote. It was never shown a number to bargain with.

## Why a document and not a log

Dana already had a log. The difference is that the cap sits in the same file as the spend. A reviewer who audits the session next morning runs `visimark check` once and gets a verdict, without reconciling two files that may disagree. If a harness bug lets spend slip past the budget, the ledger fails its own check, and the transcript shows it.

She also stopped rewriting the prompt. It still says two dollars, because it is polite to tell the agent. The document is what holds the line.

## Disclosure

I wrote this article with AI. VisiMark is a MIT-licensed project with no business model or sales team behind it.

- [Website](https://michal-niedzwiedzki.github.io/visimark/)
- [Playground](https://michal-niedzwiedzki.github.io/visimark/playground.html)
- [Tutorial](https://michal-niedzwiedzki.github.io/visimark/tutorial.html)
- [GitHub](https://github.com/michal-niedzwiedzki/visimark)
- [VS Code extension](https://marketplace.visualstudio.com/items?itemName=visimark-michal-niedzwiedzki.visimark-vscode)
