# Spec: Action List

Status: ready-for-agent
Spec session: action-list — spec

Player actions taken in the game's panels between turns are listed above the action box, told to the narrator with the next turn, and can be hidden or undone before sending.

## Problem Statement

A player can use a potion, equip a sword, give an item to a character, turn a trait on, travel, or switch persona from the panels between turns. The narrator never hears about it. To make the story react, the player must type the same action into the action box. That repeats the action in the story and can apply it twice: the Inventory pass may consume a second copy of a potion the player already drank.

The reverse problem exists too. A player who fixes a mistake in a panel, such as a wrong stat value or a misplaced item, does not want the story to react at all. Today there is no way to say which changes are story events and which are corrections, and no way to take back a panel action except doing the reverse by hand, which fires the item's scripts a second time.

A regenerate also loses these changes. The page snapshot does not record panel actions, trait toggles, travel or persona switches, so regenerating the next turn silently reverts them.

## Solution

Every listed panel action adds an entry to the **Action List**, a tray above the action box. Each entry shows what happened in plain words. Entries are told to the narrator by default; the player can hide any entry so the narrator never hears it. Stat edits arrive hidden, since they are usually corrections. The newest entry has an undo that restores the game exactly as it was before that action. Doing the exact reverse of the newest action (unequip right after equip) also counts as its undo. Repeats of the same action collapse into one row with a count.

When the player sends, the shown entries ride along with the action, and the list closes. The sent page keeps the list, with hidden entries marked as visible only to the player. The player can send with an empty action box, so drinking a potion and pressing Send is a whole turn. Regenerating a turn brings its list back, reapplied and editable.

## Rulings

