# Writing a VisiMark article

House rules for the articles in this folder. They came out of writing
[Markdown woes: Looks right, is wrong](looks-good-is-wrong/markdown-woes-looks-right-is-wrong.md),
which is the worked example: when a rule here is unclear, read how that article
does it.

## Before you write

Read the site and the README first, so the article argues from what the tool
actually does today rather than from what it did a release ago:

- <https://michal-niedzwiedzki.github.io/visimark/>
- <https://github.com/michal-niedzwiedzki/visimark/blob/master/README.md>

Pick one hook and one problem. An article carries a single conceptual hook,
usually the strongest one the site is leading with at the time. If you find
yourself wanting to carry two, that is two articles.

## Where it lives

One folder per article, named for the slug:

```
docs/articles/<slug>/<article-file>.md
docs/articles/<slug>/<article-file>.webp   # cover image, if there is one
```

The article opens with a title, then a short metadata block. Fill the posting
lines in as the article goes out:

```
# Markdown woes: Looks right, is wrong

Tags: Markdown, CI, AI, GitHub
Author: Michał Niedźwiedzki

Posted: https://dev.to/...
Reposted: https://visimark.hashnode.dev/...
```

Every article also gets an entry in `articles.json` in this folder (slug,
title, author, tags, teaser, icon, path). That file is the table of contents:
`scripts/gen-articles.ts` reads it to generate `articles.html` and one reader
page per article, `articles/<slug>/index.html`, which shows the Markdown file
below the title, without the metadata block. Run `bun run gen:articles` after
adding or editing an entry, and commit the regenerated pages — CI fails if
they are stale.

Syndicated copies point their canonical URL back at the original posting, so
the copies do not compete with it.

## Length and pacing

Keep it short. A reader loses patience fast. The first draft of the first
article ran ~2,400 words; the version that stuck was under 1,000. If a section
restates a point already made, even in different words, cut the section instead
of trimming its sentences.

One idea per section, one section per beat of the story. Do not split a single
idea across three headings ("the problem is X" / "here's why X" / "and X gets
worse"). Say it once, well, and move on.

Never let rhetorical-question lists or bullet piles stand in for a real
sentence ("How many numbers? Ten? Twenty?"). They pad length without adding
information. Write the point directly instead.

## Structure that worked

1. Cold open with the hook line, then the persona hits the problem head-on. No
   throat-clearing.
2. One short beat on *why* the problem exists. Not just that it is bad, but a
   believable, sympathetic reason it was never fixed, such as a startup that
   caught traction before anyone had time to clean up the process. This earns
   the character's competence back after they have just been shown making a
   mistake.
3. Introduce the tool once, mid-article, with a single minimal code example. Do
   not re-explain it from three angles afterwards.
4. Replay the opening scenario with the tool in place, showing the concrete
   output: a real `check` failure, a real diff, rather than describing it
   abstractly.
5. One closing line that echoes the opening hook. No stacked closers, no "let
   that sink in" beats.

Run every command the article shows before publishing, and paste the real
output. A fabricated exit code in an article about catching wrong numbers is
the worst possible error to ship.

## Personas

Use fictional personas to illustrate. Make them vivid characters with a
background and a real personality: their own hopes, goals, fears, dilemmas. Not
all at once, just enough of a touch to make the character relatable.

It is fine for a persona's world to nod at present-day tooling in passing.
Marta's stack "hangs together on zip ties and duct tape... and agents, lots of
AI agents" is the right weight: a light touch, not a subplot.

## Prose rules

- No em dashes or en dashes in the running text. Use a period, comma, colon, or
  semicolon instead.
- No bold labels, and no triads applied by rule ("machine-generated text +
  human-looking numbers + no machine-checkable relationship"). If three items do
  not each carry distinct information, cut to one or two.
- Avoid "not X but Y" staging, and one-line dramatic closers. "That is a
  terrible way to review a document" is the kind of line to use once, not once
  per section.
- Prefer plain verbs (is, are, has) over "serves as", "stands as", "represents".
- Simple language. Do not mince words. Do not bore the reader. Punchy sentences,
  used frugally.

## Voice shift: first person for the tool-intro section

The article runs third person, following the personas. The one section that
introduces VisiMark itself breaks that pattern deliberately and switches to
first person: "I built the first version for my own invoices... I'll admit it,
I fell for the thing."

Why:

- It reframes the pitch as a personal-project story rather than a product
  pitch. "Here's what I built, for reasons" is a different genre from "here's a
  solution to your problem" even when the content is identical. That matters
  concretely for DEV.to's rule against using an AI-assisted article to promote
  a business.
- Naivety earns trust. A line like "I thought it might be useful to somebody
  other than me, so I painted it and waxed it" undercuts any sense of a sales
  pitch precisely because it is modest and a little self-deprecating.

Keep the shift contained to that one section. Do not bleed first person into
the narrative sections, readers need the personas to stay themselves, and do
not let it linger past the tool intro. Surrounding sentences in that section
can stay in second person; the goal is a personal aside, not a wholesale
rewrite of every sentence.

## Closing disclosure block

Every article ends with a short disclosure, after the closing line. Three short
lines, not a section that re-argues the article's point. It is a disclosure,
not a second pitch. It does three things:

1. States the AI assistance plainly. One sentence, "I wrote this article with
   AI", satisfies DEV.to's disclosure requirement; the guideline allows
   disclosure anywhere in the copy, the conclusion included.
2. States that the project is not commercial: MIT license, no business model,
   no sales team, no signup. An article cannot be promoting a business if there
   is no business to promote. Check the README and LICENSE still say what the
   disclosure claims before publishing.
3. Points to the [Playground](https://michal-niedzwiedzki.github.io/visimark/playground.html)
   alongside the repository and the project website. A skeptical reader can
   verify the article's claims there in under a minute with no install, which is
   worth more than another paragraph of explanation.

## Tone

Confident, conversational, technically literate, slightly opinionated,
sympathetic, occasionally dry or wry, never salesy. An experienced engineer
explaining something obvious in hindsight, not a marketing copywriter
explaining a product.

## External sources

- <https://dev.to/code-of-conduct>
- <https://dev.to/guidelines-for-ai-assisted-articles-on-dev>
