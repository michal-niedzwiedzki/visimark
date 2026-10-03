# Manda-Panda and the Sunday bakeoff

## Saturday, 6:40

Amanda came in at knee height and went up the bed like a hill she owned.

"I'm doing the bakeoff."

Ted kept his eyes shut. "Mm."

"Tomorrow. At the fair. I need a stall."

Ted tried the usual moves. He was asleep. He was, in fact, dead. There were pancakes downstairs, which was a lie that cost him nothing and bought him four seconds. Amanda was eleven and unmoved. She sat on his chest and waited, like a very small judge. Beside him, his wife Joanna had gone perfectly still under the duvet, a skill she had polished over many Saturdays.

Then Ted made his mistake. "What would you even sell?"

"Chocolate cookies. For a million dollars."

"Nobody pays a million dollars for a cookie."

"Ten."

They did it out loud, in the dark. A batch made 24 cookies and cost about fifteen dollars, if he remembered the butter right. The fair wanted twelve for the table. So at three dollars a cookie, how many did she sell?

"All of them."

"That depends on the price."

"Then make it cheap."

"Cheap and they sell out, and you could have charged more."

"Then expensive."

"Expensive and you carry them home."

Every answer needed another answer. Amanda helped by supplying numbers. Forty. A hundred. Four hundred and seventeen. Ted lost his place twice and found it once.

From the pillow, Joanna spoke for the first time that morning. "Shower. Both of you. Then do it properly."

## A table with a quantity

Half an hour later, shaved, with Amanda eating toast over his shoulder, Ted opened Obsidian and made a note. He named it `bakeoff.md`. He had used VisiMark for invoices and a few what-if questions, and he wrote the way he always did, in plain sentences with a little table, as if explaining to a colleague.

````markdown
A batch makes 24 cookies.

| Ingredient | Qty | Price | Cost |
|------------|----:|------:|-----:|
| Flour      | 1.2 |  1.50 | 1.80 |
| Butter     | 0.5 |  9.00 | 4.50 |
| Sugar      | 0.6 |  2.00 | 1.20 |
| Eggs       |   6 |  0.40 | 2.40 |
| Chocolate  | 0.4 | 14.00 | 5.60 |

```vmark #batch
Cost precision 2 = Qty * Price

batch_cost = SUM(Cost)
```

```vmark #stall
price   precision 2 = 3.00
batches = 2
fee     precision 2 = 12.00

baked   = batches * 24
sold    = baked
spend   precision 2 = batches * batch.batch_cost + fee
revenue precision 2 = sold * price
profit  precision 2 = revenue - spend
```
````

A batch cost 15.50. Two batches at 3.00 a cookie, everything sold: a profit of 101.00.

"That's a lot," said Amanda.

"That's if everyone buys. They won't. Fewer people buy as the price goes up."

"How many fewer?"

Ted did not know. He knew that Priya's mum had said, at school pickup, that at two dollars Priya sold out in an hour and at five people only looked. He drew a line through those two facts. It was a guess, and he said so out loud, and wrote it down where he could find it later.

## What the file is

I made up Ted, Amanda and Joanna. The file is real, and every number in this article came from running it. I built VisiMark so that a number in a Markdown file carries the formula that produced it, and a command can prove the two still agree. Lately a value can also be declared a parameter, so that a run can ask what the document would say if it were different. That is where Ted was heading.

## Shouting prices

````markdown
```vmark #stall
param price precision 2 = default 3.00
batches = 2
fee     precision 2 = 12.00

baked   = batches * 24
demand  = 160 - 30 * price
sold    = IF(baked < demand, baked, demand)
left    = baked - sold
spend   precision 2 = batches * batch.batch_cost + fee
revenue precision 2 = sold * price
profit  precision 2 = revenue - spend

goal    precision 2 = 60.00
assert profit >= goal
```
````

`price` was now a parameter, and Amanda wanted 60.00 out of the day, so that went in as an assertion.

`demand` was the guess. It is the number of cookies people would buy over the whole fair at a given price, whether or not she baked that many. The formula says that at a price of zero, 160 cookies would go, and every extra dollar loses 30 of them. At three dollars that is 70, more than the 48 she baked, so they all sell. At five dollars it is 10, which matches what Priya's mum saw: people only looked. `sold` is the smaller of what she baked and what people wanted, and `left` is the rest. Ted made the two numbers up from those two stories. A real stall would find them by selling.

Then she started calling prices from behind his ear, and Ted asked the document each one without changing it.

