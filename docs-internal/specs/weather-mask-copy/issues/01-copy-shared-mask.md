# 01: Copy a Shared Weather Mask to One Image

Status: ready-for-human
Blocked by: None
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The whole spec in one unit. The Weather Mask menu on a location image frame (`src/managers/WeatherMaskButton.tsx`) gets one action. It copies the shared mask into a new Mask entry and links the copy to this image only (Q26, Q28).

- A pure helper in `src/lib/weatherMask.ts` returns the new Mask entry and the slot's new link. The copy gets a fresh id from `@/lib/uuid` and the original's pixel data unchanged.
- The menu calls the helper inside one undo step, like the other Weather Mask actions (Q29).
- The action shows only while two or more images share the mask, in the same group as Edit and Replace (Q27).
- Draft the action label and the copy's name from `docs/Writing-Guide.md`. The user approves the wording at review.
- Choose whether the brush editor opens on the copy after the split. Record the choice under Landed.
- No new dev hook (Q30). Not an export-shape change.

## Acceptance criteria

- [x] `weatherMask.test.ts` covers the helper: a fresh id, equal data, only this slot relinked. (`copies a shared Mask to one slot…`, plus a unique second-copy name.)
- [x] `WeatherMaskButton.test.tsx`: the action is hidden at a shared count of one. (`names no count for a Mask one image links…` menu list, and the post-split menu in `drops the shared count…`.)
- [x] After the split, this slot links a new Media List Mask entry with the original's data. (`links this slot to a new Mask with the same pixels…`.)
- [x] Every other slot keeps the original. The guard is proved: a helper that relinks every slot turns the test red. (Reinstated: 1 lib test and 3 component tests went red; restored green.)
- [x] One undo restores the shared link and removes the copy. (`undoes in one step…`.)
- [x] The menu's shared count drops after the split. (`drops the shared count…`: 3 → 2 on the original, none on the copy.)
- [x] A changelog fragment in `docs-internal/changelog.d/weather-mask-copy-01.md`.

## Landed

Brush editor choice: it opens on the copy right after the split (user story 8). Cancel with nothing painted closes it at once and keeps the copy. Save changes the copy only (`opens the brush editor on the copy…`).

**Not verified**
- No live-preview check. The jsdom tests drive the real menu, undo history and brush editor; no dev route holds a world with a shared mask.

**For you**
- Wording approved 2026-11-26: the action label **Copy for This Image**, and the copy's name `<name> (Copy)`, then `<name> (Copy) (2)` for a second copy.
- Live check: World Editor → a location with two images that share a mask → the Weather Mask button.
