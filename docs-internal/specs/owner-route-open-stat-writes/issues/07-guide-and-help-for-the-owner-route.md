# 07: Guide And Help For The Owner Route

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Docs edits against a finished runtime, plus a test that ties the Quick Reference to the surface tables. Sonnet at medium effort.

## What to build

The Stat Code Guide drops the read-only and same-owner lines, documents `owner`, and states the owner-order rule. The sections are Quick Reference, How to Change Another Stat from Code, Accessing Other Stats, Writing to Other Stats, Two Boxes, One Field, Order of Effects, Average of All Stats, Persona, Entities, and Limitations.

- The Persona section says that under a library persona, code reaches the Custom Persona's stats through `entities[...]`, not `persona`.
- The accumulating-stats note explains Q12: a Blueprint box's world-stat write moves the stat once, not once per bearer.
- CONTEXT.md gains an entry for the `owner` stat-code global.
- The Quick Reference test keeps its rows tied to the surface tables and runs its code forms through the executor and diagnostics.

## Acceptance criteria

- [ ] No guide line calls `entities[x].stats` or `persona.stats` read-only, or limits writes to the same owner
- [ ] The guide documents `owner` in world, owned, and Blueprint code, and the owner order
- [ ] The Quick Reference test passes with `owner` rows
- [ ] Formaquestion answers one `owner` question and one cross-owner write question with the new rule
- [ ] Copy follows the STE voice; four gates green

## Blocked by

- 03 (Editor Follows The Owner Route)
