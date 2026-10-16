# 06: One Turn Parse

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a small helper and caller swaps, one in GameViewer.

## What to build

One turn parser. A narration helper built on it keeps the fallback for truncated content and returns nothing when no narration parses. Story export leaves out broken turns. The history estimate, Turn Card, saved reasoning and prior-narration corpus read json5-only turns. The old narration parser and its two failure strings are removed.

Spec: Implementation Decisions: Turn parse. Stories 12, 13, 32.

## Acceptance criteria

- [ ] The narration helper has behavior tests: strict JSON, json5-only, `game_text`, truncated, garbage
- [ ] A regression test exports a story with a broken turn and the export has no error text, and it fails with the old code put back
- [ ] Every caller named in the spec reads through the shared parser
- [ ] Four gates green

## Blocked by

- None (can start immediately)
