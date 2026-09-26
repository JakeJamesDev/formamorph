# 06: Script Placeholders

Status: in-progress
Base: e1d604d5
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the resolver has owner contexts and pins; a second resolver or the wrong context gives a script a value the prompt contradicts.

## What to build

A Tool script reads `placeholders`, a read-only map from each shared placeholder's name to the text this playthrough resolved, plus a `placeholders` map on each entity item and each dictionary entry item for their owned placeholders. Every value is what a Template chip shows this turn, through the one existing resolver in world mode with the owner-aware context, so pins, rolls, and nested chips agree with the prompt. First name wins on a collision. Placeholders owned by another placeholder are not listed. The code editor lists the names in autocomplete, the item shapes show the new member, and one snippet reads a placeholder. Try It shows sample placeholders with no world open and the open world's values otherwise. The sandbox gains no function and no host call.

## Acceptance criteria

- [ ] Script reads a shared placeholder by name, an entity placeholder from its item, a book placeholder from its entry, a pinned value, and a nested chip fully resolved
- [ ] Script value equals the Template chip value for the same placeholder in the same snapshot
- [ ] Repeated name gives the first placeholder's value; a world with none gives an empty map; a write does not change the value
- [ ] Surface lists `placeholders` with the open world's names, the item members, and the snippet
- [ ] Sample snapshot carries sample placeholders
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
