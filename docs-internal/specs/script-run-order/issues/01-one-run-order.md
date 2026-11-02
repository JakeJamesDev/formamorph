# 01: One Run Order

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Prefactor. Writes still land last-write-wins here, so this ticket changes which write wins and nothing a script reads.

## What to build

The Scripts tab and the turn read one run order, so a row's place is where it runs. One Blueprint row runs for all its owners back to back at the row's place. Library entities' scripts run after the list, in pick order, ignoring any `order`. World Tools stay first. Timings are listed At Game Start, Before the AI, During AI Output, After the AI, When a Trait Switches, in the tab and every menu.

Rulings: Q8, Q9, Q10, Q18, Q19.

## Acceptance criteria

- [ ] One function gives the run order, and the Scripts tab and the turn both call it.
- [ ] A test through `runStatCodeTurn` proves one Blueprint script runs for all its owners back to back at its row's place, with and without an `order`.
- [ ] A test proves a library entity's script runs after every row and ignores a stored `order`.
- [ ] A script with no `order` keeps today's sort, and a new script goes to the bottom of its timing.
- [ ] `scriptsByTiming`, the Timing menu, Add Script, templates and Code Insert list timings in the Q18 order.
- [ ] The Formaquestion prompt text and the help tool's schema keep their current order, and a test proves their bytes don't change.
- [ ] Each new guard fails when the old order returns.
- [ ] Scripts Guide's Run Order and the Scripts tab how-to describe this order, and a changelog fragment exists.