```text
$ echo '{"price":"1.00"}' | visimark eval bakeoff.md --scenario - --get stall.profit
5
  ASSERT  #stall   profit >= goal
          5.00 >= 60.00   is false under scenario (holds on defaults)
```

"One dollar!" Five dollars of profit. "Five dollars!" Seven. "Three-fifty!" 125.

"So it's three-fifty," said Amanda.

"We have tried three numbers."

"They were good numbers."

Ted looked at the clock, then at the prices he had not tried, which were most of them. He had never used `simulate`. He read its page in the docs, closed it, and typed what he wanted: try every price from one dollar to five, fifty cents apart, and tell me the best one that meets the goal.

````markdown
```vmark #stall
param price precision 2 in [1.00, 5.00] lattice 0.50 = default 3.00
```

```vmark #sweep
report best scalar stall.profit direction max among feasible
```
````

`simulate` is a command-line tool, so he opened a terminal next to the note.

```console
$ visimark simulate bakeoff.md
simulate: bakeoff.md: 10 questions (1 lattice params)
==> bakeoff.md <==
#sweep

report best scalar stall.profit direction max among feasible

  price=3.50
  stall.profit  125.00  (+24.00 against base)
  chosen from 5 feasible of 9 questions
simulate: bakeoff.md: 1 of 1 sheets ran in 36 ms
```

"Three-fifty," said Amanda. "I said that."

"You said every number between one and a million."

## The clever question

Amanda chewed her toast. "Why two?"

"Two what?"

"Batches."

"Because I picked two."

"That's not a reason."

It was not. Ted turned `batches` into a second parameter, from one to six. Then he asked her what else she cared about. She said her piggy bank held 60.00 and she was not spending more. She said she did not want to throw out more than half a batch. Those became two more assertions. He asked for the gates and the forbidden corners too, so that the next answer would come with its reasons.

````markdown
```vmark #stall
param batches precision 0 integer in [1, 6] lattice 1 = default 2
piggy_bank precision 2 = 60.00

assert spend <= piggy_bank
assert left <= 12
```

```vmark #sweep
report best scalar stall.profit direction max among feasible
report gates
report forbidden
```
````

```console
$ visimark simulate bakeoff.md
simulate: bakeoff.md: 55 questions (2 lattice params)
==> bakeoff.md <==
#sweep

report best scalar stall.profit direction max among feasible

  price=3.00 batches=3
  stall.profit  151.50  (+50.50 against base)
  chosen from 9 feasible of 54 questions

report gates

  54 questions
  assert               holds  fails  faulted  base   first failure
  spend <= piggy_bank     27     27        0  holds  price=1.00 batches=4
  profit >= goal          29     25        0  holds  price=1.00 batches=1
  left <= 12              26     28        0  holds  price=1.00 batches=6

report forbidden

  price = 1.00  every question with it breaks an assertion
  price = 1.50  every question with it breaks an assertion
  price = 5.00  every question with it breaks an assertion
  batches = 4   every question with it breaks an assertion
  batches = 5   every question with it breaks an assertion
  batches = 6   every question with it breaks an assertion
  45 of 54 questions are infeasible
simulate: bakeoff.md: 1 of 1 sheets ran in 69 ms
```

Amanda read it aloud, the way she read everything, with her finger. Three dollars, three batches, 151.50. Fifty dollars and fifty cents more than Ted's first guess. Three batches cost 58.50 with the table, so it fit in the piggy bank with a dollar fifty to spare. Her leftovers rule broke most often, in 28 of 54 questions, which she took as proof that she was right to have one. Prices under two dollars, a price of five, and anything past three batches could never work, whatever else she chose. The tool had said so in a list.

## But it's ugly

She scrolled up and down. It had done everything she had asked, plus a few things she had not known to ask.

"It's good," she said. "But it's ugly."

Ted looked at his note. Grey tables, hash marks, a monospaced block. He could not argue with the grey. He dragged a Hello Kitty sticker into the document, right under the heading, and turned the laptop toward her.

"Better?"

Amanda blinked, while nodding.

Then she was off the bed and in the kitchen, dragging out the flour for three batches, and Ted followed with the butter.

## Disclosure

I wrote this article with AI. VisiMark is a MIT-licensed project with no business model, sales team or signup behind it.

The [Playground](https://visimark.dev/playground.html) runs the tool in your browser with nothing to install. The [repository](https://github.com/michal-niedzwiedzki/visimark) and the [project site](https://visimark.dev/) have the rest.
