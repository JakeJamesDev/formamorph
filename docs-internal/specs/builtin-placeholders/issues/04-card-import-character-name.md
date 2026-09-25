# 04: Card Import Writes Character Name Chips

Status: ready-for-human
Base: 3931bb68
Blocked by: 02 — Character Name Resolves Live
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Built-in Placeholders](../spec.md)

**What to build:** Importing a SillyTavern card stores `{{char}}` as the Character Name token in the entity's AI description and its openings, in place of the name it writes today. Any spelling of either macro is canonicalized. The card's embedded lorebook keeps the current name replacement, because a dictionary entry has no owning entity. ST persona import keeps replacing `{{char}}` with "the other character".

Demo: import a card whose description says `{{char}} smiles`. The entity's description shows a Character Name chip. Rename the entity. In play, the AI context reads the new name.

Export shape: no field is added, but imported entity text now holds `{{char}}` where it held a name. An older app version shows the raw token. Say so in the response for the release version decision.

Workload: a contained change in two import modules with existing tests to extend.

- [x] Card import stores `{{char}}` in the AI description and openings, canonicalized from any spelling
- [x] The embedded lorebook still gets the character's name as plain text
- [x] ST persona import still writes "the other character"
- [x] Tavern card, character import, lorebook import and persona import tests cover each case, mutation-proven
- [x] Response carries the export-shape reminder
- [x] Changelog In-Progress entry appended (👤)
- [x] Four gates green; `graphify update .` run

## Comments

- 2026-09-25, implementer: before this ticket, the embedded lorebook did not write the name. It stored `{{char}}` as a token, which resolves to nothing with no owning entity. So "keeps the current name replacement" described no real behavior. The build follows story 21 and the acceptance line: the book now gets the name as plain text.
- Open product call: a standalone SillyTavern World Info import still stores `{{char}}`, which reads as nothing in play.
