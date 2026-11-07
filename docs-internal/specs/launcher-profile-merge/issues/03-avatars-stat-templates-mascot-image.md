# 03: Avatars, Stat Templates and Mascot Image

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: three categories registered against an interface ticket 02 defines, with a writer for each.

## What to build

The merge also brings over Avatars, stat templates and the Mascot image.

- **Avatars** follow newer wins by library revision. Equal or missing stamps keep the folder's copy (Q12, Q2).
- **Stat templates and the Mascot image** have no stamps. They copy only what the folder lacks (Q9).
- Each category shows in the offer's summary and gets its own progress bar. Avatars are large, so the engine's smallest-first order places them after the small categories (Q14).

## Acceptance criteria

- [ ] Engine tests: an Avatar follows newer wins and the tie rule.
- [ ] Engine tests: a stat template or Mascot image the folder already holds stays, and a missing one is copied.
- [ ] The offer summary and the run list the three categories (DOM read on the dev-route).
- [ ] A test fails when the fill-missing guard is removed.
- [ ] A changelog fragment covers the added categories, or the ticket 02 entry's group gets a new entry.
