# 07: Roll added characters' and library dictionaries' placeholders

Status: done
Base: 051fd08f
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Fix a play bug that ticket 04 found. Placeholders owned by library characters added at Enter World, and by library dictionaries picked there, are never rolled. Their chips read empty in narration. Add them to the session's placeholder set and roll them like the library persona's. Then expose them to stat code through `entities` and `dictionaries` (Q14, Q26).

## Notes from ticket 04

- `runStatCodeTurn` joins the played library persona's pool through `withLibraryPersonaPlaceholders`. Its rows are marked `unlisted`, so the old `placeholders` route never reaches them. Once play rolls added characters' pools, joining them there is a one-line change.
- A test pins that an added character's `placeholders` holds no names. Update it when this ticket exposes them.
- A miss under `dictionaries.X.placeholders` is an editor error today, because the editor knows every authored book. When library dictionaries join, make it a warning, as a miss under an entity is (`checkOwnedPlaceholderPath` in the stat code analysis module).

## Acceptance criteria

- [x] An added character's placeholder chips resolve in narration to a rolled value that stays stable across turns.
- [x] A library dictionary's placeholder chips resolve the same way.
- [x] A save keeps those rolls, and a reload reads the same values.
- [x] `entities['Added'].placeholders` and `dictionaries['Library Book'].placeholders` read and pin those placeholders. A pin changes what narration shows.
- [x] Tests for the play fix and for the stat code reads, each shown to bite. The changelog line is in In Progress.

## Notes for review

- Bite run: thirteen mutations, each failing its tests. Only the first library entity joined (the ticket 04 shape), library books not joined, joined rows listed in `placeholders`, library books listed before the authored ones, the session set without additions, additions not drawn at once, invented characters joining, world books read as library books, no sync from play state, the page-one opening ignoring the additions, the dictionary name check back to an error, a dictionary placeholder miss back to an error, and session refs left stale across a restart.
- A library book is a runtime book whose id is not authored (Q28). Picked library books take fresh ids at entry; their placeholder ids keep the library's.
- The world copy wins a placeholder id it shares with a library item, as it does for the library persona. That id then has no node under the library owner's entry; its chips still resolve through the world copy.
- A library item's carried shared placeholders join the set but have no owner node, as for the library persona since ticket 04. Q14 covers owned placeholders.
- At mount, GameplayContext's sync effect runs after GameViewer's init with empty play state, so the set lacks the additions for one render. Rolls survive and page one resolves through its own override. The persona effect has the same shape.
- Not done (ticket 05's area): the authored `dictionaries` list passed to the run still holds authored books the player turned off at Enter World.
