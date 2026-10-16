# 08: Persona-Change Runs Read The New Cast

Status: done
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the read context is built from live view state that has not re-rendered yet.

## What to build

A persona-change run reads the cast from the world after the change (Q4). `persona`, `entities`, `trait` and the trait scope all come from the new world. A script that reads the persona sees the entity the player plays now.

## Acceptance criteria

- [ ] A persona-change script reads the new persona.
- [ ] A persona-change script reads the new cast of entities.
- [ ] `trait` and the trait scope still come from the new world.
- [ ] Toggle runs are unchanged.
- [ ] Guards fail when the run goes back to the old cast.
