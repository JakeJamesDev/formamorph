# Persona

Status: ready-for-agent
Spec session: Persona

## Problem Statement

The player has no identity in Formamorph. No name exists, and no description exists. Prompts call the player "the player" and narrate to "You". Traits, stats, and Player Notes are the only player data, and traits belong to one world.

This blocks three things:

- A player who comes from SillyTavern cannot bring the persona they wrote there. An imported character card loses every `{{user}}` reference, because the importer rewrites it to "the player".
- A player cannot say who they are one time and use that in every world.
- An author cannot let the player play as one of the world's own entities.

The staged planner also matches cast members against a player-name list. That list holds trait names today, because no player name exists.

## Solution

A **Persona** is an entity that fills the player slot for a playthrough. It is not a new record type. It is an entity with a Persona mark.

- A player makes personas in the Entities library. The tab filters on the mark.
- An author marks world entities as playable. A marked world entity is a persona of that world.
- The player picks a persona, or None, when they enter a world. They can change it in game from the side panel.
- A `<PERSONA>` chip carries the persona into each prompt that writes, plans, or refers to the player.
- A reserved Player Name chip lets authored text and imported cards say the player's name.
- SillyTavern personas import from ST's backup file, with their avatar images.

## User Stories

### Library personas

1. As a player, I want to mark a library entity as a persona, so that I can play as it in any world.
2. As a player, I want a filter in the Entities tab that shows only personas, so that I find them among my other entities.
3. As a player, I want to edit a persona in the same editor as any entity, so that I learn one editor.
4. As a player, I want a persona to hold a name, aliases, a description, a short summary, pronouns, and a portrait, so that the AI knows who I am.
5. As a player, I want to set one persona as my global default, so that new worlds start with it selected.
6. As a player, I want each world to remember the persona I last used there, so that I do not pick again on every entry.
7. As a player, I want a world's remembered pick to win over my global default, so that my per-world choice holds.
8. As a player, I want to export a persona as an entity card and import it again, so that I can move it between devices.
9. As a player, I want a shared persona to arrive as a persona, so that I do not mark it again.
10. As a player, I want to turn an entity I already have into a persona with one action, so that I do not retype it.

### Pronouns

11. As an author, I want a pronouns field on every entity, so that third-person passes stop guessing.
12. As a player, I want my persona's pronouns to reach digests and diaries, so that they refer to me correctly.

### Entering a world

13. As a player, I want a Persona category in the enter-world workspace step, so that I pick who I am before play starts.
14. As a player, I want a None choice, so that I can play a world as its author wrote the player.
15. As a player, I want the picker to show each persona's portrait and name, so that I recognize it quickly.
16. As a player, I want the picker to list the world's own personas apart from my library personas, so that I see what the author offers.
17. As a player, I want Quick Start to use the world's remembered pick, then my global default, so that a fast entry still has a persona.
18. As a player, I want the persona category hidden when no persona is available, so that the step stays short.

### World personas

19. As an author, I want to mark a world entity as playable, so that the player can play as it.
20. As an author, I want only marked entities to be playable, so that I vouch for how each one reads from the player's side.
21. As a player, I want the entity I play to leave the cast for that playthrough, so that I never meet myself.
22. As a player, I want the entities of the world to know my world persona from turn one, so that they do not treat a known person as a stranger.
23. As a player, I want the starting location preselected to one of my world persona's locations when that location is a starting location, so that I start where that entity lives.
24. As a player, I want to change that preselected location, so that the choice stays mine.
25. As an author, I want relationships that point at a played entity to point at the player, so that the authored ties hold.

### Author control

26. As an author, I want a world setting with three values, Open, Fixed, and Cast, so that I control who the player can be.
27. As an author of a world that defines the player, I want Fixed to preselect None and keep Quick Start at None, so that a global default does not override my player.
28. As an author, I want Cast to limit the picker to my world's personas and preselect the first, so that the player is always one of my cast.
29. As a player, I want to pick a persona in a Fixed world anyway, so that the author's setting guides and does not block me.

### One entity, one role

30. As a player, I want a marked library entity to show in both the character list and the persona picker, so that I can use it either way.
31. As a player, I want an entity I pick as my persona removed from the characters for that playthrough, so that one name means one identity.

### In game

