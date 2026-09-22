# Three agents and a 5-dimensional for-loop

Tags: AI, Agents, Markdown, CI
Author: Michał Niedźwiedzki

Posted:
Reposted:

## Five knobs and a Friday

Ines had five knobs, one Friday afternoon, and a client who wanted to sign before the weekend.

The client was Aperture Labs, a research outfit whose procurement contact, a Mr. Johnson, approved every purchase order with the words "for science" and had never once been heard to say synergy. They had approved forty thousand zloty, gross, and no more. Ines needed at least seventeen thousand in the bank on the day of signature, because the firm's payroll did not care about anyone's approval process. She also wanted to give Aperture a discount, because in four years of dealing with Mr. Johnson the discount was the only thing that had ever earned her a thank-you.

The knobs were these. More backend hours in the first order. A percentage off the whole engagement. The share of the invoice due at signature. Some days of a Security review, a second service the firm could sell alongside. And an upgrade of the on-call hours to the premium tier.

She had been turning them by hand for an hour. Each combination she liked went into the quote, the totals moved, she frowned, and she typed the old numbers back. By four o'clock she had sold the same engagement six different ways and could not say which of them she would defend to Marek in finance, who owned the margin floor and kept it in his head and nowhere else.

She could think of two ways to find the best combination. She did not trust either.

## Why the quote lived in her head

The firm had grown from three people to twelve without anyone deciding to grow it. The quote was a spreadsheet Marek had built when there were three of them, and it was very good for three of them: a few lines, a total, a formula he could hold in his mind. The margin floor was his. The number of Security days that could be spared was Priya's, in delivery, and it changed with her calendar. Neither number was written down in the spreadsheet, because when there were three people you just asked.

A what-if meant editing that spreadsheet, and editing it had a history. Two quarters earlier somebody had tried a discount to see what it did, saved the file to go and get coffee, and the quote went out with the discount in it. Nobody had meant to give it. The client noticed within the hour, and the client did not send a thank-you note about it.

So people stopped asking what-if questions and started guessing. Ines was very good at guessing, which is a useful skill until the day it is a substitute for arithmetic.

## What I put in the document

I made up Ines, Tomek, Marek and Mr. Johnson. The document they argue over is real, and every number in this article came from running it.

I built VisiMark so that a number in a Markdown file carries the formula that produced it, and a command can prove the two still agree. Recently I added one more thing to it that turned out to matter here: a value can be declared a parameter, and a run can ask what the document would say if the parameter were different, without touching the file.

The seller's working copy of the quote is a document like that. The five knobs are declared once, with the value the quote actually has as the default:

```text
param extra_hours    precision 0 = default 0
param volume_disc    precision 3 = default 0%
param prepay_share   precision 2 = default 30%
param crosssell_days precision 0 = default 0
param premium_hours  precision 0 = default 0
```

Marek's floor and Priya's four days went into the same file, as plain constants with assertions beside them. Nobody has to remember them any more, and nobody can turn them from outside, because only a declared parameter can be varied and none of these is one.

```text
min_margin        = 40%
security_capacity = 4
buyer_budget      = 40000.00

assert lines.margin >= min_margin
assert levers.crosssell_days <= security_capacity
assert lines.gross_total <= buyer_budget
```

