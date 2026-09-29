# 01: Connection legs and per-direction hints

Status: ready-for-human
Base: 577648bb
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

- [x] The Connection type has `id`, `a`, `b`, `aToB?`, `bToA?`, each leg `{ hint?: string }`. `twoWay`, `from`, `to`, and `aiHint` are gone.
- [x] `migrateWorld` converts an old two-way record to two legs that both carry the old hint, and an old one-way record to one leg. A new-shape record passes through. A record with no legs is dropped. The step is idempotent.
- [x] Save world copies go through the same step.
- [x] The bundled worlds with Connections are in the new shape and play the same.
- [x] Destination entries carry the hint of the leg that reaches them. A leg with no hint gives no hint, even when the other leg has one.
- [x] A one-way Connection still offers no return trip, and ADR-0002 behavior is unchanged.
- [x] Each canvas arrow's label is its own leg's hint.
- [x] Setting a direction keeps each leg's hint with its leg. A flip moves the leg without changing `a`/`b`. Switching one-way to two-way adds the new leg with the existing hint. A blank hint drops the field.
- [x] Canvas inspector boxes are labeled with an arrow plus the destination name. Location panel boxes are labeled **To** *partner* and **From** *partner*.
- [x] A guard test fails when the single-hint behavior is reinstated.
- [x] Changelog line in In Progress. The response carries the export-shape reminder.

## Comments

- Saves carry no copy of Connections (`SaveObject` and `GameState` hold no locations), so the save criterion needs no code. The world a save plays is migrated by `loadWorldData`.
- Arrow labels follow the spec session's A + B ruling: equal leg hints draw one shared label on the `a → b` arrow; different hints draw each label on its arrow's outer side.
- The Authoring Tour's Connection step keeps its In Play lens at the first location (spec session ruling B). Its quoted hint reads the leg leaving the lens, so a hint typed only in the top box shows after ticket 02 links the boxes.
- Review fold-in: `LegKey` moved to `@/types`; the migration now normalizes new-shape records too; `docs/WorldFormat.md` documents the leg shape.
