# 04: Owner placeholders

Status: in-progress
Base: 4f85effe
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Owned placeholders are reached through their owner: `entities['X'].placeholders`, `persona.placeholders` and `dictionaries['X'].placeholders` (Q11, Q13). A library persona's and added characters' placeholders become readable and pinnable (Q14). This is the expand step: the old `placeholders.Owner.Name` path still works until ticket 06.

## Acceptance criteria

- [ ] Each entity entry carries its placeholder tree, built by the same resolver as `placeholders`, so a node reached by two routes holds one pin state.
- [ ] `dictionaries` maps each dictionary by code name, with `id`, `name` and `placeholders`. The later of two same-named dictionaries wins (Q13).
- [ ] Play passes the library persona's placeholders to the run. Added characters' placeholders and library dictionaries wait for ticket 07 (Q26). A pin through `persona.placeholders` lands as a Code Pin on that placeholder's id.
- [ ] Completions offer each owner's placeholders after `.placeholders`. Rename rewrites the new paths.
- [ ] Tests at `runStatCodeTurn`, each shown to bite. The changelog line is in In Progress.
