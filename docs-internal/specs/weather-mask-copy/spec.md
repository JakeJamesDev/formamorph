# Spec: Weather Mask Copy

Status: ready-for-agent

## Problem Statement

The day and night images of one place often share one Weather Mask. Sometimes the night image needs its own mask: a lamp glows where the day image showed open sky, or the night pass moved a window edge. Today the only way to split a shared mask is to remove it from one image and paint a new mask from blank. All the paint that already fits is lost.

## Solution

The Weather Mask menu on a location image gets one new action. It copies the shared mask into a new Mask entry and links the copy to this image only. The other images keep the original. The author then edits the copy, starting from the paint that already fits.

The action shows only when the mask is shared by two or more images.

## Rulings

Settled in the Sunmeadow weather grill, 2026-11-26. Q numbers continue from the Weather Mask spec (last Q25).

| Q | Ruling |
|---|---|
| Q26 | A shared mask splits through a menu action that copies it to this image only. Remove-and-repaint stays possible but is not the split path. |
| Q27 | The action shows only while the mask is shared by two or more images, in the same menu group as Edit and Replace. |
| Q28 | The copy is a new Mask entry in the Media List with the same pixels. The original entry and its other links are unchanged. |
| Q29 | The action is one undo step, like the other Weather Mask actions. |
| Q30 | No new dev hook. The dev router's existing `getWorld` and `putWorld` carry masks out of and into the preview for world builds. |

## User Stories

1. As an author, I want to give one image its own copy of a shared mask, so that I can adjust the night mask without changing the day mask.
2. As an author, I want the copy to start with the paint of the shared mask, so that I only fix the part that differs.
3. As an author, I want the other images to keep the original mask, so that the split changes nothing I did not touch.
4. As an author, I want the action hidden when the mask is not shared, so that the menu offers nothing that does nothing.
5. As an author, I want to undo the split in one step, so that a wrong split costs nothing.
6. As an author, I want the copy listed in the Media tab as its own Mask, so that I can see and rename it like any other mask.
7. As an author, I want the menu's shared count to drop after the split, so that I can see the image no longer shares the mask.
8. As an author, I want to open the brush editor on the copy right after the split, so that I can start fixing it at once.

## Implementation Decisions

- The Weather Mask menu on the location image frame gains the action. Its label and the new entry's name follow the Writing Guide. The wording is the implementer's to draft and the user's to approve.
- The weather mask library module gains a pure helper that returns the new Mask entry and the slot's new link. The menu calls it inside one undo step.
- The copy gets a fresh id from the uuid helper. Its pixel data is the original's data, unchanged.
- After the split, the slot links the copy. Every other slot that linked the original still does.
- Opening the brush editor after the split is the implementer's call: either open it at once or leave the author on the frame. The ticket records which one it chose.

## Testing Decisions

- A good test drives the menu as an author would and reads the result: the images' mask links and the Media List entries. It never inspects component state.
- The existing Weather Mask button component test is the seam. New cases: the action hides at a shared count of one; after the split the slot links a new entry with the original's data; the other slots keep the original; one undo restores the shared link and removes the copy.
- The pure helper gets cases in the existing weather mask library test.
- Prove the "other slots keep the original" guard bites by making the helper relink every slot, and watch the test fail.

## Out of Scope

- Merging two masks back into one shared mask. Choose still links any existing mask.
- Copying a mask between worlds.
- Any change to the brush editor itself.

## Further Notes

- The Sunmeadow weather effort in worlds-wip depends on this action for places whose night image needs its own mask. Painting the shared masks can start before it lands.
- This is not an export-shape change. A copy is an ordinary Mask entry with an ordinary slot link.
