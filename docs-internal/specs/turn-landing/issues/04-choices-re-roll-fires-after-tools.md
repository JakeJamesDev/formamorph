# 04: Choices Re-Roll Fires After Tool Calls

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

When a player re-generates a turn's choices, the turn's After Script World Tool calls fire again, so a Tool's choice edit is on the new list as it was on the old one (Q15).

Read from source, not reproduced: the choices re-roll replays the turn up to After the AI and then reruns the choice scripts without the replay's After triggers.

- Start with a mounted test that reproduces it.
- The choices re-roll passes the replay's After triggers to its script rerun. Nothing else about it changes, and it stays outside the Turn Landing (Q4).

## Acceptance criteria

- [ ] A mounted test re-generates choices on a turn whose After Tool call edits the choices, and the new list carries the edit. It fails on the code before this ticket.
- [ ] A turn with no Tool calls re-generates choices as before.
- [ ] A stopped choices re-roll still puts the turn's own choices back.
- [ ] Changelog fragment written, under Fixed.
- [ ] World and save `.json` shape unchanged.

For you: in a world with a Tool that edits choices After the AI, re-generate choices and check the Tool's edit is on the new list.
