# Agent run ledger — a harness reads and writes this, not a person

An autonomous coding agent working a multi-step task needs a spending cap it
cannot talk itself out of. The usual approach is a number buried in a prompt
("stay under $2") that the agent itself is trusted to track — the same actor
with an incentive to keep going is the one doing the accounting. Here the cap
and the running total live in a document a **harness** checks before the next
tool call is allowed to fire, so the enforcement point is outside the agent
entirely.

## Rate card

Prices are per million tokens, current as of the session start.

| Model            | Input $/M | Output $/M |
|------------------|----------:|-----------:|
| claude-opus-5     |     15.00 |      75.00 |
| claude-sonnet-5   |      3.00 |      15.00 |
| claude-haiku-4-5  |      0.80 |       4.00 |

```vmark #rates
budget = 2.00
```

The session budget is **$2.00**<!--vmark=rates.budget-->, fixed at session
start and never edited by the agent — only by the human who opened the task.

## Calls made this session

The harness appends one row per completed tool-use turn. Nothing here is
edited after it is written; a correction is a new row, the same discipline
`check` already expects of an input column.

A tempting first draft prices each row with a nested `IF` against the rate
card above:

```text
InputCost = ROUND(InputTok / 1000000 * IF(Model == "claude-opus-5", 15,
                   IF(Model == "claude-sonnet-5", 3, 0.8)), 4)
```

That is shown only to reject it: a column rule cannot look up a *row* of
another sheet's rate table — a reduce takes a whole column, not a foreign row
keyed by this row's `Model`, and there is no lookup primitive. The honest fix
is to carry the rate as an input column already priced per call, which is
what a real harness does anyway: it knows which model it called and what that
call cost, because it made the call.

| Step | Model            | InputTok | OutputTok | InCostPerM | OutCostPerM |   Cost |
|------|------------------|---------:|----------:|-----------:|------------:|-------:|
| plan       | claude-opus-5    |     4200 |       850 |      15.00 |       75.00 | 0.1268 |
| search x3  | claude-haiku-4-5 |    18500 |      1200 |       0.80 |        4.00 | 0.0196 |
| edit       | claude-sonnet-5  |     6100 |      2400 |       3.00 |       15.00 | 0.0543 |
| test-fix   | claude-sonnet-5  |     3800 |      1100 |       3.00 |       15.00 | 0.0279 |
| review     | claude-opus-5    |     5200 |      1600 |      15.00 |       75.00 | 0.1980 |

```vmark #calls
Cost = ROUND(InputTok / 1000000 * InCostPerM + OutputTok / 1000000 * OutCostPerM, 4)

spent     = SUM(Cost)
remaining = rates.budget - spent

assert spent <= rates.budget
```

Five calls have spent **$0.4266**<!--vmark=calls.spent--> of the
**$2.00**<!--vmark=rates.budget--> budget, leaving
**$1.5734**<!--vmark=calls.remaining--> before the next tool call is refused.

## The gate

```console
$ visimark eval docs/example-agent-budget.md --get calls.spent
0.4266
```

The harness runs this before dispatching each tool call, not after: if
appending the *next* projected row would fail `assert spent <= rates.budget`,
the call is never made, and the agent is told why in terms it can act on —
"budget exhausted at step 5", not a silent timeout. Compare that to a system
prompt instruction to "stop around $2": that number lives nowhere a process
can read it, so nothing outside the model's own judgment enforces it, and a
long enough context window eventually pushes it out of view entirely.

## Why this is a harness artifact, not a spreadsheet

The ledger is append-only, machine-written, and machine-read — no cell here
is a human's guess. What makes it VisiMark rather than a JSON log the harness
already keeps privately is that the **cap is asserted in the same document as
the spend**, so a reviewer auditing the session after the fact runs one
command and gets a verdict, and a harness bug that let spend exceed budget
shows up as a failed `check` in the transcript itself rather than requiring a
second script to reconcile two files that might disagree.
