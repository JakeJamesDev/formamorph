# 04: Owner placeholders

Status: done
Base: 4f85effe
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Owned placeholders are reached through their owner: `entities['X'].placeholders`, `persona.placeholders` and `dictionaries['X'].placeholders` (Q11, Q13). A library persona's and added characters' placeholders become readable and pinnable (Q14). This is the expand step: the old `placeholders.Owner.Name` path still works until ticket 06.

## Acceptance criteria

- [x] Each entity entry carries its placeholder tree, built by the same resolver as `placeholders`, so a node reached by two routes holds one pin state.
- [x] `dictionaries` maps each dictionary by code name, with `id`, `name` and `placeholders`. The later of two same-named dictionaries wins (Q13).
- [x] Play passes the library persona's placeholders to the run. Added characters' placeholders and library dictionaries wait for ticket 07 (Q26). A pin through `persona.placeholders` lands as a Code Pin on that placeholder's id.
- [x] Completions offer each owner's placeholders after `.placeholders`. Rename rewrites the new paths.
- [x] Tests at `runStatCodeTurn`, each shown to bite. The changelog line is in In Progress.

## Notes for review

- Bite run: ten mutations, each failing its tests. Owner nodes left off the entries, the library persona's pool not joined, every library pool joined, library rows listed in `placeholders`, the first same-named dictionary winning, owner nodes left out of the flattened map, the unknown-owner split dropped, the persona rename dropped, `persona.placeholders` completions offering every entity, and a dictionary miss reported as a warning.
- A pin through an unknown entity, an unknown dictionary or the empty persona reports as `unknownOwnerPlaceholders`, apart from `unknownPlaceholders`. The Test Bench and Test Code play no persona, so they would otherwise flag every `persona.placeholders` pin as a typo.
- The Test Bench run now carries the authored entities and dictionaries, so owner paths in it resolve.
- Open for a ruling: a placeholder rename rewrites `persona.placeholders.Old` when any playable entity's own tree moves that key. Where two playable entities both own `Old` and one is renamed, the rewrite breaks the path for the other. `persona.traits` renames work the same way since ticket 02.
- For ticket 07: a miss under `dictionaries.X.placeholders` is an error, since the editor knows every authored book. Once library dictionaries join, it should become a warning, as a miss under an entity is.
- Not done: name-drift has no dictionary case, and the stat code help and templates don't show the new routes yet (ticket 06 rewrites them).
