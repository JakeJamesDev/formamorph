# 03: Entry fields

Status: done
Base: 77ff1ca6
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Read-only identity and state fields on every entry kind, so authors can branch on what a thing is and see why a switch was ignored (Q9, Q10, Q17).

## Acceptance criteria

- [ ] An entity entry exposes `id`, `type`, `pronouns` and `inScene`. `type` and `pronouns` read `''` when unset. `inScene` follows the turn's scene list, and the played persona reads `true` (Q9).
- [ ] A trait entry, in `traits` and in each entity's `traits`, exposes `id`, `name`, `mode`, `available`, `group` and `playerToggle`. `available` uses the existing gate check for the trait's Bearer. `group` is `''` when ungrouped (Q10).
- [ ] A placeholder entry exposes `id` and `name`. A stat entry exposes `enabled`, false while a trait's stat toggle switches the stat off (Q17).
- [ ] A write to any read-only field is dropped and reported.
- [ ] The surface module lists every new field, and the drift guard holds.
- [ ] Tests at `runStatCodeTurn`, each shown to bite. The changelog line is in In Progress.