32. As a player, I want a persona row in the side panel beside Notes and Traits, so that my own data sits together.
33. As a player, I want a Change control there, so that I can change my persona mid-playthrough.
34. As a player with a save made before this feature, I want to attach a persona to it, so that old saves gain the feature.
35. As a player, I want an edit to a persona to reach every save that uses it, so that I fix a description one time.
36. As a player, I want a save to remember None, so that loading it never applies my default persona.
37. As a player, I want one notice when a save's persona is missing from my library, so that I know why the playthrough runs without one.
38. As a player who switches away from a world persona, I want that entity to return to the cast, so that the world stays complete.

### Prompts

39. As a prompt author, I want a `<PERSONA>` chip with Full, Summary, and Name variants and the format axis, so that I place the persona at the detail each prompt needs.
40. As a prompt author, I want the chip to be affixable, so that an empty persona removes its own header.
41. As a player, I want the default prompts to carry the chip, so that the feature works without prompt edits.
42. As a player, I want narration to stay in second person, so that the persona does not change the voice of the game.
43. As a player with a library persona, I want entities to use my name only after they learn it, so that strangers act as strangers.
44. As an author, I want my world's prompt override to state that an entity knows the player, so that a chat world behaves as ST cards assume.
45. As a player, I want the staged planner to recognize my persona's name and aliases as me, so that the director never casts me as a separate character.
46. As a player, I want scene image tags to read my persona's description, so that pictures of the scene show me correctly.

### Player Name chip

47. As an author, I want a Player Name chip in world, entity, and dictionary text fields, so that authored text can say the player's name.
48. As a player with no persona, I want that chip to read "the player", so that text stays correct.
49. As a player, I want an imported card's `{{user}}` to become the Player Name chip, so that the card addresses my persona by name.
50. As a player, I want an imported lorebook's `{{user}}` to become the same chip, so that lore reads the same way.

### Placeholders

51. As a player, I want my library persona's own placeholders to resolve in play, so that a persona with chips renders complete text.
52. As a player, I want those placeholders rolled one time per playthrough, so that my persona stays stable across turns.

### SillyTavern import

53. As an ST user, I want to import ST's persona backup file, so that all my personas arrive in one action.
54. As an ST user, I want to pick my avatar image files with the backup file, so that each persona gets its portrait.
55. As an ST user, I want a persona with no matching image to get the initials placeholder, so that the import never fails on a missing file.
56. As an ST user, I want `{{user}}` in a persona description to become that persona's own name, so that the text reads correctly here.
57. As an ST user, I want `{{char}}` in a persona description to become "the other character", so that no raw macro remains.
58. As an ST user, I want ST's default persona to become my global default when I have none, so that my setup carries over.
59. As an ST user, I want a report of what the import skipped, so that I know what to fix by hand.

## Implementation Decisions

### The record

- A Persona is an Entity with a boolean Persona mark. No new record type, store, editor, or library tab exists.
- The mark means one thing in two places. On a library entity it means "this is one of my personas". On a world entity it means "the player can play as this entity".
- Every entity gains an optional pronouns field. It is free text. The entity context builder renders it for every entity, not only personas.
- The entity editor shows the mark and the pronouns field in both the World Editor and the library editor.
- "Convert entity to persona" is the act of setting the mark. No copy is made.

### The persona reference

- The save stores a persona reference with three states: a world entity id, a library entity id, or an explicit None. An absent reference means the save predates the feature and has no persona.
- The reference sits on the save envelope beside the dictionary set chosen at world entry. It does not roll back with turns.
- Persona content is read live. A world persona reads from the authored world. A library persona reads from the entity library at load and when the library changes.
- This differs from library entities added as characters, which are copied into the save. The rule is: a character is a frozen copy, a persona is a live read. The spec states this so that a later reader does not unify them by accident.
- A reference that no longer resolves gives no persona and raises one notice per load.

### One module owns persona resolution

- A new pure module resolves the persona and filters the cast. It takes the save's reference, the authored world's entities, and the library entities. It returns the resolved persona or none, and the cast without the played entity.
- Every reader of the entity list goes through this module: the roster chip, the prose parse for entity participation, diaries, discovery matching, scene tags, the staged planner's cast, and the in-game entity panel. No reader applies its own filter.
- The same module supplies the player-name list for cast classification: the persona's name and aliases. Trait names leave that list.
- Gameplay never writes the authored world. The cast filter is a runtime view.

### Defaults and memory

