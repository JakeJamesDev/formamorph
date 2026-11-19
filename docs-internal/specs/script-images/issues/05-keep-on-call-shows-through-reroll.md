# 05: Keep On Call Shows Through Re-roll Stats

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

After Re-roll Stats, a turn keeps the images and tells that its world Tool On Call scripts made. Today they disappear. The spec covers this in Q7 and Q30.

- **The bug.** An On Call run, and an item script that a Tool call fires during the turn, record their entries with the `before` timing. Re-roll Stats drops every Start, Before and After entry and expects the replay to add them again. But the replay applies On Call writes as saved, with no script run, so nothing adds those entries back.
- **Scope.** The fix covers text tells and images alike. Text tells had the bug before this effort.
- **Save shape.** The fix must not lose entries in saves that already exist. If the fix tells On Call entries apart through a new field, that is an export-shape change and needs the reminder.
- **Docs.** If the re-roll rule changes, correct it in [Scripts-Reference.md](docs/Scripts-Reference.md). Write a changelog fragment.

## Acceptance criteria

- [ ] A turn whose On Call script called `player.show` and `player.tell` still shows both after Re-roll Stats. A GameViewer test covers it, and it fails when the fix is reverted.
- [ ] An item script that a Tool call fires during the turn keeps its image and tell through Re-roll Stats.
- [ ] Before the AI script entries still drop and replay as Q7 says, and an abandoned re-roll still restores them.
