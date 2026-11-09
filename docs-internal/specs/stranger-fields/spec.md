# Spec: Stranger Fields

Status: done
Status note: Closed 2026-11-09, tickets 01–04, last landing 0549ea06c. Review: spec text corrected. Closed red: lint errors in a peer's uncommitted UsageTab.tsx and worlds-wip; tests failed in MainMenu.cudaNotice, EventFormDialog, CodeArea, CodeArea.cards, RemoteWorldDetailsModal.changelog, none in this effort.
Spec session: stranger-fields — spec

## Problem Statement

The Stranger Name and Stranger Description sit below the entity's picture on the Profile tab, away from the fields they replace. An author has to look in two places to see what a player sees before and after meeting an entity.

A Stranger Description does nothing without a Stranger Name. An entity with no Stranger Name starts met, so the player never sees that description. An author can't make a character whose name the player knows but whose look the player doesn't know yet.

Items put Unidentified Name and Unidentified Description at the end of the Descriptions tab, in a different place again. Their hints sit inline, while the Stranger Name has a help button.

## Solution

Each replacement field sits next to the field it replaces, on entities and items alike.

- **Stranger Name** sits next to **Name** in a split column. **Unidentified Name** does the same on items. The two fields stack when the pane is narrow.
- **Stranger Description** sits directly under **Player-Facing Description** on the Descriptions tab. **Unidentified Description** does the same on items. Both always show.
- Each of the four fields has its own help button. Their inline hints move into the help topics.
- An entity starts unmet when it has a Stranger Name or a Stranger Description, the same rule items use. With only a Stranger Description, the player and the AI see the real Name. The player sees the Stranger Description in place of the Player-Facing Description until they meet the entity.

## User Stories

1. As a world author, I want Stranger Name next to Name, so that I see both names an entity can show at a glance.
2. As a world author, I want Stranger Description directly under Player-Facing Description, so that I compare the before and after text in one place.
3. As a world author, I want Stranger Description to show even when Stranger Name is blank, so that I can write a description-only stranger.
4. As a world author, I want an entity with only a Stranger Description to start unmet, so that the player learns its look only on meeting it.
5. As a world author, I want an entity with only a Stranger Description to keep its real Name for the player, so that a famous character can be known by name but not by sight.
6. As a world author, I want the AI to see nothing new for a description-only stranger, so that the narration names the character as usual.
7. As a world author, I want relationships and Known In to meet a description-only stranger at the start, so that the start rule works the same for every unmet entity.
8. As a world author, I want a description-only stranger met by the same rule as any stranger, narration naming it while present or a script calling `meet()`, so that I have one meeting rule to learn.
9. As a world author, I want the Name and Stranger Name inputs to line up on one row, so that the split column looks tidy.
10. As a world author, I want the two name fields to stack when the pane is narrow, so that each keeps room for placeholder chips.
11. As a world author, I want a help button on Stranger Name, so that I can read how strangers and meeting work.
12. As a world author, I want a separate help button on Stranger Description, so that I can read what it replaces and when it shows.
13. As a world author, I want my Stranger Description kept when I clear Stranger Name, so that I never lose text by surprise.
14. As a world author, I want Unidentified Name next to the item's Name, so that items and entities share one layout.
15. As a world author, I want Unidentified Description directly under the item's Player-Facing Description, so that items and entities share one layout.
16. As a world author, I want help buttons on Unidentified Name and Unidentified Description, so that items and entities share one way to explain these fields.
17. As a world author, I want search and Reveal Origin to open the tab where each moved field now lives, so that a search hit lands on the field.
18. As a world author in Simple mode, I want the entity Profile tab unchanged, so that Simple mode stays simple.
19. As a library author, I want the library entity editor unchanged, so that fields that mean nothing outside a world stay hidden.
20. As a player, I want a description-only stranger to show its real Name in the scene list, so that I recognize a character I have heard of.
21. As a player, I want a description-only stranger to open in the Stranger view under its real Name, so that I see the look the author wrote for a first meeting.
22. As a player, I want the normal description once I meet the entity, so that I see what I learned.
23. As a player asking Formaquestion, I want a description-only stranger to show its real Name and the Stranger Description, so that the help window never spoils a look I haven't seen.
24. As a player of an existing world, I want entities that have a Stranger Name to behave as before, so that my saves and worlds keep working.

