# 05: Regenerate and Edit Keep Attachments

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Regenerating a turn sends that turn's stored images again, under the same rules as the first send. With Image Attachments off, a regenerate sends none. Editing a past action keeps its attachments. The edit UI shows them as removable thumbnails, and removing one takes it out of the turn-id map.

## Acceptance criteria

- [ ] A regenerate of a turn with attachments sends them on the passes that include attachments.
- [ ] With the setting off, a regenerate sends no images.
- [ ] Editing an action keeps its attachments, and removing one in the edit UI updates the map and the chat thumbnails.
- [ ] Tests cover regenerate with the setting on and off, and removal in edit.
