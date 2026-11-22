# 03: Drawn Opening Record

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The save remembers which Opening started the playthrough. At New Game the draw writes an opening record: owner id, Opening id, and a location id when a location owns the row, the same key the opening pool uses. A page-one re-roll that draws another row rewrites it (Q5). The shipped default opening writes none (Q7).

On load the record resolves against the current world (Q17). A missing owner or Opening, or a save with no record, resolves to null. A renamed Opening resolves under its new name.

This ticket owns the opening key type and the resolver. Tickets 04 and 06 import them and never build their own.

Ships its own docs: the **Drawn Opening** glossary entry and a changelog fragment.

## Acceptance criteria

- [ ] A new game that draws an entity's Opening saves a record naming that owner and Opening, through the gameplay context save/load round trip.
- [ ] A location-owned Opening's record carries the location id, and an entity and a location sharing an Opening id never resolve to each other.
- [ ] A page-one re-roll that draws a different row rewrites the record. A re-roll that keeps the row leaves it.
- [ ] A game started from the shipped default opening saves no record.
- [ ] Load resolves the record to the Opening in the current world, null when the Opening or owner was deleted, and null for a save with no record.

⚠️ Save `.json` shape change: the opening record.
