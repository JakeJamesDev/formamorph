# Spec: Openings

Status: ready-for-agent
Spec session: First Message

## Problem Statement

A world opens one way. The author writes a single opening cue, the player submits it, and the AI writes page one. The author cannot offer several openings, cannot write page one by hand, and cannot let an entity bring its own opening into a world.

SillyTavern character cards depend on a hand-written first message. That message sets the style and length the model copies for the rest of the chat. The card importer drops it, together with every alternate greeting, because an entity has no place to keep it. An imported card therefore never opens the way its author intended.

## Solution

A world and every entity carry a weighted list of **Openings**. Each opening is one of two kinds, named by where its text lands:

| Kind | What it does |
|---|---|
| **Opening Action** | Fills the player's input box at Start Game. The player can edit it, submits it, and the AI writes page one from it. This is what the opening cue does today. |
| **Opening Narration** | Is page one. The text shows at once, exactly as written, and no narration request goes out. |

At world start the app draws one opening by weight. Page-one regenerate draws again and does not repeat an opening in the same session.

The pool is read at draw time and never copied:

- Entities the player picks at Enter World come first. If any picked entity has openings, the draw uses only those.
- Otherwise the pool is the world's own openings plus the openings of authored entities present at the chosen starting location.
- If the pool is empty, the shipped default Opening Action applies, as it does today.

SillyTavern import turns the first message and each alternate greeting into an Opening Narration on the entity.

Both entity editors take the same tab layout, and both gain an **Openings** tab. The World Editor's opening panel becomes a mirrored list: it shows and edits every opening in the world, grouped by owner, under one on/off switch.

## User Stories

### Authoring openings on a world

1. As a world author, I want to write several openings for my world, so that a new playthrough does not always start the same way.
2. As a world author, I want to set each opening to open as a Player Action or as Narration, so that I choose whether the AI writes page one or I do.
3. As a world author, I want to write page one by hand as an Opening Narration, so that the first page sets the exact tone, style, and length I want.
4. As a world author, I want a draw weight on each opening, so that some openings come up more often than others.
5. As a world author, I want to see each opening's chance beside its weight, so that I understand the draw without doing arithmetic.
6. As a world author, I want weight 0 to keep an opening without drawing it, so that I can bench a draft without deleting it.
7. As a world author, I want one switch that turns the whole list off and keeps the text, so that I can draft openings and enable the feature when I am ready.
8. As a world author, I want an empty list to say that the default opening applies and to show its text, so that I know what the player gets before I write anything.
9. As a world author, I want placeholder chips to work inside an opening, so that rolled values appear in page one the same way they appear in other world text.
10. As a world author, I want editor search and replace to reach every opening, so that a rename covers them.
11. As a world author, I want my existing single opening cue to become the first row of the list, so that my world opens as it did before.
12. As a world author whose cue was switched off, I want the list switch to start off with my text kept, so that the change does not alter how my world opens.

### Authoring openings on an entity

13. As a world author, I want an entity to carry its own openings, so that an entity can start the scene in its own voice.
14. As a world author, I want an entity's openings to count only when the entity is at the player's starting location, so that nobody greets the player from another place.
15. As a world author, I want the world's opening panel to list every authored entity's openings beside the world's own, grouped by owner, so that I manage all of them in one place.
16. As a world author, I want to edit an entity's opening from the world panel, so that I do not open each entity to change one line.
17. As a world author, I want the world panel to mark an entity that is at no starting location, so that I see why its openings never come up.
18. As a world author, I want the world switch to cover entity openings too, so that one control disables the feature for my world.
19. As an entity author, I want an Openings tab in the library entity editor, so that a shared entity brings its openings wherever it goes.
20. As an entity author, I want both entity editors to use the same Profile, Descriptions, Openings, and Placeholders tabs, so that I learn the layout once.
21. As an entity author, I want the library editor to keep its Overview tab for publish information, so that tags and listing details stay apart from the entity itself.
22. As an entity author, I want openings to travel in the exported entity card and in a published listing, so that players who download my entity get them.
23. As an entity author, I want an opening's chips to resolve after import into another world, so that the text reads correctly away from home.

### Importing SillyTavern cards

24. As a player, I want a SillyTavern card's first message imported as an Opening Narration, so that the card opens the way its author wrote it.
25. As a player, I want each alternate greeting imported as its own Opening Narration at equal weight, so that regenerate works like a greeting swipe.
26. As a player, I want the card's name macro replaced with the entity's name in openings, so that page one reads naturally.
27. As a player, I want the user macro kept in the stored text and shown as "you", so that page one reads well now and a later player-name feature can fill it in without a second import.
28. As a player, I want a card with no first message to import exactly as before, so that nothing breaks for plain cards.

