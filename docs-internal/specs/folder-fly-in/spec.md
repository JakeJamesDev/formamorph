# Folder Fly-In — Spec

Status: ready-for-agent
Spec session: Folder Fly-In — Spec

A folder on the main menu tile board opens with a camera zoom into the folder tile, and closes with the
same zoom in reverse. The folder tile shows the top-left corner of its own board at a readable scale, so
the zoom starts and ends on the same picture.

## Problem Statement

A folder opens with an instant swap. The library board disappears and the folder's members appear in the
same paint. Nothing tells the player where the members came from, and the back action gives no sign of
where the folder stands on the board.

The folder tile also shows a fixed 2×2 mosaic of its first four members. The open folder places its
members at their real sizes and cells. The tile and the open folder are two different pictures of one
thing, so no zoom between them can look correct.

## Solution

- In the grid layout, a folder tile shows a **cropped face**: the top-left region of its own board. Each
  member's thumbnail stands at the cell and the size it has in the open folder. The region is as wide as
  the columns the folder uses, up to a cap set by the tile's size, so a thumbnail on the face is about the
  size a mosaic cell was. The face draws whole tiles only. A `+N` badge counts the members it leaves out;
  the name bar and the count stay.
- A click on a folder tile, or **Open Group** in the menu, starts the **fly-in**. The library board zooms
  toward the folder tile and fades out. The folder board starts inside the tile at the face's scale and
  grows to full size. The two layers move as one camera, so the face becomes the board with no jump.
- The members the face leaves out wait until the library board is gone. Then they all fade in together.
  On a fly-out they fade out first, and then the camera zooms out.
- **Library** in the folder header plays the same motion in reverse and puts the library scroll position
  back.
- The folder tile's name bar fades out first on a fly-in and comes back last on a fly-out.
- On a fly-out, the member tiles' title text fades out first. On a fly-in the titles stay readable for the
  whole motion.
- The motion takes 420 ms.
- The detailed layout keeps the mosaic and the instant swap.
- The instant swap is also used while a drag runs and when the player asks for reduced motion.

## User Stories

1. As a player, I want a folder to open with a zoom into its tile, so that I see where the members came from.
2. As a player, I want the back action to zoom out to the folder tile, so that I see where the folder stands on the board.
3. As a player, I want the folder tile to show its first members where they stand in the open folder, so that the tile is a true picture of the folder's top-left corner.
4. As a player, I want the face to show member sizes, so that a large member looks large on the tile.
5. As a player, I want the face to keep the holes I left in the folder board, so that the tile matches my arrangement.
6. As a player, I want the zoom to land exactly on the folder board, so that nothing jumps when the motion ends.
7. As a player with a scrolled library, I want the zoom to land correctly, so that the scroll offset does not pull the two layers apart.
8. As a player, I want my library scroll position back after I leave a folder, so that I do not lose my place.
9. As a player, I want the folder board to open at its top, so that the view matches the miniature.
10. As a player, I want the folder name bar out of the way during the zoom, so that it does not cover the board I fly into.
11. As a player, I want member titles readable while I fly in, so that I can find a world before the motion ends.
12. As a player, I want member titles to fade when I fly out, so that tiny text does not flicker on the shrinking board.
13. As a player, I want the motion to be short, so that opening many folders is not slow.
14. As a player who asks for reduced motion, I want the instant swap, so that the zoom does not disturb me.
15. As a player, I want a drag to behave as it does today, so that the animation never breaks a reorder or a group drop.
16. As a player, I want clicks ignored during the motion, so that I cannot start a drag on a moving board.
17. As a player, I want a second click during the motion to work, so that a fast back-and-forth does not leave the board stuck.
18. As a player, I want the zoom to stay inside the board area, so that the scaled board never covers the toolbar or the tabs.
19. As a player with a small folder tile, I want the fly-in to work the same, so that tile size does not change the behavior.
20. As a player with a large folder tile, I want the fly-in to work the same.
21. As a player with a folder of one or two members, I want them to fill the tile, so that a small folder does not look empty.
22. As a player with a folder of many members, I want the face to show the first few at a readable size and count the rest, so that I can tell what the folder holds.
23. As a player who resizes the window, I want the face to repack with the board, so that the tile stays true at every width.
24. As a player on a phone, I want the same fly-in on the two-column grid.
25. As a player who filters the library, I want the folder tile to show only the members the filter passes, so that the zoom stays exact in a filtered view.
26. As a player who uses **Open Group** from the context menu, I want the same fly-in as a click.
27. As a player in the detailed layout, I want folders to open as they do today, so that a list of cards does not get a zoom that cannot match.
28. As a player on the Entities, Dictionaries, and Models tabs, I want the same folder behavior as on Worlds.
29. As a player whose folder is disbanded while it is open, I want to drop back to the library with no animation, so that no zoom runs toward a tile that does not exist.
30. As a player who adds, removes, resizes, or moves a member, I want the miniature to update, so that the tile never shows an old arrangement.
31. As a developer, I want the camera math in one pure function, so that the lock between the two layers has a unit test.
32. As a developer, I want the face and the open folder to read placements from one source, so that they cannot drift apart.
33. As a player, I want thumbnails on the folder tile large enough to recognize, so that I can find a folder by its art.
34. As a player, I want no member cut in half on the folder tile, so that the face looks deliberate.
35. As a player, I want the rest of the folder to appear only after the library is gone, so that tiles never show up on top of a library that is still on screen.
36. As a player, I want the rest of the folder to fade in together, so that the reveal does not read as a wipe.
37. As a player with a large member in a small folder tile, I want that member shown whole, so that the face is never empty.

