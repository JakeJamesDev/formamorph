# 06: Keep the List in the Save

Status: ready-for-agent
Blocked by: 01, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

A save shape change; snapshots can be large, so the round trip needs care.

## What to build

A player acts in the panels, saves or closes the game, and reloads. The Action List comes back with the same entries, hidden flags and counts, and undo still restores. The live list and its snapshots are a new save field. A save without the field loads with an empty list. There is no compat code for unreleased forms.

Spec rulings: Q12.

## Acceptance criteria

- [ ] A save with a live list reloads with the same entries, and undo of the newest restores the pre-action state; a round-trip test covers it.
- [ ] A save without the field loads with an empty list.
- [ ] Autosave and manual save both carry the list.
- [ ] The response names the save shape change (export-shape reminder).
