# Spec: Formaquestion World Reading

Status: ready-for-agent
Spec session: formaquestion-world-reading — spec

## Problem Statement

Formaquestion answers from the bundled docs only. A player who asks about the world in front of them gets nothing useful. In the World Editor, an author who asks "why doesn't my Tool fire?" gets the Tools page but nothing about their own Tool. In the game, a player who asks "who was the woman at the gate?" or "what is the Ashen Pact?" gets a general-knowledge guess. The help request holds world text only through a Formaquestion Tool the player turns on, or through the code test on a code turn.

## Solution

Formaquestion reads the open world. Its lean follows the screen:

- **In the World Editor**, it explains how the world works. It searches every authored part of the world as it is on screen, unsaved edits included, beside the docs. Each world source links to its item in the editor.
- **In the game**, it explains the lore and story so far. It reads only what the player has met: the story so far, plus the player text of met entities, places and items, the visible stats and the player's traits, and the dictionary entries that fire on its own context. It never reads AI descriptions, hidden content or unmet content. It may say what it would try, as an opinion, never as a solution.

World reading is on by default. A switch in Formaquestion's settings turns it off.

## Rulings

Settled with the user on 2026-10-29 in the grill. Q20–Q27 came from a gap review of Q1–Q19.

| # | Ruling |
|---|---|
| Q1 | In game, Formaquestion reads the story so far and the authored text of entities, places and items the player has met |
| Q2 | The lean follows the screen: World Editor = how it works, game = lore so far. No player control picks it |
| Q3 | In the World Editor, one answer can draw on the docs and the world together |
| Q4 | Any world the app can open, community and Supporter-only worlds included |
| Q5 | A world-question case set on the bundled worlds, a baseline run, then the user sets the pass bar |
| Q6 | In game, the docs are used too |
| Q7 | On by default, with a switch in Formaquestion's settings |
| Q8 | The World Editor reads live editor state, unsaved edits included. Fall back to the last saved world only if performance is a problem |
| Q9 | In game, dictionary entries activate over Formaquestion's fed context, the same activation the narration uses. No save change |
| Q10 | In game, entities, places and items use their player description only, never the AI description |
| Q11 | In game, hidden stats, hidden traits and hidden item copies are skipped |
| Q12 | The dictionary scan includes the player's question, as narration scans the player's action |
| Q13 | Dictionary entries have AI text only; it is allowed in game. If entries gain a player-only text, that text replaces it |
| Q14 | In the World Editor, every dictionary entry is searchable, triggered or not |
| Q15 | In game, the story so far is built the way the narration builds it (narrowed by Q21) |
| Q16 | The World Editor index covers every authored part: entities, places, items, traits, stats and stat code, scripts, Tools, dictionaries and the world prompts |
| Q17 | World sources link to their item in the World Editor; in game they show as plain names |
| Q18 | In game, director-invented entities and runtime items count as met |
| Q19 | In game, Formaquestion may say what it would try, phrased as its opinion, never as the solution |
| Q20 | In game, Formaquestion Tools and the code test read the same Player View, not the full world |
| Q21 | The in-game story so far is milestone memories and recent turns. Diaries and script memory lines stay out |
| Q22 | In game, Formaquestion reads visible stats and the player's own traits. Hidden and disabled stats are skipped |
| Q23 | World rules go in a new prompt in the help preset file. A file without it loads with the built-in default |
| Q24 | World text has its own character budget beside the docs budget |
| Q25 | Text the AI wrote in play (invented entities, runtime items) counts as player text |
| Q26 | An item is met once the player has held it, or once a visible copy has been at a met place |
| Q27 | The case set also scores leaks and Q19 opinion phrasing, with editor and game cases scored apart |
| Q28 | Test seams: `askHelp`, one pure Player View builder, and a world-question probe |

## User Stories

### World Editor

1. As an author, I want to ask Formaquestion how a part of my world works, so that I get an answer about my world, not only the docs.
2. As an author, I want one answer to use the docs and my world together, so that "why doesn't my Tool fire?" covers both the Tools page and my Tool.
3. As an author, I want Formaquestion to read my unsaved edits, so that the answer matches what I see.
4. As an author, I want Formaquestion to explain what a script, a stat's code or a Tool does, so that I can debug logic I didn't write.
5. As an author, I want Formaquestion to find any dictionary entry by meaning, so that I don't have to know its keywords.
6. As an author, I want Formaquestion to explain the world prompts, so that I understand what the narrator is told.
7. As an author, I want each world source in an answer to open its item in the editor, so that I can jump to the thing being explained.
8. As an author, I want placeholders to show as I wrote them, so that an answer doesn't depend on a random roll.
9. As an author who opened a community world, I want to ask how it works, so that I can learn from other authors.
10. As an author, I want hidden stats, AI descriptions and hidden content explained in the editor, so that nothing in my own world is out of reach.