- The global default persona and the per-world remembered pick are device-local settings. Neither is exported.
- The global default names a library entity only. A per-world pick can name a world entity, a library entity, or None.
- Preselect order at enter-world and for Quick Start: the world's remembered pick, then the rule of the world's player setting, then the global default.

### The world's player setting

- The world overview gains one setting with three values. Open is the default and is the meaning of an absent value.
- Open: any persona. Preselect follows the order above.
- Fixed: None is preselected, and Quick Start uses None, unless the player made a pick in that world before. The player can still pick.
- Cast: the picker lists only the world's own personas and preselects the first. None is not offered. A Cast world with no marked entity behaves as Fixed.

### Enter-world

- The workspace step gains a Persona category. It shows when at least one persona is available for that world under the world's player setting.
- A library entity picked as the persona is removed from the added characters for that playthrough. The picker and the character list enforce this in both directions.
- Picking a world persona preselects the starting location to the first of that entity's locations that is a starting location. The player can change it. No pick is forced.
- The pick travels to the game the same way the chosen dictionaries and added characters do.

### In game

- The side panel shows the persona's portrait and name beside Notes and Traits, with a Change control that opens the same picker.
- A change rewrites the save's persona reference. It obeys the world's player setting and the one-role rule.
- Digests and diaries written before a change keep the earlier name. No re-attribution runs.

### The Persona chip

- `<PERSONA>` joins the shared context chips. It has a detail axis with Full, Summary, and Name, plus the shared format axis. It is affixable.
- Full and Summary reuse the entity context builder, so a persona renders as one entity block: name, aliases, pronouns, description. Name renders the name and pronouns only.
- For a world persona, the chip adds one line that states the other entities of this world know this person. A library persona gets no such line.
- Default preset coverage:

| Prompt | Variant |
|---|---|
| narration, thinking, director, storyboard, character, scenetags | Full |
| choices, summary, milestone, diary | Name |
| statupdates, location, discover, time passed, time opening | none |

- In each default prompt the chip sits in the stable block beside Traits and above Location. The persona does not change during a playthrough, so this position protects the prefill cache.
- The narration prompt keeps second person and keeps the learned-name rule. The rule's wording extends to cover the persona's name. A world prompt override can state that an entity knows the player.
- Chip presence is read through the template parser, never by substring.
- Hard cutover, as with earlier chips: a custom preset or a world prompt override gets no persona until its author adds the chip.

### The Player Name chip

- A reserved built-in chip resolves at render time to the persona's name, or to "the player" when no persona is set.
- It lives beside the placeholder grammar as a fixed token that needs no definition, no Roll, and no home. The placeholder resolver resolves it in the same pass as authored chips, so every text that already resolves placeholders gains it.
- World, entity, and dictionary text fields offer it in the chip menu.
- The character card importer and the lorebook importer write it where they wrote "the player" before.
- Text that holds the chip and is read by an older app version shows the raw token. That is the cost of the shape change.

### Library persona placeholders

- A library persona can carry placeholders of its own. The authored world's Placeholder Set does not hold them.
- When a library persona is set, the session's Placeholder Set is the world's list plus the persona's own list. Rolls for the persona's Wildcards are drawn when the persona is set and are stored with the playthrough's other Rolls.
- A change of persona draws Rolls for the new persona and leaves the old Rolls in place, so a switch back is stable.

### SillyTavern persona import

- A pure converter reads ST's persona backup JSON: a map from avatar filename to name, a map from avatar filename to description data, and a default persona key.
- The import accepts the JSON file plus any number of image files in one pick. An image matches a persona when its filename equals the persona's key.
- Each persona becomes a marked library entity with a fresh id. A matched image becomes the portrait through the existing image pipeline. An unmatched persona gets the initials placeholder.
- In descriptions, `{{user}}` becomes the persona's own name as plain text. `{{char}}` becomes "the other character". Other macros stay as written.
- ST's position, depth, role, and title fields are dropped. ST's default persona becomes the global default only when none is set.
- The import reports each skipped or imageless persona.
- The entry point sits in the Entities tab's import control and dispatches on file type, as the character file import does.

### Export-shape changes

Each of these is additive, and each needs the user's sign-off at build time. None carries a version bump or a migration from this spec.

| Shape | Change |
|---|---|
| Entity, in worlds, cards, and listings | Persona mark, pronouns |
| World overview | The player setting |
| Save envelope | The persona reference |
| World, entity, and dictionary text | The reserved Player Name chip |

### Prompt text changes

