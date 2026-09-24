# 05: Locations Steps

Status: ready-for-human
Status note: Built in 1d32c839 and the review follow-up. The one-way Connection ruling (2026-09-23) is built by ticket 15: In Play shows the location the Connection leaves from.
Base: e56bc579
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** After Overview, the tour builds two connected locations, and In Play shows each field's effect.

| Step | Player Sees | Prompt Reads |
|---|---|---|
| Add a location | (the Add button is the anchor) | none |
| Name | Location tab with the name | Narration: the location block |
| Player-Facing Description | Location tab body | Narration: "The AI never reads this field" |
| AI-Facing Description | "Players never see this field" | Narration: the location block, marked |
| Starting Location | "A new game starts here" | none |
| Add a second location | (the Add button is the anchor) | none. **Use Example** shows once the location exists and fills its Name and both descriptions |
| Connection with Travel Hint | Connected Locations in the Location tab | Location Change: the destinations list, with the hint attached. No Narration reader, because Narration never reads it |

This ticket also adds the **add-step mechanics** that every later tab uses:

- An add step points at the list's Add button, and it completes when a new item exists.
- The tour records the new item's id as a tour item and selects the item.
- If an author deletes a tour item, the step that created it becomes current again.
- **Back to Tour** selects the step's item.

**Use Example** values come from Appendix A: The Tidewell and The Salt Lantern.

**Rationale for the model:** the add-step mechanics and tour-item recovery are new behavior that three later tickets reuse. Opus at high effort.

## Acceptance criteria

- [ ] All seven steps run in order after Overview, and each saves when it completes.
- [ ] Player Sees uses the Location tab body from ticket 02.
- [ ] The location block and the destinations list come from the Test Bench builders. The Travel Hint shows attached to its destination.
- [ ] Each reader names the prompt that really reads the field: Narration for the location block, Location Change for the destinations list (spec session ruling, 2026-09-23).
- [ ] The Starting Location step completes when the tour's first location is a Starting Location.
- [ ] The Connection step completes when a Connection joins the two tour locations. A Travel Hint is optional.
- [ ] Deleting a tour location makes its add step current. The steps after it wait until a new one exists.
- [ ] The drift test covers the new anchors with no new test code.
- [ ] Tests through the World Editor Bench harness cover each step's slice, the marks, the add mechanics and the recovery after a delete.
- [ ] Preview check through the dev router: the Name, AI-Facing Description and Connection steps, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree. Tickets 06, 07 and 09 add steps to the same registry. Sequence edits with any parallel session.
