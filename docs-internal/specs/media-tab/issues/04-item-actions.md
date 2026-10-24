# 04: Item Actions

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Writes through four parent kinds, one history step per action, and the history reveal mapping for a new tab. It owns the action row that tickets 05 and 06 reuse, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

The item panel gains **Replace** and **Remove** beside Download, for every kind except Avatars (ticket 06) and gallery images (ticket 05 places the row under the gallery).

- **Replace** opens a file picker filtered to the kind and writes the new file into the same field. Images go through the existing downscale consent. A replaced sound or 3D Model keeps its field; a replaced image keeps its slot.
- **Remove** clears the field. It needs no confirm, since undo restores it.
- Each action is one editor history step with a label in the house form (for example `Remove Ambient Sound: <location>`).

This ticket owns the **action row** as one component (Replace, Download, Remove, with the linked-image Open Link form of Download). Tickets 05 and 06 use it.

History reveal learns the Media tab: undoing or redoing a Media tab edit returns to the tab with the card selected. The reveal keys the selection by the item's identity, so tickets 05 and 06 get it without new mapping.

Changelog fragment: fold into ticket 01's line if unreleased.

## Acceptance criteria

- [ ] Replace and Remove work for world thumbnail, Background Music, entity sound, entity 3D Model, location background, location ambient sound and dictionary thumbnail
- [ ] Each action writes the world and undoes in one step
- [ ] Replace on an image goes through the downscale consent
- [ ] A Remove makes the card leave the gallery and the totals drop
- [ ] Undoing a Media tab edit from another tab returns to the Media tab with that card selected
- [ ] The action row is one component used by the item panel
