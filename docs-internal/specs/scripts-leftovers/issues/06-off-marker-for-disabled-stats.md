# 06: Off Marker For Disabled Stats

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a small UI change on an existing meta-text pattern.

## What to build

A disabled stat reads "Off" (Q1, Q2). Its script rows on the Scripts tab keep the 50% dim and add "Off" as meta text. Its row on the Stats tab gets the same dim and meta text, in the world stat tree and the entity stat tree. The marker uses the editor row's existing meta text.

## Acceptance criteria

- [ ] A disabled stat's script rows on the Scripts tab show "Off" meta text and stay dimmed.
- [ ] A disabled stat's Stats tab row is dimmed and shows "Off" meta text, in both stat trees.
- [ ] An enabled stat shows neither.
- [ ] Both themes are checked in the preview.
- [ ] Guards fail when either marker goes away.
