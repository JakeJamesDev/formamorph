# 20: Openings Hint Counts What Can Draw

Status: done
Blocked by: 19
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one count in the panel, read from the rule ticket 19 owns.

## What to build

The Openings checkbox and the panel's footer hint count Custom Persona Others rows, but the game counts only its Self rows. A world whose only opening text is on those rows says "Draws one opening by weight", then starts on the default. Ruling Q16: the checkbox and the hint count only rows the game can draw.

Spec: Q16. Evidence: ticket 11, Landed.

## Acceptance criteria

- [x] A panel test with text only on Custom Persona Others rows fails today (the hint says one opening draws), then passes with the default-opening state (`keeps the default-opening state…` failed with the old rule, passes now)
- [x] A world with a drawable row keeps today's checkbox and hint (test) (`says one opening draws…` for a Self row and for another entity)
- [x] World-Editor-Openings matches, if it names this state; the docs tests are green (line added under the checkbox section; docs tests run in the gates)
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/docs-sweep-bugs-20.md`)

## Landed

**Not verified**
- None.

**For you**
- Open a world whose only opening text is on the Custom Persona's Others rows: the Openings footer hint should read "Write an opening here…".
