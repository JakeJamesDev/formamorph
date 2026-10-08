# 04: Scene Library

Status: ready-for-agent
Blocked by: 01, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: component work against a settled contract and an approved storyboard; motion math is routine.

Parent: [Trailer spec](../spec.md)

## What to build

The scene types the storyboard needs, each with a wide and a tall layout.

- Kinetic text card: a line or two of copy that enters, holds and leaves, in the Design System type roles and colors.
- Frame camera: a captured frame with a pan, zoom or hold path in frames, with an optional callout highlight on a region.
- Typed prompt then narration: a player line types in, then narration text streams in word by word, from the storyboard's copy.
- Shared transitions: cut, fade, and one directional wipe.
- The Remotion studio shows every scene in both layouts for review.

## Acceptance criteria

- [ ] Every scene type the storyboard uses exists with a wide and a tall layout.
- [ ] The studio lists each scene in both layouts.
- [ ] Copy in scenes uses the Design System type roles and Lexend.
- [ ] The proof composition still renders.
