# 04: Chevrons as Directed Rerolls

Status: in-progress
Base: e4385de4
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Type: task
Spec: ../spec.md (Which value opens, and what a chevron does)

Model rationale: small header wiring on top of the store operation from 01.

## What to build

Each open value's header gains a chevron each way. A step opens the previous or next value of that
placeholder and moves the shared preview roll with it, so Preview and every other field show the value the
author stepped to.

- A step calls the rolls store's directed set for that placement. World placements move every World chip
  of that placeholder; a Unique placement moves only itself.
- The order is the placeholder's value order. Steps wrap at both ends.
- A Variable (one value) hides the chevrons.
- An Object opens on its first value; chevrons walk the rest. Preview still shows the joined text.
- Pins are not steps. A pin forces one of the values; the chevrons still walk the values.
- The toolbar's Reroll works on the Values tab and redraws every open value.
- The header's label shows the open value's position or label as the prototype does.

## Acceptance criteria

- [ ] A chevron step changes the open value and the store's roll for that placement.
- [ ] After a step, the Preview tab and a second field show the stepped-to value.
- [ ] Stepping past the last value opens the first, and the reverse.
- [ ] A Variable chip shows no chevrons.
- [ ] An Object chip opens on its first value and walks all values.
- [ ] A step on a Unique placement leaves other placements of that placeholder alone.
- [ ] Reroll on the Values tab redraws the open values.
- [ ] Component tests cover step, wrap, Variable, Object, and Unique independence.
- [ ] Changelog In-Progress entry added. Four gates green.
