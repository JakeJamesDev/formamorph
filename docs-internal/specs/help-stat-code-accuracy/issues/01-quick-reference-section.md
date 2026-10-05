# 01: Quick Reference Section

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: one docs section that must state every sandbox member correctly, plus a drift test; precision over volume.

## What to build

A player who opens the Stat Code Guide finds one `Quick Reference` section with a table of every sandbox object and its members: `self`, `stats`, `clock`, `traits`, `persona`, `entities`, `placeholders`, `dictionaries`, `console`. Each row gives a read form and a write form as one line of code. The section states the access rules this effort exists for: a stat compares through `.value`, a trait switches through `.enabled`, a played persona's trait is under `persona.traits` with another entity's under `entities.<Name>.traits`, and "after N days" is `clock.day > N`. It holds no example values a small model can copy as content. The Entities and Persona sections gain player wording for entity traits (NPC, companion, custom persona). The Story Clock section gains no keywords.

## Acceptance criteria

- [ ] The section lists every sandbox object the executor injects, and every member of each, in one table
- [ ] A drift test holds the section's member names to the sandbox's own lists; removing a row fails it
- [ ] The persona rule and the `clock.day` form are stated once each, in the section
- [ ] The help-recall blind set is not edited, and the Story Clock keywords are unchanged
- [ ] Changelog fragment written
