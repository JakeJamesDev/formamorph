# 04: Trait Switch Landing

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a contained fix on one landing path, with the proof that the drop existed.

## What to build

A trait the player toggles during play runs its When a Trait Switches scripts, and today their memory, pin and diary writes are returned and never consumed. The fix lands them the way a Before-the-AI run's world writes land, between turns, on the latest turn on screen: the memory line joins that turn's digest, the pinned line becomes a Custom line anchored at that point, the diary line joins the entity's diary (Q6). Switches made by a script inside a run keep their current path.

Spec: Q6, story 18.

## Acceptance criteria

- [ ] A test reinstates the drop and fails: toggling a trait whose switch script calls the memory line, the pin and the diary leaves all three on the latest turn after the fix and none before
- [ ] A rewind past that turn removes the pinned line with it, as script pins do
- [ ] A switch fired by a script inside a Before-the-AI run still lands with that run's batch, unchanged
- [ ] Four gates green

## Blocked by

- None (can start immediately)
