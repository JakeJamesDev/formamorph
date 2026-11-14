# Spec: Named Memories

Status: ready-for-agent
Spec session: named-memories — spec

## Problem Statement

A world author wants one memory that a script keeps current, in place of one memory per event. The case that prompted it: a breeding world names each offspring with `player.input` and pins "<Name> lives at the nursery." After many births, the per-birth pinned lines go with every request and bloat it.

Scripts can already `edit(text)` and `remove()` a Custom memory, but they cannot find the same memory again on a later turn:

- A text match breaks when the player edits the line.
- A new pin's `id` is not known until its turn ends.

There is also no way to undo a script's rewrite. A Custom edit persists through a rewind, so rewinding a birth turn leaves the baby in a condensed line.

## Solution

A script can give a Custom memory a **name** and find it by that name on any later turn.

- `memories.pin("Nursery", text)` creates the memory named Nursery, or replaces the text of the live memory that has that name.
- `memories["Nursery"]` returns that memory's entry. Its `text` holds the current text, the player's edits included. A script reads it, condenses it with the new event, and pins the result under the same name.
- Every script write to a named memory rewinds with its turn. A rewind or a regenerate brings back the text from before that turn.
- The Memory Manager shows the name as a read-only label on the Custom row.
- `memories.add` becomes `memories.append`. Old scripts are rewritten when they load.

## Rulings

Settled with the user on 2026-11-14.

| # | Ruling |
|---|---|
| Q1 | The name is an optional field on the Custom memory record. Scripts set it |
| Q2 | Lookup is `memories['<Name>']`. The upsert is `memories.pin(name, text)`. `memories.add` is renamed `memories.append`. `memories.pin(text)` stays as it is |
| Q3 | A name is unique per save. Names match trimmed and case-insensitive |
| Q4 | A script write to a named memory rewinds with its turn. The memory keeps one text per turn that wrote it; the newest surviving one shows. Player edits persist through a rewind |
| Q5 | `memories.add` shipped in 3.4.0. A load-time script-text rewrite turns it into `memories.append`, as the `memory.add` → `memories.add` and `diary` rewrites did. The bundled worlds that use it (Emberwatch, Slime) are updated in source |
| Q6 | `pin(name, text)` throws a TypeError when the name matches a member of the list (`length`, `filter`, `at`, `map` and the rest), so every name is reachable by brackets |
| Q7 | A player delete frees the name. The next `pin(name, text)` creates a fresh memory. A restore whose name another live memory holds brings the memory back unnamed |
| Q8 | Scripts read the player's edited text. The next script write replaces it. Rewinding that write brings the player's edit back |
| Q9 | The Memory Manager shows the name as a read-only label on the Custom row. The player cannot name, rename or clear a name |
| Q10 | A named memory's anchor turn follows its latest surviving script write, and moves back when that write rewinds |
| Q11 | `pin(name, text)`, `entry.edit(text)` and `entry.remove()` on a named memory all rewind with their turn. Unnamed memories keep today's rule: an edit or removal persists through a rewind |
| Q12 | An unknown name reads as a blank entry, the script standard: `id`, `name` and `text` are `''`, every flag is false. `edit` and `remove` through it are ignored and reported |
| Q13 | Surfaces in scope: Scripts Reference and Memory docs, editor completions and hover cards, a changelog entry. The Help vector rebuild is not part of this effort |
| Q14 | The AI sees the text only. The name never goes in a request |

## User Stories