### Starting a world

29. As a player, I want page one to appear at once when the draw is an Opening Narration, so that I start by replying and not by pressing submit on text I did not write.
30. As a player, I want the input box empty and ready after an Opening Narration, so that my first action is my own.
31. As a player, I want choices, stat updates, scene tags, the opening hour, and every other post-narration step to run on a written page one, so that the game state after page one matches any other page.
32. As a player, I want read-aloud and the scene image to work on a written page one, so that the first page is not a lesser page.
33. As a player, I want an Opening Action to behave exactly as the cue does today, so that nothing I know changes.
34. As a player who picks a library entity at Enter World, I want that entity's openings to win over the world's, so that the entity I chose opens the scene.
35. As a player who picks several entities, I want one opening drawn from all of them by weight, so that any of them can start.
36. As a player who picks an entity with no openings, I want the world's own pool to apply, so that the world still opens as its author intended.
37. As a player, I want a picked entity's openings to work even when the world's list is switched off, so that the author's draft switch does not cancel my choice.
38. As a player using Quick Start, I want the draw to happen with no extra step, so that Quick Start stays one press.
39. As a player loading a save, I want no draw and no change to my history, so that loading stays loading.

### Regenerating page one

40. As a player, I want page-one regenerate on an Opening Narration to draw a different opening, so that I can swipe through the openings on offer.
41. As a player, I want regenerate to avoid openings I already saw this session until all have been shown, so that each press shows something new.
42. As a player, I want a regenerate that draws an Opening Action to return me to the filled input box, so that both kinds work from the same button.
43. As a player in a pool of one Opening Narration, I want regenerate to leave page one as it is, so that the button does no harm.
44. As a player who reloads, I accept that the no-repeat memory starts over, so that saves stay the same shape.

### Checking the work

45. As a world author, I want the Test Bench opening lens to show an Opening Narration as page one with no prompt, so that the bench tells the truth about what the player gets.
46. As a world author, I want the Test Bench to show which openings are in the pool for a chosen starting location, so that I can check the location gate.

## Implementation Decisions

### Data

- An **Opening** has a stable id, its text, and its kind. The kind is Player Action or Narration.
- An owner carries an ordered list of openings and a weight map keyed by opening id. A missing weight counts as 1, and weight 0 benches the row. This is the Placeholder weight model, reused on purpose so the two read the same in the editor and in data.
- Owners are the world overview and each entity. Entities have no switch of their own.
- The world overview carries one openings switch. Absent means on.
- The old single cue and its switch leave the world shape. `migrateWorld` moves the cue into the list as one Player Action opening. A cue that was switched off sets the openings switch to off and keeps the row. The step is idempotent.
- The entity card file and the published entity listing carry the entity's openings and weights. Card import restores them under fresh ids, as it does for entity-owned placeholders.
- No save shape change. The no-repeat memory is session state.

> **Export shape:** this changes the world export, the entity record, and the entity card file. The migration and any version change are timed by the project owner against a real release.

### The Openings module

One new pure module owns every rule. It has no React and no storage.

- **Pool:** given the world overview, the authored entities, the chosen starting location, and the picked entities, it returns the rows that can be drawn. Picked entities with at least one drawable row replace the world pool. The world switch removes the world's rows and the authored entities' rows, and never the picked entities' rows.
- **Draw:** given a pool, a shown set, and a random source, it returns one opening by weight from the rows not yet shown. When every row has been shown, the shown set starts over. An empty pool returns the shipped default Player Action.
- **Editor view:** given the world, it returns all openings grouped by owner, with the computed chance for each row and a flag for an entity that is at no starting location.
- Entity presence at a location is read through the existing entity presence helper, per ADR-0003.
- The existing opening cue resolver keeps its role as the single place every fallback reads. It resolves through this module.

### Starting and regenerating

- The draw happens in the new-game seed step, after traits, the starting location, and the picked entities are in place. It resolves chips against the opening pins, as the cue does today.
- **Player Action:** unchanged. The text pre-fills the input box and the player submits.
- **Narration:** the game starts at once. The turn runs through the Turn Pipeline with the narration text supplied as material. The narration pass makes no request. Every post-narration pass runs, and the result lands through the normal Turn Commit. No second commit path is added.
- History keeps the hidden start message before a written page one, so a request never begins on an assistant message.
- Page one appears through the normal page rendering. It does not imitate streaming.
- **Regenerate:** page-one regenerate draws again with the session's shown set. A Narration result replaces page one through the same path. A Player Action result returns the game to the not-started state with the box filled, which is today's behavior. A loaded save starts with an empty shown set and rebuilds the pool from the world plus the entities seeded at the initial turn.