The Persona chip placement, the known-person line, and the extended name rule are AI-call text changes. They follow the prompt writing guide and ship with probe numbers on both reference tiers. No example names appear in any prompt.

### Dev reachability

The enter-world Persona category and the side-panel picker get dev-router coverage so that one call reaches each.

## Testing Decisions

A good test here states a playthrough's inputs and asserts what the player or the AI receives. It does not assert which helper ran.

- **Persona resolution module.** The main seam, pure and table-driven. Cases: world reference, library reference, None, absent, and a reference that no longer resolves. Cast filter cases: a played world entity leaves the cast at every one of its locations, a library persona never enters it, and a switch returns the entity. Player-name list cases: name plus aliases, and no trait names. Prior art: the entity presence and runtime character tests.
- **Reader coverage guard.** One test lists the entity readers and proves each takes its cast from the module. The guard must fail when a reader reads the raw entity list. Prove it by pointing one reader at the raw list and watching it fail.
- **Preselect rules.** Pure tests over the world's player setting, the remembered pick, and the global default, for both the step and Quick Start. Include Cast with no marked entity.
- **Persona chip.** Builder tests for each detail and format variant, the known-person line for world personas only, and the empty render with affixes. Prior art: the entity context builder tests and the template round-trip tests.
- **Player Name chip.** Resolver tests: persona set, no persona, and a text that mixes it with authored chips. Importer tests assert that `{{user}}` becomes the chip.
- **AI context, end to end.** The Test Bench's AI-context builder is the highest existing seam for "what the model sees". Tests there assert the persona appears in the prompts of the coverage table and is absent from the rest, and that a played world entity is absent from the roster.
- **Library persona placeholders.** Tests assert that a persona's own Wildcard resolves in play, keeps one Roll across turns, and keeps it across a switch away and back.
- **ST import converter.** Pure tests over a fixture backup: name and description mapping, macro rewrites, filename matching, the missing-image path, the default persona rule, and a malformed file. Prior art: the lorebook import tests and the tavern card tests. Fixture names come from the repo's neutral set.
- **Enter-world and side panel.** Component tests through the existing enter-world tests and the game panels harness: the category shows and hides, the one-role rule holds in both directions, the location preselect applies and stays editable, and a Change writes the reference.
- **Save round trip.** A save with each reference state loads to the same state. A save with no reference loads with no persona and no notice.

Motion and timing are never asserted. UI checks use the dev-router and static DOM evidence.

## Out of Scope

- Greeting and example dialogue fields, depth injection, per-world request toggles, and the chat world itself. Each is a separate effort on the ST parity list.
- A link between a persona and the player's Avatar, and any use of the entity's own 3D model or sound for the player.
- The persona portrait inside the game beyond the side-panel row.
- ST's persona title, position, depth, and lock rules.
- Re-attribution of earlier digests and diaries after a persona change.
- Export of personas in ST's format. Interop stays one-way in.
- Rewriting authored entity text that names "the player" as a separate person. The author owns that text when they set the mark.
- Any version bump, migration, or changelog finalization.

## Further Notes

- **New glossary term.** Persona: the entity that fills the player slot for a playthrough, from the library or from the world's marked entities. Avoid "player character" and "user". The domain glossary should gain this entry when the work starts.
- The decisions in this spec come from a recorded interview, questions 1 to 27. The earlier ST parity research stays the reference for how ST composes its prompt.
- ST facts were read live on 2026-09-18 from the SillyTavern docs repository and the persona script on the release branch. The backup file holds no images, which is why the import takes image files beside it.
- The staged planner's player-name list holds trait names today. Moving it to the persona's name is a behavior change for playthroughs with no persona: the list becomes empty there.
- **The Openings spec meets this one in three places.**
  - Openings keeps ST's user macro in stored opening text and shows it as "you", to wait for a player-name feature. The Player Name chip is that feature. Its stored form must be the form Openings writes, so that one import serves both. Whichever effort builds second adopts the first one's form.
  - A played entity is out of the cast, so its openings leave the opening pool for that playthrough. The persona resolution module's cast is the list the opening draw reads.
  - Openings adds tabs to the entity editor. The Persona mark and the pronouns field land in the same editor. Sequence those tickets so that two sessions do not edit it at one time.
- A suggested ticket order: the entity fields and the resolution module first, then the chip and default prompts with probes, then enter-world and the side panel, then the Player Name chip, then library persona placeholders, then the ST import.
