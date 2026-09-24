# 06: Entities Steps

Status: in-progress
Base: 99bbfe14
Blocked by: 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** After Locations, the tour builds one entity, and In Play shows the two sides of a character.

| Step | Player Sees | Narration Prompt Reads |
|---|---|---|
| Add an entity | (the Add button is the anchor) | none |
| Name | Entity list row and entity card | The roster, once the entity has a location |
| Pronouns | "Players never see this field" | The roster's pronouns line |
| Player-Facing Description | Entity card body | "The AI never reads this field" |
| AI-Facing Description | "Players never see this field" | The roster entry, marked |
| Locations | Entity list row, shown while at that location | The roster of that location |

Until the entity has a location, every AI reader shows the **not in the scene** state: the AI never reads an entity that is in no location. Once the author places it, the roster shows it.

**Use Example** values come from Appendix A: Maren, she/her, in The Tidewell.

**Rationale for the model:** follows the pattern of tickets 04 and 05. Sonnet at high effort, because of the not-in-the-scene state.

## Acceptance criteria

- [x] All six steps run in order after Locations, and each saves when it completes.
- [x] Player Sees uses the entity list row and entity card body from ticket 02.
- [x] The roster comes from the Test Bench builders, for the entity's location.
- [x] Before the entity has a location, each AI reader shows the not-in-the-scene state. After the Locations step, the roster shows the entity.
- [x] The Locations step completes when the entity is in at least one tour location.
- [x] Tests through the World Editor Bench harness cover each slice, the marks, and the not-in-the-scene state before and after placement.
- [x] Preview check through the dev router: the AI-Facing Description and Locations steps, with static DOM evidence.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree. Shares the step registry with tickets 07 and 09.
