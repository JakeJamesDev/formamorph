# 01: Pick counts: shape, migration, and max

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a shipped-shape migration plus every `exclusive` reader moving to one new rule; the rest of the effort builds on it.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

A trait group has an optional minimum and maximum number of picks. They replace `exclusive`. An old world loads with its exclusive groups as "Up to One" and plays exactly as before. The editor sets the count with a select: Any, Exactly One, Up to One, Custom. Custom shows "At least" and "At most" fields. On the setup screen and in the Traits panel, a group with a max of 1 keeps its radio swap. A full group with a larger max disables its unchecked rows. Defaults are capped at each group's max in authored order. The minimum is stored and edited here. Ticket 02 enforces it.

## Acceptance criteria

- [ ] `TraitGroup` has `minPicks?` and `maxPicks?`, and `exclusive` leaves the type (Q5). An absent min means 0, and an absent max means no limit. This is a world export shape change.
- [ ] `migrateWorld` rewrites `exclusive: true` as `maxPicks: 1` on world groups and entity-owned groups. A second run changes nothing.
- [ ] Every reader of `exclusive` reads `maxPicks === 1`, and only direct children count (Q3). `TraitSelectionModal` is confirmed dead and named in the ticket's comments, not updated.
- [ ] Switching on a trait in a full group with a max above 1 is refused by the gate module. A max-1 group still retires its sibling (Q10).
- [ ] Default selection keeps at most `maxPicks` defaults per group, first in authored order. This generalizes the exclusive-default collapse.
- [ ] A pure query reports each group's pick state per bearer: count, min, max, short, full. The setup list, the Traits tab and Test Bench read it.
- [ ] The group editor shows the count select with the four presets. Custom shows the two number fields. Copy follows the Writing Guide.
- [ ] The same behavior holds for entity-owned groups (Q11).
- [ ] Tests: migration and idempotence; the gate-module refusal at the cap; the default cap; component checks for disabled rows at the cap and for max-1 radios. Each guard is shown to bite.
- [ ] The changelog line is in In Progress. The response carries the export-shape reminder.
