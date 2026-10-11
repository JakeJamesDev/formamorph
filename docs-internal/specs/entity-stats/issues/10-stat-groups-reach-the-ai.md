# 10: Stat Groups Reach the AI

Status: done
Blocked by: 05, 07, 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a prompt-shape change across the stats chips and the stat request, judged by probe numbers.

Parent: [Entity Stats spec](../spec.md)

## What to build

The AI reads stats in the sections the author wrote. Stats chips, the Entities chip's stats piece and the stat request nest stats under their group headings and descriptions, as the Traits chip nests traits. Rulings Q26, Q28.

## Acceptance criteria

- [ ] Stats chips render stats nested under group headings in each format.
- [ ] The Entities chip's stats piece nests each entity's stats the same way.
- [ ] The stat request's owner sections nest stats under group headings; the schema is unchanged.
- [ ] Ungrouped stats render as before.
- [ ] The entity stats probe meets Q28 on the cloud default model and Cydonia with grouped stats, with flat stats as the in-batch control. Numbers go in the commit body.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
