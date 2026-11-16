# 20: Late Quote Colors

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Spec Q74 (2): a quote that is already on screen when its streamed color arrives takes that color at once, with the 300 ms fade.

- **When it happens:** the player skips the reveal, or a hold reaches `QUOTE_HOLD_MAX_MS` and the quote shows uncolored. Today the visible block doesn't redraw for the color, so it waits for the next remount or for narration to end (ticket 18's Landed notes).
- **The change:** the live narration block picks up each color as its run finishes, with no remount. The full-turn reading at narration end still wins, as Q72 says.
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [ ] After a skip, each quote takes its color when its run finishes, before narration ends. The test is proved by reinstating the wait.
- [ ] After a hold cap, the uncolored quote takes its color when the late run finishes.
- [ ] A color change plays the 300 ms fade, never a jump. The full-turn recolor at narration end still works.
- [ ] Frames of one quote before and after its late color, in light and dark, for the user.
