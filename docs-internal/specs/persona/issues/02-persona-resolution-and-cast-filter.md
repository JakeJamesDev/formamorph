# 02: Persona Resolution and Cast Filter

Status: in-progress
Base: fe233128
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** A save holds a persona reference, and one pure module turns that reference into the persona and into the cast without the played entity. Every reader of the entity list in play takes its cast from that module. The staged planner's player-name list holds the persona's name and aliases in place of trait names. No picker exists yet, so tests and a dev hook set the reference.

**Rationale for the model:** the ticket routes every entity reader in the game view, the largest file in the codebase, through one new seam. A strong model at high effort.

## Acceptance criteria

- [ ] The save envelope holds the reference beside the dictionary set chosen at world entry. Its states are a world entity id, a library entity id, and an explicit None. An absent reference means no persona. The reference does not roll back with turns.
- [ ] The module is pure. It takes the reference, the authored world's entities, and the library entities. It returns the resolved persona or none, the cast without the played entity, and the player-name list.
- [ ] Table-driven tests cover each reference state, a reference that no longer resolves, a played world entity absent from every one of its locations, and a library persona that never enters the cast.
- [ ] The roster chip, the prose parse for entity participation, diaries, discovery matching, scene tags, the planner's cast, and the in-game entity panel all read the module's cast.
- [ ] A reader guard test fails when a reader takes the raw entity list. The guard is proven by pointing one reader at the raw list and watching the test fail.
- [ ] The player-name list is the persona's name and aliases. With no persona the list is empty. Trait names leave it. The cast classification tests reflect this.
- [ ] Library persona content is read live from the entity library at load and when the library changes. World persona content is read from the authored world. Gameplay writes neither.
- [ ] A save round-trip test covers each reference state. A save with no reference loads with no persona.
- [ ] A dev-only hook sets the reference so that later tickets and live checks can use it. It stays out of production builds.
- [ ] The response states the export-shape change: one additive field on the save envelope.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

A character added at Enter World is a frozen copy in the save. A persona is a live read. The difference is deliberate; do not unify them. The missing-persona notice belongs to ticket 05.