The whole file, with its rate card, its unit costs and its charts, is [on the site](https://michal-niedzwiedzki.github.io/visimark/preview.html?file=example-deal-desk.md). It passes its own check:

```text
$ visimark check docs/example-deal-desk.md
docs/example-deal-desk.md

  0 problems (0 stale, 0 errors)
```

Ines asked her first question the way a person does, by writing it down. A scenario is a small JSON file whose values are strings, and this one said: take half the invoice at signature, and give them eight percent for it.

```text
$ cat first.json
{ "prepay_share": "50%", "volume_disc": "8%" }
$ visimark eval --scenario first.json docs/example-deal-desk.md
lines.margin                  0.3646
lines.signature               13183.14
...
scenario: first.json
  levers.volume_disc     0.08  scenario  (default 0)
  levers.prepay_share    0.5   scenario  (default 0.3)
  ASSERT  #guardrails   lines.margin >= min_margin
          0.3646 >= 0.4   is false under scenario (holds on defaults)
$ echo $?
1
```

The signature payment went from 8597.70 to 13183.14, which was the direction she wanted. The margin fell to 0.3646, under Marek's floor, and the run said so and exited 1. It also said the assertion holds on the defaults, so the failure belonged to her scenario and the quote itself was fine. Nothing had been written to the file. There was no coffee break in which to save it by accident.

She read the output twice, mostly for the pleasure of it. Then she saw the size of what remained.

## The phone call

She called Tomek out of habit more than plan. He was the person she called when a good idea needed a second brain. He picked up on hands-free, engine noise behind him, somewhere on the ring road between a client site and the office.

"Five knobs," she said, and read him the ranges: up to forty extra hours, up to ten percent off, five prepay steps, up to four Security days, up to twelve premium hours. "I want the best combination and I have until five."

"Don't try them one at a time. Write a script. A loop inside a loop inside a loop, one for each knob, and inside all of them you call visimark with a scenario file and read what comes back. Keep the ones that pass, take the biggest discount out of what's left. Maybe forty lines."

"Show me."

"I'm driving."

"Tell me, then."

He tried. Open a terminal, he said, and a text editor, and start a file called sweep.py. Import subprocess, and json. For hours in range of forty-one, because range stops one short of the number you give it and she wanted zero through forty. A merge lane interrupted him. When he came back he was somewhere inside a second loop, explaining that a Python dictionary needs its keys written as strings, that the percent sign in a discount value was just a character in that string and not something the language cared about, that json.dumps would turn the whole thing into text she could hand to a subprocess call. Somewhere after that she lost whether the variable was called disc or discount, and it turned out the difference mattered.

"I have a notepad with six lines that don't run," she said, "and you have a car to drive."

"This is the right way to do it." There was an edge in his voice that had nothing to do with her. A truck pulled out ahead of him and took half his next sentence with it. "I can be there in forty minutes, if the traffic holds."

"I don't have forty minutes."

A pause, with only road noise in it. The sound of a person doing arithmetic they did not like the answer to.

"Then don't wait for me," he said, and hung up to put both hands back on the wheel, which is about as close as a considerate engineer gets to admitting he has lost an argument to physics.

She sat with the notepad a moment. The Python was gone, but the idea underneath it was not. Try many things, fast, and trust only the ones the document itself signs off on. She did not need to write that loop by hand to have it run. She could ask something else to run it for her, in a language she already trusted, and read the results the way she had read her own first scenario ten minutes earlier.

## Three agents

What Tomek had wanted, under the Python, was to hand a search to something that would try many things and stop at the ones the document approved. Ines had three of those already, and none of them needed a car ride to explain. She opened three agent sessions and gave each the same brief, one Tomek would have approved of if he had had a working phone signal to read it over:

> Aperture Labs wants to sign this week. We need at least 17000 PLN in the bank at signature. Beyond that, give them as much discount as the guardrails allow: discount is the concession we trade for a bigger commitment. Use `visimark eval --scenario` to try combinations and read the assertion results. Report the best scenario you find and what you learned. Do not edit the document. The guardrails are not negotiable.

The brief does not mention the margin floor, the budget or the Security team, because those are in the document, and an agent that ignored them would find out on the next run. Each agent went its own way, which is what three agents given the same brief tend to do.

The first went for cash. The share due at signature is the direct lever on signature cash, so it started there. At fifty percent, the highest share Aperture would agree to, the payment came to 14329.50. That was short of seventeen thousand, and nothing in the document objects to a payment being short, so the run passed. It tried sixty percent, got 17195.40, and the run failed the prepay ceiling. Then it stopped. No share it was allowed to ask for could reach the target on this invoice, and the invoice itself would have to grow.

The second went for volume. It added the full forty backend hours, set the share to forty-five percent, and offered five percent off in exchange. The margin floor failed at 0.3828. It walked the discount down, three percent failing at 0.3956, two percent passing at 0.4017, and reported two percent as the most that this route could afford.

The third went for mix. It sold the Security review at four days, upgraded all twelve on-call hours, and asked forty-five percent at signature. With no discount at all the margin came out at 0.4265. It found the edge of that route by trying five days, which turned out to be worse than exceeding the team's capacity:

```text
$ visimark eval --scenario fifth.json docs/example-deal-desk.md
  ASSERT  #guardrails   levers.crosssell_days <= security_capacity
          5 <= 4   is false under scenario (holds on defaults)
  ASSERT  #guardrails   lines.gross_total <= buyer_budget
          42139.80 <= 40000.00   is false under scenario (holds on defaults)
```

A fifth day broke two limits in one run, the team's capacity and Aperture's budget. Back at four days, the third agent added a discount, found that five percent failed the floor at 0.3964 and four percent passed at 0.4026, and tried forty percent at signature just to see, which dropped the payment to 15237.04 and missed the target.

It reported this scenario as its best:

```text
$ cat winner.json
{
  "crosssell_days": "4",
  "premium_hours": "12",
  "prepay_share": "45%",
  "volume_disc": "4%"
}
$ visimark eval --scenario winner.json docs/example-deal-desk.md
lines.net_total               30969.6
lines.cost_total              18500
lines.margin                  0.4026
lines.gross_total             38092.61
lines.signature               17141.67
...
$ echo $?
0
```

Four percent off, 38092.61 gross, 17141.67 at signature, and a margin that cleared the floor by twenty-six ten-thousandths. The agent's note said the same thing more carefully: the mix route had room for a bigger discount than the volume route because a Security day earns more than the deal's blended margin, and every extra backend hour earns about what the deal already does. It also said the margin was thin, that a small rise in the Security team's unit cost would break it, and that the number should be confirmed before the quote went out.

Ines read the note with something close to affection. She still did not fully trust it. A paragraph is not the same thing as a checked result, and the one person who could have written her a proper check was somewhere on the ring road, out of reach.

## A loop she could actually write

The exhaustive version of Tomek's idea meant watching all five knobs across a hundred and forty thousand combinations. She did not have Python at hand, or the forty minutes, or, if she was honest, a firm memory of what json.dumps did under the hood. What she had was a terminal she used every day and visimark installed on it the same as everyone else's, because the firm ran every invoice through it before it went out the door. She had already used it once that afternoon, by hand, with a single scenario file. A loop that wrote a new file and called the same command again was not Tomek's forty lines of Python. Five lines of Bash would do, and Bash was a language she had never been afraid of.

Agent C's report gave her somewhere to start: four Security days, twelve premium hours, a discount that seemed to sit around four percent depending on the prepay share. She did not want to take the agent's word for where that edge was. She wanted to see it herself, so she fixed what the report had already fixed and swept the two knobs it had left open.

```bash
$ cat sweep.sh
#!/usr/bin/env bash
echo "prepay,disc,margin,signature,exit" > results.csv
for prepay in 40 45 50; do
  for disc in 0 1 2 3 4 5; do
    printf '{"crosssell_days":"4","premium_hours":"12","prepay_share":"%s%%","volume_disc":"%s%%"}' \
      "$prepay" "$disc" > scenario.json
    out=$(visimark eval --scenario scenario.json docs/example-deal-desk.md --json)
    code=$?
    margin=$(echo "$out" | jq -r '.values["lines.margin"]')
    signature=$(echo "$out" | jq -r '.values["lines.signature"]')
    echo "$prepay,$disc,$margin,$signature,$code" >> results.csv
  done
done
$ bash sweep.sh
$ column -s, -t results.csv
prepay  disc  margin  signature  exit
40      0     0.4265  15871.92   0
40      1     0.4207  15713.2    0
40      2     0.4148  15554.48   0
40      3     0.4088  15395.76   0
40      4     0.4026  15237.04   0
40      5     0.3964  15078.32   1
45      0     0.4265  17855.91   0
45      1     0.4207  17677.35   0
45      2     0.4148  17498.79   0
45      3     0.4088  17320.23   0
45      4     0.4026  17141.67   0
45      5     0.3964  16963.11   1
50      0     0.4265  19839.9    0
50      1     0.4207  19641.5    0
50      2     0.4148  19443.1    0
50      3     0.4088  19244.71   0
50      4     0.4026  19046.31   0
50      5     0.3964  18847.91   1
```

Eighteen calls, eighteen seconds, one file she could read on the screen without scrolling. The pattern held regardless of prepay: at five percent off, the margin broke the floor every time, exit code 1. At four percent it held, every time, at exactly 0.4026. That number depends only on the discount and what it costs, not on how the invoice is split at signature, and once she saw the column laid out flat she understood why: prepay just moves money in time, it does not move it out of the deal. The seventeen thousand was a different kind of number. It was not a line the document enforced, only the figure in Ines's own brief, so she read that column with her own eyes, the way agent C had. At forty percent prepay it never got there, at any discount. At forty-five it cleared seventeen thousand from four percent downward. Forty-five was the smallest ask that worked, so forty-five it was.

She had confirmed the third agent's answer herself, on a page she had written, in a language she already knew.

## Tomek, later

He arrived a little after five, keys still in hand, expecting a mess or nothing at all. He found a CSV with the shape of a spreadsheet and a Bash script eleven lines long.

He read it the way he read everyone's code, quietly first, then aloud. "Eighteen points. You never touched extra_hours. You never went past fifty on prepay."

"Agent C already ruled those out. I only had two knobs left to check."

"That's not a search. That's checking somebody else's homework."

"It's checking somebody else's homework with the actual tool, instead of trusting a paragraph," she said. "Whose word were you going to take an hour ago?"

He didn't have an answer for that, which she took as a kind of answer. He read the script again, this time for the parts he would have written differently, and found none worth arguing about.

"There's something I want to know before you send it," Ines said. "The four Security days. I got that from Priya, once, in a corridor. If I'm wrong about the four, agent C's answer is perfect and useless." She had already called Priya to be sure, and Priya had confirmed it: four, not five, and please put it in writing next time anyone asked.

"Four is what's in the document. That's what the document approves." Tomek turned the number over anyway, out of a compulsion he'd never bothered denying. "It's not wrong. It's just not exhaustive. Give me tonight and I'll tell you if anything outside your eighteen points does better."

## What the whole space said

That evening he wrote the script he had wanted to dictate over the phone, except this time in TypeScript, on a keyboard, with both hands. It reached past the command line into the same engine visimark's own CLI calls, because nothing at the command line sweeps a space on its own; a hundred and forty-six thousand calls to `eval`, each its own process, would have taken about five hours.

```ts
import { readFileSync } from "node:fs";
import { build } from "./packages/visimark/src/model/build.js";
import { locate } from "./packages/visimark/src/parse/document.js";
import { check } from "./packages/visimark/src/eval/check.js";
import { resolveScenario, applyScenario } from "./packages/visimark/src/eval/scenario.js";

const model = build(locate(readFileSync("docs/example-deal-desk.md", "utf8")));
const str = (v: string) => JSON.stringify(v);

let points = 0;
let feasible = 0;
let bestDiscount = 0;
let atBest = 0;
const started = performance.now();

for (let hours = 0; hours <= 40; hours++)
  for (let disc = 0; disc <= 10; disc++)
    for (let prepay = 30; prepay <= 50; prepay += 5)
      for (let days = 0; days <= 4; days++)
        for (let premium = 0; premium <= 12; premium++) {
          points++;
          applyScenario(
            model,
            resolveScenario(model, [
              { key: "extra_hours", raw: str(`${hours}`) },
              { key: "volume_disc", raw: str(`${disc}%`) },
              { key: "prepay_share", raw: str(`${prepay}%`) },
              { key: "crosssell_days", raw: str(`${days}`) },
              { key: "premium_hours", raw: str(`${premium}`) },
            ]),
          );
          const run = check(model);
          const limitsHold = run.assertions.every((a) => a.holds !== false);
          const signature = (run.values.get("lines.signature") as { d: number }).d;
          if (!limitsHold || signature < 17000) continue;
          feasible++;
          if (disc > bestDiscount) [bestDiscount, atBest] = [disc, 0];
          if (disc === bestDiscount) atBest++;
        }

const seconds = Math.round((performance.now() - started) / 1000);
console.log(`${points} scenarios in ${seconds}s`);
console.log(`${feasible} meet the target inside every limit`);
console.log(`the largest discount among them is ${bestDiscount}%, reached by ${atBest} of them`);
```

```text
$ bun test-chamber.ts
146575 scenarios in 79s
6171 meet the target inside every limit
the largest discount among them is 4%, reached by 234 of them
```

He texted her the numbers before nine the next morning. Four percent, same as her eighteen points had said, and two hundred and thirty-four ways to reach it, hers among them. Then, because peace of mind is a compulsion for him too, he changed one constant and ran it again: security_capacity from four days to two, the number Priya had confirmed only reluctantly.

```text
$ bun test-chamber.ts
146575 scenarios in 73s
4076 meet the target inside every limit
the largest discount among them is 3%, reached by 589 of them
```

Two days instead of four costs a percentage point of discount. He sent that too, unprompted, the closest he came to admitting out loud that the constant mattered as much as the search.

## Where each one runs out

By the time both messages had landed, Ines had stopped thinking of it as agents against a loop. It was three tools for three different amounts of time. The agents took a few minutes each and came back with a route and a reason, no install beyond what the firm already ran. A person who is comfortable with a shell and a text file for output can use the same tool to check a lead in the same afternoon, without waiting on anyone's calendar. The full sweep of the space took the tool's own author, an evening, and code that reaches past the public interface, because nothing in visimark today sweeps a space on its own. Each is the right size for a different amount of time on the clock, and none of them argued with the guardrails in the document, because none of them could.

What none of the three could check was Priya's four days, or Marek's floor, or the number Mr. Johnson had actually approved. The document is only as honest as the constants a person put into it. A scenario that looks best on paper because a capacity number is stale is a scenario the document will happily wave through, agents and loops both. Ines had made the call to Priya before she sent anything, which is the one check none of the tools could have made for her.

## What is left over

Tomek complained a little more the next morning, in the way of engineers who have won an argument and are still not satisfied. The helpers his script reaches into are not part of the package's public interface. The table of ten runs the agents tried, the one with their totals and margins, sat in the document pasted in from command output, which meant the checker had no way to tell if it had drifted from the model underneath it. And a chart of the margin against the discount, the picture that would have shown exactly where the floor gets crossed, was one missing feature away from possible, if a table could hold scenarios instead of only data. He said he would write it up. Ines said that was the first sensible thing anyone had said about any of this in two days.

She had sent Aperture Labs the quote earlier that same afternoon, at ten to five, well before either of Tomek's messages arrived: forty-five percent at signature, four percent off, four days of Security review, twelve on-call hours in the premium tier. Under it, she had left one line Marek could check in a minute on Monday, the scenario file itself, sitting next to the document that had approved it.

Mr. Johnson replied within the hour. It said "Approved. For science."

Ines still had five knobs. For the first time she had a quote she could defend, and she had defended it before the engineer who was so sure he knew the answer had even parked the car.

## Disclosure

I wrote this article with AI. VisiMark is a MIT-licensed project with no business model, sales team or signup behind it.

The [Playground](https://michal-niedzwiedzki.github.io/visimark/playground.html) runs the tool in your browser with nothing to install. The [repository](https://github.com/michal-niedzwiedzki/visimark) and the [project site](https://michal-niedzwiedzki.github.io/visimark/) have the rest.