- **Q1** Stat edits create entries, hidden by default. The player can show one.
- **Q2** Undo is newest first only.
- **Q3** The list closes when the turn sends. Undo after that is a turn rewind, not a list action.
- **Q4** Hidden entries are kept on the sent page, visible to the player only.
- **Q5** Entries come from inventory panel actions (use, equip, unequip, drop, give, pick up), trait toggles, location travel and persona switches. All are shown by default.
- **Q6** Undo restores a full state snapshot taken just before the action, so script writes and item effects revert with it.
- **Q7** The Inventory pass must not repeat a listed action: it gets a prompt line, and code drops a matching operation. Both are needed (the Item Use and Identity Q52 lesson).
- **Q8** Shown entries reach the narration request only. Choices, stats, digest and other passes do not get them.
- **Q9** Exception to Q8: the Inventory pass gets the shown entries as an "already done, do not repeat" line for the Q7 guard.
- **Q10** The entries reach narration in the thinking-off lane only, like the Direction rider. With native thinking on, the narrator does not hear them.
- **Q11** The player can send with an empty action box when the list has shown entries.
- **Q12** The pending list and its undo snapshots are stored in the save, so a reload keeps them.
- **Q13** Listed actions are blocked while a turn runs. This newly blocks trait toggles and travel mid-turn.
- **Q14** Regenerating a turn reopens its list with the actions reapplied and editable.
- **Q15** This effort fixes the regenerate revert through the list: every listed action is on the turn record, so regenerate can reapply it.
- **Q16** Collapse is visual: each repeat keeps its own snapshot, and undo removes one repeat at a time.
- **Q17** Any action that exactly reverses the newest entry acts as that entry's undo: equip/unequip, drop/pick up of the same copy, travel back, trait off/on, persona switch back. No entry is added and no reverse scripts run.
- **Q18** Back-to-back entries with the same operation, item and target collapse into one row (×N). A different action in between starts a new row.
- **Q19** Code writes each entry line from facts. Only the wrapper line around them is a preset field, in Prompts → Narration → Messages beside Direction.
- **Q20** A stat entry carries the old and new value.
- **Q21** The code guard covers shown entries only. A hidden correction never blocks a real typed action.
- **Q22** The parked empty-action digest gap stays parked.
- **Q23** The UI shape was settled by a prototype (`prototype/action-list`, commits c0fa65207 and 63e81e75d).
- **Q24** Glossary term: **Action List**; its entries are **Listed Actions**.
- **Q25** The tray (prototype variant B) wins.
- **Q26** The tray animates its expand and collapse. The chevron follows the standard: right when collapsed, down when expanded.
- **Q27** Each entry's icon matches the panel tab it came from (the Stats tab icon for stat edits, and so on).
- **Q28** Reversal and collapse work on facts, not copy ids, since stacks split and merge. Pick up reverses the newest drop when it takes the same item, the same quantity, from where the drop put it. Unequip reverses the newest equip of the copy that equip left, whatever the slot. Collapse needs the same operation, item (the authored or runtime item, not the copy), target and quantity; a line names a quantity above 1.
- **Q29** Undo reverts the action and everything it caused, the play log included, and adds no log line. It never reverts what the player wrote by hand since the action and that the list does not track, such as player notes; those keep their live value.
- **Q30** An entry stores the display name it had when the action ran (an unidentified copy's unidentified name, the give target's In Scene label). A later reveal or rename does not rewrite it.
- **Q31** Panel actions add entries in both layouts. Until the Chat layout has its own tray, a send from Chat tells the AI nothing: its entries are stored on the turn as not told. A send from Pages tells every shown entry, wherever it was made, because the player saw them in the tray.
- **Q32** Empty send needs the narration call's native thinking off. With it on, the narrator would get an empty action and no block (Q10), so a typed action is required.
- **Q33** The empty-action turn keeps the narration user template as it is, with the block appended. The probe decides whether it needs more.
- **Q34** The sent list is a per-turn record in the save. Only the newest turn's record keeps its snapshots (regenerate needs them); a send drops the previous turn's snapshots and keeps its facts, counts and hidden flags.
- **Q35** Until ticket 07 lands, a regenerated turn sends no block: regenerate still reverts the panel actions, so telling them would contradict the state.
- **Q37** A stat edit of the same owner and stat as the newest entry merges into it. The entry keeps its first old value, first snapshot and hidden flag, takes the latest new value, and stays at count 1. A merge back to the old value removes the entry. A different stat or any other action in between starts a new entry.
- **Q38** An entity stat line names the owner as the panel shows it ("Mira's Health 40 → 60"). Values are rounded as in the Stats tab.
- **Q39** Ticket 05 owns the mid-turn block for stat edits; ticket 04 owns it for trait toggles, travel and persona switches.
- **Q40** Every entry's snapshot is one shape holding the GameState and the persona reference. Ticket 04 owns it; 05 builds on it and 06 serializes it.
- **Q41** Entity-owned trait toggles the player can switch are listed too. The owner is in the facts; reversal needs the same trait, the same owner and the opposite switch.
- **Q42** Travel means the Location map modal only. The starting location, turn moves, script moves and the AI's "Move to X?" are not listed. Travel, trait and persona entries never collapse.
- **Q43** (user ruling) A switch script's run counts as a panel run: every listed action and undo wait until it finishes, including while a `player.confirm` prompt waits on the player. Toggling other traits while such a prompt is open is no longer possible, and the tests that pinned it go.
- **Q44** The guard maps listed kinds to pass operations: use → `use` by the player; equip and unequip → the same op by the player; give → `transfer` to the receiver, `gain` to the receiver from the player, or `lose` by the player; drop → `transfer` to the location or `lose` by the player; pick up → `gain` to the player or `transfer` from the location to the player. Any other shape is never guarded.
- **Q45** The guard's budget is units, not operations: count × quantity per shown entry. A pass op over the budget lands its remainder, with one log line for the part dropped.
- **Q46** The Inventory pass guard line is code-owned, not a preset field, and the anatomy labels it. Only shown inventory entries reach it; stat, trait, travel and persona entries never do.
- **Q47** The live list is saved wherever the game state is saved, through the same save write, and needs no new autosave trigger. The panel changes and their list always travel together.
- **Q48** No snapshot in the save carries the message history (undo keeps the live history). Ticket 06 strips it from the live list and from the newest sent list's snapshots.
- **Q49** A malformed live list loads as an empty list. Dropping one entry would break the undo chain after it.
- **Q50** (user ruling, reopens Q7, Q9 and Q46 on probe evidence) The guard is the code rule only; the Inventory pass gets no line about listed actions. On cloud the line never stopped a double, and with the rule it blocked a typed second use (0/12, against 7–10/12 without it).
- **Q51** (user ruling) A regenerate of a turn whose sent list has entries, hidden-only included, pauses: it rewinds, restores the send-time state, reopens the list, puts the action and its attachments back, and waits for Send. A turn with an empty list resends at once, as today.
- **Q52** The newest sent record stores the send-time state as one more snapshot (state and persona, no message history, Q48), dropped with the others on the next send (Q34). Regenerate restores it. Additive save-shape change.
- **Q53** Regenerate Stats and the choice-script rerun start from the same send-time state through one shared helper, so they keep the listed actions too (Q15). They do not pause or reopen the list.
- **Q54** (ticket 03 as built) A listed pick up guards a pass gain from the floor or from no one. A gain a character hands over is never matched.
- **Q55** In the Chat layout, regenerate resends at once from the send-time state: actions stay applied, the list does not reopen, and the AI is told nothing (Q31).
- **Q56** Regenerating the opening turn (page 1) keeps today's path: the list clears and the pre-game state returns.
- **Q57** (ticket 07 as built) A sent record without its snapshots falls back to today's pre-turn restore.
- **Q36** Shared turn-input shape (ticket 02 owns it, 03 reuses it): the told entries, shown only, oldest first, each as its facts and count. A pure Action List helper writes the block text.

