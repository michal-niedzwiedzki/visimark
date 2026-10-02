# The kiln bonus

## Friday, before lunch

Walt put his hat on the desk. That meant he wanted this over quickly.

"Forty thousand board feet of white oak," Hank said. "Kiln dry. The builder pays on the fifteenth if we hold the price today."

"What price?" Earl asked.

"Drying costs seventy-two hundred. The margin holds. The bonus holds."

Earl kept his pencil on the book. "That rate is for pine. Oak costs thirty-one cents a board foot to dry, not eighteen. Send that quote and the bonus is gone. Payroll is short."

"The rate is right there in the quote," Hank said. "I can read my own paper."

"The kiln card is on the nail by the door," Earl said. "I can read too."

Walt looked at the clock. "I won't take a bonus from anyone because the two of you disagree. Bring me the page that says who is wrong. Then I eat."

## The page

Last month Walt told Ray to make the quotes look less messy. Ray runs the time clock, the forklift radios, and the one computer in the mill that still boots. He had no free afternoon. So he gave the old Word files to an AI chatbot and asked it to clean them up.

The chatbot said it would write each quote so the numbers come from formulas, and that Ray should install a small free tool called VisiMark to check them. "I'm good with words," it said, "but I make mistakes with arithmetic." Ray installed it without reading further.

The chatbot wrote a proper sum. It needed a drying rate, and it grabbed the one from a similar line. That line was pine, dried in January, on a short cycle. Oak is heavier and stays in the kiln longer. The sum still looked finished.

```vmark #rates
pine_dry = 0.18
oak_dry = 0.31
board_feet = 40000
dry_cost = board_feet * pine_dry
```

Dry cost on the quote: **7200**<!--vmark=rates.dry_cost-->.

Ray ran the check, as the chatbot had told him to, and also to get Earl to stop yelling about the computer's numbers. The badge printer was next on his list, and it was already making a noise.

```text
WARN    rates.oak_dry     defined and never read — did you mean `pine_dry`?

0 problems (0 stale, 0 errors)
```

"It passes," Ray said, and put the page on the desk.

Earl tapped the nail by the door. "The oak rate is in the file. The sum never uses it. The sum uses pine."

Hank swore once. "I never picked pine."

"The chatbot copied the line next to it," Ray said. "The total matches the sum. That's why the page looks right."

Walt picked up his hat, then put it down again. "So the computer agrees with itself, and the kiln card disagrees with the computer."

"Yes," Ray said.

## One word

Ray changed the sum to use `oak_dry`. He left 7200 where it was and ran the check again.

```text
STALE   rates.dry_cost                               7200 ≠ 12400.00
STALE   1 prose anchors bound to the values above

2 problems (2 stale, 0 errors)
```

Five thousand two hundred dollars. That was the bonus, and also the hole in payroll if the old price had gone out.

He ran the fix. The page now said 12400.00. He printed it, slid it under Walt's hat, and went back to the time clock.

Walt called the builder before the builder called him. The price was the oak price. The load stayed on the books.

Then Walt turned to the room. "Whose fault was it?"

Hank looked at Earl. Earl looked at Hank. Ray looked at the floor.

"The computer," Hank said.

"The computer," Earl said.

"The computer," Walt agreed, and put his hat on. "Somebody tell it it's not getting a bonus."

Ray typed the news into the chatbot on his way out. It answered at once. "You're absolutely right, and I apologize for the confusion!"

Nobody thanked Ray. Nobody blamed him either. The mill had lumber to cut, and everyone went to lunch.

## Disclosure

I wrote this article with AI. VisiMark is MIT licensed, with no business, no sales team, and no signup.

The warning and the line `7200 ≠ 12400.00` came from running that file. The [Playground](https://visimark.dev/playground.html) runs the same check in the browser. You can also [scan your own GitHub repo](https://visimark.dev/#repo-scan) for arithmetic errors in its Markdown files.