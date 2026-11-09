# 04: Drop the Openings Switch

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a small model change across the draw, migration and a few labels, with clear tests to drive it.

## What to build

A world uses its openings whenever it has any (Q9, Q10).

- The draw ignores the stored `openingsEnabled` flag. A world with authored openings draws one; a world without them starts on the default opening, as today.
- World migration strips the flag on load and stays idempotent, so a saved world no longer carries it.
- The world type loses the field, and every reader of it goes: the editor's history labels, the opening instrument, stored-world additions and the data context.
- The entity and location Openings tabs' hints that talk about turning openings on, or about openings being off, are rewritten per the Writing Guide.
- ⚠️ Export-shape change: the world `.json` loses `openingsEnabled`. Say so in the landing reply.

## Acceptance criteria

- [ ] A world with authored openings and a stored off flag draws an opening (openings unit test, mutation "honor the flag" goes red)
- [ ] Migration strips the flag and a second run changes nothing (migration unit test)
- [ ] No source reads `openingsEnabled` any more
- [ ] No editor hint mentions openings being on or off
- [ ] Docs updated; a changelog fragment is written that tells authors their switched-off openings now draw
