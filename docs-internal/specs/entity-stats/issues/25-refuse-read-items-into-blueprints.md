# 25: Refuse Read Items Into Blueprints

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: adds one refusal to both trees, reusing ticket 24's stat reader checks and the trait requirement scan; the trait reader list is the part to confirm.

Parent: [Entity Stats spec](../spec.md)

## What to build

Today an author can drag a world stat or a world trait into Blueprints while something still reads it. The item stops being a player stat or trait, and its readers stop working without a warning. Now the drag is refused, with a note that names the reader (ruling Q81), as a placeholder drag into Blueprints already is (Blueprints Q54).

- **Stats:** the readers are Q80's trait rows and stat code.
- **Traits:** the readers are other traits' requirements and anything else that names the trait. The ticket session brings the full trait reader list to the spec session before building.
- A group drag is refused when anything inside it is read. The note names the first hit.

## Acceptance criteria

- [ ] A world stat that a trait row or stat code reads can't move into Blueprints. The note names the reader.
- [ ] A world trait that a requirement or another reader names can't move into Blueprints. The note names the reader.
- [ ] A group holding a read item is refused the same way.
- [ ] An item that nothing reads still moves into Blueprints.
- [ ] The note copy follows the existing trait refusal form and passes the copy-sweep.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
