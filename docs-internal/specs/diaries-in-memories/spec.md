# Spec: Diaries in Memories

Status: ready-for-agent
Spec session: diaries-in-memories — spec
Prototype: branch `prototype/diary-view`, variant C4 (`#dev?view=gameViewer&fixture=diaries&modal=entity&variant=C4`). Rounds 1–3 compared a diary view in the popup (A), a section in the popup (B), and five placements inside Memories (C, C1–C4). C4 won on 2026-11-24.

## Problem Statement

With Character Diaries on, every character keeps a first-person diary, and the AI reads that diary each turn to play the character. The player can't see any of it. When a character acts on a wrong belief, the player has no way to find the entry that caused it, fix it, or ask the AI to write it again. The only window into a diary is Show Silent Requests in the AI Context viewer.

Story memories can already be read, edited, rewritten and deleted in the Memories window. Diaries are the same kind of thing, AI-written text that steers later turns, but they have none of those tools.

## Solution

Diaries join the Memories window. On desktop a Nav Rail lists **Story** first, then one **Diary** row per character. On mobile the same list is the Sections bar that Settings and Enter World use. Picking a character shows their diary entries, oldest first, with the turn's memory above each entry for context.

Each diary entry has the tools a memory has: **Edit**, **Regenerate**, **Revert to the Original** and **Delete**. Regenerate shows the new text first, with **Keep** and **Discard**. Story memories switch to that same preview flow, so the window has one way to regenerate.

A character's popup gets one quiet line under the description, such as "Bram's diary · 5 entries", which opens Memories on that diary.

Every change the player makes to AI-written text, in a memory or a diary, is stored in one shared layer. The AI's original text is never destroyed.

## Rulings

Settled in the grill, 2026-11-24. A ruling reopens on new evidence, never on a new opinion.

| Q | Ruling |
|---|---|
| Q1 | Player changes to memories and diaries live in **one shared layer**. The AI's original stays on the turn; readers apply the layer when they read. |
| Q2 | Regenerating a diary entry shows a **preview with Keep / Discard**, as the popup's description regenerate does. |
| Q3 | "Nothing notable" entries are hidden by default, behind a toggle. |
| Q4 | With Character Diaries off, Memories still shows the diaries a save already has. A fresh game shows no diaries. |
| Q5 | Lines a script wrote into a diary show **read-only** with a Script badge. Edit and Regenerate touch only the AI's entry. |
| Q6 | The player can **delete** a diary entry. It leaves the list and the AI's reading, and can be restored. |
| Q7 | The popup shows the diary line only when the character has at least one entry the AI reads. |
| Q9 | Released saves' `memoryEdits` and `memoryDeleted` **migrate on load** into the shared layer. Only the new shape is written. |
| Q10 | One **Show Hidden Entries** toggle shows quiet and deleted entries, dimmed. Deleted ones offer Restore. |
| Q11 | Diaries list in order of the character's **first appearance**. A row never moves once it is there. |
| Q12 | **Anyone with entries** gets a row, entity or not, under the name the diary is kept by: the name the AI reads. |
| Q13 | The Memory tab's side panel stays **story only**. |
| Q15 | The shared **Nav Rail scrolls** when its list is taller than the space. Fixed once; World Editor and Community Creations get it too. |
| Q20 | **Reset All My Changes** resets the open view: memory changes on Story, that diary's changes on a diary. |
| Q21 | Story memories' Regenerate switches to the **same Preview / Keep / Discard** flow. |

Q8, Q14 and Q16–Q19 were never asked; the numbers are skipped, not lost.

## User Stories

