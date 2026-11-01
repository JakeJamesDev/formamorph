# 12: Remove the Unreachable Load World Input

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: a deletion with one test to remove.

## What to build

The World Editor holds a hidden `#load-world` file input with nothing that opens it, since the World Editor Mobile change removed its button. Ruling Q8: remove the input, its handler and the test that fires the input directly. No Load World button returns.

Spec: Q8, Implementation Decisions "Dead input". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [ ] A search of the source finds no `load-world` id, handler or test after the change
- [ ] The World Editor still opens a world from the main menu (existing tests green)
- [ ] No current docs page describes the input (checked); released changelog notes stay as written
- [ ] A changelog fragment under Minor / Removed / 🛠️
