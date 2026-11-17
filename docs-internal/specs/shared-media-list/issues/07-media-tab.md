# 07: Media Tab

Status: ready-for-agent
Blocked by: 05, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The Media tab manages the Media List.

- **Import Media** takes images, sounds and VRM files. Images and sounds join the list under their names. VRMs go into the world's Avatar store (Q8).
- **Group by Type** stays a toggle (Q15). Off, the default, keeps one row per use, grouped by what holds it. On lists each entry once, sectioned by kind, with a Used by list from ticket 01's usage index.
- Entries nothing links are marked Unused and stay in the world (Q7). The filter menu gains an Unused filter.
- Deleting from the tab uses ticket 04's usage confirm.
- Q45: the Media tab's image and sound panels drop their own Replace and Remove; the slot's Import, Choose, Remove From Slot and Delete From World cover them.
- From ticket 06's landing: the editor's Advanced-data count treats an ambience link to a deleted entry as Advanced data; a link with no entry counts as empty.
- From ticket 05's landing: item pictures have no card in the Media tab's per-parent view, so Group by Type is where they show; their Used by names the item. Also fold in two small fixes: the Authoring Tour's cover example still writes embedded data (route it through import), and an unnamed Body's entry is named `Body 1` by migration but `Unnamed Body 1` by a slot write (use `Body`, matching migration).
- From ticket 03's landing: Optimize Images re-encodes only linked entries, so an Unused entry keeps its full bytes. Decide with the spec session whether Optimize should include Unused entries.
- The Media tab's glossary entry changes to say it shows a store, the Media List.
- Labels are working names: run the copy sweep on the new copy.
- Ships its docs: the wiki's Media tab page.

## Acceptance criteria

- [ ] Import Media with an image, a sound and a VRM adds two named entries and one Avatar.
- [ ] With Group by Type on, an image linked by two entities shows once, with both in Used by.
- [ ] With Group by Type off, the view matches today's layout.
- [ ] An unlinked entry shows as Unused and the Unused filter finds it.
- [ ] Deleting a used entry from the tab lists its uses first.
- [ ] Frames of the Media tab with Group by Type on and off, dark theme, 1440 wide: `.scratch/frames/media-type.png`, `.scratch/frames/media-owner.png`.
