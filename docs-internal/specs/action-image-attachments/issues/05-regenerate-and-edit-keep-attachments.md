# 05: Regenerate and Edit Keep Attachments

Status: ready-for-human
Base: 84a8d2ed
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Regenerating a turn sends that turn's stored images again, under the same rules as the first send. With Image Attachments off, a regenerate sends none. Editing a past action keeps its attachments. The edit UI shows them as removable thumbnails, and removing one takes it out of the turn-id map.

## Acceptance criteria

- [x] A regenerate of a turn with attachments sends them on the passes that include attachments.
- [x] A regenerate stores the old turn's images again under the new turn id before the history prune runs. The prune from ticket 01 drops entries whose turn id is no longer in history, so a late re-store loses the images.
- [x] Verify on the dev route `#dev?view=gameViewer&fixture=whiteRoom&attach=sample`, which stages two images on the latest turn.
- [x] With the setting off, a regenerate sends no images, and it still stores the old turn's images under the new turn id.
- [x] The Edit dialog shows the thumbnails with remove buttons whether the setting is on or off (Q20).
- [x] Editing an action keeps its attachments, and removing one in the edit UI updates the map and the chat thumbnails.
- [x] Tests cover regenerate with the setting on and off, and removal in edit.
