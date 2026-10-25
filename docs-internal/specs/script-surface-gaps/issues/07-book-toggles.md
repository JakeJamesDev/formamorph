# 07: Book Toggles

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: book reach and book writes on top of ticket 06's overlay, with one derivation rule.

## What to build

Scripts reach books by who turned them off (Q33). That is derived with no new data: a book the save has off while the world, or the player's library add, has it on is player-off and stays absent; a book the world ships off is listed with `enabled: false` (Q36). Book `enabled` takes writes in both directions on any reachable book (Q37, Q40). Book toggles live in ticket 06's overlay and rewind with undo (Q38). A library book the player added reads and takes writes like any book in play, and the library record is never written (Q39). User Tools stay read-only. The Scripts guide covers book reach and writes.

Spec: Q33, Q36–Q40, stories 34–38.

## Acceptance criteria

- [ ] A book the world ships off reads `enabled: false`; a Before the AI write switching it on puts its matching entries in this turn's narration request
- [ ] A script switches an on book off, and its entries leave the next request
- [ ] A book the player turned off at world entry is absent from `dictionaries`
- [ ] A library book the player added takes an entry write, and the library record is unchanged afterward
- [ ] Undo after the turn restores the book's earlier state

## Blocked by

- 06
