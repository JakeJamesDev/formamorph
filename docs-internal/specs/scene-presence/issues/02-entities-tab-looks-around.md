# 02: Entities Tab Looks Around

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Entities tab lists **Look Around**: everyone here the player would see if they looked around. People in scene come first and quiet ones after. Strangers show by their label. Clicking a met person opens the full popup as today. Clicking a stranger opens a reduced popup with the label, the image and the Stranger Description only.

## Acceptance criteria

- [x] Through the GamePanels harness, the tab lists In Scene entities first, then the quiet Look Around entities. (`lists the In Scene entities first, then the quiet ones`)
- [x] A stranger row shows its label, never the true name. A stranger with no label is not listed. (`shows by its label and never by its true name`, `is not listed with no label at all`)
- [x] A stranger's popup shows the label, image and Stranger Description, and no name, description or stats. (`StrangerModal.test.tsx`; DOM read in the dev preview)
- [x] A met person's popup is unchanged. (`opens the full popup once the story has named it`; `EntityModal` untouched)
- [x] The Entities tab no longer reads the live scene list directly. (rows come from `usePresence`; `visibleEntities` remains only in the Entity View fallback)
- [ ] Frames `.scratch/frames/entities-look-around-light.png` and `.scratch/frames/entities-look-around-dark.png` at 1400 px wide show a quiet group and a stranger row.

For you: play a few turns in Emberwatch and check that the quiet group in the Entities tab feels right.

## Landed

**Not verified**
- Frame width: the Browser pane captured at 800 px (the page emulated 1400 px), JPEG data under a `.png` name. The frames show a quiet group (Lantern Moths, Sentry) and a stranger row (a stooped scholar). Frames come from the `entityPresence` dev fixture with its extra places added for the capture only.

**For you**
- Play a few turns in Emberwatch and check that the quiet group in the Entities tab feels right.
- Page back in a long save and check that the Entities tab shows who stood there then (per-page presence, Q50).
- The Entity View still falls back to the first scene entity's true art for a stranger. Ticket 03 or a follow-up should decide that.

**Built**
- `usePresence(viewedPage?)` in `src/lib/usePresence.ts` is the shared panel hook (Q54). `useResolvedWorld` gains `authoredCast`, the cast before play positions.
- `StrangerModal` is the reduced popup. `LeftPanel` takes an optional `onStrangerClick(entityId, label)`.
- The `entityPresence` dev fixture's Archivist gains a Stranger Name and Description.
