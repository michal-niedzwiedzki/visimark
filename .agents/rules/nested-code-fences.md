---
description: Use four backticks for an outer fence that contains a nested ```vmark or ```markdown example
alwaysApply: true
---

# Nested code fences

A fenced code block closes at the first line that is *only* backticks (same
character, same count or more) with nothing but whitespace after them — the
fence's own info string (`markdown`, `vmark`, ...) never matters for closing,
only for opening. So a bare, three-backtick closing line inside an outer
three-backtick fence closes the **outer** fence early, not the inner one it
was meant to close, silently truncating the example and dumping the rest as
unfenced prose.

This bites every time a worked example nests a ` ```vmark ` block (or any
other fenced block) inside an outer fence used to show "here is the whole
document" — issue bodies, spec/plan prose, design docs, `AskUserQuestion`
previews, anywhere a full document listing is shown as one block.

**How to apply.** When an outer fence's content contains its own fenced
block, give the **outer** fence one more backtick than any fence nested
inside it — four backticks for a single level of nesting:

````markdown
```vmark #s
status = "past due"
```

Account status: **past due**<!--vmark=s.status--> as of today.
````

The inner block keeps its ordinary three backticks; only the outer one
grows. This is not needed when the fenced content has no fence of its own —
an ordinary ` ```markdown ` or ` ```text ` snippet with no nested block stays
at three backticks.

Before publishing a GitHub issue, a spec, or a plan that shows a `vmark`
example inside a surrounding fence, check the outer fence widens to four
backticks. `docs/design/display-rules-replacing-percent-sigil-spec.md` and
several `docs/vocab/*-{plan,spec}.md` files shipped this bug — three
backticks at both levels — before it was caught and fixed. The manual check:
if the outer fence's own content includes a line that is *only* three
backticks before the outer example is meant to end, the outer fence needs a
fourth backtick.
