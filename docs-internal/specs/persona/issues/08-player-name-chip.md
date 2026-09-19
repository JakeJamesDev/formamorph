# 08: Player Name Chip

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** A reserved Player Name chip resolves at render time to the persona's name, or to "the player" with no persona. World, entity, and dictionary text fields offer it in the chip menu. The character card importer and the lorebook importer write it where they wrote "the player" before, so an imported card addresses the persona by name.

**Rationale for the model:** the ticket adds a built-in token beside the placeholder grammar, which the resolver, the chip editor, and two importers all read. A strong model at high effort.

## Acceptance criteria

- [ ] The chip is a fixed token that needs no definition, no Roll, and no home. The placeholder resolver resolves it in the same pass as authored chips, so every text that resolves placeholders gains it.
- [ ] Resolver tests cover a persona set, no persona, and a text that mixes the chip with authored chips.
- [ ] The chip menu of each text field offers it. It renders as a chip in the editor and survives a save and reload byte-identical.
- [ ] Design-time readers such as the preview, the Test Bench, and search and replace show the chip by its label and do not treat it as a missing placeholder.
- [ ] The card importer and the lorebook importer write the chip for the user macro. Importer tests assert it.
- [ ] The stored form equals the form the Openings spec writes for the user macro. Read that spec and its state first. Whichever effort builds second adopts the first one's form, and the ruling goes into both specs.
- [ ] Entities and lore imported before this ticket keep their plain "the player" text. No migration runs.
- [ ] The response states the export-shape change: a reserved chip in world, entity, and dictionary text, which an older app version shows as a raw token.
- [ ] The chip menu is checked in the preview through the dev-router.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

A world persona's name resolves through the same chip. The chip carries no pronouns and no description.
