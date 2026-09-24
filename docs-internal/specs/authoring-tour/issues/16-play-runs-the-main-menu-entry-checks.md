# 16: Play Runs the Main Menu Entry Checks

Status: ready-for-human
Status note: Built. The gate now sits in `startEntry`. A blocked Play opens the world modal, which only a New World tour reaches untested. A blocked Play still ends the tour, as every Play does.
Base: a3685c8b
Blocked by: 11
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** The tour's **Play** button enters a world through exactly the same checks as entering it from the main menu. Today **Play** skips the source-block check, the one that stops entry when a world's linked library content is missing. With this change, a tour world that has missing sources is stopped the same way, with the same message, as it would be from the main menu.

A tour world has no library links unless the author adds them outside the tour, so this rarely fires. The point is that the tour has no entry path of its own that can drift from the real one.

**Rationale for the model:** it routes **Play** through the main menu's entry path instead of beside it, so later entry checks apply to both for free. Sonnet at high effort.

## Acceptance criteria

- [ ] **Play** and the main menu's world entry share one entry path. There is no second list of pre-entry checks.
- [ ] A tour world with a missing linked source is blocked on **Play**, with the same message the main menu shows.
- [ ] A tour world with no linked content enters as it does today, through the Introduction readme and setup screen when the world has them.
- [ ] **Play** stays absent from the in-game World Editor.
- [ ] Tests: extend the Play test through the main menu with a blocked case and the existing unblocked case. Prove the blocked case by skipping the check again and watching it fail.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.
