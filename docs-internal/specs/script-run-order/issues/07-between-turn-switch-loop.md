# 07: Between-Turn Switch Loop

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The close's review found this by reading the source. No run has confirmed it, so the failing test comes first. If that test can't fail, report it to the spec session, and this ticket ends with that evidence.

## What to build

A trait granted by an item, whose When a Trait Switches script takes or gives that item, can flip forever between turns. Each commit of Item Copies fires its switches as a new action, so the depth caps and the totals (Q40, Q45) restart each pass. One player action, such as a panel toggle, must stop firing scripts at those limits, across every pass that it starts. The world and its state stay usable, and the author sees a warning once.

Rulings: Q40, Q45, Q46.

## Acceptance criteria

- [ ] A failing test through the mounted game view reproduces the loop from a panel toggle before any fix.
- [ ] That test passes: the toggle ends, within the existing totals, with one warning.
- [ ] A test proves one normal switch whose script gives an item still lands, and its item events and switches fire.
- [ ] The guard fails when each pass starts a new action again.
- [ ] Scripts Reference's limit line says the totals cover what an action starts between turns.
