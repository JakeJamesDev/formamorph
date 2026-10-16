# 03: Global Target in World Files

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one migration rule applied at four import boundaries.

## What to build

A trait stat row's target `player` becomes `global` (Q5). A requirement row that names a global item loses any stored owner (Q19). The world migration does both; the entity file importer, the character card importer and the library entity store run the same rewrite. Exports write the new shape. The world format doc documents `global` and notes that `player` loads.

⚠️ Export-shape change: carry the reminder in the response.

Spec: Q5, Q19, stories 11–13.

## Acceptance criteria

- [ ] A `player` row target loads as `global` from a world file, an entity file, a character card and the library entity store
- [ ] A stored owner on a row naming a global item is gone after load from each boundary
- [ ] Exports write `global`; a second migration changes nothing
- [ ] The world format doc shows `global` and notes that `player` loads
- [ ] Four gates green

## Blocked by

- None (can start immediately)
