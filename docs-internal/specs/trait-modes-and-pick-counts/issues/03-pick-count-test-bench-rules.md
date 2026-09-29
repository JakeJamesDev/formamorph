# 03: Pick-count Test Bench rules

Status: ready-for-human
Base: d2ddbd02
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: rules follow an established pattern; the reachability rule reuses the existing least-fixpoint helper.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

Test Bench catches pick-count traps before a player hits them. A world must start with no options changed (Q9), so defaults that don't meet a minimum are an error (Q16). Each rule checks every bearer through the existing lens, including linked groups.

## Acceptance criteria

- [ ] `trait-group-defaults-below-min` (error): the group's defaults don't meet its minimum.
- [ ] `trait-group-min-unreachable` (error): fewer traits in the group can unlock than its minimum. This reuses the never-unlockable least-fixpoint logic.
- [ ] `trait-group-min-above-max` (error).
- [ ] `trait-group-multiple-defaults` becomes a defaults-over-max rule (warning) for any max. Its id and copy change to match.
- [ ] `trait-group-too-small` reads `maxPicks === 1`.
- [ ] Each rule reports per bearer with the group and trait items named, like the existing trait rules.
- [ ] Tests through `runRules`: each rule fires and stays quiet on the valid case, including a linked group on a second bearer. Each guard is shown to bite.
- [ ] The changelog line is in In Progress.