### In game

11. As a player, I want to ask who a character is, so that I can remember someone I met hours ago.
12. As a player, I want to ask what happened so far, so that I can pick up a save after a break.
13. As a player, I want to ask about a place I've been, so that I can recall what it was like.
14. As a player, I want to ask about an item I hold or saw, so that I know what it is.
15. As a player, I want to ask about a lore term from the story, so that the world's own entry explains it.
16. As a player, I want Formaquestion never to name a character I haven't met, so that the story isn't spoiled.
17. As a player, I want Formaquestion never to reveal a hidden stat, trait or item, so that the author's secrets hold.
18. As a player, I want Formaquestion never to quote an AI description, so that motives and twists stay hidden.
19. As a player, I want a character's private diary kept out of answers, so that what a character secretly thinks stays secret.
20. As a player, I want a character known only by an alias to stay under that alias, so that a reveal isn't spoiled.
21. As a player, I want characters and items that appeared during play to count, so that "who was that guard?" works.
22. As a player, I want to ask why a stat is low, so that I understand my own numbers.
23. As a player, I want to ask what Formaquestion would try next, so that I get an opinion when I'm stuck without being handed the answer.
24. As a player, I want app questions to still use the docs in game, so that "how do I use this item?" covers both the app and the item.
25. As a player, I want sources in game to be plain names, so that a click can't open an editor page full of spoilers.
26. As a player who undid a turn, I want Formaquestion to forget what the undone turn showed, so that the answer matches my current story.
27. As a player in an Open Chat world, I want the same met rules, so that a chat world doesn't leak either.

### Settings, presets and trust

28. As a player, I want world reading on without setup, so that it just works.
29. As a player, I want a switch to turn world reading off, so that I can keep world text out of help requests.
30. As a player, I want the settings to say that world text goes to my endpoint, so that I know what is sent.
31. As a player who edited Formaquestion's prompts, I want to edit the world rules too, so that I control how it treats world text.
32. As a player with an older help preset file, I want it to still load, so that my edits aren't lost.
33. As a player who writes in another language, I want world names kept as the world writes them, so that answers match the story.
34. As a player who asks a follow-up, I want Formaquestion to remember which world items the last answer used, so that "and her sister?" works.
35. As a player on a screen with no world open, I want docs-only answers as today, so that nothing changes there.
36. As a player who opens the in-game World Editor, I want the editor lean, so that the screen I see decides the answers.
37. As a player using a Formaquestion Tool in game, I want it to see only what I have met, so that my own Tools can't leak spoilers.
38. As a player who uses the code test in game, I want it to see only what I have met, so that a code turn doesn't send unmet names.

## Implementation Decisions

### Player View (Q1, Q10, Q11, Q18, Q20–Q22, Q25, Q26)

- A new pure module builds the **Player View**: it takes the authored world and the playthrough and returns only what the player has met, in player text. It is the one in-game filter; the help request, Formaquestion Tools and the code test all read it (Q20).
- **Entities:** met entities by id, plus discovered entities that the player did not delete. Player description only. An entity whose real name is not yet revealed appears under the alias the scene uses.
- **Places:** the current location and every location a past turn recorded. A turn without a recorded location adds nothing. Player description only; the legacy description field counts as player text where no player description exists.
- **Items:** an item is met once the player held it, or once a visible copy was at a met place. Hidden copies stay out until revealed. Runtime items use their description, which counts as player text (Q25).
- **Stats and traits:** visible stats and the player's own traits. Hidden stats, disabled stats, hidden traits and AI-only group headings are skipped.
- **Never in the Player View:** AI descriptions, AI summaries, diaries, script memory lines, unmet entities, places and items, and entity "known in" or persona-only data beyond what the met rules allow.
- The view reads the current snapshot, the history sliced to it and the earlier snapshots of its chain, so undo and rewind move it with the story.
- **Shape (ticket 01):** a narrow `PlayerView` type with id, name and player text per row and no AI field. Rows are keyed by the ticket 02 kinds (entity, location, item, stat, trait). Ticket 06 adapts it to the Tool Snapshot and the authored world.
- An item seen at a met place means a visible copy at the location the player stood at in that snapshot.
- An unrevealed entity shows its alias name only, with no description.
- Q25 applies only to AI-invented discovered records: no world entity id, and a source turn that is not the opening. Discovered records of authored entities (Enter World picks, bring-over visitors) use their player description.
- Stats show name, value, bounds and the band text the panel shows; a stat's description stays out. The player's stats are the global stats plus the played persona's own. Other entities' stats stay out.
- The player's traits are the active global traits plus the played persona's owned traits. Switched-off traits stay out.
- The played persona appears as the player. Persona-only entities not being played stay out.
- The builder takes a `resolve(text)` input, so text reads with the values the player sees.
- **Help snapshot in game (ticket 06):** only the help registration changes. Narration World Tools and Try It keep the full world. Entities keep only the names the player has seen, the revealed real name and the scene alias, and drop other authored aliases. Every enabled dictionary entry stays reachable by name (Q12); a Tool script's dictionary books carry their names and placeholders with an empty `entries` list, which ticket 05 fills with the entries the question fired. Recall memories hold digests only. Chips render from Player View rows. Script state and the code test's world hold visible stats and gate stats, met owners plus the persona, met locations and met item copies; placeholders and dictionaries are unchanged.
- The Tool Snapshot and the authored world that the game registers with the open-world registry become Player View-based. The World Editor keeps registering the full authored world. This revises ADR-0011's "authored world, no playthrough" in game; a new ADR records it.

