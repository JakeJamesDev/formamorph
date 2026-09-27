# 07: Community Cards reference shows a flagged stand-in listing

Status: in-progress
Base: 66d76f24
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

## What to build

The Community Cards reference adds an entity fixture the server flags as a stand-in, with a stored thumbnail value. The card draws Morph art for it and never shows the stored file. The no-image entity fixture stays, so both routes to Morph art are visible.

The guide adds one line: a flagged stand-in listing draws Morph art and never fetches its stored file.

Recommended model rationale: one fixture, one test, one guide line against a shipped card component.

## Acceptance criteria

- [ ] The flagged fixture renders Morph art and no image with the stored thumbnail, asserted by test
- [ ] The no-image fixture still renders Morph art
- [ ] The guide states the flagged-path rule; new copy has a Writing review entry
- [ ] The showcase registry test passes
- [ ] Four gates green; verified in the showcase at desktop and 375px, both themes
