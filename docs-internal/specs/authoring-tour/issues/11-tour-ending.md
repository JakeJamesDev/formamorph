# 11: Tour Ending

Status: in-progress
Base: 81739da8
Blocked by: 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Authoring Tour](../spec.md)

**What to build:** The tour points out saving, then closes on a clear next move.

- **Save pointer.** Right after the first automatic save, a note on the Save button says the tour saves for them now, and that after the tour they save with this button. It shows once.
- **Mode step.** The next-to-last step points at the Simple/Advanced toggle and says Advanced shows more fields. It marks the existing one-time toggle note as seen.
- **Final step.** **Play** enters the world through the normal entry flow. A pointer to the Test Bench flask says where to check the world later.

Finishing clears the tour's progress record and lifts the forced Simple mode.

The ending steps sit last in the registry. Until the tab tickets land, the tour ends right after Overview.

**Rationale for the model:** small steps on the existing engine. Sonnet at medium effort.

## Acceptance criteria

- [x] The Save pointer shows once, after the first save, and does not count as a numbered step.
- [x] The mode step marks the existing toggle note as seen. A test proves that the old note does not show after the tour.
- [x] **Play** saves the world, then enters it through the same flow as the main menu. It includes the Introduction readme and setup screen when the world has them.
- [x] Finishing clears the progress record and restores the author's own mode.
- [x] The ending steps stay last in the registry as tab steps are added. A test asserts this.
- [x] Tests through the World Editor Bench harness cover the pointer, the mode step and finishing. Play is tested as far as the navigation it starts.
- [x] Preview check through the dev router: the mode step and the final step, with static DOM evidence.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.

## Comments

**2026-09-23, implementation notes**

- The Save note is owned by the tour, not the tutorial registry. It shows after the first save of a tour session, holds the step note back until **Got It**, and has its own seen id (`authoring-tour-save`). **Reset Tutorials** brings it back.
- The mode step marks the Simple vs. Advanced note seen when the step is reached. An author who ends the tour before that step still gets the old note.
- The final step shows **Finish** and **Play**. **Finish** ends the tour in the editor. **Play** shows only where the host can enter a world (the main menu), so the in-game editor offers **Finish** alone.
- Ending steps have no tab (`tab: null`). They point at the header and footer, which show on every tab, so **Back to Tour** stays on the current tab.
- Tests: `WorldEditor.authoringTourEnding.test.tsx` (bench harness) and `MainMenu.tourPlay.test.tsx` (Play through the Introduction and setup screen to game start). Each new guard was mutation-tested.
