# 08: Player Name Chip

Status: ready-for-human
Status note: The game view is too large to mount, so a source scan guards its three opening sites and a hook test proves the render. The chip is in the `{` menu of prose fields only, not the placeholder strip or name and keyword fields.
Base: 4139c508
Blocked by: 02, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** The user macro that Openings stores, `{{user}}`, becomes the Player Name chip. It renders as the persona's name on every surface. With no persona it renders as "you" in opening text, as built, and as "the player" in world, entity, and dictionary text. World, entity, dictionary, and opening text fields offer it in the chip menu. The character card importer and the lorebook importer write it into descriptions and lore, where they wrote "the player" before.

**Rationale for the model:** the ticket extends a built module that every opening draw calls, and it makes the chip editor show a marker that is not a placeholder. A strong model at high effort.

## Acceptance criteria

- [ ] The existing user-macro module stays the one owner of the stored form and the render. No second token and no second module exist. The render takes the persona's name and the kind of text.
- [ ] With a persona, the marker renders as the name everywhere, and a possessive stays as the text wrote it. With no persona, opening text keeps the built "you" and "your" rules, and world, entity, and dictionary text renders "the player" and "the player's".
- [ ] Every "you" test that Openings built passes unchanged. That suite is the regression guard.
- [ ] Every text that resolves placeholders also renders the marker, in one shared pass, so no reader handles it alone. The three opening render sites in the game view use the same pass.
- [ ] Module tests cover a persona set, no persona on each kind of text, a possessive with and without a persona, and a text that mixes the marker with authored chips.
- [ ] A first draw and a page-one regenerate with a persona render the name into page one. Openings imported before this ticket gain the name with no second import. A test proves both.
- [ ] The chip menu of world, entity, dictionary, and opening text fields offers it. It renders as a chip in the editor, and imported openings that hold the marker as plain text show it as a chip. The text survives a save and reload byte-identical.
- [ ] Design-time readers such as the preview, the Test Bench, and search and replace show the chip by its label and do not treat it as a missing placeholder.
- [ ] The card importer writes the marker into description fields, and the lorebook importer into lore, both through the module's canonical writer. Importer tests assert it. Opening import is unchanged.
- [ ] Entities and lore imported before this ticket keep their plain "the player" text. No migration runs.
- [ ] The response states the export-shape change: the marker can now appear in world, entity, and dictionary text, which an older app version shows as a raw token. Opening text already carries it.
- [ ] The chip menu is checked in the preview through the dev-router.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

A world persona's name resolves through the same chip. The chip carries no pronouns and no description. The known limit that Openings recorded stays: any period counts as a sentence end for the "you" fallback. A page one that is already written keeps its text when the persona changes.
