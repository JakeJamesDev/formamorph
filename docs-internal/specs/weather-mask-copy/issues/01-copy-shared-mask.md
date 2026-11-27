# 01: Copy a Shared Weather Mask to One Image

Status: ready-for-agent
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

- [ ] `weatherMask.test.ts` covers the helper: a fresh id, equal data, only this slot relinked.
- [ ] `WeatherMaskButton.test.tsx`: the action is hidden at a shared count of one.
- [ ] After the split, this slot links a new Media List Mask entry with the original's data.
- [ ] Every other slot keeps the original. The guard is proved: a helper that relinks every slot turns the test red.
- [ ] One undo restores the shared link and removes the copy.
- [ ] The menu's shared count drops after the split.
- [ ] A changelog fragment in `docs-internal/changelog.d/weather-mask-copy-01.md`.
