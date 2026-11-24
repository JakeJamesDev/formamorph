# 05: Player Lock Line

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player's lock line reads in full clauses, built from the clause builder's player view (Q5, Q18).

- Before: "Requires Knight and not Paladin, or Mercenary".
- After: "Requires: you have Knight and you don't have Paladin, or you have Mercenary."

It covers every place the player reads a gate: a locked trait at new game and in play, and a Locked location in the List, the Map and its Locked text.

- A Condition about the played persona says "you". A Condition about another entity names it.
- The joining rule stays: "and" inside a row, "or" between rows, with a comma before "or" after a row of several Conditions.
- Hidden traits and hidden Options stay left out, as today.
- The You pill on a persona's name goes away where the clause now says "you". Send this to the spec session before the first edit if any surface still needs the pill.

## Acceptance criteria

- [ ] A locked trait's line reads in full clauses for each Condition kind; pure tests on the gate line, beside the existing ones.
- [ ] The comma rule holds: "A and B, or C" with full clauses.
- [ ] A persona Condition reads "you are Albus" / "you are not Albus".
- [ ] A Locked location shows the new line in the List and the Map; the locked-locations Playwright run reads it.
- [ ] A hidden trait or Option is still left out of the line.
- [ ] The glossary's **Requires** entry quotes the new lock line; wiki pages that quote a lock line are updated.
- [ ] A changelog fragment under Minor, Added: lock lines read as full sentences.

For you: start a new game in a world with gated traits. Does the lock line read naturally at a glance, or is it too long on the trait card?
