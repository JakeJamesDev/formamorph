# Spec: Open Chat Default World

Status: ready-for-agent
Spec session: Chat Style Default World

## Problem Statement

A player who imports a SillyTavern card has no good place to use it. Every bundled world is an RPG with its own premise, stats, and locations. Those fight the scenario the card carries. The narration reads as an adventure, not as a conversation with the entity.

The parts that make a chat possible now exist: per-world prompt overrides, Openings, Persona, the Chat layout, and card import. No world puts them together.

## Solution

A new bundled default world named **Open Chat**. The world is a neutral harness. It has no premise, no stats, and one near-empty location. The picked entity and its dictionary carry the lore.

The world supplies its own narration prompt and choices prompt. A reply is a chat message: the entity speaks in first person, as if it sent the message. There is no narrator and no scene prose. Choices are the messages the player could send back, with no quotation marks.

The player tunes the chat with three exclusive trait groups: Reply Length, Prose Style, and Pacing. Each trait pins a tone placeholder value that the narration prompt reads. The middle trait of each group is the default, so Quick Start and a skipped picker both give the middle setting.

**Revision 3, 2026-09-21.** Revision 2 (tickets 08-10) hardcoded the message frame in the prompt, so every Style pick read the same, and its own probe showed the frame rarely held. Revision 3 makes the **Style** trait carry the frame itself. Each Style trait pins three placeholders: the narration voice block, the choices shape, and the world opening text. The prompts hold context and the output contract only. Three styles: **Chat** (text messages, entity in first person, no narration), **Plain** (a narrated back-and-forth, entity in third person with quoted speech, the player's line as typed), and **Literary** (the built-in prompt's voice, second person, the player's action narrated first so the turns read as a novel without the player's input). Tickets 11-13 carry it.

**Revision 2, 2026-09-21.** The first build (tickets 01-07) shipped a dialogue-led second-person narrator with four groups. The user ruled on the output: it read as novel prose, not chat. Revision 2 replaces the voice with first-person messages, drops Narration Share, and fixes three defects: pins held literal text instead of a value id, no trait was the default, and the narration prompt kept the preset's length guidance beside the Reply Length chip. Tickets 08-10 carry the rework.

Version 1 ships without four SillyTavern parity items. They are listed under Out of Scope.

## User Stories

1. As a player, I want a bundled world made for chatting with a library entity, so that I can use an imported card without building a world.
2. As a player, I want the world to have no premise of its own, so that the card's scenario is the only scenario.
3. As a player, I want each reply to be a message the entity sends me in first person, so that the playthrough reads as a chat.
4. As a player, I want no narrator and no scene prose in a reply, so that nothing sits between me and the entity.
5. As a player, I want choices that read as messages I could send back, with no quotation marks, so that a choice reads as my next message.
6. As a player, I want to pick a reply length, so that replies are as short or as long as I like.
7. As a player, I want to pick a Style, so that a reply reads as text messages, as a narrated back-and-forth, or as a novel.
7a. As a player, I want the choices and the world opening to follow my Style, so that every surface of a turn has one shape.
7b. As a player, I want each Style to read clearly different from the other two, so that the pick means something.
8. As a player, I want a Quick Start to use the middle tone settings, so that a skipped picker still gives a sane chat.
9. As a player, I want to pick the pacing, so that the entity drives the conversation or waits for me.
10. As a player, I want each tone group to allow one pick only, so that two settings never contradict.
11. As a player, I want a sane chat when I skip the tone picks, so that the world works with zero setup.
12. As a player, I want to switch a tone trait during play, so that I can tune the chat without a restart.
13. As a player, I want the entity's own opening to start the playthrough, so that an imported greeting is page one.
14. As a player, I want a neutral pre-filled action when the entity has no opening, so that the start never reads as an RPG scene.
15. As a player, I want to edit that pre-filled action before I submit it, so that my first line is my own.
16. As a player, I want to play as any of my personas or as None, so that the persona is my choice, as in SillyTavern.
17. As a player, I want the intro readme to tell me to pick or import an entity first, so that I do not enter an empty room by mistake.
18. As a player, I want the intro readme to explain the three tone groups and to recommend one entity, so that I know what each pick changes.
19. As a player, I want the gameplay readme to name the Chat layout setting, so that I can find the layout made for this world.
20. As a player who enters with no entity, I want the narrator to still run, so that the playthrough does not break.
21. As a player, I want a turn to cost as few requests as possible, so that a chat is fast and cheap.
22. As a player, I want to decline the world's prompts with the existing per-world opt-out, so that my own preset still applies if I prefer it.
23. As a player, I want my dictionary entries to activate as they do in every world, so that imported lorebooks work.
24. As a player with an existing install, I want Open Chat to appear after the update, so that I do not reinstall to get it.
25. As a player, I want to delete Open Chat and have it stay deleted, so that it behaves like every other default world.
26. As a player, I want the world tile to have a thumbnail, so that it looks finished beside the other defaults.
27. As an author, I want to open Open Chat in the World Editor, so that I can read its prompts and copy the pattern.
28. As an author, I want the world to raise no Test Bench warning, so that it is a clean example.
29. As a player on a small model, I want the prompts to work on the average reference tier, so that the chat feel does not need a premium model.

