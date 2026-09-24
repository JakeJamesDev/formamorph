# 14: World Name Step Ignores the Default Name

Status: in-progress
Base: a3685c8b
Blocked by: 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Authoring Tour](../spec.md)

**What to build:** On a world made by **New World**, the tour's World Name step opens with **Next** disabled. The default name "New World" does not count as a value. **Next** unlocks once the author changes the name or uses **Use Example**. Every other step keeps the rule "any value unlocks **Next**".

**Rationale for the model:** one completion predicate and a shared constant. Sonnet at medium effort.

## Acceptance criteria

- [ ] **New World** and the World Name step's predicate read the default name from one shared constant. Neither has its own copy of the string.
- [ ] On a new world, the World Name step shows **Next** disabled.
- [ ] Typing any other name, or using **Use Example**, enables **Next**.
- [ ] Clearing the name back to empty disables **Next** again.
- [ ] Resuming a tour on a world still named with the default opens the step with **Next** disabled.
- [ ] Tests run through the World Editor Bench harness. Prove the guard by letting the default name count and watching the test fail.
- [ ] Remove the open point about the default name from ticket 03's Comments, or mark it resolved there with a pointer to this ticket.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree. The step registry is shared with tickets 06–09 and 11, so sequence edits with any parallel session.