### Import

- The SillyTavern importer reads the first message and the alternate greetings. Each becomes a Narration opening at weight 1, in card order. Blank entries are skipped.
- The name macro becomes the entity's name. The user macro stays in the stored text. At draw time it renders as "you".
- Description fields keep today's macro handling. Only openings keep the user macro.

### Editors

- **First ticket, no data change:** the library entity editor takes the World Editor's organization. Both editors show Profile, Descriptions, and Placeholders. The library editor keeps Overview, which holds publish information only. The field bodies stay shared.
- Both editors then gain an **Openings** tab. Each row has the text field with chip support, an **Opens As** toggle with the values **Player Action** and **Narration**, the weight, and the computed chance. The multiline weighted-value rows from the Placeholder editor are the model for the row.
- The World Editor's opening panel becomes the mirrored list. It shows the world's rows first, then one group per authored entity. Edits write to the owner. The panel holds the world switch. The empty state names the default opening and shows its text read-only.
- The find bar reaches every opening on every owner and opens the correct tab.
- New tabs get dev-router entries.

### Terms

- **Opening**, **Opening Action**, **Opening Narration**, and **Opens As** are the user-facing terms. "Cue" and "scripted" do not appear in the UI or the docs. The domain glossary gains these entries.
- An entity is always "entity" in copy, never "character".

## Testing Decisions

A good test here checks what an author or a player can observe: which opening is drawn, what page one holds, which requests go out, and what a file contains after a round trip. It does not assert internal state or call order.

| Seam | What it proves | Prior art |
|---|---|---|
| The Openings module | Pool rules, the starting-location gate, picked-entity priority, the world switch, weights, weight 0, the empty pool, and no-repeat draws with a seeded random source | The opening cue resolver tests; the Placeholder draw and weight tests |
| The Turn Pipeline, through its request adapter and derivation callback | An Opening Narration turn sends no narration request, runs every post-narration pass, and produces a Turn Commit whose page one is the authored text | The pipeline runner tests and the parity inputs |
| `migrateWorld` | The old cue becomes one Player Action row, a switched-off cue sets the switch off, and a second run changes nothing | The existing migration tests |
| The SillyTavern importer | First message and alternate greetings become Narration rows in order, macros are handled as decided, and a card without them imports as before | The existing importer tests |
| The entity card round trip | Openings and weights survive export and import under fresh ids | The existing entity file tests |
| The world Openings panel and the shared entity tabs | Rows group by owner, an edit in the panel changes the entity, the switch and the empty state render, and both editors show the same tabs | The World Details and entity editor component tests |
| The Test Bench opening lens | A Narration opening shows as page one with no prompt, and the pool follows the chosen starting location | The existing opening lens tests |

Every guard is proven by reinstating the fault once and seeing the test fail. The draw tests use a seeded random source, never a mocked global. No test is shaped so that a rule cannot fire.

## Out of Scope

- The player name and the resolution of the user macro. Another session owns that spec.
- Example dialogue from a card.
- Depth injection, such as a character's note or an author's note.
- Card-level prompt overrides and post-history instructions.
- A per-world control that turns off the choices, stat, or location requests.
- The chat world and the seeded default entity.
- A player opt-out from written openings.
- A player-facing opening picker at Enter World.
- Keeping the no-repeat memory on the save.
- Card formats other than PNG, and export to the SillyTavern format.

## Further Notes

- **Follow-up:** when the player-name spec lands, the stored user macro resolves to the player's name. No second import is needed, which is why import keeps the marker.
- Five points were put to the project owner as assumptions and drew no objection: the world switch does not block picked entities; the world panel lists all authored entities and marks those at no starting location; history keeps the hidden start message before a written page one; the Test Bench shows a written page one with no prompt; and the items above stay out of scope. Any of them can be reopened before tickets are cut.
- The older Opening Cue spec describes the single-cue feature this work replaces. Its resolver rule still holds: every fallback site reads one function.
- This work is the first of the SillyTavern parity gaps recorded in the chat world research notes. The order agreed there is the first message, then example dialogue, then the request toggles.
- A changelog entry goes in the In Progress section under the author-facing bucket.

## Comments
