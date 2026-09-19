# 04: Pick a Persona at Enter World

Status: in-progress
Base: f43219d7
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** The enter-world workspace step gains a Persona category. The player picks a library persona or None, and the pick reaches the game as the save's persona reference. One global default persona exists, and each world remembers its last pick on the device. Quick Start uses the same order with no step.

**Rationale for the model:** the work follows the existing workspace categories and the dictionary and character hand-off. A mid-tier model fits; high effort for the preselect rules and the one-role rule.

## Acceptance criteria

- [ ] The category lists marked library entities with portrait and name, plus None. It is hidden when no persona is available.
- [ ] The pick travels to the game the way the chosen dictionaries and added characters do, and lands as the save's reference. None lands as an explicit None.
- [ ] The new-game seed step sets the reference before it draws the opening, so later tickets can render the persona's name into page one. A test asserts the order.
- [ ] A library entity picked as the persona is not among the picked entities that the opening pool reads, so its openings never enter the pool. A test proves it.
- [ ] A marked library entity shows in both the character list and the persona picker. Picking it in one removes it from the other for that playthrough. Component tests cover both directions.
- [ ] The player sets and clears a global default persona from the Entities tab. It names a library entity only. It is device-local and never exported.
- [ ] Each world remembers its last pick, None included, on the device. Pure tests cover the preselect order for the step and for Quick Start: the world's remembered pick, then the global default, then None.
- [ ] A default or remembered pick that names a deleted entity falls through to the next rule.
- [ ] The preselect rules take the world's player setting as an input that is always Open in this ticket, so ticket 07 extends them without a rewrite.
- [ ] The category is reachable in one dev-router call and is checked in the preview with static DOM evidence.
- [ ] Help copy follows the UI help copy pattern.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

World personas in the picker belong to ticket 06. The in-game picker belongs to ticket 05 and reuses this ticket's picker component. No export-shape change in this ticket; ticket 02 added the reference.
