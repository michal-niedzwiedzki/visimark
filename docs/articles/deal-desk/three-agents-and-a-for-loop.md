# Three agents and a 5-dimensional for-loop

## Five knobs and a Friday

Ines had five knobs, one Friday afternoon, and a client who wanted to sign before the weekend.

The client was Aperture Labs, a research outfit whose procurement contact, Mr. Johnson, approved every purchase order with the words "for science." They had approved forty thousand dollars, gross, and no more. Ines needed at least seventeen thousand in the bank on the day of signature, because payroll does not care about anyone's approval process. She also wanted to give Aperture a discount, because after four years of dealing with Mr. Johnson, a discount was the only thing that had ever earned her a thank-you.

The knobs were extra backend hours, a discount, the share paid at signature, days of Security review, and premium on-call hours. Five knobs make a lot of combinations. She had been turning them by hand for an hour, and by four o'clock she had sold the same engagement six different ways and could not say which one she would defend to Marek in finance. Marek owned the margin floor. He kept it in his head and nowhere else.

The firm had grown from three people to twelve without anyone deciding to. The quote was a spreadsheet Marek built when there were three of them, and it was fine for three: a few lines, a total, a formula you could hold in your mind. The margin floor was his. The number of Security days the firm could spare was Priya's, in delivery, and it moved with her calendar. Neither was written down, because when there were three people you just asked.

Editing that spreadsheet to try a what-if had a history. Two quarters earlier someone tried a discount, saved the file to fetch coffee, and the quote went out with the discount in it. The client noticed within the hour. So people stopped asking what-if questions and started guessing. Ines was very good at guessing, which is a fine skill right up to the day it replaces arithmetic.

## The phone call

She called Tomek. He was the person she called when a good idea needed a second brain, and he picked up on hands-free, engine noise behind him, somewhere on the ring road.

"Five knobs," she said. "I want the biggest discount that breaks nothing, and I have until five."

"That's a five-dimensional search," he said at once. "Don't do them one at a time. Five loops, one inside the next. For every combination you run the model, keep the ones that pass, take the biggest discount. Maybe forty lines."

"Show me."

"I'm driving."

"Tell me, then."

He tried. Open a terminal, he said, and start a file. Import this, import that. For hours in range of forty-one, because range stops one short and she wanted zero through forty. A merge lane took half a sentence. When he came back he was explaining that the percent sign in a discount was only a character in a string, and somewhere in there she lost whether the variable was called disc or discount, and it turned out to matter.

"I have a notepad with six lines that don't run," she said, "and you have a car to drive."

"I can be there in forty minutes, if the traffic holds."

"I don't have forty minutes."

A pause, with only road noise in it. Then he hung up to put both hands back on the wheel, which is about as close as a considerate engineer gets to admitting he has lost an argument to physics.

Ines put the phone down and looked at the notepad. The Python was gone, but the idea under it was not. Try many things, fast, and trust only the ones the document signs off on.

## What I put in the document

I made up Ines, Tomek, Marek and Mr. Johnson. The document they argue over is real, and the numbers in this article came from running it.

I built VisiMark so that a number in a Markdown file carries the formula that produced it, and a command can prove the two still agree. Lately I added one more thing, and it mattered here: a value can be declared a parameter, and a run can ask what the document would say if that parameter were different, without touching the file. Ines's five knobs are five parameters. Marek's floor and Priya's four days sit in the same file as plain numbers with guardrails beside them, so nobody has to remember them and nobody can turn them from outside. Only a declared parameter can be varied, and those are not.

The question is called a scenario, and Ines asked her first one the way a person does. Take half the invoice at signature, and give them eight percent off for it.

The signature payment jumped from 8,597.70 to 13,183.14. Good. The margin fell to 36.46 percent, under Marek's floor. Bad. The run said exactly which guardrail failed, and it said the quote itself still held on its own numbers, so the failure belonged to her experiment. Nothing had been written to the file. There was no coffee break in which to save it by accident.

