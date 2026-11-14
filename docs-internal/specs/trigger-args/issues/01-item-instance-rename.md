# 01: Rename Item Copy to Item Instance

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one mechanical rename across about 1,060 lines, checked by the typecheck. Wide, not deep.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q15).

## What to build

"Item Copy" becomes **Item Instance** in code, the glossary, the docs and UI copy. Types, functions, fields, variables, tests and fixtures follow (`ItemCopy` → `ItemInstance`, `copyId` → `instanceId`, and the like). Two layers stay as they are, for later tickets: the keys a save writes (ticket 02) and the script surface, `items[x].copies` and `self.event.copy` (ticket 03). A save written before and after this ticket is byte-identical. This ticket lands alone and first, because every other ticket builds on the new names.

## Acceptance criteria

- [ ] No code identifier, comment, test name or fixture says copy for an Item Instance, except the save keys and the script surface.
- [ ] The glossary entry is **Item Instance**; its `_Avoid_` line lists "Item Copy"; entries that named Item Copy use the new term.
- [ ] The docs and UI copy say Item Instance, written per the Writing Guide (copy-sweep on the changed strings).
- [ ] A save written from the same state before and after the rename is identical (test).
- [ ] The script surface and its hover text are unchanged.