### Story so far (Q15, Q21)

- In game, the story so far is milestone memories plus the recent verbatim turns, assembled the way the narration assembles them. Diaries and script memory lines are dropped.
- With memory digests off, the story so far is the recent turns only.

### Game request shape (ticket 05)

- Player View rows form a game World Index, ranked like the editor pool (keyword, its own pick request, semantic) under the world budget. Fired dictionary entries join ahead of ranked rows, inside the same budget, and take at most 3 of the 5 sections; keyword-fired entries rank ahead of semantic ones (ticket 10).
- The story so far is its own story block with its own 12,000-character budget, always sent in game, never ranked and never a source. It uses the narration's banded history (verbatim floor, milestone drop, oldest digest dropped first), without memory notes, rehydration, the now line or time stamps. With digests off, it holds the newest verbatim turns that fit.
- Scan corpus: the question, the Player View text and the story digests as scene sources; the story's verbatim turns as history, honoring each entry's scan depth. Semantic activation embeds the question, gated by the Semantic Lore setting. Script lore toggles and placeholders apply.
- Sources: the Player View rows that reached the block and each fired entry, as plain names.
- Read the World off, or a bare question: no world block, no story, no activation. Tools keep the Player View either way; their dictionary books are filled with the fired entries only when activation ran.
- The `worldGame` rider rides last, after the code rider.

### Dictionary in game (Q9, Q12, Q13)

- Formaquestion runs the narration's dictionary activation, keyword and semantic, over its own fed context: the story so far, the Player View text, and the player's question. Activated entries join the world block. Toggles that scripts set apply.
- Nothing new is saved.
- Entry text is used as is. A future player-only entry field replaces it.

### World index in the editor (Q3, Q8, Q14, Q16)

- A world index turns every authored part into sections in the docs-index shape: entities, places, items, traits, stats and their code, scripts, World Tools, dictionary entries and the world prompts. Placeholders stay as authored chips.
- The index rebuilds from live editor state when the world changes, debounced. If rebuilds cost too much on large worlds, fall back to the last saved world (Q8).
- One section per authored item: entity (both descriptions), location, item, trait, stat with its code, each script, each World Tool, each dictionary entry, each world prompt. An entity's own stats and traits are their own sections (ticket 04).
- The index rebuilds in under 50 ms on the largest bundled world, debounced 500 ms. Section embeddings are computed lazily at question time and cached by text hash. Switching to the last saved world (Q8) is a design change that needs a spec ruling, not runtime switching.
- **Q29 (user, 2026-10-29):** the world pool gets its own AI pick request, sent in parallel with the guide pick request, which stays byte-equal. One shared request dropped guide recall@5 from 81.9% to 78.3% with Emberwatch open (cloud, 5 runs per arm). Above 400 world sections, the world pick request is skipped and keyword and semantic ranking carry the world pool.
- The docs lookup function stays guide-only; the world block also rides in the lookup message. A bare question (every source off) sends no world block.
- The answer and lookup prompts keep today's text. The guide-only relaxation rides the `worldEditor` rider, and the closing grounding line names world sections only when a world block is present. Both budgets start at 12,000 characters and 5 sections until ticket 07 tunes them.
- The open-world registration gains `lean: 'editor' | 'game'`.
- World sections rank through the same keyword, AI pick and semantic sources as guide sections, as a second pool. Guide and world hits fill separate budgets (Q24); the baseline tunes both sizes.

### Request and prompts (Q2, Q6, Q19, Q23)

