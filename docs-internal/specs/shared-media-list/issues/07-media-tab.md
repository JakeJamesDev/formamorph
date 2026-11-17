# 07: Media Tab

Status: done
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

- [x] Import Media with an image, a sound and a VRM adds two named entries and one Avatar. `MediaListView.test.tsx` "adds an image and a sound as named entries and a VRM as an Avatar".
- [x] With Group by Type on, an image linked by two entities shows once, with both in Used by. `MediaListView.test.tsx` "shows an image two entities link once"; live on Slime Outbreak in the preview.
- [x] With Group by Type off, the view matches today's layout. The existing gallery tests in `useWorldMediaEditor.test.tsx` pass unchanged; `mediaEntries.test.ts` checks the sections equal `mediaSections` plus the Unused section.
- [x] An unlinked entry shows as Unused and the Unused filter finds it. `MediaListView.test.tsx` "Media tab Unused".
- [x] Deleting a used entry from the tab lists its uses first. `MediaListView.test.tsx` "lists every use of a used entry first".
- [ ] Frames of the Media tab with Group by Type on and off, dark theme, 1440 wide: `.scratch/frames/media-type.png`, `.scratch/frames/media-owner.png`. Taken at a 1440×900 viewport, but the Browser pane captures only its 800×600 left part.

## Landed

**Not verified:**
- The two frames are 800×600 crops of the 1440-wide layout: the Browser pane captures no more. The gallery is whole; the panel is cut at its right edge.

**For you:**
- Frames: `.scratch/shared-media-list-07/frames/media-type.png` (Group by Type on, a shared image with two uses, an Unused card) and `.scratch/shared-media-list-07/frames/media-owner.png` (Group by Type off, the Unused section, an entry panel).
- Try Import Media with several files in one of your worlds, then Group by Type: check the names and Used By read right.
- The Media tab's gallery images and sounds no longer have Replace or Remove (Q45). Their slot's Remove From Slot is the gallery's own edit, so its undo step has no label of its own. The cover, Body backdrop, 3D Model and dictionary cover panels keep Replace and Remove.
- Import Media sends a `.glb` to the Avatar store, as Upload Avatar does (Q48). A 3D Model `.glb` goes there too.

**For later tickets:**
- `mediaEntryItems` (`lib/mediaEntries.ts`) is one card per entry with its uses; `MediaUse` now carries a gallery link's `requires`.
- `CONTEXT.md` has no glossary entry for Media List itself; the Media tab entry names it.
