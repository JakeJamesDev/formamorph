# 06: Script Placeholders

Status: ready-for-human
Base: e1d604d5
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the resolver has owner contexts and pins; a second resolver or the wrong context gives a script a value the prompt contradicts.

## What to build

A Tool script reads `placeholders`, a read-only map from each shared placeholder's name to the text this playthrough resolved, plus a `placeholders` map on each entity item and each dictionary entry item for their owned placeholders. Every value is what a Template chip shows this turn, through the one existing resolver in world mode with the owner-aware context, so pins, rolls, and nested chips agree with the prompt. First name wins on a collision. Placeholders owned by another placeholder are not listed. The code editor lists the names in autocomplete, the item shapes show the new member, and one snippet reads a placeholder. Try It shows sample placeholders with no world open and the open world's values otherwise. The sandbox gains no function and no host call.

## Acceptance criteria

- [x] Script reads a shared placeholder by name, an entity placeholder from its item, a book placeholder from its entry, a pinned value, and a nested chip fully resolved
- [x] Script value equals the Template chip value for the same placeholder in the same snapshot
- [x] Repeated name gives the first placeholder's value; a world with none gives an empty map; a write does not change the value
- [x] Surface lists `placeholders` with the open world's names, the item members, and the snippet
- [x] Sample snapshot carries sample placeholders
- [x] Four gates green, `graphify update .` run, In-Progress changelog entry added

## Comments

- 2026-09-26 (implementer): Values resolve each placeholder's world-mode chip through the scene's own `resolve` and `resolveEntity`, the path a Template chip takes, not through `readPlaceholders`. That call skips Built-ins and needs raw resolve options the snapshot builder does not hold, and it would miss a before box's writes. Book placeholders resolve under the world `resolve`: the resolver has no book owner context, the same as entry values. `CodeSurface.statMaps` now gates the stat-code placeholder-tree rules, so the Tool's flat `placeholders` map gets plain member completion. An unoptioned `authoredChipScene` resolves with fresh rolls, so a multi-value placeholder can differ between a script and a Template there; play and Try It in a game read frozen rolls.
