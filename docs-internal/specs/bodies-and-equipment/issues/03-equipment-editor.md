# 03: Equipment Settings Editor

Status: ready-for-human
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This is a new visual pattern. Get the user's approval through the `design-system` flow before you build it. The user approved it with Bodies on Morphie's layer pattern (Q49).

## What to build

An **Equipment Settings** entry pinned at the top of the World Editor's Items list opens an editor in the right pane with three sections:
- **Slots:** add, rename, reorder and delete.
- **Bodies:** add, rename and reorder Bodies, and edit each Body's slot entries with a capacity. The section states that the first Body is the Default.
- **Persona Items:** the player's starting placements.

The Slots and Persona Items sections leave Overview.

An entity's Items tab gets a Body select above its placements. Its options are Default (\<first Body name\>), None, then each Body. An item's Slot Size ranges from 1 to the largest capacity any Body gives its slot.

Deleting a slot in use counts the items and Body entries that use it, then clears them. Deleting a Body in use counts entity picks and trait Body rows, then clears them. Cleared picks fall back to Default. Both deletes use the helper from 02. Trait Body rows arrive in 05. Until then, the Body delete counts picks only and leaves the trait-row count to 05.

Spec: Solution; Implementation Decisions under Editor and Delete standard; Q4, Q16, Q17, Q25, Q27, Q28, Q43–Q47, Q49.

## Acceptance criteria

- [x] The Equipment Settings entry opens the editor with the Slots, Bodies and Persona Items sections, and Overview has neither the Slots nor the Persona Items section — `WorldEditor.equipment.test.tsx` "opens the Slots, Bodies and Persona Items sections, which leave the Overview"
- [x] Bodies can be reordered, and the Default note names the first Body — Playwright keyboard drag in the preview: dragging Hound first made the note read "Hound is the Default"; test "names the first Body as the Default"
- [x] The entity Body select lists Default (\<name\>), None and then each Body, and saves the pick — test "lists Default with the first Body, None, then each Body, and saves the pick"
- [x] Slot Size is capped by the largest Body capacity for its slot — the item panel slot-size tests from 01, plus "cuts Slot Sizes down…" and "undoes a capacity drop and its Slot Size cut in one step"
- [x] A slot delete in use confirms with item and Body-entry counts, then clears them. An unused slot deletes at once — tests under "the Slots section"
- [x] A Body delete in use confirms with the pick count, then resets those picks to Default — test "counts the entities that pick a Body in use, then sets them back to Default". 05 landed first, so the delete also counts and blanks trait Body rows (world and entity traits): test "counts the trait Body rows that pick a Body…"
- [x] A dev route opens the Equipment Settings editor (`#dev?modal=worldEditor&tab=items&subtab=equipment&fixture=items`). Frames are stored at `.scratch/frames/equipment-editor-light.png` and `.scratch/frames/equipment-editor-dark.png` at desktop width — 1440 px frames, plus two mobile frames
- [x] The World Editor Items wiki page describes Equipment Settings — the "Equipment Settings" section of `World-Editor-Items.md`

## Landed

**Not verified**
- None. Every criterion above is ticked.

**For you**
- For you: the Equipment editor's layout and the Body entry editing feel (World Editor → Items → Equipment Settings).
- Frames: `.scratch/bodies-and-equipment-03/frames/equipment-editor-light.png` and `.scratch/bodies-and-equipment-03/frames/equipment-editor-dark.png`.
- The pinned row is the one new pattern. It got a Design System row and a Rich Lists showcase sample. Q49 covers Bodies only.
- Two unreleased changelog entries under Inventory still say slots and Persona Items are "on the Overview tab". A ticket branch can't edit them; fold them at close.
