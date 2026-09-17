# 01: Rolls Keyed by Value Id, With a Directed Set

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Type: task
Spec: ../spec.md (Which value opens, and what a chevron does)

Model rationale: a contained store refactor with clear tests; no editor work.

## What to build

The editor's shared preview rolls store remembers each roll by the value's id, not by its text, and gains
one new operation: set the roll for one placement to one value. A field's Preview shows the same text it
shows today. The visible change: when an author re-spells a rolled value on the Placeholders tab, every
Preview keeps showing that value with its new spelling, where today the roll is dropped and redrawn.

This is the prefactor for the Values tab. An edit there changes the text of the open value, and a
text-keyed roll would strand it on the next read.

- World placements keep one roll per placeholder. Unique placements keep one roll per placement.
- A roll whose value id left the placeholder is dropped before it is read, as a stale text roll is today.
- Nested rolls reached through a value's chips follow the same keying.
- The directed set takes a placement and a value id, stores it, and bumps the store's version so readers
  re-render. It redraws nothing else.
- The Test Bench's Opening rolls and the playthrough session store are separate stores and do not change.

## Acceptance criteria

- [ ] A Preview shows the same resolved text before and after this change for an untouched world.
- [ ] Re-spelling a rolled value keeps that value rolled in every field's Preview.
- [ ] Removing a rolled value drops its roll, and the next read draws a new one.
- [ ] The directed set makes every reader of that placement show the chosen value.
- [ ] A directed set on a Unique placement leaves other placements of the same placeholder alone.
- [ ] Reroll still redraws the named placeholders and everything reachable through their values.
- [ ] Store-level tests cover the cases above; existing Preview tests pass unchanged.
- [ ] Four gates green.
