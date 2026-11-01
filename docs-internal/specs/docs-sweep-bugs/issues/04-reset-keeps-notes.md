# 04: Reset Keeps Hand-Written Memories

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one handler, one confirmation string, one help topic and one docs page.

## What to build

**Reset All My Changes** in the Memories dialog deletes the memories the player wrote by hand. Ruling Q3: Reset keeps them. Reset clears edits, deletions and pins only. Its confirmation, the Memories help topic and the Memory page say that hand-written memories stay.

Spec: Q3, Implementation Decisions "Memories reset". Evidence: docs-sweep ticket 03, Landed.

## Acceptance criteria

- [ ] A component test that adds a hand-written memory, edits and pins an AI memory, then confirms Reset fails today, then passes: the hand-written memory stays, the edit and pin are gone
- [ ] The confirmation text says hand-written memories stay, under the Writing Guide
- [ ] The Memories help topic and both Memory page passages that say Reset deletes hand-written memories are rewritten; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
