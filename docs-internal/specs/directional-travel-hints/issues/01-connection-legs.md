# 01: Connection legs and per-direction hints

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: a shape replacement across about 11 modules plus a migration. The migration and ADR-0002 behavior must stay exact.

Parent: [Directional Travel Hints spec](../spec.md)

## What to build

Each direction of a Connection has its own Travel Hint, and the narrator gets the hint for the direction the player travels.

The Connection record becomes one record per pair with optional legs (see the spec's Data shape). A `migrateWorld` step converts old worlds and the world copies in saves. The bundled worlds move to the new shape. Every reader of the old fields moves over: the location graph, the location context, the Locations Canvas builder, the connection-editing module, the Authoring Tour, and the design-system canvas reference.

Both editors (canvas inspector and the location panel's Connections list) show one plain, editable Travel Hint box per leg, each labeled with its direction. There is no link toggle in this ticket.

## Acceptance criteria

- [ ] The Connection type has `id`, `a`, `b`, `aToB?`, `bToA?`, each leg `{ hint?: string }`. `twoWay`, `from`, `to`, and `aiHint` are gone.
- [ ] `migrateWorld` converts an old two-way record to two legs that both carry the old hint, and an old one-way record to one leg. A new-shape record passes through. A record with no legs is dropped. The step is idempotent.
- [ ] Save world copies go through the same step.
- [ ] The bundled worlds with Connections are in the new shape and play the same.
- [ ] Destination entries carry the hint of the leg that reaches them. A leg with no hint gives no hint, even when the other leg has one.
- [ ] A one-way Connection still offers no return trip, and ADR-0002 behavior is unchanged.
- [ ] Each canvas arrow's label is its own leg's hint.
- [ ] Setting a direction keeps each leg's hint with its leg. A flip moves the leg without changing `a`/`b`. Switching one-way to two-way adds the new leg with the existing hint. A blank hint drops the field.
- [ ] Canvas inspector boxes are labeled with an arrow plus the destination name. Location panel boxes are labeled **To** *partner* and **From** *partner*.
- [ ] A guard test fails when the single-hint behavior is reinstated.
- [ ] Changelog line in In Progress. The response carries the export-shape reminder.
