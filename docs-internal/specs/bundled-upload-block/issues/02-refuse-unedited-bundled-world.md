# 02: Refuse an unedited bundled world on publish

Status: ready-for-human
Status note: Built in e0781b43. The review fixes rode into 2489ca31 through the shared index.
Base: a14f26a8
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: a small refusal that copies the existing Avatar publish-attempt pattern.

## What to build

A player selects a bundled world they never edited and presses publish. The publish dialog does not open. A toast says: "This is a bundled world. Edit it to make it your own, then publish." After one edit to that world, publish opens the dialog as today. A world the player wrote is never refused.

## Acceptance criteria

- [ ] A world publish-attempt function mirrors the Avatar one: it returns a refusal, or a ready payload.
- [ ] Refused: a bundled world id with the dirty flag unset.
- [ ] Allowed: the same world with the dirty flag set, and any non-bundled id.
- [ ] The main menu's world publish button uses the attempt and shows the refusal as a toast.
- [ ] Tests drive the attempt with real library records. Each guard is proven by restoring the old behavior and watching the test fail.
- [ ] Verified in the preview: an unedited bundled world shows the toast, and an edited one opens the dialog.
- [ ] Changelog In-Progress entry. Four gates green.
