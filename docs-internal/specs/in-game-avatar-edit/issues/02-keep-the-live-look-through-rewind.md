# 02: Keep the Live Look Through Rewind

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one carve-out in the gameplay state restore, with an existing precedent and an existing test seam.

## What to build

The player's look is a viewing preference, not story state (Q5). Rollback and regenerate stop restoring the look from the turn snapshot and keep the live look, as they already do for entity picture preference. Loading a save still restores the saved look. Turn snapshots keep recording the look, and a past page in the history view still shows its snapshot's look. The save shape does not change.

Spec: Q5; stories 15, 16, 24.

## Acceptance criteria

- [x] A look changed after a turn survives rollback (gameplay state restore test). `GameplayContext.rewindLook.test.tsx`: "survives rollback".
- [x] A look changed after a turn survives regenerate (gameplay state restore test). Same file: "survives regenerate".
- [x] Both guards are proven to bite by reinstating the restore of the look. With the restore reinstated, both tests failed; the save-load and past-page tests stayed green.
- [x] Loading a save restores that save's look (gameplay state restore test). Same file: "is replaced by the saved look when a save loads".
- [x] A past page shows the look its snapshot recorded while the live look differs (gameplay state restore test). Same file: "shows a past page its snapshot look…".
- [x] A changelog fragment is not needed on its own: the behavior ships with ticket 01's entry. Ticket 01 has not landed, so no line was folded in.

## Landed

**Not verified**
- Ticket 01 had not landed, so no line went into its changelog entry. Add one when it lands.

**For you**
- None. No player-visible surface changes until ticket 01 ships the editor.