- The lean comes from the open-world registry: the newest registered world is either an editor world or a game world. The in-game World Editor registers over the game, so it gets the editor lean. No registered world means docs-only, as today.
- The request carries a world block beside the docs block. Game requests carry the docs too (Q6).
- The world rules join the help preset as two prompt keys, `worldEditor` and `worldGame`, each a plain rider like the code rider (ticket 03). `worldEditor` holds how-it-works; `worldGame` holds lore so far, opinion-not-solution and no speculation about unshown plot. The request sends only the key that matches its lean: ticket 04 sends `worldEditor`, ticket 05 sends `worldGame`. No probe ships with ticket 03; ticket 07's baseline measures both texts.
- The preset file carries the switch as a top-level `readWorld` boolean, applied to the device setting on import. A stored custom preset that lacks the new texts gets the built-in defaults, the same rule as the file.
- ⚠️ **Export shape:** the help preset file gains the world-rules prompt and the world-reading switch. The file has been in released builds since v3.2.0. The parser accepts a file without them and fills the built-in defaults; today it refuses a file that lacks any expected entry, so that rule changes for these two keys.
- The AI Language directive keeps world names as the world writes them.

### Sources and follow-ups (Q17)

- Sources gain a world-item kind beside guide sections: kind, id and display name. One union `sources` list holds both, with no separate world field (ticket 02).
- World-item kinds: entity, location, item, trait, stat, script, tool (a World Tool), dictionary, prompt. Later tickets may add kinds.
- The follow-up topic rule takes either kind. Docs-page favoring applies only when the topic is a guide section.
- The AI Context trace lists a world source as "<kind> · <name>", not clickable.
- In the editor, a world source opens its item, like Take Me There opens a docs target. In game, it is a plain name.
- Follow-up history, its topic rule and the AI Context trace carry world sources the same way they carry guide sections.

### Settings (Q7)

- A **Read the World** switch on Formaquestion's General tab, next to **Open Screen**, on by default, stored per device with the other help settings. Help line: "Sends the open world's text to your endpoint with each question".

### Docs and glossary

- The guide's Formaquestion page gains a section on world reading and its two leans.
- The CONTEXT.md Formaquestion entry changes: a request now carries world text from the open world, filtered to the Player View in game. Add **Player View** to the glossary.
- A new ADR records world reading and the Player View, and marks the in-game part of ADR-0011 as superseded.

## Testing Decisions

- Tests check behavior at a seam, not internals: what goes into the request body, and what the Player View holds. A leak guard must fail when its bug comes back (`test-bar` skill).
- **Player View builder (pure):** one test per met rule and per exclusion. Unmet entity absent; AI description absent; alias before reveal; discovered and deleted entities; places from turn records and the current location; items held, seen at a met place, hidden until revealed; hidden and disabled stats; diaries absent; undo moves the view back.
- **`askHelp`:** game world in → no unmet name or AI text in the body; editor world in → full world sections present; no world → body unchanged from today; switch off → no world block; dictionary entry fires on the question and on the story; separate budgets hold; world sources reach the answer's sources and the next follow-up. Prior art: the `helpSession.*.test.ts` family with `src/test/helpFixtures.ts`, and `helpSession.codeTest.test.ts` for the open-world wiring.
- **Formaquestion Tools and code test in game:** each reads the Player View. Prior art: `helpSession.codeTest.test.ts` and the Tool Snapshot tests.
- **Help preset file:** a file without the new keys loads with defaults; a file with them round-trips. Prior art: `helpPresetFile.test.ts`.
- **World-question probe (Q5, Q27):** a case set on the bundled worlds, editor and game cases scored apart, with three scores: grounded-correct, leak (unmet or hidden text in an answer) and opinion phrasing for "what would you try" cases. Game cases carry a save state at a fixed point in the story. Prior art: `help-baseline.cli.ts`, `help-baseline-score.ts`, `help-code-probe.cli.ts`. A baseline run comes first; the user sets the bar after it.
- **Probe design (ticket 07):** game saves are hand-written fixtures built through the real Player View and story builders. Arms: `shipped`, `off` (docs-only control), and on game cases `full` (the full world in place of the Player View, the leak control). Grounded-correct uses fixed answer keys of required facts, checked against a hand-graded sample. Leak means a distinctive hidden name or phrase appears in the answer; editor cases are not leak-scored. Opinion means a first-person hedge and no flat statement of the solution. The baseline records guide, world and story sizes per case and flags any case where a budget dropped content. Budget tuning is a later decision based on those numbers. Cloud default model first, per the probe skill.

## Out of Scope

- A player-only field for dictionary entries (Q13 only says what happens if one is added).
- A save record of fired dictionary entries or visited places.
- Hints or solutions in game beyond Q19's opinion.
- Formaquestion editing a world, a save or a setting. It still only answers.
- World reading on screens with no registered world (Main Menu, world previews, Test Bench).
- Images from the world in help requests.

## Further Notes

- The in-game help request shares the endpoint with turn requests. Single-slot local engines will queue it; not checked in code.
- Bundled worlds are small without images (about 56–110 KB of text), but imported lorebooks can hold thousands of entries, so the editor index must stay retrieval-based.
- Q20 changes what a Formaquestion Tool returns in game. A Tool that reads a hidden stat returns less in game than in the editor.
