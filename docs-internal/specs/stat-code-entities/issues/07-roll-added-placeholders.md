# 07: Roll added characters' and library dictionaries' placeholders

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Fix a play bug that ticket 04 found. Placeholders owned by library characters added at Enter World, and by library dictionaries picked there, are never rolled. Their chips read empty in narration. Add them to the session's placeholder set and roll them like the library persona's. Then expose them to stat code through `entities` and `dictionaries` (Q14, Q26).

## Acceptance criteria

- [ ] An added character's placeholder chips resolve in narration to a rolled value that stays stable across turns.
- [ ] A library dictionary's placeholder chips resolve the same way.
- [ ] A save keeps those rolls, and a reload reads the same values.
- [ ] `entities['Added'].placeholders` and `dictionaries['Library Book'].placeholders` read and pin those placeholders. A pin changes what narration shows.
- [ ] Tests for the play fix and for the stat code reads, each shown to bite. The changelog line is in In Progress.
