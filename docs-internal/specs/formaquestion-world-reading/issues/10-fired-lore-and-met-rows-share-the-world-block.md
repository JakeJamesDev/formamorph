# 10: Fired Lore and Met Rows Share the World Block

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a budget rule in the game world block, measured by the probe.

## What to build

In game, fired dictionary entries go first in the world block under its 5-section cap. Five fired entries push out every Player View row, including the entity the question asked about. Past 5, "fired entries always join" is not true either. The world block keeps room for the top-ranked Player View rows when lore fires. The split is a decision for triage (for example, a separate cap for fired entries, or a reserved place for the top row).

Found in the close review. Spec: "Fired dictionary entries always join, ahead of ranked rows, inside the same budget."

## Acceptance criteria

- [ ] A question that fires 5 or more entries still carries the top-ranked Player View row
- [ ] The rule the triage picks is folded into the spec
- [ ] `probe:world-question` game arm, before and after, recorded in the ticket
