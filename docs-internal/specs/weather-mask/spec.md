# Spec: Weather Mask

Status: done
Status note: 2026-11-23, tickets 01–05 done, last landing 27c4f3943. Review: spec text corrected. Gates green on 2026-11-23 for the repo; lint errors come only from the gitignored worlds-wip folder.
Spec session: weather-mask — spec

## Problem Statement

The Weather Background covers the whole screen or nothing. In a Sheltered location it hides completely, so a room with a big window shows dry glass while the story says a storm rages outside. In an open location it covers everything, so rain falls on the floor under a porch roof or an overhang. The weather an author picked and the picture they drew disagree, and the scene stops looking like one place.

## Solution

An author can give a location image a **Weather Mask**: a grayscale picture that says where the weather shows. White shows weather, black hides it, gray shows it partly. In play, the Weather Background draws only where the mask allows, lined up with the location image on any screen shape.

- A Sheltered location with a mask shows the weather through its window. Without a mask, Sheltered hides the weather as before.
- An open location with a mask keeps the weather off whatever the mask hides, such as the ground under an overhang.

A mask is its own entry in the Media List, of a new kind, **Mask**. Each location image slot links one, so the day and night pictures of one place can share a mask. Authors upload a mask made in any art tool, or paint one in a brush editor in the World Editor that previews live weather over the picture.

## Rulings

Settled in the grill, 2026-11-23. A ruling reopens on new evidence, never on a new opinion.

