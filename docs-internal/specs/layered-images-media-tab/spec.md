# Spec: Layered Images in the Media Tab

Status: done
Status note: Closed on 2026-11-22. Tickets 01–04 landed; the last landing is 1daf8adb0. Review: spec text corrected. Gates on 2026-11-22: tests pass, and lint errors are only in the gitignored worlds-wip folder.
Spec session: layered-images-media-tab — spec

## Problem Statement

The first world to use Layered Images at scale (Sunmeadow Town, starting with Roxanne) showed that the Media tab treats a Layered Image as a second-class picture.

- In Group by Entity, a gallery slot that links a Layered Image shows only its kind and **Go to <entity>**. A flat image in the same place gets its name field, size line, **Download**, **Remove From Slot** and Visibility Rule. An author cannot reach the Layered Image's editor from the entity's gallery at all. **Edit Layers** exists only on the Layered Image's own card under Group by Type.
- A layered slot is titled by its slot ("Roxanne › Image 2"), not by the picture it shows.
- Every part image a Layer uses is listed as a full Media card: under its own **Layered Image Variants** section in Group by Entity, and inside the Images section in Group by Type. A part is not a whole picture and is pointless to view on its own. A large cast with 8 to 10 parts per character floods the tab.
- Deleting a Layered Image leaves its parts behind. Once parts are hidden, nothing would show them.

## Solution

A layered gallery slot behaves like a flat one everywhere the image gallery field shows it, plus an **Edit Layers** button. Part images leave both groupings: they live inside their Layered Image's editor, search still finds them, and deleting their Layered Image removes the ones nothing else uses.

## Rulings

Settled in the grill, 2026-11-21. A ruling reopens on new evidence, never on a new opinion.

| Q | Ruling |
|---|---|
| Q1 | In Group by Entity, a gallery slot that links a Layered Image shows the same panel as a flat image's slot, with **Edit Layers** beside **Download**. |
| Q2 | A layered slot has the same slot actions as a flat image. Refined by Q10: a flat slot has no Replace, so a layered slot has none either. **Remove From Slot** unlinks it and leaves the Layered Image in the Media List; **Choose** on the emptied slot lists images and Layered Images. |
| Q3 | The **Layered Image Variants** section is dropped. |
| Q4 | A layered slot's card and panel are titled with the Layered Image's name ("Roxanne › Roxanne Bare"), not the slot's ("Image 2"). |
| Q5 | An image that only Layers use is hidden in both groupings. It shows inside its Layered Image's editor. Once any field links it directly, it shows again. |
| Q6 | **Edit Layers** appears wherever the image gallery field shows a layered slot: the Media tab, the entity editor's gallery, and location and item image fields. On desktop it opens the full-screen Layered Image editor; on mobile, the Layer panel. |
| Q7 | A layered slot's size line reads "Layered Image · N Layers · total size", counting each part image once. |
| Q8 | **Delete From World** on a Layered Image also removes each part image that nothing else uses. The confirm names those parts. The delete is one undo step. Parts used elsewhere stay. |
| Q9 | Media search matches a hidden part image by name and shows the Layered Image that holds it. |
| Q10 | New evidence on Q2 (ticket 01): a flat framed slot has no Replace button, and a test guards that. Parity wins: no Replace button on any slot. (Ticket 01) |
| Q11 | Parity is per host. In the entity editor a flat slot shows only its name bar, so a layered slot shows the name bar plus an outline **Edit Layers** button on its own line under it, with no size line, Download or Rule editor. In the Media tab, Edit Layers sits beside Download. (Ticket 01) |
| Q12 | A layered gallery slot stacks with its entity's other slots in Group by Entity, and counts in the stack's count and total. (Ticket 01) |
| Q13 | On mobile, Edit Layers opens the Layer panel in a full-height dialog titled with the Layered Image's name. A layered slot's size line has no budget text or Over Budget badge. Download saves the flattened outside-play picture losslessly, named from the Layered Image. (Ticket 01) |
| Q14 | A search hit on a part shows its holder as that grouping shows it: the holder's slot cards in Group by Entity, its one entry card in Group by Type. Filters apply before search, so a hit never shows against the active filter. (Ticket 03) |
| Q15 | The delete confirm adds a second list under the use list, "It also deletes these images, which only it uses:", naming each part. A part used by two Layers of this same Layered Image counts as unshared and goes. The undo label stays "Delete Layered Image: <name>". (Ticket 04) |
| Q16 | New evidence on Q11 (2026-11-22, after the close): **Edit Layers** on its own line came and went as the author stepped through the strip, and moved the tiles. In the shared gallery field it is now an icon button on the frame's top-left corner, and the Visibility Rule is an icon button on the top-right (the tile cog and the summary line are gone). Neither shows on the empty slot. The name row shows on every slot, disabled on the empty one. Settled in a prototype on `prototype/portrait-gallery` (variant D). |

## User Stories

