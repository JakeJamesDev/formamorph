# 01: Pick counts: shape, migration, and max

Status: ready-for-human
Base: 15d2b102
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a shipped-shape migration plus every `exclusive` reader moving to one new rule; the rest of the effort builds on it.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

A trait group has an optional minimum and maximum number of picks. They replace `exclusive`. An old world loads with its exclusive groups as "Up to One" and plays exactly as before. The editor sets the count with a select: Any, Exactly One, Up to One, Custom. Custom shows "At least" and "At most" fields. On the setup screen and in the Traits panel, a group with a max of 1 keeps its radio swap. A full group with a larger max disables its unchecked rows. Defaults are capped at each group's max in authored order. The minimum is stored and edited here. Ticket 02 enforces it.

## Acceptance criteria

- [x] `TraitGroup` has `minPicks?` and `maxPicks?`, and `exclusive` leaves the type (Q5). An absent min means 0, and an absent max means no limit. This is a world export shape change.
- [x] `migrateWorld` rewrites `exclusive: true` as `maxPicks: 1` on world groups and entity-owned groups. A second run changes nothing.
- [x] Every reader of `exclusive` reads `maxPicks === 1`, and only direct children count (Q3). `TraitSelectionModal` is confirmed dead and named in the ticket's comments, not updated.
- [x] Switching on a trait in a full group with a max above 1 is refused by the gate module. A max-1 group still retires its sibling (Q10).
- [x] Default selection keeps at most `maxPicks` defaults per group, first in authored order. This generalizes the exclusive-default collapse.
- [x] A pure query reports each group's pick state per bearer: count, min, max, short, full. The setup list, the Traits tab and Test Bench read it.
- [x] The group editor shows the count select with the four presets. Custom shows the two number fields. Copy follows the Writing Guide.
- [x] The same behavior holds for entity-owned groups (Q11).
- [x] Tests: migration and idempotence; the gate-module refusal at the cap; the default cap; component checks for disabled rows at the cap and for max-1 radios. Each guard is shown to bite.
- [x] The changelog line is in In Progress. The response carries the export-shape reminder.

## Comments

- `TraitSelectionModal` is dead code: only `TraitSelectionModal.test.tsx` imports it. Per Q24 it keeps compiling with a one-line `maxPicks === 1` read and is not otherwise updated. Removing it is the user's call.
- The in-game player switch (`switchPlayerTrait`) refuses a switch-on at the cap through the gate module's `overfills`. Stat code's switches keep their own path and ignore the cap, as they ignore Player Can Toggle.
- Review fold-in: the editor previews (Test Bench lens, the authored scene, the entity trait preview) cap defaults at each group's max too. The lens cap has a guard test; the other two share `capDefaults` and have no dedicated test.