## User Stories

1. As a player, I want a potion I drink from the Inventory tab to be told to the narrator, so that the story reacts without me typing it.
2. As a player, I want an item I equip from the panel to be told to the narrator, so that characters notice my new sword.
3. As a player, I want an item I give to a character from the panel to be told to the narrator, so that the character reacts to the gift.
4. As a player, I want items I drop or pick up from the panel to be told to the narrator, so that the scene accounts for them.
5. As a player, I want a trait I turn on or off to be told to the narrator, so that the story reflects it.
6. As a player, I want travel I do through the map to be told to the narrator, so that the next narration starts from the trip.
7. As a player, I want a persona switch to be told to the narrator, so that the story knows who I am now.
8. As a player, I want to see every panel action that will be told to the AI before I send, so that nothing reaches the story without my knowing.
9. As a player, I want to hide an entry, so that a correction I made never reaches the story.
10. As a player, I want to show a hidden entry again, so that I can change my mind before sending.
11. As a player, I want stat edits to arrive hidden, so that fixing a wrong value takes no extra step.
12. As a player, I want to show a stat edit with its old and new value, so that the narrator can tell a heal from a fix.
13. As a player, I want to undo the newest action, so that an accidental click is fully reversed.
14. As a player, I want undo to revert what the item's scripts and effects did, so that the game is exactly as it was before.
15. As a player, I want equipping and then unequipping the same item to leave nothing in the list, so that fiddling with gear is not a story event.
16. As a player, I want traveling somewhere and straight back to leave nothing in the list, so that a misclick on the map costs nothing.
17. As a player, I want three potions in a row to show as one row with ×3, so that the list stays short.
18. As a player, I want undo on a ×3 row to remove one use, so that I can take back just the last one.
19. As a player, I want a different action in between to start a new row, so that the order of events stays true.
20. As a player, I want to collapse the tray, so that it does not crowd the narration.
21. As a player, I want the tray header to count what the AI will be told and what is hidden, so that I can check it at a glance.
22. As a player, I want to send with an empty action box when the list has shown entries, so that drinking a potion and pressing Send is a whole turn.
23. As a player, I want the list to close when I send, so that the next turn starts with a clean list.
24. As a player, I want the sent page to show the actions that came before it, so that I can see why the story reacted.
25. As a player, I want hidden entries on a sent page marked as visible only to me, so that I know the AI never saw them.
26. As a player, I want the Inventory pass not to consume a second potion after I drank one from the panel, so that I do not lose items twice.
27. As a player, I want a typed "I drink another potion" after a hidden correction to still work, so that hidden entries never block real actions.
28. As a player, I want regenerating a turn to keep my panel actions, so that a regenerate never silently reverts them.
29. As a player, I want a regenerated turn's list to be editable again, so that I can hide or undo before resending.
30. As a player, I want a reload to keep the list and its undo, so that closing the game between turns loses nothing.
31. As a player, I want listed actions blocked while a turn runs, so that a change never lands in the middle of a turn.
32. As a player, I want each entry's icon to match the panel tab it came from, so that I can see where it happened.
33. As a player who edits prompts, I want to change the wrapper line the narrator sees, so that I can tune it for my model.
34. As a player who edits prompts, I want a reset for that wrapper line, so that I can return to the default.
35. As a world author, I want item scripts to run once for a listed action, never again when the narrator describes it, so that my effects do not stack.