## Implementation Decisions

**World content**

- The world is authored content plus one entry in the bundled default list. It adds no new world field. It uses existing fields only, so the exported world and save shape do not change.
- Zero stats. The turn plan skips the stat-update pass when the stat count is zero.
- One location with a near-empty description and no connections. Both location passes skip when there is nowhere to go.
- No authored entities and no dictionary.
- The world player setting is Open.
- One world Opening of kind Player Action with neutral text. Entity openings win over the world pool, as Openings already rules.
- The thumbnail slot ships empty. The user supplies the art before release.

**Prompts**

- The world sets a narration prompt override and a choices prompt override. It sets no stat-update override.
- Revision 3. The narration override holds no voice rules of its own. It holds the role line, the context chips (memory, persona, dictionary, notes, entities, location, language), the three tone chips, and the output contract (prose only, no menu, stop at the end). The **voice block** placeholder chip supplies the frame. The length guidance chip stays out; the Reply Length trait is the only length control.
- The three voice blocks, one per Style value. **Chat:** the entity replies as text messages in first person, no narration, no quotation marks, an action between asterisks if needed. **Plain:** a narrated back-and-forth; the entity is written in third person with its speech in quotation marks, the player's typed line stands as the turn's first beat and is not restated. **Literary:** the built-in narration prompt's voice rules; second person, the player's action narrated first as the turn's first beat, so the turns string together as a novel without the player's input.
- The choices override likewise holds no shape rules of its own. The **choice shape** placeholder chip supplies them. Chat: a choice is the bare message text, a deed between asterisks. Plain and Literary: a choice is a first-person line with the words in quotation marks (`I walk up and ask, "..."`), a deed as `I` and a verb. The list contract (3 to 5 lines, distinct, no lead-in) stays in the prompt.
- The world opening is one Player Action whose text is the **opening** placeholder chip. Chat pins a message-shaped greeting; Plain and Literary pin a narrated first-person line. An entity opening still wins and keeps the card's own shape.
- A voice block is multi-line prompt text. The first build step proves a multi-line placeholder value reaches the model intact through the chip render, in the narration prompt, the choices prompt, and the opening draw.
- The two-entity and no-entity cases are stated inside each voice block in one line each, as smoke cases. The readme recommends one entity.
- An imported greeting stays page one as is.
- Both prompts follow the prompt-writing guide: positive contract, generic examples only, no parrotable values.
- Sampler pins for narration and choices stay as they are. The world changes text only.

**Tone placeholders**

- Revision 3: five world placeholders. **Reply length** and **pacing** hold three values each, as before. The **Style** group's three traits each pin three placeholders: **voice block**, **choice shape**, and **opening**, each listing three values, one per style. A trait carries several pins already; no engine change.
- Three exclusive trait groups: Reply Length, Style (Chat, Plain, Literary), Pacing. Every pin names a listed value by its value id. The middle trait of each group is the default trait: Medium, Plain, Shared.
- Reply Length and Pacing values are written frame-neutral, so they read correctly under any Style. Reply Length counts brief, medium, or full replies, not messages or paragraphs.
- The narration override reads reply length, voice block, and pacing. The choices override reads choice shape. The world opening reads opening.
- The traits change no stats. They exist only to carry pins.
- Ruling, 2026-09-21: ticket 07 added placeholder chips to world custom prompts, in the engine and the editor. The tone chips sit in the narration prompt, and the world system prompt is one neutral line.
- Revision 1 used one-value placeholders with pins typed off the list. Ticket 02 proved that works, but a literal pin does not follow an author edit, and it left no trait as the default. Revision 2 replaces it.

