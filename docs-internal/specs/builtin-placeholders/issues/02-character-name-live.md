# 02: Character Name Resolves Live

Status: ready-for-agent
Blocked by: 01 — Built-in Registry Replaces the User-Macro Special Cases
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Built-in Placeholders](../spec.md)

**What to build:** The registry gains a Character Name row with the stored token `{{char}}`, matched in any case with inner spaces. The placeholder resolve options gain an optional character: the resolved name of the entity that owns the text. The resolved-world hook gains one entity-text helper that takes the entity and its text and resolves with that entity as the character. Every consumer of entity descriptions and summaries goes through it: the AI-context build, the entity modal, the game panels, the opening pool at Enter World, and the Test Bench opening path. Opening pool rows already carry the owning entity id.

Demo: paste `{{char}}` into an entity's AI description in the World Editor. Start a game. The AI context and the entity modal show the entity's name. Rename the entity in the editor and reload the save. Both show the new name.

Edge rules: a Character Name chip inside an entity's own name resolves to an empty string. A persona entity that carries the chip resolves to the persona's own name. With no owner the chip resolves to an empty string, like a missing placeholder.

Resolve order stays as it is: author placeholders first, then Built-ins. The entity's own name resolves before it fills Character Name.

Workload: one new seam that must catch every entity-text consumer, and a resolver that composes with the existing name resolution. Missing one consumer shows stale or raw text in play.

- [ ] `resolvePlaceholders` with a character in the options renders Character Name as that name, in any spelling of the token
- [ ] A placeholder inside the owning entity's name resolves before it fills the chip
- [ ] No owner, and a chip inside the entity's own name, each give an empty string
- [ ] The resolved-world hook exposes one entity-text helper, and no consumer of entity descriptions or summaries resolves them any other way
- [ ] The opening pool and the Test Bench opening path pass the owning entity
- [ ] A persona entity carrying the chip resolves to the persona's own name
- [ ] The Player Name render cases still pass
- [ ] Tests at the resolve seam and at the entity-text helper, each guard mutation-proven
- [ ] Changelog In-Progress entry appended (👤)
- [ ] Four gates green; `graphify update .` run