## Implementation Decisions

**Layout (rulings Q1, Q2, Q4, Q5, Q8)**
- The Profile tab's identity fields put Stranger Name in a second column beside Name. The columns split only when the pane has room and stack otherwise. The split follows the editor's existing pane-width approach, not the viewport.
- The Stranger fields keep their gate: Advanced mode, World Editor only (Q7). Elsewhere, Name stays full width.
- The Descriptions tab renders Stranger Description directly after Player-Facing Description and before the AI-Facing fields. The item editor does the same for Unidentified Description. Neither depends on its partner field (Q8, and the reversal of Q4's condition); Stranger Description keeps the Q7 gate.
- Unidentified Name leaves the Descriptions tab and joins the item's Name in the same split column.
- The entity and item field-to-tab maps for search and Reveal Origin move `strangerName` to Profile, `strangerDescription` to Descriptions, and `unidentifiedName` to the item's main tab.

**Help (Q2, Q6, Q9)**
- The `worldEditor.strangerName` topic splits into a Stranger Name topic and a new Stranger Description topic. Unidentified Name and Unidentified Description get new topics.
- Inline hints on these four fields go away. Their content moves into the topics, written per `docs/Writing-Guide.md`.
- Each new topic carries a wiki page and anchor. The wiki pages for entities and items get matching sections.

**Data (Q3)**
- Clearing a field never clears its partner. A blank field is stored as absent, as today.
- The world and save shapes do not change.

**Runtime (Q11–Q14)**
- The Presence module gains a predicate for "has a stranger face": a Stranger Name that is set (even one that resolves blank, as today) or a non-blank Stranger Description. It mirrors the item rule for an unidentified face. A second predicate says whether the entity hides its Name (a Stranger Name is set).
- Presence carries a **known** set: the Met set plus each unmet entity that does not hide its Name. The map roster, the Formaquestion Player World and the trait tree read it (Q15, Q16).
- The start rule's first case changes from "no Stranger Name" to "no stranger face". Relationships, Known In and runtime characters still meet the entity at the start.
- An unmet entity's label stays: latest story alias, else Stranger Name, else nothing, for entities with a Stranger Name. An unmet entity with only a Stranger Description takes its real Name as its label. The story never gives it an alias.
- The prompts' stranger reveal stays limited to entities with a Stranger Name, so the AI sees nothing new (Q12).
- The meeting rule stays: the narration names the entity while it is at the player's location, or a script calls `meet()` (Q13). It already matches by real Name for every entity.
- Opening an unmet description-only entity opens the Stranger view under its real Name, showing the Stranger Description (Q14).
- The Formaquestion Player World lists a description-only unmet entity by its real Name with the Stranger Description.

**Inventory pass (Q17–Q19)**
- The Inventory pass matches an owner by Name, by any Alias with placeholders resolved, and by Stranger Name or story alias, met or not. A Name wins; a name two owners share matches no one. The owner list on the turn stays `{ id, name }`.

**Glossary**
- `CONTEXT.md`: **Stranger** becomes an unmet entity with a Stranger Name or a Stranger Description. Only one with a Stranger Name hides its true name. **Met**'s first start case becomes "It has neither a Stranger Name nor a Stranger Description." **Met** also says the map and the Help window list the Met set plus each unmet entity with no Stranger Name.

## Testing Decisions

A good test drives a public seam with a world and a play state, and asserts what the player or author sees. It never asserts a helper's internals.

- **Presence module** (`presence.test.ts`): a description-only entity starts unmet; relationships and Known In still meet it; its label is its real Name; the story never stores an alias for it; narration naming it while present meets it. A Stranger Name entity keeps today's behavior. Prior art: the existing start-rule and label cases there.
- **World Editor render tests** (`WorldEditor.itemNames.test.tsx`, `EntityFields.stranger.test.tsx`; the tab maps in `entityPanelTabs.test.ts` and `worldSearch.test.ts`): field order per tab, Stranger Description shown with a blank Stranger Name, one help button per field, and Reveal Origin landing on the new tab. Prior art: the label lists in those files.
- **Stranger view** (`StrangerModal.test.tsx`, `GamePanels.test.tsx`): a description-only stranger shows its real Name and the Stranger Description; after meeting, the normal panel shows.
- **Formaquestion Player World** (`playerView.test.ts`, `playerViewWorld.test.ts`): a description-only unmet entity appears under its real Name with the Stranger Description, never the Player-Facing Description. Prior art: `playerViewUnidentified.test.ts`.
- Each runtime guard is proven by reinstating the old start rule and watching its test fail.

## Out of Scope

- Showing the Stranger fields in Simple mode or the library entity editor.
- Any change to how the AI is told about strangers.
- New meeting triggers.
- Migrating worlds: no stored shape changes.

## Further Notes

- The reveal for a description-only stranger can come fast, since the narrator knows the Name and may use it on the first turn. The author accepts that (Q13).
- The help topics and the wiki sections are user-facing copy: run `copy-sweep` on them.
- The changelog entry belongs under Added, for description-only strangers; the layout move rides in the same entry.

## Rulings

- **Q1** Name and Stranger Name split when the pane has room and stack when narrow. Items match (Q5).
- **Q2** The Stranger Name hint moves into its help topic so the inputs line up.
- **Q3** Clearing Stranger Name keeps the Stranger Description saved.
- **Q4** Stranger Description sits directly under Player-Facing Description. Its "only with a Stranger Name" condition was reversed: it always shows.
- **Q5** Items match the entity layout in this effort.
- **Q6** The Stranger help topic splits per field; Stranger Description gets its own (?).
- **Q7** The Stranger fields keep their gate: Advanced mode, World Editor only.
- **Q8** Unidentified Description always shows.
- **Q9** Unidentified Name and Unidentified Description each get a (?) topic; their hints move in.
- **Q10** Void: Stranger Description always shows.
- **Q11** An entity starts unmet with a Stranger Name or a non-blank Stranger Description; the start rule still meets it.
- **Q12** A description-only unmet entity shows its real Name to the player and the AI.
- **Q13** The meeting rule is unchanged.
- **Q14** A description-only unmet entity opens in the Stranger view under its real Name.
- **Q15** (from Q12) A description-only unmet entity counts as known on every roster of people the player knows, the Formaquestion Player World included. It is listed wherever a met entity would be, under its real Name, with the Stranger Description.
- **Q16** (from Q12) The map roster shows a description-only unmet entity under its real Name. Unmet only decides which description shows and which view opens.
- **Q17** (moved in from NPC Schedules Q30) The Inventory pass resolves an owner by Name, by any Alias with placeholders resolved, and, for an unmet stranger, by its label. Ticket 04.
- **Q18** (ticket 04) Owner aliases are never stored on the turn. A re-roll rebuilds them live from the stored owner ids, so the save shape stays the same. An unmet stranger matches by both its Stranger Name and its latest story alias. The Inventory chip's printed owner names are out of scope.
- **Q19** (ticket 04, replaces Q18's "while unmet") The Inventory pass matches an entity's Stranger Name and its recorded story alias whether or not the player has met it. A Name wins, and a name two owners share matches no one. The pass reads no met state, so a re-roll after a meeting still resolves.
- **Q20** (ticket 03) World search indexes Stranger Name and Stranger Description, chip-capable, only when the world is in Advanced mode, the same gate the fields have.
