# 14: Show the Stranger Label in Every Roster

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Thinking Mode defaults to Off, and only Precall runs the planner. With Off, Inline or Staged, the narrator lists an unmet stranger under its true name with nothing else, so the true name can reach the prose from the first turn. The narrator must still read the true name to recognize the introduction (Q83). Every prompt that lists an unmet stranger with a Stranger Name also shows the stranger label, the latest story alias else the Stranger Name, as one more roster field, like the planner's Q68 field.

Read `docs-internal/notes/prompt-writing-guide/notes.md` first. The field and any rule line that tells the model how to use it are positive contracts with no example values.

## Acceptance criteria

- [ ] Every prompt whose roster lists an unmet entity with a Stranger Name shows its stranger label field. A met entity, or one without a Stranger Name, renders as today.
- [ ] Narration with Thinking Mode Off refers to an unmet stranger by its label until the story introduces them.
- [ ] A probe on cloud with in-batch controls, old prompt against new with at least 5 runs per arm, reports how often the true name leaks into narration with Thinking Mode Off. The numbers go in the landing message.
- [ ] Precall planning keeps ticket 07's numbers: no new leak, and the alias still matches the label.
- [ ] Request Anatomy shows the field.