1. As a world author, I want to pin a memory under a name, so that my script can find it again on a later turn.
2. As a world author, I want `memories["Nursery"]` to return the named memory, so that I can read its current text.
3. As a world author, I want `memories.pin("Nursery", text)` to replace the text when the memory exists, so that one memory holds every offspring.
4. As a world author, I want the same call to create the memory when it does not exist, so that my script needs no first-time branch.
5. As a world author, I want `memories["Nursery"].text` to read `''` before the first pin, so that a condensing script can start from it with no null check.
6. As a world author, I want to test whether a named memory exists through its `id`, so that I can branch when I need to.
7. As a world author, I want names to match regardless of case and outer spaces, so that a small typo in case does not make a second memory.
8. As a world author, I want a name that clashes with a list member to throw, so that I learn at once that brackets cannot reach it.
9. As a world author, I want a blank name or blank text to throw a TypeError, as `pin(text)` does today.
10. As a world author, I want a pin with a name to read under that name in the scripts below it in the same turn, so that a later script can condense on top of it.
11. As a world author, I want a second `pin(name, text)` in the same turn to replace the first, as later calls overwrite earlier ones today.
12. As a world author, I want `entry.edit(text)` and `entry.remove()` to work on a named memory, so that I can use the entry verbs I already know.
13. As a world author, I want an `edit` or `remove` through an unknown name to be ignored and reported in Test Code and the Test Bench, so that a typo shows.
14. As a world author, I want each entry to carry a read-only `name` field (`''` when unnamed), so that I can tell named memories apart in a loop.
15. As a world author, I want `memories.append(text)` to do what `memories.add(text)` did, so that the verbs read as what they do.
16. As a world author with an older world, I want my `memories.add` calls rewritten to `memories.append` on load, so that my world keeps working.
17. As a world author, I want a World Tool script to use names the same way as a Script, so that one surface covers both.
18. As a world author, I want the editor to complete `memories.append`, `memories.pin(name, text)` and the entry's `name`, with hover cards, so that I can find the new calls while I write.
19. As a player, I want a rewind of the birth turn to remove that baby from the Nursery memory, so that the memory matches the story I kept.
20. As a player, I want a regenerate to restore the named memory's text from before the turn, so that a discarded turn leaves no trace.
21. As a player, I want a rewind past the turn that created a named memory to remove the memory, as a rewind removes an unnamed script pin today.
22. As a player, I want my edit of a named memory to survive a rewind, so that my changes are never lost to a rewind.
23. As a player, I want the next script write to start from my edited text, so that my correction carries into the condensed line.
24. As a player, I want a rewind of that later script write to bring my edit back.
25. As a player, I want to delete a named memory, so that I can get rid of a line I do not want.
26. As a player, I want the world to keep working after that delete, with the next script write creating a fresh memory.
27. As a player, I want to restore a deleted named memory, and to get it back unnamed when a newer memory has its name, so that nothing I restore overwrites another memory.
28. As a player, I want to see the name on the Custom row in the Memory Manager, so that I know a script keeps that memory current.
29. As a player, I want the name to be read-only, so that I cannot break the world's script by renaming it.
30. As a player, I want a named memory to sit in the timeline at its latest update, so that the AI reads it as current, not as an old fact.
31. As a player, I want the AI to see only the memory's text, so that the name adds nothing to my requests.
32. As a player, I want a named memory to be sent with every request, as every Custom memory is today.

## Implementation Decisions

**One new deep module owns the named-memory record.** It is pure, with no React and no context. Its interface:

- Apply a turn's named writes (`pin(name, text)`, `edit`, `remove`) at turn end, keyed by the turn's id and anchor.
- Prune the script revisions of turns that left the history (rewind, regenerate, failed or stopped turn). This joins the existing script-pin prune, which runs at the same point.
- Apply a player edit, a player delete and a player restore, with the Q7 rule on restore.
- Resolve the effective text and anchor of each named memory for every consumer.
- Resolve a name to a live memory, matched trimmed and case-insensitive.

GameViewer only wires it in, where it already applies script pins, memory verbs and the pin prune.

**Record shape.** A Custom memory today is an id, a text and an anchor turn, stored in the save's memory overrides. A named memory adds:

- `name`: the name as the script first wrote it.
- A list of revisions. Each revision records the turn that wrote it (or the player), the text (or a removal) and the anchor turn.

The effective text is the newest surviving revision. Script revisions prune with their turn. Player revisions never prune. When the creating script revision leaves the history, the memory goes, as an unnamed script pin does today. An unnamed memory keeps today's shape and rules. The exact field names are the implementer's.

