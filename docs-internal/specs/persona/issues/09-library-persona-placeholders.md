# 09: Library Persona Placeholders

Status: in-progress
Base: 7313b8b4
Blocked by: 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** A library persona that carries placeholders of its own renders complete text in play. When a library persona is set, the session's Placeholder Set is the world's list plus the persona's own list. Rolls for the persona's Wildcards are drawn one time when the persona is set, and they hold across turns and across a switch away and back.

**Rationale for the model:** the placeholder resolver and its session rolls are subtle, and the authored world must stay untouched. A strong model at high effort.

## Acceptance criteria

- [ ] The session's Placeholder Set joins the world's list and the persona's list on the read side only. Gameplay never writes the authored world.
- [ ] Rolls for the persona's Wildcards are drawn when the persona is set, at Enter World or in game, and are stored with the playthrough's other Rolls.
- [ ] A change of persona draws Rolls for the new persona and keeps the old Rolls, so a switch back renders the same values. A test proves it.
- [ ] The Persona chip output resolves the persona's chips. A test reads the rendered prompt and proves that a Wildcard resolves and keeps one value across turns.
- [ ] A save and reload keeps the Rolls. A persona with no placeholders changes nothing.
- [ ] Pins keep their order of precedence over a persona's Rolls.
- [ ] The guard is proven by removing the persona's list from the set and watching the test fail.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

World personas already resolve through the world's own set. If stored Rolls for a persona need a new key shape in the save, state that in the response as a save-shape change.
