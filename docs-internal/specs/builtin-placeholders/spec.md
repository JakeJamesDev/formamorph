# Built-in Placeholders

Status: ready-for-agent
Spec session: builtin-placeholders — spec

## Problem Statement

Authors can write `{{user}}` to name the player, but only if they already know the SillyTavern shorthand. The placeholder palette shows a **Player Name** chip, but with no heading. So it looks like one of the author's own placeholders, and nothing says that the author cannot edit or delete it.

`{{char}}` has no chip. Card import replaces it with the entity's name as plain text. When the author renames the entity later, the old name stays in its descriptions and openings.

In the code, Player Name is a list of exceptions. About 28 call sites outside the user-macro module check for the token one at a time: the chip pattern, and the label, hint, color, known-token, fixed and preview branches. Each new macro would add another set of branches.

## Solution

Formamorph gets **Built-in Placeholders**. These are placeholders that every world has, that no author creates, and that resolve from the playthrough, not from authored values. There are two at launch:

| Built-in | Stored token | Resolves to |
|---|---|---|
| Player Name | `{{user}}` | The persona's name. With no persona: "you" in openings, "the player" in reference text, with a capital at a sentence start |
| Character Name | `{{char}}` | The resolved name of the entity that owns the text, read live |

The stored tokens keep the SillyTavern spelling, so pasted and imported ST text works with no translation, and saved data does not change shape.

The palette strip and the `{` typeahead show a **Built-in** section at the top, with a heading. Its chips look different from author placeholders and have no World/Unique pop-out. Their hint says what the chip becomes. Character Name appears only in text that belongs to one entity. The typeahead finds each Built-in by its label ("Player Name") and by its raw spelling (`{user`, `{char`).

## User Stories

1. As an author, I want a Built-in section in the palette strip, so that I learn the player's name can go into text without knowing the ST shorthand.
2. As an author, I want the Built-in section to have a heading, so that I can tell these chips apart from placeholders I made.
3. As an author, I want Built-in chips to look different from my own placeholders, so that I don't expect to edit their values.
4. As an author, I want the Built-in section above my own placeholders, so that the two chips I use most are always in the same place.
5. As an author, I want to type `{player` and find Player Name, so that I can insert it by what it means.
6. As an author coming from SillyTavern, I want to type `{user` and find Player Name, so that my muscle memory works.
7. As an author coming from SillyTavern, I want to type `{char` and find Character Name, so that my muscle memory works.
8. ~~As an author, I want to type `{{user}}` by hand and see it become a Player Name chip, so that typed and inserted chips are the same.~~ Dropped: the chip editor does not do this today (see Further Notes).
9. As an author, I want to paste ST text that contains `{{char}}` into an entity field and see a Character Name chip, so that pasted cards work.
10. As an author, I want Character Name in an entity's descriptions, summary and openings, so that the text names its own entity.
11. As an author, I want Character Name absent from world text, location text and dictionary entries, so that I never place a chip that has no entity to name.
12. As an author, I want a Character Name chip to show the entity's current name after I rename the entity, so that my text never goes stale.
13. As an author, I want a Character Name chip to show the resolved name when the entity's name holds a placeholder, so that the text agrees with the name the player sees.
14. As an author, I want the Built-in chip's hint to say what it becomes with a persona and with none, so that I can predict the output.
15. As an author, I want no World/Unique pop-out on a Built-in chip, so that I'm not offered a choice that means nothing for it.
16. As an author, I want the Preview tab to show a Player Name chip by its label, so that I can see where the name will go.
16a. As an author, I want the Preview tab in an entity's fields to show a Character Name chip as that entity's current name, so that the preview reads as the text will.
17. As an author, I want Built-ins to stay out of the Placeholders tab tree, so that the tree lists only what I can edit.
18. As an author, I want Built-ins to stay out of prompt fields, so that I use the Persona variable there until the prompt path can render them correctly.
19. As an author, I want an entity card I export to keep its Character Name chips, so that the card still names itself after another author renames it.
20. As a player importing an ST card, I want `{{char}}` in the description and first messages to become Character Name chips, so that renaming the imported entity updates its text.
21. As a player importing an ST card, I want `{{char}}` in its embedded lorebook to become the character's name as plain text, so that the lorebook entries still make sense when separated from the entity.
22. As a player importing an ST persona, I want `{{char}}` in the persona description to keep reading "the other character", so that the persona does not name itself.
23. As a player, I want Character Name in an entity opening to render as that entity's name, so that the first message reads correctly.
24. As a player with a persona, I want Player Name to render as my persona's name, so that the story uses my name.
25. As a player with no persona, I want Player Name to render as "you" in openings and "the player" in AI-read text, so that the text still reads correctly.
26. As a player, I want the AI context and the displayed text to agree on both names, so that the story stays consistent.
27. As a developer, I want one registry that lists every Built-in with its label, token, accent, visibility rule, hint and resolver, so that a new Built-in is one row, not a set of branches.
28. As a developer, I want the placeholder chip pattern built from the registry, so that parsing picks up a new Built-in with no change.