**Identity.** A named memory keeps the id of the pin that created it for its whole life. So `entry.id` is a stable handle too. Only a fresh memory after a player delete (Q7) gets a new id.

**Effective text is the single source.** The chokepoint that applies memory overrides for every consumer (recap, planner, selector, retrieval, panel) reads the resolved text and anchor. No consumer reads revisions directly. The AI request carries the text only (Q14).

**Script surface (executor).**

- `memories` stays a list, oldest first. Bracket access with a string that is not a list member resolves a name. A miss returns the blank entry of Q12.
- `memories.pin(name, text)` with two arguments is the named upsert. One argument keeps today's unnamed pin.
- Names and texts are trimmed. A blank name, a blank text, a non-text argument, or a name that is a list member throws a TypeError.
- Each entry gains a read-only `name` field, `''` for an unnamed memory or a summary.
- `memories.append(text)` replaces `memories.add(text)` with the same behavior.
- Writes reach the turn through the existing world-writes record, so the run chain shows a named pin to later scripts in the same turn, and World Tools get it at their timings.
- In Test Code and the Test Bench, the list is empty. Bracket lookups return blank entries, and writes are recorded and reported as today.
- Pin verdicts (`entry.pin()`, `entry.forget()`) stay ignored on Custom memories, named or not.

**Load-time rewrite.** The script-text migration gains one rewrite: `memories.add(` becomes `memories.append(`. It is idempotent and leaves code it does not recognize byte for byte, as the existing rewrites do. Emberwatch and Slime are updated in source.

**Memory Manager.** A Custom row shows its name as a read-only label. The player edit, delete and restore buttons route through the new module.

**Editor surface.** Completions and hover cards cover `memories.append`, the two-argument `memories.pin` and the entry's `name`. Names are runtime values, so the editor never underlines an unknown name in brackets.

**Docs.** The Memory section of the Scripts Reference and the Memory page cover names, brackets, the upsert, the blank entry, the rewind rules and `append`. The Tools page's surface list and its load-rewrite paragraph name `append`. The changelog gets one Added entry.

**Export shape (constraint #2).** The save's memory overrides change: Custom memories gain the optional name and revision list. The world file is unchanged; only script text is rewritten on load.

## Testing Decisions

A good test drives a public seam with real inputs and asserts what a player or author sees. It never asserts internal fields the seam does not expose. Each guard is proven by reinstating the bug it prevents.

Four seams:

1. **Executor** (`executeStatCode` → world writes). Covers bracket lookup (hit, miss, case and spaces), the blank entry, `pin(name, text)` create and replace, the TypeErrors, `append`, same-turn reads in later scripts, and ignored and reported writes through a blank entry. Prior art: the existing executor memory tests (memories, memory verbs, memory writes).
2. **The new named-memory module.** Covers apply, rewind prune (one write, several writes, the creating write), player edit then script write then rewind, player delete then fresh pin, restore with a taken name, anchor movement, and the unnamed path unchanged. Prior art: the script-pin and memory-writes tests.
3. **Script-text migration.** Covers the `add` → `append` rewrite, idempotence, and code left untouched. Prior art: the existing migration tests for `memory.add` and `diary`.
4. **Memory Manager component.** Covers the read-only name label on a named Custom row and none on an unnamed one. Prior art: the Memory panel and Memory Manager tests.

No GameViewer-level test and no E2E. GameViewer only wires the module.

## Out of Scope

- The Sunmeadow world's own Nursery script. The Sunmeadow spec session owns it.
- Names on summaries. Only Custom memories take a name.
- Player naming or renaming in the Memory Manager.
- Authored named memories in the World Editor (a memory a world starts with).
- Sending the name to the AI.
- The Help vector rebuild.
- Changing the rewind rule for unnamed memories.

## Further Notes

- The rule that a named memory goes when its creating write leaves the history comes from today's script-pin behavior. It was not a separate grill question.
- `memories.add` remains readable in shipped worlds only through the load rewrite. No alias stays in the surface.
