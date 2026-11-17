# 04: Picker Slot

Status: done
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

- [x] Import adds a named entry and links it into the open slot. `MediaPicker.test.tsx` › "imports several files as named entries…" (`lantern`, `tide chart`, filling the open slot and the next).
- [x] Choose links an existing entry; the search filters by name; entries already on this subject are dimmed. "chooses an existing entry…" (no new entry; `harbor` filters to one) and "dims the entries this subject already links…"; mutation to never-dimmed goes red.
- [x] A pasted URL adds a linked entry named after the URL's last segment. "adds a pasted image URL…" (`knight portrait`, extension dropped, Q36); mutation dropping the URL name goes red.
- [x] Renaming to a taken name gives the suffixed name. "renames on blur, suffixing a taken name…" (`bram 1 (2)`); `mediaUnlink.test.ts` › renameMediaEntry.
- [x] Unlink frees the slot and keeps the entry. "unlinks the framed image and keeps its entry". The control is labeled **Remove From Slot** (copy sweep; see Landed).
- [x] Delete from World lists each place using the entry, and after confirming no field links it. "Delete from World lists every use…" (`Odd Wick, Image 1`, `Bram, Image 2`; one undo restores both); `mediaUnlink.test.ts` covers location, item, body, cover, music and map fields.
- [x] Choose is not clipped and takes clicks in the World Editor entity and location panels (inside their scroll areas) and in the Media tab's panels. The library entity editor keeps the plain uploader (Q41). Playwright on Emberwatch at 1440: the grid's first entry wins `elementFromPoint` and a click links it, in the entity panel, the location panel's Media tab and the Media tab's entity panel. The World Editor is itself a dialog.
- [x] Frames of the empty slot, the open Choose grid and a filled slot, both themes, 1440 wide: `.scratch/frames/slot-empty-<theme>.png`, `.scratch/frames/slot-choose-<theme>.png`, `.scratch/frames/slot-filled-<theme>.png`. Mother Hesk on Emberwatch, through Playwright.

For you: try Choose with a world that has many images and judge whether the grid is quick enough to scan.

## Landed

**Not verified:**
- Escape in the **Image Name** field reverts the draft; whether the same key also closes the World Editor dialog was not checked.
- Choose with a world of hundreds of images: thumbnails load lazily, with no virtualization.

**For you:**
- For you: try Choose with a world that has many images and judge whether the grid is quick enough to scan.
- The **Unlink** control is labeled **Remove From Slot**: the Writing Guide already uses Unlink for a linked copy of a library entity, and "linked image" for a URL. Keep it, or pick another word.
- The Media tab's image panel now shows two removes for the framed image: the entry bar's ✖️ **Remove From Slot** and the framed row's **Remove**. Both unlink. Judge whether one should go.
- Frames: `.scratch/shared-media-list-04/frames/slot-empty-dark.png`, `slot-choose-dark.png`, `slot-filled-dark.png`, and the `-light` set.

**For later tickets:**
- `MediaChooseButton`, `MediaEntryBar`, `DeleteMediaConfirm` and `useMediaEntryActions` live in `src/managers/MediaPicker.tsx`. Ticket 07's delete reuses `useMediaEntryActions`.
- `removeMedia` already unlinks item, map, body backdrop, cover, music, sound and ambience links, so tickets 05 and 06 only widen their fields.
- Choose relinks by content through `editGallery`, so it picks the entry holding those bytes. Two entries with identical bytes can't arise through placement or migration.
- `renameMedia({ mediaId, name })` is the hook for ticket 09's script rewrite.