## Implementation Decisions

- **Built-in registry.** A new pure module owns the list of Built-ins. Each row has: an id, the label, the canonical stored token, a pattern that matches every accepted spelling (any case, inner spaces), extra search terms for the typeahead, an accent, a visibility rule for which fields offer it, a hint, and a resolver.
- **The user-macro module folds into the registry.** Its render rule (persona name, possessive kept, "you"/"the player", capital at a sentence start) becomes the Player Name resolver. Its callers read the registry.
- **Resolver contract.** A resolver gets the text around the token and a render context: the persona name, the text kind (opening or reference), and the owning entity's resolved name. The text around the token is what the capital rule needs.
- **Resolve options gain the owning entity.** The placeholder resolve options already carry the player. They gain an optional character, which is the resolved name of the entity that owns the text. With no character, a Character Name chip resolves to an empty string, like a missing placeholder.
- **Resolve order.** Author placeholders resolve first, then Built-ins. This matches how Player Name renders today. The entity's own name resolves before it fills Character Name.
- **One entity-text seam.** The resolved-world hook resolves entity names and aliases only. Entity descriptions and summaries resolve at each consumer through a bare text resolver, which knows no owner. The hook gains one helper that takes the entity and its text and resolves with that entity as the character. Every consumer of entity text goes through it: the AI-context build, the entity modal, the game panels, the opening pool at Enter World, and the Test Bench opening path. Opening pool rows already carry the owning entity id.
- **Two pin bindings, one core (ticket 02 ruling).** The helper is a pure core that takes the entity, its text and the resolve options. The resolved-world hook binds it to live pins. The view-scoped placeholder resolver binds the same core to view pins, so the entity modal on a paged-back turn still reads that turn's pins. "One seam" means one core, not one hook.
- **AI-side consumers found in ticket 02.** The staged character pass and the tool snapshot send entity summary and description with no resolution today, so raw chips reach the AI. Both go through the core: the chip-scene adapters, live and authored, pre-resolve entity text per owner, as they already do for trait text. The persona picker row is the one game-panel consumer; location text is unchanged.
- **Edge rules.** A Character Name chip inside an entity's own name has no owner yet, so it resolves to an empty string. A persona entity that carries the chip resolves to the persona's own name.
- **Editor Preview.** Player Name previews as its label: the editor has no persona. Character Name previews as the owning entity's current name when the field sits in an entity editor, which knows the name (user ruling 2026-09-26, ticket 05). The name goes through the same preview draw as the text, so a chip inside it previews as its drawn value. This holds for every field that offers Character Name, including an entity's openings in the World tab's Openings panel (ticket 05 ruling). Outside an entity-owned field, and for an empty name, the label shows.
- **Chip vocabulary.** The placeholder chip vocabulary takes Built-in rows from the registry. It replaces every special case for the user macro in label, hint, color, known-token, fixed, and accept-from-palette checks. The palette returns the Built-in rows first, under a **Built-in** section heading, before the loose author placeholders.
- **Visibility.** Player Name shows in every placeholder field that shows it today, and stays hidden in prompt fields. Character Name shows only when the field's owner is an entity. A field's owner can also be a dictionary book, and a book never shows Character Name. The vocabulary reads the owner's kind from the placeholder owners list.
- **Label surfaces.** Five read-only surfaces name the user macro by hand today: editor search, placement letters, stat-code names, the world prompt chip walk, and the Preview value map. Each reads the label from one registry helper instead, and each gets Character Name with no further change.
- **Typeahead matching.** A chip row can carry extra search terms. The typeahead matches the query against the label and those terms. Built-ins list their raw spelling (`user`, `char`) as a term.
- **Stored form.** Tokens are stored in their canonical spelling (`{{user}}`, `{{char}}`). Import and paste canonicalize any other spelling. Nothing that is already stored gets rewritten.
- **Card import.** Character Name chips are written into entity-owned text: the AI description and the openings. The embedded lorebook keeps the current name replacement, because a dictionary entry has no owning entity. ST persona import keeps "the other character".
- **Not a placeholder record.** Built-ins do not become records in the world's placeholder list. They have no id in the save's rolls, no pins and no parts.
- **Export shape.** No field is added. Entity text can now hold `{{char}}`, where import used to write the name. An older app version would show `{{char}}` as raw text. Flag this at release for the version decision.

