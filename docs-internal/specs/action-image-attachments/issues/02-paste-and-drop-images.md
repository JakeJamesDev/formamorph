# 02: Paste and Drop Images

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

With Image Attachments on, a player can paste an image into the action box (Ctrl+V) or drop image files onto it. Both feed the same pending set as the attach button, with the same cap, type check, and downscale. With the setting off, paste inserts text as it does today and drop does nothing new.

## Acceptance criteria

- [ ] Pasting clipboard image data adds a pending attachment. Pasting text still inserts text.
- [ ] Dropping one or more image files adds them, and the four-image cap and the non-image refusal apply.
- [ ] The drop target reuses the existing image drop helpers.
- [ ] With the setting off, neither handler adds attachments.
- [ ] Verify on the dev route `#dev?view=gameViewer&fixture=whiteRoom&attach=sample`, which turns the setting on without saving it.
- [ ] Tests in the GamePanels harness cover paste, drop, the cap across mixed input, and the setting-off case.