## Implementation Decisions

- **The prototype is the primary source.** Branch `prototype/folder-fly-in`, variant **A — Camera**, speed
  1×, face **crop**. Launch: `npx vite --port 5201 --strictPort --force` in the prototype worktree,
  then `/?variant=A&seed=1&face=crop`. The production code is a rewrite, not a copy.
- **Cropped face.** The face component draws the folder's board at its real pixel size and shrinks it with
  one `scale(tileWidth / regionWidth)` transform, origin top-left, aligned to the tile's border box. It reads
  placements from the same placement resolver and the same span rule as the open folder board, at the same
  column count. It draws plain thumbnails, not the card components, because cards register sortables. In a
  filtered view it uses the filtered placements of the members the filter passes.
- **The region** is the part of the board the face stands for. One pure function gives it, and the face
  and the camera both read it. In base-cell columns (from the prototype):

  ```
  used   = max over members of (col + span)
  corner = span of the member at row 0, col 0, else 1
  cols   = min(baseCols, max(min(used, tileSpan * 2), corner))
  regionWidth  = cols * cellWidth + (cols - 1) * gap
  regionHeight = tileHeight * regionWidth / tileWidth
  ```

  The cap `tileSpan * 2` is one, two, or four medium columns for a small, medium, or large folder tile.
  The `corner` term keeps a large member on a small folder tile whole.
- **Whole tiles only.** A member is on the face when it has a placement, `col + span <= cols`, and its
  bottom edge is inside `regionHeight`, with about 6% slack for the few pixels by which a span-4 tile's
  ratio differs from a span-2 tile's. Every other member is a **left-out member**. The `+N` badge shows
  their count.
- **Fly-in module.** A hook owns the transition. The grid hands it the grid element, the tile elements, the
  open folder id, the setter, and a busy flag. The grid's open and back handlers call the hook; the
  disband effect keeps the direct setter.
- **Two layers.** Before the swap the hook clones the grid element. After the swap it puts the clone in a
  fixed overlay that has the scroll viewport's rectangle and clips to it. The real grid is the other
  layer. On a fly-in the clone is the outer (library) layer; on a fly-out the clone is the inner (folder)
  layer.
- **Camera geometry, as a pure function** (from the prototype). With `s = regionWidth / tileWidth`, `o` the
  tile's offset in the outer layer, `i` its offset in the inner layer, and `d` the inner layer's origin
  minus the outer layer's origin:

  ```
  outer: translate(0, 0) scale(1)            ->  translate(d - o*s) scale(s)
  inner: translate(i) scale(1/s)             ->  translate(0, 0) scale(1)
  ```

  Both use `transform-origin: 0 0`, the same duration, and the same easing. Linear interpolation of these
  two pairs keeps the tile's image in the outer layer equal to the region's rectangle in the inner layer at
  every progress value. The `d` term is required: a scrolled library and the folder header both move the inner
  layer's origin away from the outer layer's.
- **Keyframes are written in the fly-in sense.** A fly-out plays the same keyframes with
  `direction: 'reverse'`.
- **Timing.** 420 ms, `cubic-bezier(0.45, 0, 0.15, 1)`, Web Animations API, no new dependency.
- **Opacity, in the fly-in sense.** Outer layer 1 → 0 at 60% progress, the **reveal point**. Folder tile
  inside the outer layer 1 → 0 at 30%. Inner layer 0 → 1 at 35%.
