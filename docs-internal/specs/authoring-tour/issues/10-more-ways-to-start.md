# 10: More Ways to Start

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** An author can reach the tour in two more ways.

- **First editor visit.** The first time any world other than a new blank one opens in the editor, a one-time note offers the tour. It shares its seen-state with the new-world offer from ticket 03, so declining or taking either offer retires both.
- **Settings.** A **Start Authoring Tour** row on the Data tab shows in both Settings modes. It is not beside Reset Tutorials, which is Advanced-only. The row is hidden while a game is running.

Starting from either place creates a new world with the same defaults as **New World**, opens it in the editor, and starts the tour. The tour never edits a world the author already had.

**Rationale for the model:** it touches the main menu, the editor and Settings, and navigates between them. Sonnet at high effort.

## Acceptance criteria

- [ ] The first-visit offer shows once, only on a world that is not a new blank one.
- [ ] Declining either offer hides both. Taking either offer hides both. A test proves the shared seen-state.
- [ ] The first-visit offer and the existing Simple/Advanced toggle note never show at the same time. The offer comes first.
- [ ] **Start Authoring Tour** shows on the Data tab in Simple and Advanced Settings, and is hidden during a game.
- [ ] Starting from Settings or the first-visit offer creates one new world, opens the editor on it, and starts at step 1. The world that was open is not changed.
- [ ] The row's copy follows the Settings copy rules. A copy sweep of it is clean.
- [ ] Tests: the offers through the World Editor Bench harness, the Settings row through the Settings modal tests in both modes, including the in-game case.
- [ ] Preview check through the dev router: the first-visit offer and the Settings row, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.
