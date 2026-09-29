# Avatar Thumbnail Source and Details Panel — Spec

Status: ready-for-agent
Spec session: avatar-thumbnail-and-details — spec
Status note: (2026-09-29) Grilled and confirmed, Q1–Q15. Ticketed: 01 thumbnail source, 02 details panel layout.

## Problem Statement

Some Avatar files ship an embedded thumbnail that the artist posed as a tilted or profile shot. The Model Library shows that embedded image on the Avatar's card. The result looks crooked next to other cards, and the player has no way to change it. Formamorph can already render a straight head-and-shoulders portrait, but it only does so when a file has no embedded image.

The Avatar details view also crowds its 3D preview. The license and file table is always open. **Export Avatar** and **Publish Avatar** stack vertically as two full-width buttons.

## Solution

Each Avatar in the Model Library gets a **Thumbnail** submenu in its card's context menu, with two radio items: **From File** and **Generated**. **From File** shows the file's embedded image and is the default. **Generated** shows Formamorph's rendered portrait. The file is never changed, so the embedded image is always available again. Publishing sends whichever image the player chose.

The Avatar details panel collapses its details table by default and remembers the player's choice. **Export** and **Publish** sit side by side.

## Decisions (grilled and confirmed)

| # | Decision |
|---|---|
| Q1 | The embedded image shows by default. The generated image is the fallback and the opt-in. |
| Q2 | The generated image renders on the first switch to **Generated**, then it is cached. Import does not render it. |
| Q3 | The choice is per Avatar. There is no global setting. |
| Q4 | The control lives in the Model Library card's context menu. |
| Q5 | Publish sends the chosen image to the listing. |
| Q6 | The control is a **Thumbnail** submenu with radio items, like the existing **Size** submenu. |
| Q7 | The submenu is hidden when the file has no embedded image. |
| Q8 | During the first render, the card keeps the current image. If the render fails, an error toast shows and the choice stays **From File**. |
| Q9 | Changing the choice does not touch an existing listing. The next publish sends the new image. |
| Q10 | The radio items read **From File** and **Generated**. |
| Q11 | The details table starts collapsed. |
| Q12 | The open or collapsed state is remembered per device. |
| Q13 | The shared details panel owns the collapse. The Model Library modal and World Overview's custom player Avatar behave the same and share one remembered state. |
| Q14 | **Export** and **Publish** sit side by side at equal width, without "Avatar" in their labels. **Export** fills the row when **Publish** is absent. |
| Q15 | One spec, two tickets: thumbnail source, and details panel layout. They touch different files. |
| Q16 | (Ticket 01 intent question) A legacy record whose file has an embedded image rebuilds its file variant from the blob and drops the stored thumbnail. Legacy downloads stored a render even when the file had an embedded image, so the stored image can't be trusted as the file variant. Q1 wins over story 3 for those records. |

## User Stories

1. As a player, I want to switch an Avatar's card image to a generated portrait, so that a tilted artist shot doesn't look crooked in my library.
2. As a player, I want to switch back to the file's own image at any time, so that trying **Generated** costs me nothing.
3. As a player, I want the file's image to stay the default, so that my existing library looks the same after the update. Exception (Q16): a legacy download that showed a render switches to its embedded image.
4. As a player, I want the context menu to show which image is active, so that I don't have to guess the current state.
5. As a player, I want the **Thumbnail** submenu to appear only when there is a choice, so that the menu stays short for files without an embedded image.
6. As a player, I want the card to keep its current image while the portrait renders, so that the card never goes blank.
7. As a player, I want an error message when the portrait can't render, so that I know why the image didn't change.
8. As a player, I want the second switch to be instant, so that comparing the two images is quick.
9. As a player, I want my choice to survive a restart, so that I set it once per Avatar.
10. As a player, I want the plain labels **From File** and **Generated**, so that I don't need to know what "embedded" means.
11. As a creator publishing an Avatar, I want the listing to use the image I chose, so that the community sees the same card I see.
12. As a creator with a published Avatar, I want a local switch to stay local until I publish again, so that a menu click never changes my listing by surprise.
13. As a player, I want the file itself to stay unchanged, so that **Export** still gives me the exact file I imported.
14. As a player downloading a community Avatar, I want the same choice on that Avatar, so that downloaded and imported Avatars behave the same.
15. As a player opening an Avatar's details, I want the details table collapsed, so that the 3D preview has the room.
16. As a player who reads license details often, I want the table to stay open after I open it, so that I don't expand it every time.
17. As a player, I want the World Overview's custom player Avatar panel to behave the same as the library one, so that the two views don't drift apart.
18. As a player, I want **Export** and **Publish** side by side, so that the footer takes one row.
19. As a player who can't publish, I want **Export** to fill the row, so that the footer doesn't look half empty.
20. As a player, I want **Publish** to still tell me which license requirement fails when I press it, so that a collapsed table doesn't hide why I can't share.

