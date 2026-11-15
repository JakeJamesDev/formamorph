# 01: Rename Item Copy to Item Instance

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one mechanical rename across about 1,060 lines, checked by the typecheck. Wide, not deep.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q15).

## What to build

"Item Copy" becomes **Item Instance** in code, the glossary, the docs and UI copy. Types, functions, fields, variables, tests and fixtures follow (`ItemCopy` → `ItemInstance`, `copyId` → `instanceId`, and the like). Two layers stay as they are, for later tickets: the keys a save writes (ticket 02) and the script surface, `items[x].copies` and `self.event.copy` (ticket 03). A save written before and after this ticket is byte-identical. This ticket lands alone and first, because every other ticket builds on the new names.

## Acceptance criteria

- [x] No code identifier, comment, test name or fixture says copy for an Item Instance, except the save keys and the script surface. Typecheck green; grep sweeps of identifiers, comments and prose, and a two-axis review against Base.
- [x] The glossary entry is **Item Instance**; its `_Avoid_` line lists "Item Copy"; entries that named Item Copy use the new term. `CONTEXT.md`.
- [ ] The docs and UI copy say Item Instance, written per the Writing Guide (copy-sweep on the changed strings). Strings changed; copy-sweep not run.
- [x] A save written from the same state before and after the rename is identical (test). `GameplayContext.itemInstances.test.tsx` "write the same keys a save carried before the rename"; shown to bite by writing `itemInstances` again (5 tests failed).
- [x] The script surface and its hover text are unchanged. `statCodeSurface.ts` hover text and `toolScriptSurface.ts` have no text change.

## Landed

**Not verified**
- Copy-sweep on the changed strings was not run.
- No UI frame was checked. The editor hints, timing hints and docs changed in wording only.

**Kept for later tickets**
- Save keys (ticket 02): `itemCopies`, `copyId` and `targetCopyId` on saved inventory operations.
- Sandbox side (ticket 03): `items[x].copies`, `self.event.copy`, `SandboxItem.copies`, `ItemScriptEvent.copyId`, the prelude names and the hover text. Script tokens in `docs/ScriptsGuide.md` and `docs/Scripts-Reference.md` stay; prose around them says Item Instance. Help vectors are not rebuilt.

**For you**
- Read the item hints in the World Editor Items tab and the timing hints on the Scripts tab: "Item Instance" and "instance" replace "copy".
