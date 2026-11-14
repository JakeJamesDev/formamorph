# 01: Named Pin and Lookup

Status: ready-for-agent
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

- [ ] `pin('Nursery', a)` on one turn and `pin('nursery ', b)` on a later turn leave one memory with text `b`, the same `id`, and `name` `Nursery`.
- [ ] `memories['NURSERY'].text` reads the current text; an unknown name reads a blank entry (`id`, `name`, `text` are `''`, flags false) and never throws.
- [ ] A named pin reads under its name in a later script of the same turn; a second named pin in the turn replaces the first.
- [ ] Each TypeError case of Q6 throws; reverting the list-member check fails its test.
- [ ] Rewinding or regenerating the turn of a later write restores the earlier text and anchor; rewinding the creating turn removes the memory. Disabling the prune fails these tests.
- [ ] The named memory's anchor follows its latest surviving write.
- [ ] The AI request carries the text and never the name.
- [ ] Unnamed Custom memories and `pin(text)` behave as before (existing tests unchanged).
- [ ] The Memory Manager shows the name label on a named Custom row and none on an unnamed one (component test).
- [ ] Scripts Reference, Memory page, completions and hover cards cover `pin(name, text)`, brackets and `name`.
- [ ] Changelog fragment written.
- [ ] Response reminds the user: the save's Custom memories gain `name` and a revision list (constraint #2).

For you: in a game, pin a named memory from a script over two turns, rewind the second turn, and check the Memory Manager row shows the first text with its name label.