## Implementation Decisions

### Thumbnail source (ticket 1)

- The stored Avatar record gains a thumbnail source field with values `file` and `generated`. An absent field means `file`.
- The record keeps `thumbnail` as the image that is shown. The grid, the metadata listing, and the publish payload keep reading `thumbnail`, so they need no change.
- The record caches each variant separately, so a switch in either direction is instant after the first render. The file variant can always be rebuilt from the blob through the VRM meta reader.
- The metadata listing exposes whether the file has an embedded image, so the context menu can hide the submenu (Q7) without loading the blob.
- `ModelStorageService` gains a method that sets the source for one Avatar. On a switch to `generated` with no cached render, it renders first. On a failed render it leaves the source as `file` and reports the failure to the caller. It persists only if the record still exists, like the existing thumbnail backfill.
- `ensureThumbnail` honors the source. Today it returns early once any thumbnail exists; that early return has to respect the chosen source and the cached variants.
- Existing records store one `thumbnail` with no source, and its origin is unknown: legacy downloads stored a render even when the file had an embedded image. When the file has an embedded image, the file variant is rebuilt from the blob and the stored thumbnail is dropped (Q16). When it has none, the stored thumbnail is the generated variant.
- The Model Library's thumbnail backfill effect only runs when the list of ids changes. A switch updates the Avatar's entry in the grid state directly.
- The Model Library grid passes a **Thumbnail** submenu through the context menu's `itemActions` slot. It follows the **Size** submenu's radio pattern.
- A failed render shows an error toast. The copy follows the project's error-toast pattern.

### Details panel layout (ticket 2)

- The shared Avatar details panel wraps its details table in the existing collapsible section component. It starts collapsed.
- The open state persists in `localStorage` under one key shared by every surface that uses the panel. Reads and writes are wrapped in try/catch, and the panel falls back to collapsed.
- The Model Library modal's footer lays **Export** and **Publish** out in one row at equal width. When **Publish** is absent, **Export** takes the full row.
- The button labels become **Export** and **Publish**.

### Export shape

- None. Avatars and their thumbnails do not travel in world exports, saves, backups, or character cards. World Overview's custom player Avatar is stored as file data only. The change touches the IndexedDB Avatar record only.

## Testing Decisions

- Tests check behavior a player or caller can observe: which image the record shows, what the menu offers, what the panel renders. They do not assert on internal field layout.
- **`ModelStorageService`**, in its existing test file, with the VRM meta reader and the thumbnail renderer mocked (jsdom has no WebGL):
  - The default source shows the embedded image.
  - The first switch to `generated` renders once. The second switch back and forth does not render again.
  - A failed render leaves the source on `file` and the shown image unchanged.
  - A legacy record whose file has an embedded image shows that image, not its stored thumbnail.
  - A delete during the render is not undone by the write.
  - The published payload carries the chosen image.
- **The tile context menu**, in its existing test file: the **Thumbnail** submenu shows the active radio item, calls back with the new source, and is absent when the Avatar has no embedded image.
- **The grid refresh**: a small test on the switch handler shows the grid state gets the new image without an id change.
- **The details panel and modal**, in their existing test files: the table starts collapsed, opening it persists, a remount reads the stored state, a storage failure falls back to collapsed, and the footer shows one or two buttons in a row with the new labels.
- Every guard proves it bites: reinstate the old early return or the old label and watch the test fail.

## Out of Scope

- A global "prefer generated thumbnails" setting.
- Custom user-uploaded thumbnails.
- Changing the generated portrait's framing.
- Auto-updating an existing community listing when the choice changes.
- Using a listing's cover image for a downloaded Avatar.
- A thumbnail choice for World Overview's custom player Avatar, which has no card.

## Further Notes

- The tilted case that started this is the alternate Avatar used in release builds. Its embedded image is a three-quarter profile. The renderer draws it straight.
- `CONTEXT.md` defines **Avatar** as the copy term and `model` as the code kind id. Copy never says "model" or "VRM".
- Every new menu item and control needs a dev-route check through `verify-ui`, in both themes.
