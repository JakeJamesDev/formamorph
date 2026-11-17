# 04: Picker Slot

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The image slot from prototype variant B (Q16), on entity and location galleries. This ticket owns the picker component; tickets 05 and 06 reuse it.

- Empty slot: **Import** and **Choose** side by side, the image URL box below. Import adds the files to the list under their names and links the first into this slot; several files fill the next slots. Choose opens a popover grid: search over names, three columns, names wrapped to two lines, entries this subject already links dimmed. A pasted URL joins the list as a named linked entry.
- Filled slot: the existing frame plus a name field that renames the entry (uniqueness and suffix from ticket 01), **Unlink**, and **Delete from World**.
- Delete from World lists every place that uses the entry (ticket 01's usage index) and asks first. Confirming unlinks it everywhere and removes the entry (Q6).
- Generate with AI adds its picture under the subject fallback name and links it, keeping the "Replace which image?" step.
- Drop targets keep working: a dropped file or link imports and links.
- From ticket 03's landing: the Authoring Tour's example image still writes an embedded picture that only the next load moves into the list. Route it through the slot's import so it lands as an entry at once.
- Labels are working names: run the copy sweep on the new copy.
- Ships its docs: the wiki's World Editor image pages.

The prototype is on branch `prototype/image-library`; rebuild it properly rather than promoting it.

## Acceptance criteria

- [ ] Import adds a named entry and links it into the open slot.
- [ ] Choose links an existing entry; the search filters by name; entries already on this subject are dimmed.
- [ ] A pasted URL adds a linked entry named after the URL's last segment.
- [ ] Renaming to a taken name gives the suffixed name.
- [ ] Unlink frees the slot and keeps the entry.
- [ ] Delete from World lists each place using the entry, and after confirming no field links it.
- [ ] Choose is not clipped and takes clicks in the World Editor entity and location panels (inside their scroll areas) and in the Media tab's panels. The library entity editor keeps the plain uploader (Q41).
- [ ] Frames of the empty slot, the open Choose grid and a filled slot, both themes, 1440 wide: `.scratch/frames/slot-empty-<theme>.png`, `.scratch/frames/slot-choose-<theme>.png`, `.scratch/frames/slot-filled-<theme>.png`.

For you: try Choose with a world that has many images and judge whether the grid is quick enough to scan.
