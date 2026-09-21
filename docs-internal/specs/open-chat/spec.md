# Spec: Open Chat Default World

Status: ready-for-agent
Spec session: Chat Style Default World

## Problem Statement

A player who imports a SillyTavern card has no good place to use it. Every bundled world is an RPG with its own premise, stats, and locations. Those fight the scenario the card carries. The narration reads as an adventure, not as a conversation with the entity.

The parts that make a chat possible now exist: per-world prompt overrides, Openings, Persona, the Chat layout, and card import. No world puts them together.

## Solution

A new bundled default world named **Open Chat**. The world is a neutral harness. It has no premise, no stats, and one near-empty location. The picked entity and its dictionary carry the lore.

The world supplies its own narration prompt and choices prompt. The narrator stays in second person, but each reply centers the entity's speech and actions. Choices read as short replies in the player's voice.

The player tunes the chat with four exclusive trait groups: Reply Length, Prose Style, Narration Share, and Pacing. Each trait pins a tone placeholder that the narration prompt reads. A player who picks nothing gets the middle setting of each.

Version 1 ships without four SillyTavern parity items. They are listed under Out of Scope.

## User Stories

1. As a player, I want a bundled world made for chatting with a library entity, so that I can use an imported card without building a world.
2. As a player, I want the world to have no premise of its own, so that the card's scenario is the only scenario.
3. As a player, I want replies to center the entity's speech and actions, so that the playthrough feels like a conversation.
4. As a player, I want the narrator to stay in second person, so that imported greetings and later replies share one frame.
5. As a player, I want choices that read as things I could say or do next, so that a choice fits the conversation.
6. As a player, I want to pick a reply length, so that replies are as short or as long as I like.
7. As a player, I want to pick a prose style, so that the chat reads as casual messages or as novel prose.
8. As a player, I want to pick how much scene description surrounds the dialogue, so that I control the narration share.
9. As a player, I want to pick the pacing, so that the entity drives the scene or waits for me.
10. As a player, I want each tone group to allow one pick only, so that two settings never contradict.
11. As a player, I want a sane chat when I skip the tone picks, so that the world works with zero setup.
12. As a player, I want to switch a tone trait during play, so that I can tune the chat without a restart.
13. As a player, I want the entity's own opening to start the playthrough, so that an imported greeting is page one.
14. As a player, I want a neutral pre-filled action when the entity has no opening, so that the start never reads as an RPG scene.
15. As a player, I want to edit that pre-filled action before I submit it, so that my first line is my own.
16. As a player, I want to play as any of my personas or as None, so that the persona is my choice, as in SillyTavern.
17. As a player, I want the intro readme to tell me to pick or import an entity first, so that I do not enter an empty room by mistake.
18. As a player, I want the intro readme to explain the four tone groups, so that I know what each pick changes.
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
- The narration override starts from the built-in narration prompt and keeps its chips. Only the voice rules change. Memory, persona, dictionary, and language chips must stay.
- The narration voice is a dialogue-led second-person narrator. The entity is written in third person and addresses the player as "you". This is the same frame as an imported greeting.
- The override supports several picked entities but has no turn-taking rules.
- The choices override produces short replies or actions in the player's voice.
- Both prompts follow the prompt-writing guide: positive contract, generic examples only, no parrotable values.
- Sampler pins for narration and choices stay as they are. The world changes text only.

**Tone placeholders**

- Four world placeholders: reply length, prose style, narration share, pacing. Each holds one value, the middle setting. That value is the default when no trait pins it.
- Four exclusive trait groups, one per placeholder. Each trait carries one placeholder pin with a value typed off the list. The middle trait of each group pins the same text as the default.
- The narration override reads all four placeholders as chips. Each value is a full instruction sentence, so the prompt reads correctly with any pin.
- The traits change no stats. They exist only to carry pins.
- Ruling, 2026-09-21: ticket 07 added placeholder chips to world custom prompts, in the engine and the editor. The tone chips sit in the narration prompt, and the world system prompt is one neutral line.
- First build step: prove live that a pin with an off-list value masks a one-value placeholder. If it does not, use a multi-value placeholder with weight 0 on every non-default value.

**Readmes**

- The intro readme covers setup: pick or import an entity, pick a persona, and what each tone group does.
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

- **Seam 1, world content.** Load the bundled file through the world migration and run the Test Bench rule runner over it. Assert the exact set of findings, so each ticket must shrink it. The finished world has one: the info finding for a location with no entities, which is this world's design. Ticket 01 also lists the empty world system prompt (ticket 03 removes it) and the missing readme (ticket 05 removes it). No rule changes. Then assert the structural facts: zero stats, one location, both overrides present and enabled, Open player setting, one Player Action opening, four exclusive groups. Prior art: the default-world id tests and the Test Bench rule tests.
- **Seam 2, tone resolution.** Resolve the narration override text with no pins, then with each trait's pins. Assert the default equals the middle trait's result, and that every trait changes exactly its own placeholder. Assert no placeholder resolves to an empty string. Prior art: the placeholder pin tests.
- **Seam 3, turn plan.** Plan a turn with this world's counts and default settings. Assert that narration and choices are due, and that the stat-update pass and both location passes are absent. Do not assert the exact list: passes that a player setting drives, such as the memory digest, stay on and are not this world's concern. Prior art: the turn plan tests.
- **Probes.** A/B each override against the built-in prompt on both reference tiers, at least 2 runs per case, with one imported card as the fixture. Metrics: dialogue share of the reply, second-person frame held, reply length per tone setting, and choices in the player's voice. Run the guide's regression check on the other metrics. Record before and after numbers in the ticket.
- **Live check.** Seed on a clean profile and on an existing profile through the dev-router. Confirm the tile, the trait picker groups, and one full turn.
- Each new guard must fail when its bug returns, per the test bar.

## Out of Scope

- Example dialogue import from cards.
- Per-world switches that turn off the choices, planning, or stat requests.
- Depth injection and Character's Note import.
- A seeded default entity and an entity seeder.
- Prompt tuning for group chats.
- A world field that preselects the Chat layout.
- Any change to the card importer.
- The thumbnail art itself.

## Further Notes

- Research and the SillyTavern mapping live in `docs-internal/notes/chat-world-st-parity/notes.md`. Its status table predates Openings and Persona.
- The world cannot force the Chat layout, because the layout is a player setting. The readme is the only lever in version 1.
- The choices request is a player setting. A player who wants a pure SillyTavern feel turns choices off in Settings.
- An imported greeting already matches the narration frame. Do not treat it as a voice conflict.
- The version and the release are the user's. This spec adds Changelog In-Progress entries only.
