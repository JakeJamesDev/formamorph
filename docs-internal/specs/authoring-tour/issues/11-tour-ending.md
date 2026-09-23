# 11: Tour Ending

Status: ready-for-agent
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

- [ ] The Save pointer shows once, after the first save, and does not count as a numbered step.
- [ ] The mode step marks the existing toggle note as seen. A test proves that the old note does not show after the tour.
- [ ] **Play** saves the world, then enters it through the same flow as the main menu. It includes the Introduction readme and setup screen when the world has them.
- [ ] Finishing clears the progress record and restores the author's own mode.
- [ ] The ending steps stay last in the registry as tab steps are added. A test asserts this.
- [ ] Tests through the World Editor Bench harness cover the pointer, the mode step and finishing. Play is tested as far as the navigation it starts.
- [ ] Preview check through the dev router: the mode step and the final step, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.
