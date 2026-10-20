# 03: You and Persona Rules

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The persona edge cases. They cross the persona resolution, the Persona block and the roster builders, where small mistakes leak an unplayed persona.

## What to build

An author picks **You** as a target, and "Kate is Rowan's mother" renders with whatever persona the player plays. The player's own relatives are known in every scene. Relationships that touch a persona-only entity the player doesn't play stay out of the prompt.

## Acceptance criteria

- [ ] The target dropdown offers You first.
- [ ] You resolves to the played persona's name at render time. No second person form.
- [ ] The Persona block counts as a block for the print-once rule.
- [ ] The played persona counts as present, so its relationships pull targets into the known roster.
- [ ] A relationship with an unplayed persona-only end drops from the prompt, both its line and its pull-in. Ticket 02 pulls such an entity into the known roster. The editor keeps the relationship.
- [ ] Relationships held by a world persona or the Custom Persona entity render like any other.
- [ ] Chip-value tests cover each rule above, under a world persona, a library persona and None.
