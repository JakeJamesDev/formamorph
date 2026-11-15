# 01: Named Pin and Lookup

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A script can pin a Custom memory under a name, find it on any later turn with `memories['<Name>']`, and replace its text with the same call. A rewind or a regenerate undoes the turn's write. This ticket owns the named-memory module and the record shape; ticket 02 adds the player's edit, delete and restore and the entry verbs on top of them.

- `memories.pin(name, text)` creates the named memory, or replaces the text of the live one (spec Q2, Q3). `memories.pin(text)` is unchanged.
- `memories['<Name>']` resolves a name, trimmed and case-insensitive. A miss is the blank entry (Q12). Entries gain a read-only `name`.
- `pin(name, text)` throws a TypeError for a blank name, blank text, non-text arguments, or a name that is a list member (Q6).
- The new pure module owns the record (spec, Implementation Decisions): apply a turn's named pins, prune the revisions of turns that left the history, resolve the effective text and anchor (Q4, Q10). GameViewer only wires it, beside the existing script-pin prune. The memory-override chokepoint reads the resolved text; the AI sees the text only (Q14).
- The Memory Manager shows the name as a read-only label on the Custom row (Q9).
- Ships its docs: the Memory section of the Scripts Reference and the Memory page; editor completions and hover cards for the two-argument `pin` and `name`.

## Acceptance criteria

- [x] `pin('Nursery', a)` on one turn and `pin('nursery ', b)` on a later turn leave one memory with text `b`, the same `id`, and `name` `Nursery`. namedMemories.test "creates a memory under its name…".
- [x] `memories['NURSERY'].text` reads the current text; an unknown name reads a blank entry (`id`, `name`, `text` are `''`, flags false) and never throws. statCodeExecutor.namedMemories.test "reads a memory by its name…", "reads an unknown name as a blank entry…".
- [x] A named pin reads under its name in a later script of the same turn; a second named pin in the turn replaces the first. statCodeExecutor.namedMemories.test "reads a named pin under its name in a later script…"; namedMemories.test "keeps one text per turn…".
- [x] Each TypeError case of Q6 throws; reverting the list-member check fails its test. Two TypeError tests; the member test went red with the check disabled.
- [x] Rewinding or regenerating the turn of a later write restores the earlier text and anchor; rewinding the creating turn removes the memory. Disabling the prune fails these tests. namedMemories.test rewind cases; 6 went red with the prune disabled.
- [x] The named memory's anchor follows its latest surviving write. namedMemories.test "brings back the earlier text and anchor…", "rewinds several writes…".
- [x] The AI request carries the text and never the name. namedMemories.test "sends the text with the next request and never the name" (banded history).
- [x] Unnamed Custom memories and `pin(text)` behave as before (existing tests unchanged). Existing memory, script-pin and verb tests pass unchanged; only field-list pins gained `name`.
- [x] The Memory Manager shows the name label on a named Custom row and none on an unnamed one (component test). MemoryManagerModal.names.test; red with the badge removed.
- [x] Scripts Reference, Memory page, completions and hover cards cover `pin(name, text)`, brackets and `name`. codeCards.memories.test covers the pin card, bracket entry cards and no diagnostics.
- [x] Changelog fragment written. `docs-internal/changelog.d/named-memories-01.md`.
- [x] Response reminds the user: the save's Custom memories gain `name` and a revision list (constraint #2). In the landing report.

## Landed

**Not verified**
- None. No in-game run: the GameViewer wiring is covered by the module tests only, as the spec's Testing Decisions set.

**For you**
- For you: in a game, pin a named memory from a script over two turns, rewind the second turn, and check the Memory Manager row shows the first text with its name label.

**Notes for ticket 02**
- A Memory Manager edit of a named memory still overwrites `text` directly, so the next prune that drops a script revision loses it (Q18). 02 routes the edit through the module as a player revision.
- The prune drops a named memory when no script revision survives. In a linear history that is the moment its creating pin leaves; it also keeps a regenerated turn's write that committed before the prune ran.
- The run chain predicts a new memory's id as `named:<turnId>:<name>`. Commit adds a `#2` suffix when a deleted memory already holds that id (delete, then a same-turn pin between turns), so the two can differ there. 02's verbs on such an entry should resolve by name.