1. As a player, I want to open a character's diary from their popup, so that I can see what they remember about our story.
2. As a player, I want the popup's diary line to say how many entries there are, so that I know whether there is anything to read.
3. As a player, I want no diary line on a character with no entries, so that the popup stays clean.
4. As a player, I want Memories to list the story and every character's diary in one rail, so that everything the AI remembers is in one place.
5. As a player, I want the rail to keep the order characters first appeared in, so that a row is where I left it.
6. As a player, I want each diary entry to name its turn and show that turn's memory above it, so that I know what moment the character is reacting to.
7. As a player, I want to edit a diary entry, so that I can fix a belief the character got wrong.
8. As a player, I want the AI to read my edited entry from the next turn on, so that the character acts on the corrected belief.
9. As a player, I want to regenerate one diary entry and see the new text before it replaces the old one, so that I never lose a good entry to a worse rewrite.
10. As a player, I want to cancel a regenerate that is waiting or running, so that I am not stuck.
11. As a player, I want Revert to the Original on any changed entry, so that I can go back to what the AI first wrote.
12. As a player, I want an edited entry marked Edited, with the original shown under it, so that I can see what I changed.
13. As a player, I want to delete a diary entry, so that the character forgets something that should not have stuck.
14. As a player, I want to restore a deleted entry later, so that a delete is never final.
15. As a player, I want quiet "nothing notable" turns hidden, so that the diary reads as what the character actually wrote.
16. As a player, I want a Show Hidden Entries toggle, so that I can still find quiet and deleted entries.
17. As a player, I want to write a real entry over a quiet turn, so that I can give the character a memory the AI skipped.
18. As a player, I want lines a script wrote marked Script and left as they are, so that I don't break a world's mechanic by accident.
19. As a player, I want search to look only in the open diary, so that results are about that character.
20. As a player, I want Reset All My Changes to reset only the open diary, so that fixing one character never undoes my work on another.
21. As a player, I want story memories to regenerate with the same preview, Keep and Discard, so that the window works one way.
22. As a player on mobile, I want the rail as the Sections bar I know from Settings, so that the window fits a phone.
23. As a player with a big cast, I want the rail and the Sections list to scroll, so that I can reach every character.
24. As a player with Character Diaries off, I want the diaries my save already has to stay readable, so that turning the setting off hides nothing I had.
25. As a player, I want a note in Memories when Character Diaries is off, so that I know why no new entries appear.
26. As a player, I want editing a turn's narration to drop my edits to that turn's diary entries but keep my deletes, so that diaries never describe prose that no longer exists and nothing I removed comes back.
27. As a player, I want a Regenerate I press during a turn to wait for the turn, with Cancel, so that it never fights the story for the AI.
28. As a player, I want my memory edits from older versions to still work after the update, so that nothing I fixed comes back wrong.
29. As a player, I want a discovered character's diary listed under the name the AI uses, so that what I edit is what the AI reads.
30. As an author testing a world, I want to read a character's diary, so that I can see whether my description leads the AI where I meant.

## Implementation Decisions

- **One shared layer for player changes to AI-written turn text.** It replaces `memoryEdits` and `memoryDeleted` on the save envelope. Each record is keyed by a turn id, or by a written memory's id, and holds the memory change and the diary changes for that turn. Pins and written memories stay where they are: they are not changes to AI text. This type shape came from the grill:

  ```ts
  interface TextEdit {
    text?: string;              // absent: the AI's text, as with a delete-only change
    source: 'player' | 'ai';    // 'ai' = a kept regenerate; Revert always returns to the AI's first text
    deleted?: true;
  }
  turnTextEdits?: Record<string /* turn id or written-memory id */, {
    memory?: TextEdit;
    diaries?: Record<string /* diary name as stored on the turn */, TextEdit>;
  }>;
  ```

  Nested by turn so a character name never has to be parsed out of a key. The glossary's **Override** is a Blueprints term, so this layer is not called an override in code or docs.
