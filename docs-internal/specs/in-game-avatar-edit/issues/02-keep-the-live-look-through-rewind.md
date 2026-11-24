# 02: Keep the Live Look Through Rewind

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one carve-out in the gameplay state restore, with an existing precedent and an existing test seam.

## What to build

The player's look is a viewing preference, not story state (Q5). Rollback and regenerate stop restoring the look from the turn snapshot and keep the live look, as they already do for entity picture preference. Loading a save still restores the saved look. Turn snapshots keep recording the look, and a past page in the history view still shows its snapshot's look. The save shape does not change.

Spec: Q5; stories 15, 16, 24.

## Acceptance criteria

- [ ] A look changed after a turn survives rollback (gameplay state restore test).
- [ ] A look changed after a turn survives regenerate (gameplay state restore test).
- [ ] Both guards are proven to bite by reinstating the restore of the look.
- [ ] Loading a save restores that save's look (gameplay state restore test).
- [ ] A past page shows the look its snapshot recorded while the live look differs (gameplay state restore test).
- [ ] A changelog fragment is not needed on its own: the behavior ships with ticket 01's entry. If 01 has landed first, fold a line into its entry.