She read the answer twice, mostly for the pleasure of it. If she could ask one question like that, she could ask a great many.

## Three agents

She opened three agent sessions and gave each the same brief. Aperture wants to sign this week. We need at least seventeen thousand at signature. Beyond that, find the biggest discount the guardrails allow. Try scenarios, read what fails, report the best one. Do not edit the document. The guardrails are not negotiable.

The brief never mentions the margin floor, the budget or the Security team, because those live in the document, and an agent that ignored them would find out on the next run.

The first went for cash. At fifty percent at signature the payment came to 14,329.50, short of the target. At sixty it reached 17,195.40, and the run failed the ceiling on what Aperture would pay up front. No share it was allowed to ask for could get there on this invoice, and it said so.

The second went for volume. It added all forty backend hours, asked forty-five percent, and offered five percent off. The margin floor failed at 38.28 percent. It walked the discount down and found that two percent held, and reported that as the most this route could afford.

The third went for mix. Four days of Security review, all twelve premium on-call hours, forty-five percent at signature. It tried a fifth Security day just to see where the edge was, and that broke two limits in one run: the team's capacity and Aperture's budget. Back at four days, five percent off failed the floor at 39.64 percent, and four percent passed at 40.26.

Four percent off. Gross 38,092.61. Signature payment 17,141.67. Every guardrail green, with a margin that cleared the floor by a whisker. The agent added a note of its own: the margin was thin, a small rise in the cost of a Security day would break it, and someone should confirm the numbers before anything went out.

Ines read the note with something close to affection. But a paragraph is not a checked result, and she wanted to see the edge herself. So she fixed what the third agent had fixed and swept the two knobs it had left open, prepay share and discount, one scenario after another, a few lines of shell she had written a hundred times before. Eighteen runs, eighteen seconds. At five percent off, the margin broke the floor every time. At four percent it held every time, at the same 40.26, whatever the prepay share. She saw why once it was laid out flat: prepay moves money in time, it does not move it out of the deal. The seventeen thousand was a different kind of number, only a target in her own brief, so she read that column with her own eyes. Forty percent never reached it. Forty-five did, from four percent down. Forty-five was the smallest ask that worked.

She had confirmed the agent's answer herself, in a language she already knew.

## Tomek, later

He arrived a little after five, keys still in hand, expecting a mess and finding a table.

"Eighteen points," he said. "You never touched the extra hours. That's not a search. That's checking somebody else's homework."

"It's checking somebody else's homework with the actual tool, instead of trusting a paragraph. Whose word were you going to take an hour ago?"

He had no answer, which she took as one.

There was one thing left to check, and no tool could do it. The four Security days came from Priya, once, in a corridor. If Ines was wrong about the four, the agent's answer was perfect and useless. She had already called Priya. Four, confirmed, and please put it in writing next time anyone asked.

Tomek went home and wrote the script he had wanted to dictate, this time on a keyboard with both hands, and let it walk every combination of the five knobs. A hundred and forty-six thousand scenarios, about eighty seconds. Four percent was the largest discount that met the target inside every limit, same as her eighteen points, with two hundred and thirty-four ways to reach it. Then, because peace of mind is a compulsion for him too, he changed one number and ran it again: the Security capacity, from four days to two. The best discount fell to three percent. He texted her both results before nine, the closest he came to admitting the number in the file mattered as much as the search.

Ines had sent Aperture the quote at ten to five. Forty-five percent at signature, four percent off, four days of Security review, twelve premium on-call hours. Mr. Johnson replied within the hour.

"Approved. For science."

Ines still had five knobs. Now she also had a quote she could defend, and she had defended it before the engineer who was so sure he knew the answer had finished parking.

## Disclosure

I wrote this article with AI. VisiMark is a MIT-licensed project with no business model, sales team or signup behind it.

The [Playground](https://visimark.dev/playground.html) runs the tool in your browser with nothing to install. The [repository](https://github.com/michal-niedzwiedzki/visimark) and the [project site](https://visimark.dev/) have the rest.
