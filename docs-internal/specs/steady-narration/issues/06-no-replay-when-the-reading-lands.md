# 06: No Replay When the Reading Lands

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Opened at the spec close as a gap against Q3 ("the narration never remounts"). Ticket 04's live probe recorded one remount per turn: after the choices finish, the full-turn mention reading replaces the live reading, the renderer's plugins change (`links` and `speakers`), and the reveal replays.

The spec's Out of Scope leaves the renderer's plugin keying as it is, so this ticket needs triage first: decide how a new reading reaches text already on screen without a remount, or rule the one replay acceptable and amend Q3.

## Acceptance criteria

- [ ] The live probe shows no remount when the full-turn reading lands, and quotes and mention links still take the reading's colors and targets.
- [ ] A test fails if the reading's arrival remounts the narration.

For you:
- Play a turn with dialogue and Character Mentions on: no replay after the choices finish.