- **Readers resolve the layer at read time.** The memory recap and ledger read it as they read `memoryEdits` today. Every diary reader (the per-turn diary map, the character pass's diary, Diary Recall, the recall tool, the description regenerate's diary tier) takes the layer, so edited text reaches the AI and deleted entries never do. Script diary lines are not part of the layer and always read as written.
- **Migration.** `migrateSave` folds `memoryEdits` into `memory` and `memoryDeleted` into `memory.deleted`, idempotently, and drops the old fields. Loading runs it at the existing import boundary. **Export-shape change:** saves gain `turnTextEdits` and lose `memoryEdits` / `memoryDeleted`; a build older than this one can't read edits from a newer save.
- **Narration edit.** Editing a turn's narration already clears its digest, its diaries and its memory edit. It now drops that turn's text changes in the layer, memory and diaries alike, and keeps every delete: a delete means "forget this", not a comment on the old prose. A record left empty is removed. (Ruled for ticket 01, 2026-11-24.)
- **Delete-only changes.** A delete with no rewrite is stored as `{ source: 'player', deleted: true }` with no `text`; readers apply `source` only when `text` is present.
- **Rollback.** The layer lives on the envelope like `memoryEdits`, so an undo leaves records for turns that are gone. They are harmless, as today.
- **Regenerate, for memories and diaries.** It resolves to the new text instead of writing it. The window shows the preview; Keep writes a `source: 'ai'` change, Discard writes nothing. A diary regenerate sends the background diary pass's request for that turn and name, waits behind the Background Pass Queue like a memory regenerate does, and holds the queue while it runs. It stays enabled during a turn and waits behind it, with Cancel while waiting or running; it is disabled only while another regenerate or a preview is pending. The preview lives in the window: a turn starting keeps it, closing the window discards it, and Keep on a turn that undo or re-roll removed does nothing. While a preview is open, other rows' Regenerate and the same row's Edit and Delete wait. Keep over a player edit replaces it and clears the edit's automatic keep-pin. (Ruled for ticket 03, 2026-11-24.)
- **Delete and restore.** A diary delete sets `deleted`. The Background Pass Queue does not refill it, because the turn's AI entry still exists under the delete.
- **The Memories window.** A vertical Tabs root drives the selection: the Nav Rail on desktop, the Sections bar on mobile, with the same groups. Group one is **Story**; group two is one **"<Name>'s Diary"** per diary name, in order of first appearance. The diary view keeps the search field (scoped to that diary) and Add Memory stays Story-only. The memory filter row shows only on Story. Show Hidden Entries replaces it on a diary. The header count names the open view.
- **Opening a diary from outside.** The popup's line and the dev router open Memories through the existing route that switches to the Memory tab first, now carrying a diary name.
- **The popup line.** In the character popup, under the description, for any character whose name has at least one entry the AI reads. Shown whether or not the character is a discovered one.
- **Character Diaries off.** The diary group shows when the save has entries; a note under the header says new entries are off.
- **Nav Rail scroll.** The tab list scrolls inside the rail; the collapse toggle stays pinned at the bottom. Every rail gets it.
- **Copy.** Every label, hint and the changelog lead follow the Writing Guide; the help topic for Memories and the wiki page for memories gain the diary view.
- **Dev router.** `memoryManager` takes a diary target, and a `diaries` boot fixture (from the prototype) seeds a save with digests, diaries and a script diary line.

## Testing Decisions

A good test drives a public seam and checks what the player or the AI gets, never which helper ran. Three seams, all existing:

- **The shared layer, through its readers.** Given a history and the layer, check what the memory recap holds, what a character's diary holds for the character pass and recall, and what the ledger lists. Cases: player edit, kept rewrite, delete, restore, revert, a quiet entry edited into a real one, a script line beside an edited entry, case-different diary names, records for turns that are gone. Prior art: the `memoryOverrides` resolution tests.
- **`migrateSave`.** Old `memoryEdits` and `memoryDeleted` fold in, run twice gives the same result, and a save with neither stays unchanged. Prior art: the `version` migration tests.
- **The Memories window and the popup, in jsdom.** Picking a diary lists its entries; edit, Regenerate preview with Keep and Discard (memories and diaries), Cancel, delete and restore, Show Hidden Entries, per-view Reset, search scope, the Diaries-off note, and the popup line opening the diary. Prior art: the `MemoryManagerModal` regenerate, reset and search tests, and the `EntityModal` tests.
- Each guard is proven by putting its bug back and watching the test fail (`test-bar`).
- **Nav Rail scroll** is layout that jsdom can't measure. Verify it live with a DOM read of the list's scroll height against its client height, on desktop and on the mobile Sections bar.

## Out of Scope

- Diaries in the Memory tab's side panel (Q13).
- Pinning diary entries, or choosing which entries the AI reads beyond edit and delete.
- Adding a diary entry by hand for a turn the character was not in.
- A diary view anywhere but Memories, such as inside the popup (prototype variants A and B, not chosen).
- Merging diary names that drifted for one character ("the mouse" and "Grey Mouse" stay separate rows).
- Changes to how the background diary pass writes entries, or to the diary prompt.

## Further Notes

- **Export-shape reminder:** this changes the save `.json` (Q9). The version stays user-managed.
- The Sections bar scroll fix already landed on main in `9e8726f04` ("Scroll an Open Sections List"); this effort relies on it.
- The prototype branch holds the canned `diaries` fixture turns, which the dev-router work can lift as they are.
- Changelog: one Added entry for diaries in Memories, and a note that memory regenerate now previews first.
