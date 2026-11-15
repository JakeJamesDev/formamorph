# 02: Player Edits and Entry Verbs on Named Memories

Status: done
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

From ticket 01's landing (49c0f5c83):

- A Memory Manager edit of a named memory still overwrites its text directly, so a later prune loses it (Q18). Route it through the module as a player revision.
- The run chain predicts a new memory's id as `named:<turnId>:<name>`, but commit adds a `#2` suffix when a deleted memory holds that id. Resolve the verbs on such an entry by name, not by the predicted id.
- The blank entry's verbs exist and do not throw (Q17). Add their ignored-and-reported tests and docs.

## Acceptance criteria

- [x] A script `edit` on a named memory, then a rewind of that turn, restores the text before it; the same on an unnamed memory persists, as today. *namedMemories.test "rewinds an edit of a named memory…", "keeps an edit of an unnamed memory…"; executor test "records edit and remove on a named memory as named writes".*
- [x] A script `remove` on a named memory, then a rewind of that turn, brings the memory back. *"hides a removed memory, then brings it back…"*
- [x] Player edit → script pin → rewind of the script turn shows the player's edit; a script reading `.text` after the player edit sees the edit. *"shows the player's edit to scripts…" (through `scriptMemories`); Memory Manager test "saves an edit of a named memory as a player revision…".*
- [x] Player delete → `memories['Nursery']` is blank → `pin('Nursery', t)` makes a new memory with a new id. *"frees the name: the lookup misses…"*
- [x] Restore of the deleted memory while the new one lives returns it unnamed; with no live holder, it returns named. *Module tests for both cases; Memory Manager test "restores a deleted named memory unnamed…".*
- [x] `edit` and `remove` through an unknown name are ignored and reported. *Executor "reads an unknown name as a blank entry…"; statCodeTestRun.worldWrites "lists a named pin, and an edit or remove through an unknown memory name as dropped"; scriptCheck "reports an edit or remove through a memory name as a maybe" (Q25).*
- [x] Reinstating today's persist rule for named verbs fails the rewind tests. *Routing named edit/remove back to `memoryWrites` turns the executor test red; a player revision given a turn id turns three rewind tests red. Ten mutations in all, each red on its guard.*
- [x] Docs updated; changelog fragment written. *Scripts Reference Named Memories and Memory Entries, Memory page, two hover cards, `changelog.d/named-memories-02.md`.*

## Landed

**Not verified**
- None. No in-game run: the GameViewer wiring is unchanged beyond the rename, and the module and Memory Manager tests cover the rules, as the spec's Testing Decisions set.

**For you**
- For you: edit a named memory in the Memory Manager, play a turn whose script rewrites it, rewind that turn, and check your edit is back.

**Notes**
- `namedPins` is now `namedWrites` (`NamedWrite`): a pin, an entry edit or an entry removal, in call order, resolved by name at commit, so the `#2` id gap is gone. `NamedRevision` gains `removed?: true` (save shape, unreleased).
- A new id also skips ids in the deleted list, so a re-landed turn never makes a memory that reads as deleted.
- Reset All restores script removals too, and runs each restore through the Q7 rule.
- Known gap: inside one turn's run chain, a pin after a script removal shows later scripts a predicted `named:<turn>:<name>` id; the committed memory keeps its original id (Q20). Only the in-chain `entry.id` differs.
- Known gap: a player edit made between a turn's stream and its commit, on a memory that turn created, goes when the turn re-lands (Q24's rule).
- Delete stays the tombstone it was; the name frees through `findNamed`, which skips deleted ids.
