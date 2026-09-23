# 12: In Play on Mobile

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** On mobile, the step note has a **Show Effect** button. It opens In Play in a bottom sheet, which is the Test Bench's mobile pattern. The sheet shows the same slice as the desktop pane and updates as the author types. Closing the sheet returns to the field.

**Rationale for the model:** layout and sheet behavior on small screens, with the editor's non-monotonic pane widths. Sonnet at high effort.

## Acceptance criteria

- [ ] **Show Effect** shows only at mobile widths. The docked pane shows only at desktop widths.
- [ ] The sheet shows the same Player Sees surface and readers as the desktop pane for the same step.
- [ ] While the sheet is open, the step note stands down. It comes back when the sheet closes.
- [ ] The sheet and the Test Bench's mobile sheet are never open together.
- [ ] Tests through the World Editor Bench harness at a mobile width: Show Effect, the sheet's content, and the note standing down. Read the sheet's state, because the sheet stays mounted after it closes.
- [ ] Preview check at 375 wide through the dev router, on a step with marked text, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.