| Q | Ruling |
|---|---|
| Q1 | A mask is its own Media List entry. Each location image slot links one; slots can share a mask. |
| Q2 | Upload and an in-editor brush both ship in the first version. |
| Q3 | Sheltered plus a mask shows the weather inside the mask only. Sheltered with no mask hides it, as today. |
| Q4 | A mask applies in open locations too: the weather shows only where the mask allows. |
| Q5 | Masks are a new Media List kind, Mask. Mask pickers list only masks; image galleries never offer them. |
| Q6 | White shows, black hides, gray is partial. Transparent pixels count as black. |
| Q7 | A slot holding a Layered Image links one mask, covering the whole composed picture. |
| Q8 | The brush editor ships brush and eraser with size, soft edge, invert and fill, undo and redo, and a live weather preview. |
| Q9 | The Weather Foreground is unchanged by masks. |
| Q10 | The narrator's weather line is unchanged by masks. |
| Q11 | With Location Background off, masks are ignored and the weather behaves as today. |
| Q12 | Editing a shared mask edits it for every slot that links it, and the editor says how many images use it. |
| Q13 | Each location image slot gets a Weather Mask control: paint, upload, pick an existing mask, remove. A mask also opens in the brush editor from the Media tab, over an image that links it. |
| Q14 | Only location images offer a Weather Mask. |
| Q15 | The Test Bench warns when a mask's aspect ratio differs from an image that links it. |
| Q16 | The control is called Weather Mask; the Media List kind shows as Mask. |
| Q17 | The work ships as five tickets: entries and control, play, brush editor, preview and Media tab editing, Test Bench warning. |
| Q18 | The Weather Mask control shows in Advanced mode only. |
| Q19 | Settled by prototype, 2026-11-23. The brush editor is "in the scene": the whole picture sits large in the window on black, fit so every edge is paintable (the prototype's contain fit), with the weather showing through the mask. Tools float over it and rest faded until hovered or focused. Touch has no hover: on mobile the controls stay solid and stack, Cancel and Save above the picture and every tool in one panel below. On every device the controls hide while a stroke is in progress. Prototype: branch `prototype/weather-mask-brush` (commit f9d6ec4e2, variant B), `#dev?modal=weatherMaskPrototype&proto=B`. |

## User Stories

1. As an author, I want rain to show through a window in a Sheltered room, so that the picture matches the storm the story describes.
2. As an author, I want snow to stay off the ground under an overhang in an open location, so that the scene reads as covered there.
3. As an author, I want a location with no mask to behave exactly as it does today, so that adding this feature changes none of my existing worlds.
4. As an author, I want to upload a mask I made in my own art tool, so that I can use the tools I already know.
5. As an author, I want to paint a mask over the location image inside the World Editor, so that I need no other program.
6. As an author, I want white to show weather and black to hide it, so that a mask reads the way masks do in art tools.
7. As an author, I want gray to show the weather partly, so that I can fade the weather at a window's edge.
8. As an author, I want transparent pixels in an uploaded mask to hide the weather, so that a cut-out PNG works as I expect.
9. As an author, I want a brush and an eraser with a size control, so that I can paint large areas and fine edges.
10. As an author, I want a soft edge control, so that the weather fades into the picture instead of cutting off hard.
11. As an author, I want to invert the mask, so that painting the covered area of an overhang is as quick as painting a window.
12. As an author, I want to fill or clear the whole mask in one action, so that I can start from all-weather or no-weather.
13. As an author, I want undo and redo inside the brush editor, so that a bad stroke costs nothing.
14. As an author, I want live weather over the picture while I paint, so that I can judge the result before I save.
15. As an author, I want to pick which weather the preview shows, so that I can check rain, snow, storm and bright sun against the same mask.
16. As an author, I want the day and night images of one place to share one mask, so that I paint it once.
17. As an author, I want to pick an existing mask for a slot, so that a second image of the same view reuses the first one's mask.
18. As an author, I want the editor to tell me how many images use the mask I am editing, so that I know a change reaches all of them.
19. As an author, I want to remove a mask from one slot without deleting it, so that other slots keep using it.
20. As an author, I want masks listed in the Media tab with their size and the locations that keep them, so that I can see what my world holds.
21. As an author, I want to open a mask in the brush editor from the Media tab, so that I can fix it without finding a slot first.
22. As an author, I want Delete From World on a mask to unlink it from every slot, so that no slot points at a missing mask.
23. As an author, I want mask pickers to list only masks, so that I never link a picture as a mask by mistake.
24. As an author, I want image galleries never to offer masks, so that a mask never shows as a location or entity picture.
25. As an author, I want the Weather Mask control only on location images, so that entity and item galleries stay as they are.
26. As an author, I want one mask to cover a whole Layered Image, so that a Layer that changes the picture does not need its own mask.
27. As an author, I want the Test Bench to warn me when a mask's shape differs from a picture that uses it, so that I catch a mask that misses the window.
28. As an author, I want my masks to travel with my world when I export, publish or share it, so that players see what I made.
29. As an author, I want the World Editor's undo and Reveal Origin to cover linking, unlinking and editing a mask, so that mask work is as safe as any other edit.
30. As a player, I want the weather to line up with the window on my screen shape, desktop or mobile, so that the scene looks right wherever I play.
31. As a player, I want the weather behind a window to move with the same motion and reduced-motion rules as the full-screen weather, so that masks change nothing about comfort.
32. As a player, I want the full-screen weather change effect unchanged, so that indoors still feels indoors.
33. As a player with Location Background off, I want the weather to behave as it always has, so that a mask with no picture behind it never shows a stray shape.
34. As a player paging back through the story, I want a past page to show its own location's mask, so that history looks as it did.
35. As a player, I want the Background Fade to dim the masked weather with the picture, so that the fade still reads as one layer.

## Implementation Decisions

**Media List**

- A new Media Entry kind, Mask: id, name, kind, and the image data. It lives in the world's Media List beside image, sound and layered entries, and travels wherever the Media List travels.
- Stored as a PNG data URL. Painted masks save at the linked image's size, capped by the location image cap of the Downscale Presets. Uploads in any image format are re-encoded to PNG and capped the same way.
- Every Media List consumer that switches on entry kind handles Mask: the Media tab, Delete From World, Remove From Slot, the "kept by" index (masks list in their own Masks section, not under each location), stored-size totals, world export, publish and the provenance of linked entries. Image pickers, gallery adds and script media reads never offer a Mask entry.

**Location image slots**

- A location gallery slot gains an optional link to a Mask entry by id. Embedded, linked and Layered slots all carry it. Only location galleries write or read it.
- One link per slot. It covers the slot's whole composed picture, Layered Images included (Q7).
- The link belongs to the slot (Q1): it follows its picture when slots reorder, stays when the slot's picture is replaced, and goes when the slot is removed. A replacement of a different shape gets the Q15 warning.
- Shape change: world export gains the Mask entry kind and the slot field. Additive, with no migration: absent means no mask.

**Play**

- The mask in force is the mask of the location image that shows now: the primary visible image under its Visibility rules, read the way the location art is read. A past page reads its own location and image. When a script overrides the location's picture with a Media entry, the mask is the first gallery slot's that links that same entry, else none. A dangling or non-Mask link reads as no mask.
- Until the shown image has loaded and its size is known, masked weather draws nothing, so a Sheltered room never flashes full-screen rain. Unmasked weather is unchanged.
- The weather view decision gains one input, the mask in force or none. The rules (Q3, Q4, Q11):
  - No mask: unchanged.
  - Mask and an open location: the background shows, limited to the mask.
  - Mask and a Sheltered location: the background shows, limited to the mask, where before it showed nothing.
  - Location Background off, or no location image: the mask is ignored.
  - Clear, Bright Sun after dark, the player's Weather Background switch and reduced motion apply as before.
- The background output carries the mask with its kind and mode. The Weather Foreground decision ignores the mask (Q9). The narrator line ignores it (Q10).
- The Weather Background applies the mask as a luminance CSS mask on its layer, sized and placed to the location image's on-screen crop. The image fills the screen by cover, so the mask's box is computed from the image's natural size and the weather layer's own box, which fills the viewport in play, and the mask is stretched to that box. A mask of the wrong aspect stretches; the Test Bench flags it (Q15).
- The Background Fade dims the masked weather with the location art, as Q29 of the Weather spec rules.
- The dev weather bar's backdrop override draws with no mask.

**World Editor**

- Each location image slot shows a Weather Mask control in Advanced mode (Q13, Q16, Q18). With no mask: Paint, Upload, Choose. With a mask: a thumbnail, Edit, Replace, Remove. Remove unlinks the slot only. Replace overwrites the linked entry's picture, so every slot that shares it changes, as Q12 rules for edits. The control names the shared count only when two or more images link the mask.
- Choose opens a picker of Mask entries only (Q5).
- Upload always makes a new Mask entry from the chosen file and links it, even when the bytes match an existing mask: sharing happens only through Choose. The Media tab's own import never makes a Mask; masks enter only through a slot.
- Paint opens the brush editor over the slot's picture, on a new mask or the linked one.
- The Media tab lists Mask entries with their size and the locations that keep them, and opens one in the brush editor over a picture that links it. With several, the editor can switch which picture shows under the mask. With none, it opens over a plain surface at the mask's size.
- Every mask edit goes through the editor's history, so undo, redo and Reveal Origin cover linking, unlinking and painting.

**Brush editor**

- A full-window editor in the scene (Q19): the whole picture fits the window on black (contain, not play's cover crop), so the edges another screen shape shows stay paintable; the mask shows as a tint that can be hidden, and the weather preview draws through the mask. A floating toolbar holds the tools and the size and softness sliders; a corner card holds the preview kind, Show or Hide Mask, and the switch between pictures that share the mask; Save and Cancel sit top right. On desktop each control group rests faded and returns to full on hover or keyboard focus. On mobile, Cancel and Save sit above the picture and every other control in one solid panel below it. On both, every control hides while a stroke is in progress. Tools: brush and eraser with size, soft edge, invert, fill and clear, undo and redo (Q8). Save writes the mask; Cancel discards.
- Ticket 03 opens over the slot's own picture; its corner card holds Show or Hide Mask and the shared-count note. Ticket 04 adds the preview kind and the picture switch.
- Cancel and Escape discard at once when nothing was painted, and ask before discarding painted changes. Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo.
- A mask of another shape stretches to the picture's box on open and saves at the size of the picture the editor opened over, as play stretches it. Switching picture in the Media tab editor reshapes the box but keeps that size.
- Save is one World Editor history step: painting a new mask links and adds it in one step, as Upload does; editing an existing mask is its own step. Strokes live only in the editor's undo.
- The saved PNG is opaque grayscale, black where nothing is painted (Q6).
- A live weather preview draws the Weather Background through the mask in progress, with a picker for the kind (Q8).
- When the mask is shared, the editor names how many images use it, and Save changes it for all of them (Q12).
- The editing state is a pure mask-document module: an ordered list of operations (stroke with size, softness and mode; fill; clear; invert) with undo and redo, which a canvas renderer replays. The module holds no canvas.

**Test Bench**

- A warning rule: a Mask whose aspect ratio differs from an image that links it, beyond a small tolerance. The finding names the location, the image slot and the mask (Q15). The tolerance is a 2% relative difference between the width/height ratios. A Layered slot compares against its rig's canvas size; an embedded or linked image against its decoded size. Sizes need decoding, so the rule runs out of band, like the Layered Image size finding.
- A slot linking a Mask entry that no longer exists is read as no mask, and the existing missing-media finding covers it.

**Docs, help and dev routes**

- The wiki's location and Media tab pages document Weather Mask. The Weather section of the Overview page points to it.
- The brush editor gets a dev-router route and a surface registry entry, like every modal.

## Testing Decisions

A good test drives the feature from outside and checks what a player or author sees: the weather layer's mask, the slot's control, the Test Bench finding, the Media tab row. It never asserts on internal state or call order. Each guard is proved by reinstating the bug and watching the test fail.

- **Seam 1, play:** the weather view decision, one case per rule above (no mask, open plus mask, Sheltered plus mask, Location Background off, Clear, Bright Sun after dark, reduced motion). Then a GameViewer render test that reads the weather layer's mask from the DOM, including a day/night pair sharing one mask and a past page. Prior art: the weather view tests and the GameViewer weather tests.
- **Seam 2, the mask document:** the pure module, tested directly: strokes in each mode, soft edge, invert, fill and clear, undo and redo across them. The canvas rendering is checked with the verify-ui skill on the dev route; any motion claim uses Playwright per-frame sampling, since jsdom has no canvas.
- **Seam 3, editor wiring:** the World Editor bench for the Weather Mask control: paint, upload, pick, replace, remove, the shared-use count, and undo of each. Prior art: the location panel tests.
- **Seam 4, Test Bench:** the aspect warning through the existing rules runner. Prior art: the weather Test Bench rules.
- **Seam 5, Media List:** the Mask kind in the media list tests: Delete From World unlinks every slot, Remove From Slot unlinks one, pickers and galleries exclude it, export carries it. Prior art: the media list and unlink tests.

## Out of Scope

- Masks on entity, item or any other gallery (Q14).
- A mask per Layer or per Layer Variant (Q7).
- Masking the Weather Foreground (Q9).
- Any change to the narrator's weather line (Q10).
- Masks that change by Visibility rule on their own: a mask follows the image slot that shows.
- Automatic mask generation from the picture.

## Further Notes

- Export shape: world `.json` gains the Mask Media Entry kind and a slot field on location images. Additive; absent means no mask.
- Builds on the Weather spec (`docs-internal/specs/weather/`), rulings Q6, Q9, Q20, Q28, Q29 and Q32.
