# Deck joist span sheet — catching the transposed digit before the framer does

A residential deck design lives in a calculation sheet that gets copied,
retyped and re-approved several times between the engineer, the permit office
and the contractor. Every retyping is a chance to move a decimal point or
swap two digits, and the failure mode is not a compile error — it is a deck
that looks fine on paper and fails a live-load test years later. This is the
kind of document where a human error verifier earns its keep independently of
whether anyone ever asked for a spreadsheet.

## Loads

| Component     | psf  |
|---------------|-----:|
| Dead load     | 10.0 |
| Live load     | 40.0 |
| Snow load     |  0.0 |

```vmark #loads
total = SUM(psf)
```

The design load for this deck, in a snow-free region, is
**50.0**<!--vmark=loads.total--> psf — dead plus live, snow left at zero
rather than omitted, so the column still reads as a complete accounting of
every load case considered.

## Joist sizing

Joists are `2x10` Douglas fir-larch, allowable bending stress
`Fb = 875 psi`, section modulus `S = 21.39 in^3` for the actual (dressed)
dimension. Spacing is 16 inches on center.

```vmark #joist
Fb = 875
S  = 21.39
spacing_in = 16

w_plf = loads.total * spacing_in / 12
```

Tributary load per joist comes to **66.67**<!--vmark=joist.w_plf--> lb/ft.

The maximum allowable span for a simply-supported joist under uniform load,
governed by bending, is the standard beam formula solved for length:

```vmark #span
Mallow = joist.Fb * joist.S / 12
Lmax   = SQRT(8 * Mallow / joist.w_plf)

Lmax_ft = ROUND(Lmax, 2)
proposed_span = 11.83

assert proposed_span <= Lmax_ft
```

Allowable bending moment is **1559.69**<!--vmark=span.Mallow--> lb-ft, giving a
maximum span of **13.68**<!--vmark=span.Lmax_ft--> feet. The drawing calls out
a joist span of **11.83**<!--vmark=span.proposed_span--> feet, which the
assertion confirms is inside the allowable limit.

## The transcription this catches

The permit set gets redrawn by a second party who copies figures off the
engineer's sheet by hand. Suppose "16 inches on center" is retyped as
"1.6 inches on center" — a single misplaced decimal, the kind spellcheck has
no opinion about:

```console
$ sed -i 's/spacing_in = 16/spacing_in = 1.6/' deck.md
$ visimark check deck.md
  STALE   joist.w_plf                            66.67 ≠ 6.67
  STALE   span.Lmax_ft                           13.68 ≠ 43.25
  STALE   2 prose anchors bound to the values above

  4 problems (4 stale, 0 errors)
```

Notice what is absent: no `ASSERT` finding. `proposed_span <= Lmax_ft` is
still `11.83 <= 43.25` — true, and truer than before, because a spacing typo
that shrinks `w_plf` makes the allowable span look *more* generous, not less.
A verifier that only re-checked "does the assertion still pass" would wave
this mistake straight through. What actually catches it is the two `STALE`
findings: the retyped `16` no longer produces the `66.67 lb/ft` and
`13.68 feet` already printed in the prose above, so `check` fails on the
drift itself before anyone reasons about whether a passing-but-wrong
assertion is suspicious. The anchored numbers disagreeing with their own
formula are the first line of defense; the assertion is the second, and
between them a spacing error that happens to make the assertion look better
is still caught.

## Why this is a verifier, not a calculator

A calculator (a spreadsheet, a script, a slide-rule) gets the arithmetic
right the moment it is run and says nothing about whether it is still right
the next time a figure is retyped by hand. This document's numbers are
printed in the prose a reviewer actually reads — `66.67 lb/ft`, `13.68 feet`
— and those exact bytes are what `check` recomputes against, so the review
that a permit office already does (reading the sentence, checking the number
against the drawing) is the same act that catches the transcription error,
with no second tool and no separate "audit script" to keep in sync with the
calculation it audits.
