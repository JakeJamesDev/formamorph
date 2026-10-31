# 03: Equipment Editor

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This is a new visual pattern. Get the user's approval through the `design-system` flow before you build it.

## What to build

An **Equipment** entry pinned at the top of the World Editor's Items list opens an editor in the right pane with three sections:
- **Slots:** add, rename, reorder and delete.
- **Bodies:** add, rename and reorder Bodies, and edit each Body's slot entries with a capacity. The section states that the first Body is the Default.
- **Persona Items:** the player's starting placements.

The Slots and Persona Items sections leave Overview.

An entity's Items tab gets a Body select above its placements. Its options are Default (\<first Body name\>), None, then each Body. An item's Slot Size ranges from 1 to the largest capacity any Body gives its slot.

Deleting a slot in use counts the items and Body entries that use it, then clears them. Deleting a Body in use counts entity picks and trait Body rows, then clears them. Cleared picks fall back to Default. Both deletes use the helper from 02. Trait Body rows arrive in 05. Until then, the Body delete counts picks only and leaves the trait-row count to 05.

Spec: Solution; Implementation Decisions under Editor and Delete standard; Q4, Q16, Q17, Q25, Q27, Q28.

## Acceptance criteria

- [ ] The Equipment entry opens the editor with the Slots, Bodies and Persona Items sections, and Overview has neither the Slots nor the Persona Items section
- [ ] Bodies can be reordered, and the Default note names the first Body
- [ ] The entity Body select lists Default (\<name\>), None and then each Body, and saves the pick
- [ ] Slot Size is capped by the largest Body capacity for its slot
- [ ] A slot delete in use confirms with item and Body-entry counts, then clears them. An unused slot deletes at once
- [ ] A Body delete in use confirms with the pick count, then resets those picks to Default
- [ ] A dev route opens the Equipment editor. Frames are stored at `.scratch/frames/equipment-editor-light.png` and `.scratch/frames/equipment-editor-dark.png` at desktop width
- [ ] The World Editor Items wiki page describes Equipment

For you: the Equipment editor's layout and the Body entry editing feel (World Editor → Items → Equipment).