## Implementation Decisions

**Action List module (new, pure).** A deep module with no React or game-state imports. It owns the list rules: add an action, collapse a repeat, treat an exact reversal of the newest entry as its undo, undo the newest repeat, toggle hidden, and close on send. It also writes each entry's line from facts and the shown-entry block for a request. Its interface takes plain action facts and opaque snapshot handles; the caller does the state work. The prototype's rules, trimmed:

```ts
// From the prototype: what makes an action the exact reversal of the newest entry (Q17).
const REVERSE = { equip: 'unequip', unequip: 'equip', drop: 'pickup', pickup: 'drop' };
const COLLAPSES = ['use', 'give', 'drop', 'pickup'];
function reverses(newest, next) {
  if (REVERSE[newest.kind] === next.kind) return same copy and target;
  if (both travel)  return newest.from === next.destination;
  if (both trait)   return same trait, opposite switch;
  if (both persona) return newest.from === next.persona;
}
// add: newest has count 1 and is reversed → restore its snapshot, drop it.
//      same kind, item and target as newest and kind collapses → count + 1, keep this snapshot too.
//      otherwise → new entry, hidden when it is a stat edit.
```

A collapsed row holds one snapshot per repeat (Q16), so a reversal only counts when the newest row has a count of 1.

**Entries.** A Listed Action records its kind, the subject (an item by key, quantity and result, a trait, location, persona or stat; Q28), the target where one exists (the receiving entity, the switch direction), the before value for travel, persona and stats, its count, its hidden flag, and one snapshot per repeat. The line text is not stored; the module writes it from these facts.

**Snapshots.** Each entry stores the full runtime state taken just before the action (the same shape the page snapshot uses). Undo restores it. Because undo is newest first, a restore never loses a later action. Persona is envelope-level state, so a persona entry's snapshot also holds the persona reference.

**Where actions enter.** The GameViewer handlers that commit inventory panel operations, trait toggles, travel and persona switches each take a snapshot first, run as today (scripts and effect settling included), then add the entry. Manual stat edits do the same for global and entity stats. The AI's own "Move to X?" suggestion and anything a turn does are not listed.

**Mid-turn block (Q13).** Every listed action is disabled while a turn runs. The inventory panel already is; trait toggles, travel, persona switch and stat edits join it.

**Narration request (Q8, Q10, Q19).** The narration pass appends a new piece, beside the Direction rider, in the thinking-off lane, when the list has shown entries: the preset's wrapper line followed by one code-written line per shown entry. History stores the bare action, so the block never accumulates. The wrapper is a new preset field shown in Prompts → Narration → Messages with its own reset, hidden when there is nothing to show. The anatomy marks the block as assembled context.

