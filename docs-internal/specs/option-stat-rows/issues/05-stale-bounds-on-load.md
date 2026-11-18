# 05: Stale Bounds On Load

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Spec Q16 says loading a save re-derives bounds and toggles under the world's current rows and Option values. The re-derive skips worlds with no valued Option, and only re-derives the entities a current row names. So a save keeps stale bounds when its world drops every Option, or drops every row naming an entity. Ticket 01 limited the re-derive because an unconditional one also corrects existing fixtures whose bounds disagree with the traits in force; find out what those fixtures are before widening it.

## Acceptance criteria

- [ ] A save made with Easy's "+100 max Gold", loaded after the author deletes the Option, reads the base max.
- [ ] A save whose world drops the last row naming the Dragon reads the Dragon's base bounds.
- [ ] Each guard goes red with its bug reinstated.