## Testing Decisions

- A good test calls the public function and checks the output text or the rows. It does not check which helper ran. Each new guard must be proven by a mutation: break the rule, see the test fail, then restore it.
- **Resolve.** Test `resolvePlaceholders` with the owning entity in the options. Cases: Character Name renders the entity's current name; a placeholder inside the entity name resolves before it fills the chip; no owner gives an empty string; a chip inside the entity's own name gives an empty string; Player Name keeps every current render case. Prior art: the placeholder resolve tests and the user-macro render tests.
- **Entity-text seam.** Test the resolved-world hook's entity-text helper: an entity description with Character Name reads the entity's resolved name, and a renamed entity reads its new name. Prior art: the resolved-world player-name hook tests.
- **Label surfaces.** Each of the five label surfaces gets one Character Name case beside its Player Name case. Prior art: the existing Player Name case in each module's tests.
- **Vocabulary.** Test the placeholder chip vocabulary. Cases: the palette has the Built-in section first with its heading; Character Name shows only with an owner; prompt fields show no Built-ins; label, hint and color come from the registry; the typeahead row filter matches "Player", `user` and `char`. Prior art: the chip vocabulary tests.
- **Import.** Test card import. Cases: `{{char}}` in the description and first messages is stored as the Character Name token; the embedded lorebook gets the name; any spelling of either macro is canonicalized. Prior art: the tavern card, character import and lorebook import tests, and the ST persona import tests for "the other character".
- The existing user-macro tests move with the render rule and keep their cases.

## Out of Scope

- Built-ins in prompt fields. That needs the prompt template render to give a resolver the text around its token. It is a separate change, and it would lift the Player Name restriction in world custom prompts.
- Other ST macros (time, date, random, input). The registry makes each one a row later.
- Rewriting stored text. Entities imported before this change keep the name as plain text.
- A Built-in row in the Placeholders tab tree.
- Character Name in location, world or dictionary text, including an owner-by-reference rule for dictionaries attached to an entity.

## Further Notes

- Story 8, checked live on 2026-09-25 (ticket 01): a hand-typed `{{user}}` in an entity's AI-Facing Description stays plain text. It stays plain after a Preview/Edit round trip. Preview shows it as "Player Name", so the stored value holds the token. The editor has no text transform that turns typed tokens into chips, so the story is dropped. A stored token still loads as a chip, because the chip parse matches it.
- Finding for story 9: a pasted `{{user}}` in the same field also stays plain text. `PromptTokenPastePlugin` turns pasted tokens into chips, but `PromptField` mounts it only when the vocabulary has a header, which means prompt fields only. So a pasted `{{char}}` in entity text will not become a chip unless that plugin also mounts on placeholder fields.

- Glossary: "Built-in Placeholder" is a new term for `CONTEXT.md`. It is a Placeholder that every world has, that has no values, and that resolves from the playthrough.
- Related specs: `open-chat` ticket 07 explains why Player Name is not offered in custom prompts. `persona` defines the Player Name chip as the stored `{{user}}` marker.
