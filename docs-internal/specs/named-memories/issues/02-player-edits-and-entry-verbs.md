# 02: Player Edits and Entry Verbs on Named Memories

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The player's edit, delete and restore work with named memories, and the entry verbs rewind on them. Built on ticket 01's named-memory module.

- `entry.edit(text)` and `entry.remove()` on a named memory are script revisions and rewind with their turn (Q11). On an unnamed memory they keep today's rule.
- A player edit is a revision that never prunes. Scripts read it through `.text`; the next script write replaces it; rewinding that write brings it back (Q8).
- A player delete frees the name: the lookup misses and the next `pin(name, text)` creates a fresh memory with a new id. A restore whose name another live memory holds brings the memory back unnamed (Q7).
- `edit` and `remove` through a blank entry are ignored and reported in Test Code and the Test Bench (Q12).
- The Memory Manager's edit, delete and restore buttons route through the module.
- Ships its docs: the Scripts Reference Memory section and the Memory page describe these rules.

## Acceptance criteria

- [ ] A script `edit` on a named memory, then a rewind of that turn, restores the text before it; the same on an unnamed memory persists, as today.
- [ ] A script `remove` on a named memory, then a rewind of that turn, brings the memory back.
- [ ] Player edit → script pin → rewind of the script turn shows the player's edit; a script reading `.text` after the player edit sees the edit.
- [ ] Player delete → `memories['Nursery']` is blank → `pin('Nursery', t)` makes a new memory with a new id.
- [ ] Restore of the deleted memory while the new one lives returns it unnamed; with no live holder, it returns named.
- [ ] `edit` and `remove` through an unknown name are ignored and reported.
- [ ] Reinstating today's persist rule for named verbs fails the rewind tests.
- [ ] Docs updated; changelog fragment written.

For you: edit a named memory in the Memory Manager, play a turn whose script rewrites it, rewind that turn, and check your edit is back.
