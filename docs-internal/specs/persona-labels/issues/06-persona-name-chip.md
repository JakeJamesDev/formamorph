# 06: Persona Name Chip

Status: done
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The **Player Name** built-in chip becomes **Persona Name**. Rulings Q6, Q8, Q9, Q16, Q17, Q19. It waits for 01 and 04 because it edits the same Design System and Glossary pages. Sonnet, because the work is a label plus many doc edits with a link check.

## What to build

An author types `{` in a prose field and sees **Persona Name** and **Character Name** under **Built-in**. Typing `{{user}}` still turns into the chip, and a search for "player name" still finds it. The chip reads as before. With a persona, it reads the persona's name. With no persona, it reads "you" in an opening and "the player" elsewhere.

These docs follow:

- Persona Authoring. Its heading becomes "The Persona Name Chip".
- World Editor Placeholders, World Editor Entities and World Editor Openings.
- The Glossary and Home.
- The Design System's Built-in chips section.

The heading's anchor fixture and every link to the old anchor change in the same commit. The help search index is rebuilt.

## Acceptance criteria

- [ ] The chip's label is **Persona Name** in the palette, the `{` menu and the field. Its tooltip uses the same name.
- [ ] Its search terms include `user` and "player name".
- [ ] The `{{user}}` token, the fallback words and the SillyTavern import mapping are unchanged.
- [ ] Built-in placeholder tests assert the label and the "player name" search. Putting back **Player Name** makes them fail.
- [ ] Every listed doc says **Persona Name**. The anchor fixture holds `the-persona-name-chip`, and no doc or code link points at `the-player-name-chip`.
- [ ] `build:help-vectors` ran, and its output is in the commit.
- [ ] A changelog fragment. Four gates green, exit codes read.