**Inventory pass guard (Q7, Q21, Q44, Q45, Q50).** The guard is code only; the pass request carries no line about listed actions. When the pass returns an operation that reports a shown inventory entry, it is dropped unit by unit up to the entry's count × quantity, with a diagnostic log line like other pass skips. Hidden entries are not guarded.

**Empty send (Q11).** Send is enabled with an empty action box when the list has at least one shown entry. The other passes receive the empty action as they do today (Q22).

**Turn record and regenerate (Q4, Q14, Q15, Q51–Q56).** On send, the closed list is stored as the turn's sent list, keyed by turn id, with its entries, their pre-action snapshots and the state at send. The page shows it under the action line. Regenerate restores the state at send, reopens the list as the live list and waits for Send. Chat resends at once from the state at send; page one keeps its old path. This replaces the current behavior where regenerate reverts panel changes.

**Save shape (Q12).** The live list (entries plus snapshots) is a new save field. The sent lists are a second field, keyed by turn id and pruned with the history. Both are additive; there is no compat code for unreleased forms.

**Tray UI (Q25, Q26, Q27).** The tray sits above the action box, beside the pending image thumbnails. Its header counts shown and hidden entries and toggles expand and collapse with an animation; the chevron points right when collapsed and down when expanded. Each row has the source tab's icon, the entry line, a hide toggle, and an undo on the newest row only. Hidden rows read as player-only. The sent page uses a compact read-only form. The design follows the Design System; the tray is a new visual pattern the user approved through the prototype. Player-facing copy ("Since Last Turn", "Only you", tooltips, the wrapper default) is written under the Writing Guide, not taken from the prototype.

## Testing Decisions

Good tests drive a seam's public behavior and assert observable results: the list a sequence of actions produces, the request text a turn sends, the operations a pass applies, the rows a player sees. None mirrors the module's internals. Each guard is proven by reinstating the bug it prevents (`test-bar` skill).

- **Action List module (new seam).** Sequences of actions in, list and snapshot handles out: collapse, a break in a run, every reversal kind, a reversal that is not the newest (no undo), undo of one repeat, hide toggles, stat entries hidden by default, close on send, and the entry lines.
- **Narration request (existing seam, narrationPrompt tests).** The block appears with shown entries only, in the thinking-off lane only, uses the preset wrapper, and never appears in history.
- **Inventory pass (existing seam, pass tests).** A pass `use` matching a shown entry is dropped; a second real use beyond the shown count still lands; a hidden entry guards nothing. Prior art: the self-sourced gain rule from Item Use and Identity.
- **Tray (existing GamePanels harness).** Rows, counts, hide and undo controls, the mid-turn block, empty send, and the sent page's read-only form.
- **Save round trip.** A save with a live list reloads with the same entries, and undo still restores.
- **Regenerate.** A regenerate keeps panel actions and reopens the list; this test fails on today's behavior.
- **Probes.** The wrapper line is a prompt change and the guard changes pass results; both ship with probe numbers (`probe` skill): the narrator reacts to shown entries, does not mention hidden ones, and the pass stops double consuming, each with in-batch controls.

## Out of Scope

- The Chat layout's version of the tray and the sent-page display. The prototype covered Pages only; Chat follows in its own ticket or effort.
- Telling the narrator with native thinking on (Q10).
- The empty-action digest gap (Q22).
- Undo beyond the newest entry, and undo after send.
- Listing script writes, AI-made changes, notes, memory edits, entity edits or character deletion.
- An author-side flag that marks items or traits as never listed.

## Further Notes

- ⚠️ **Save shape changes:** a new live-list field (`actionList`) and the sent lists (`sentActions`, the newest with its `after` state).
- New glossary entries for **Action List** and **Listed Action** go into `CONTEXT.md` with the first ticket.
- The prototype branch `prototype/action-list` and worktree stay for reference; its README holds the variant table.