1. As a world author, I want a layered gallery slot to look like a flat one in Group by Entity, so that I don't have to learn a second panel.
2. As a world author, I want an **Edit Layers** button beside **Download** on a layered slot, so that I can edit a character's Layered Image from that character's gallery.
3. As a world author, I want **Edit Layers** in the entity editor's own gallery, so that I don't have to switch to the Media tab to change a Layer.
4. As a world author, I want **Edit Layers** in a location's and an item's image field, so that every slot that can hold a Layered Image can open it.
5. As a world author on desktop, I want **Edit Layers** to open the full-screen Layered Image editor, so that I get the same editor the Media List card opens.
6. As a world author on mobile, I want **Edit Layers** to open the Layer panel, so that the mobile form matches the rest of the Media tab.
7. As a world author, I want to swap a layered slot for another image or Layered Image the way I swap a flat one (Remove From Slot, then Choose), so that one picker serves both.
8. As a world author, I want to **Remove** a Layered Image from one slot without deleting it, so that other slots that link it keep it.
9. As a world author, I want a layered slot titled with its Layered Image's name, so that "Roxanne" and "Roxanne Bare" read apart at a glance.
10. As a world author, I want a layered slot's size line to give its Layer count and total size, so that I can see what the picture costs against the publish budget.
11. As a world author, I want the total size to count a part shared between two Layers once, so that the number matches what the world stores.
12. As a world author with a large cast, I want part images out of Group by Entity, so that each character shows only whole pictures.
13. As a world author with a large cast, I want part images out of Group by Type's Images section, so that the section lists whole pictures only.
14. As a world author, I want a part image to show again once a field links it directly, so that an image I use on its own is never hidden.
15. As a world author, I want to find a part image by searching its name, so that a hidden part is never unreachable.
16. As a world author, I want a search hit on a part to show the Layered Image that holds it, so that I land where I can edit that part.
17. As a world author, I want deleting a Layered Image to remove the parts nothing else uses, so that hidden parts don't pile up in the world.
18. As a world author, I want the delete confirm to name every part it removes, so that I know what goes before I agree.
19. As a world author, I want parts that another Layered Image or field uses to stay, so that a delete never breaks another picture.
20. As a world author, I want one Undo to bring back the Layered Image and its parts, so that a mistaken delete is a single step to reverse.
21. As a world author, I want the Visibility Rule on a layered slot to work as it does on a flat one, so that gallery order and rules keep their meaning above a Layered Image.
22. As a world author, I want an image's **Used By** list to keep naming each Layer that uses it, so that I can still trace a part back to its Layered Image.

## Implementation Decisions

- **A layered slot takes its host's flat-slot panel (Q11).** In the Media tab, a layered gallery slot stacks with its parent and opens the image panel: name field (renames the Layered Image), title, size line, action row and Visibility Rule, with **Edit Layers** beside **Download**. In the shared gallery field (entity editor, location and item image fields), it shows the name bar with **Edit Layers** on its own line under it.
- **One Edit Layers button opens the existing editor.** Every host uses one shared button. On desktop it opens the full-screen editor the Media List card opens. On mobile it opens the same Layer panel, in a full-height dialog titled with the Layered Image's name (Q13). It does not build a second editor.
- **Download on a layered slot** downloads the outside-play flattened picture, as the export path already produces it (lossless, per the landed card-flatten work).
- **Title and size line come from the Media index.** A layered slot item carries the Layered Image's name as its title, and a size equal to the sum of its distinct part images' stored bytes, with its Layer count.
- **Hiding parts is a Media index rule, not a view rule.** The index marks an entry "part only" when its only uses are Variant uses. Both groupings leave part-only entries out. The **Layered Image Variants** section and its id are removed. The Unused section keeps its own rule: an entry with no uses at all.
- **Search reaches parts through their Layered Image.** A search term that matches a part-only entry's name adds the Layered Image (or each one) that holds it to the results, never the part's own card.
- **Delete From World cascades through the usage index.** A usage helper finds each part whose only uses are this Layered Image's Variants. The delete action removes the Layered Image and those parts in one history step, so one undo restores everything. The confirm lists those parts by name. A part used by another Layered Image or linked by any field is kept.
- **No export-shape change.** Worlds, saves, library entities and cards keep their current shape. Hiding, titles, sizes and the cascade are all editor behavior.

## Testing Decisions

- Good tests drive the public seam and assert what the author sees or what the world holds afterwards: which cards a grouping lists, which entries a delete removes, which buttons a slot panel offers. They do not assert markup structure or call order.
- **Media index (unit), existing seam.** Grouping by type and by parent leaves part-only entries out. An entry that is also linked by a field stays. Search on a part's name returns its Layered Image. A layered slot item carries the rig's name, Layer count, and de-duplicated total size. Prior art: the existing Media index tests.
- **Image gallery field and Media panel (component), existing seams.** A layered slot shows its host's flat-slot panel with **Edit Layers**, and **Edit Layers** opens the editor. **Remove From Slot** unlinks only this slot, and **Choose** on the emptied slot offers Layered Images. Prior art: the existing gallery field and Media panel component tests.
- **Delete From World (unit and component), existing seams.** The usage helper finds unshared parts and keeps shared ones (unit). The confirm lists the removed parts, and one undo restores everything (component). Prior art: the existing media usage and delete-media tests.
- Each new guard is proven by reinstating its bug and watching its test fail (`test-bar`).
- No new e2e. The layout fit of Layered Images is already guarded by the landed Playwright spec for picture fit.

## Out of Scope

- Roxanne's Layer art redo (garment masks, lossy overlays) and the Sunmeadow verify failures. That is world work, not app work.
- Character state that would pick clothed or nude automatically. Both pictures keep showing, and the player flips between them.
- Futanari while carrying, for Roxanne.
- Changes to the Layered Image editor itself, to play, or to the export shape.

## Further Notes

- Two Layered Image fit bugs found in the same trial already landed: `7dd2647ff` (an unbounded picture stretched in the zoom viewer, the entity panel and the Body Doll) and `3de2abfae` (the gallery frame cropped the picture, and the stack painted stretched before the canvas loaded).
- The parent spec is `docs-internal/specs/layered-images/spec.md` (closed). Its Q28 (deleting an image removes its Variants) and Q30 (Used By names each Layer) stay in force.