- **Staged reveal.** The inner layer's clip is the region rectangle at the tile's corner radius. It is
  constant in board space, so it stays on the tile's frame while the camera moves. It holds until the
  reveal point and then opens in one step, not as a wipe. Left-out members stay at zero opacity until the
  reveal point and then fade to 1, all at the same value. An earlier clip opening draws the rest of the
  folder over library tiles that are still on screen; a gradual one shows a growing slice. Both were
  built in the prototype and rejected.
- **The folder name bar fades on linear time**, 1 → 0 in the first 12%, because the camera easing would
  hold it near full opacity for a third of the duration. The name bar is not on the board, so the clock
  is the right measure for it.
- **Member title text rides the camera.** Fly-out only, and on the camera's own easing rather than linear
  time, so the fade is read against the board's size instead of the clock: a name is gone once the board
  has receded past a quarter of the camera's range, about 308 ms into the 420 ms trip. This is what makes
  the fade read as distance taking the text, not as a beat that starts the motion.
- **Scroll.** A fly-in saves the library scroll offset and sets the folder board to the top. A fly-out
  restores the saved offset before it measures the tile.
- **Guards.** No animation while a drag is active, under `prefers-reduced-motion: reduce`, in the detailed
  layout, or when the folder tile cannot be measured. The scroll viewport takes no pointer input during
  the motion. A new open or back during the motion finishes the running one first.
- **Cleanup.** When the animations finish or are canceled, the hook cancels them, restores every inline
  style it set, and removes the overlay. Nothing is left on the grid that a dnd-kit measurement can read.
- **No storage change.** The arrangement record, world exports, and saves do not change shape.

## Testing Decisions

A good test here checks what the player can see: rectangles, opacity, and what is left in the DOM. It does
not check keyframe lists or internal refs.

- **Camera geometry (unit).** For sample values of tile, outer, and inner rectangles, including a scrolled
  outer layer and a header offset, the tile's image under the outer transform equals the region's
  rectangle in the inner layer at progress 0, 0.5, and 1, for a region narrower than the board and for a
  full-width one. The test must fail when the `d` term is removed.
- **Region (unit).** The pure region function: fit to the used columns, the cap per tile size, the corner
  term, and which members are left out, including a tile that an edge would cut.
- **Cropped face (jsdom, the existing grid tests).** A folder tile draws each member on the face at the
  cell and span that the open folder gives it and draws no left-out member; the badge shows the left-out
  count; a filtered view draws only passing members; the detailed layout draws the mosaic. Prior art: `LibraryTileGrid.filter.test.tsx`, `LibraryGroupFlow.test.tsx`.
- **Motion (Playwright, per-frame sampling).** One spec records, per animation frame, the folder tile's
  rectangle in the outer layer and the region's rectangle in the inner layer. It asserts that they stay
  equal within a pixel, that the inner layer never shows past the tile's frame while the outer layer has
  any opacity, that all left-out members hold one opacity value on every frame, that sizes pass through intermediate values, that no overlay remains, that the grid has no inline
  transform afterwards, that the library scroll offset returns, and that reduced motion gives the instant
  swap. It runs on a scrolled library. Prior art: `e2e/fullscreen-morph.spec.ts`.
- **Drag regression.** `library-drag-parity.spec.ts` and `library-tiles.spec.ts` stay green with a folder
  opened and closed before the drag.

## Out of Scope

- Variants B (Mosaic) and C (Iris) from the prototype.
- Any animation in the detailed layout.
- The full-width miniature. It was built first and was not legible; the prototype keeps it as `face=mini`.
- A face that scrolls or pages to the left-out members.
- A fade for the folder header.
- The speed control, the variant bar, and the seed data. They stay on the prototype branch.
- A user setting for the animation.

## Further Notes

- The folder is drawn by two layers with separate fades, which shows as a short double fade on the folder
  itself. Paused-frame samples on a fly-out measured combined cover down to 0.90. A change that held the
  inner layer at full opacity and removed the tile's own fade was built and then reverted at the user's
  request (prototype commits `bddbdf46`, `f6fb9fa3`). The spec records the crossfade as it stands.
- The cropped face cuts the zoom factor. A medium folder tile on a wide board zooms about 2× to 3× where
  the full-width miniature zoomed 8× or more, so the outer layer no longer looks soft before it fades.
- A folder whose one member has the folder tile's size has a zoom factor of 1. Its open is the fade and
  the reveal only.
- The prototype's fake thumbnails are gradients with numbers. Real art was not judged on the face.
- Motion must be verified with Playwright sampling, not in the preview pane.
