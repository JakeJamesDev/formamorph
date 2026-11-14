# 06: Trait switch cause

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: the switch diff mixes causes; attribution must come from the toggle and the script writes without changing the diff's order.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q12).

## What to build

A When a Trait Switches script reads `args.by`. It is `'player'` for the trait the player toggled and `'script'` for a trait a script wrote, World Tools included. Every other switch in the same action reads `'rule'`: exclusive siblings, cascade-offs and gate settles. Switches from the end-of-turn settle, an Option change, a persona change, an item commit and the Inventory pass all read `'rule'`. The `trait` global is unchanged. The guide and hover cards describe the field, and the help vectors are rebuilt.

## Acceptance criteria

- [ ] A toggled trait reads `'player'`; its exclusive sibling and any cascade read `'rule'` (tests).
- [ ] A script's trait write reads `'script'`; the cascade it causes reads `'rule'` (tests).
- [ ] A gate switch at turn end, an Option change and a persona change read `'rule'` (tests).
- [ ] Switch run order is unchanged.
- [ ] Docs and hover cards describe `args.by` for switches; the help vectors are rebuilt.
- [ ] Each guard is shown to bite by reinstating the bug.
