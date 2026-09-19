# 01: Extract the Turn Card from Chat

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: a contained extraction inside one component, with existing tests as the safety net.

## What to build

A prefactor with no visible change. Chat's narration bubble composes three things by hand today: the
right-click menu wrapper, the card surface, and the action row. Move that composition into one **Turn Card**
component. It takes the action list and the turn number, and it takes its body as children. It hides the
action row when the list is empty or the turn is live.

Chat renders its narration bubble through the Turn Card. The card classes, the menu, and the row then exist
in one place. See "One Turn Card" in the spec.

## Acceptance criteria

- [ ] One Turn Card component owns the menu wrapper, the card surface, and the action row
- [ ] Chat's narration bubble renders through it; Chat no longer composes the menu and the row by hand
- [ ] Chat looks the same: surface, action row, turn number, More, right-click menu, selected-text browser menu
- [ ] The existing Chat layout tests pass without a change to their assertions
- [ ] Four gates green