**Readmes**

- The intro readme covers setup: pick or import one entity (more than one is not yet supported well), pick a persona, and what each tone group does.
- The gameplay readme covers play only: the Chat layout setting by its exact name, mid-game tone switching, and the bracket channel for direction.
- Copy follows the player-facing voice and UI terminology rules ("entity", never "character").

**Seeding**

- Open Chat joins the bundled default list with a stable id. The existing seeder and tombstones cover install, update, and delete.
- The bundled file passes through the world migration at load, as every default does.

**Docs**

- One Changelog In-Progress entry under Added, player bucket.
- The published world list in the docs gains Open Chat, if such a list exists.

## Testing Decisions

A good test here reads the bundled world the way the app does and asserts what a player would see. It does not restate the JSON.

- **Seam 1, world content.** Load the bundled file through the world migration and run the Test Bench rule runner over it. Assert the exact set of findings, so each ticket must shrink it. The finished world has one: the info finding for a location with no entities, which is this world's design. Ticket 01 also lists the empty world system prompt (ticket 03 removes it) and the missing readme (ticket 05 removes it). No rule changes. Then assert the structural facts: zero stats, one location, both overrides present and enabled, Open player setting, one Player Action opening, three exclusive groups with one default trait each, every pin carrying a value id that its placeholder lists. Prior art: the default-world id tests and the Test Bench rule tests.
- **Seam 2, tone resolution.** Resolve the narration override text with no pins, then with each trait's pins. Assert the default-trait set resolves to the middle values, that every trait changes exactly its own placeholder, and that no placeholder resolves to an empty string. Assert the rendered narration prompt holds no length guidance text. Prior art: the placeholder pin tests.
- **Seam 3, turn plan.** Plan a turn with this world's counts and default settings. Assert that narration and choices are due, and that the stat-update pass and both location passes are absent. Do not assert the exact list: passes that a player setting drives, such as the memory digest, stay on and are not this world's concern. Prior art: the turn plan tests.
- **Seam 2b, style resolution (revision 3).** Resolve the rendered narration prompt, the rendered choices prompt, and the drawn world opening under each Style trait. Assert each differs from the other two, that no chip resolves empty, and that a multi-line value keeps its lines. Prior art: the tone-resolution test.
- **Probes, revision 3.** Three arms per tier, one per Style, at least 2 runs per case, one imported card as the fixture, both overrides and the opening in context. Distinctness metrics per reply: quotation marks present, grammatical person of the entity (first or third), the player's line restated or not. Each style must differ from the other two on at least one metric, on both tiers. Same for choices: bare message versus quoted first-person line. Revision 2 is the baseline for Chat.
- **Probes, revision 2 (superseded).** A/B each override against the built-in prompt on both reference tiers, at least 2 runs per case, with one imported card as the fixture. Metrics for revision 2: first-person message held (no narrator sentences, no third-person reference to the entity, no quotation marks around the message), reply length per Reply Length setting, and for choices: no quotation marks, no "I say" lead, message-shaped lines. The revision 1 arm (the shipped prompt) is the baseline. Run the guide's regression check on the other metrics. Record before and after numbers in the ticket.
- **Live check.** Seed on a clean profile and on an existing profile through the dev-router. Confirm the tile, the trait picker groups, and one full turn.
- Each new guard must fail when its bug returns, per the test bar.

## Out of Scope

- Example dialogue import from cards.
- Per-world switches that turn off the choices, planning, or stat requests.
- Depth injection and Character's Note import.
- A seeded default entity and an entity seeder.
- Prompt tuning for group chats. Name-prefixed messages are a smoke case only; real support is later work.
- App changes for the message voice. The message is plain prose to the app, and the Chat layout shows it as is.
- A world field that preselects the Chat layout.
- Any change to the card importer.
- The thumbnail art itself.

## Further Notes

- Research and the SillyTavern mapping live in `docs-internal/notes/chat-world-st-parity/notes.md`. Its status table predates Openings and Persona.
- The world cannot force the Chat layout, because the layout is a player setting. The readme is the only lever in version 1.
- The choices request is a player setting. A player who wants a pure SillyTavern feel turns choices off in Settings.
- An imported greeting already matches the narration frame. Do not treat it as a voice conflict.
- The version and the release are the user's. This spec adds Changelog In-Progress entries only.
