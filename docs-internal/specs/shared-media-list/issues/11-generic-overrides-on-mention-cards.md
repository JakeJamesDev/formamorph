# 11: Generic Overrides on Mention Cards

Status: needs-triage
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A script can give one Generic Entity Instance its own image (Q50), and play shows it in the entity panel. Mention cards (the cards a name in the narration opens) read only the entity-wide and persona overrides, so a Generic copy's own picture is missing there. Q3 and Q50 say an override applies everywhere that image shows.

Ticket 08 tried tying mention cards to the instance at the player's place. Positions move every turn, and that wiring kept a turn from finishing (the emberwatch case in the bundled-saves test). Find a way to read the instance override that doesn't recompute on every position change, or settle with the spec session on which instance a card shows.

## Acceptance criteria

- [ ] A mention card for a Generic entity shows the override of the instance at the player's place, by the same rule the panel uses.
- [ ] The bundled-saves emberwatch save still loads and plays a turn.
